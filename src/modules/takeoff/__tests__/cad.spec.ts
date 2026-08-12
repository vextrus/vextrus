import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entityGraphSchema } from "@/core/entitygraph";
import { runCadIngest } from "@/modules/takeoff";

/**
 * The subprocess seam (ADR-0001), against the real CLI — the pipeline is
 * already inside `pnpm verify` (ruff + pytest), so the boundary it is reached
 * across belongs there too. Every refusal must arrive by name: a corrupt
 * drawing may not return a zero-entity "success" (the governing sentence).
 */

const fixtures = path.resolve(import.meta.dirname, "../../../../cad/tests/fixtures");
let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "vextrus-cad-spec-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("the cad ingest subprocess", () => {
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
