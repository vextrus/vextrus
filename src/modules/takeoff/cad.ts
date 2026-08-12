import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph";

/**
 * The cad pipeline seam (ADR-0001): a CLI subprocess, file in → EntityGraph
 * JSON out. No resident service, no health endpoint, no shared state.
 *
 * Every failure mode leaves by name — a non-zero exit, a timeout, a missing
 * artifact, an artifact that fails the contract. None of them may return a
 * zero-entity "success" (the governing sentence).
 */

/** Generous: ingestion is seconds-long, and a slow drawing is not a failure. */
export const CAD_TIMEOUT_MS = 120_000;

function cadDir(): string {
  return (
    process.env.VEXTRUS_CAD_DIR ??
    path.resolve(import.meta.dirname, "../../../cad")
  );
}

/** stderr is the CLI's refusal channel; keep the tail, not a novel. */
function tail(text: string, max = 800): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `…${trimmed.slice(-max)}` : trimmed;
}

class CadError extends Error {
  constructor(message: string) {
    super(`cad ingest failed: ${message}`);
    this.name = "CadError";
  }
}

type Run = { code: number | null; timedOut: boolean; stderr: string };

function run(args: string[], timeoutMs: number): Promise<Run> {
  return new Promise((resolve, reject) => {
    // stdout is ignored on purpose: the artifact always arrives via `-o`, and
    // an unread pipe would block the CLI at 64KB. stderr is the refusal
    // channel and is drained below.
    const child = spawn("uv", args, {
      cwd: cadDir(),
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let settled = false;
    const settle = (run: Run) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(run);
    };
    // Our own timer, and it resolves the promise itself rather than waiting
    // for `close`: `uv run` forks python as a grandchild that inherits the
    // stderr pipe, so `close` may not fire until that orphan exits — waiting
    // for it would be the very hang the timeout exists to prevent. (Windows
    // also does not report the killing signal, so "did we kill it" is a flag.)
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle({ code: null, timedOut: true, stderr });
    }, timeoutMs);
    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new CadError(`could not run the cad CLI (${err.message})`));
    });
    child.on("close", (code) => {
      settle({ code, timedOut: false, stderr });
    });
  });
}

/**
 * Ingest `dxfPath` into `outPath` and return the parsed artifact. `outPath` is
 * written by the CLI itself — shell redirection re-encodes stdout under
 * PowerShell and corrupts the JSON (cad/__main__.py).
 */
export async function runCadIngest(
  dxfPath: string,
  outPath: string,
  timeoutMs = CAD_TIMEOUT_MS,
): Promise<EntityGraph> {
  const result = await run(
    ["run", "python", "-m", "vextrus_cad", "ingest", dxfPath, "-o", outPath],
    timeoutMs,
  );
  if (result.timedOut) {
    throw new CadError(`timed out after ${timeoutMs}ms`);
  }
  if (result.code !== 0) {
    throw new CadError(
      `the CLI exited ${result.code ?? "on a signal"}: ${
        tail(result.stderr) || "no diagnostic on stderr"
      }`,
    );
  }
  let raw: string;
  try {
    raw = await readFile(outPath, "utf-8");
  } catch (err) {
    throw new CadError(
      `the CLI exited 0 but wrote no artifact (${(err as Error).message})`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CadError(`the artifact is not JSON (${(err as Error).message})`);
  }
  const graph = entityGraphSchema.safeParse(parsed);
  if (!graph.success) {
    throw new CadError(
      `the artifact does not meet the EntityGraph contract: ${graph.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return graph.data;
}
