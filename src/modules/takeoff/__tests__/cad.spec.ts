import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entityGraphSchema } from "@/core/entitygraph";
import { CAD_TIMEOUT_MS, runCadIngest } from "@/modules/takeoff";

/**
 * The subprocess seam (ADR-0001), against the real CLI — the pipeline is
 * already inside `pnpm verify` (ruff + pytest), so the boundary it is reached
 * across belongs there too. Every refusal must arrive by name: a corrupt
 * drawing may not return a zero-entity "success" (the governing sentence).
 */

const fixtures = path.resolve(import.meta.dirname, "../../../../cad/tests/fixtures");
let workDir: string;

/**
 * Above the config's general net (vitest.config.ts), for a reason particular to
 * this suite: it is the only one whose seam declares a tolerance of its own.
 * The bound must sit ABOVE CAD_TIMEOUT_MS, never below it. Below it, the seam
 * is allowed 120s while the runner kills it first, and a hung pipeline is
 * reported as "Test timed out", an anonymous message naming neither cause nor
 * repair. Above it, the seam's timer always fires first and the refusal arrives
 * by name — "cad ingest failed: timed out after 120000ms".
 *
 * Derived from the seam rather than picked, so the two cannot drift apart.
 */
const SUITE_TIMEOUT_MS = CAD_TIMEOUT_MS + 30_000;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "vextrus-cad-spec-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("the cad ingest subprocess", { timeout: SUITE_TIMEOUT_MS }, () => {
  it("ingests the fixture into the artifact the pipeline committed", async () => {
    const out = path.join(workDir, "r1.entitygraph.json");
    const graph = await runCadIngest(
      path.join(fixtures, "structural-r1.dxf"),
      out,
    );
    const committed = entityGraphSchema.parse(
      JSON.parse(
        await readFile(
          path.join(fixtures, "structural-r1.entitygraph.json"),
          "utf-8",
        ),
      ),
    );
    // the TS side parses what the Python side emits, counters included —
    // drift on either side goes red here
    expect(graph.counters).toEqual(committed.counters);
    expect(graph.source.sha256).toBe(committed.source.sha256);
    expect(graph.entities).toHaveLength(committed.entities.length);
  });

  it("refuses a corrupt drawing by name, never as an empty success", async () => {
    const corrupt = path.join(workDir, "corrupt.dxf");
    await writeFile(corrupt, "this is not a DXF file at all\n");
    await expect(
      runCadIngest(corrupt, path.join(workDir, "corrupt.json")),
    ).rejects.toThrow(/cad ingest failed: the CLI exited 1/);
  });

  it("refuses a drawing that is not there", async () => {
    await expect(
      runCadIngest(
        path.join(workDir, "absent.dxf"),
        path.join(workDir, "absent.json"),
      ),
    ).rejects.toThrow(/cad ingest failed/);
  });

  it("refuses rather than hangs when the pipeline outruns its timeout", async () => {
    await expect(
      runCadIngest(
        path.join(fixtures, "structural-r1.dxf"),
        path.join(workDir, "timeout.json"),
        1,
      ),
    ).rejects.toThrow(/timed out after 1ms/);
  });
});
