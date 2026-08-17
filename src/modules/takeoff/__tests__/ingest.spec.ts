import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mintTenantCtx } from "@/core/db";
import { INGEST_PARAMETERS, ingestParameterHash } from "@/core/ingest-contract";
import { sourceKeysOf } from "@/core/model";
import { extractUpload, INGEST_REFUSAL_CAUSES } from "../ingest";

/**
 * The ingest lane's half of the refusal register (issue #99; the model seam's half is
 * `src/core/__tests__/model.spec.ts`). Every member of INGEST_REFUSAL_CAUSES is either driven by
 * a test below — which adds it to `observed` — or declared in `deferred` with the reason it is
 * not and where it is instead. The `afterAll` at the foot of this file compares the union with
 * the enum both ways, so a cause added with neither turns verify red, and so does a deferral for
 * a cause that no longer exists. A declared deferral with a named reason is lawful
 * (`quantity-contract.md` §4); a silent gap is the one condemned state.
 */
const observed = new Set<string>();
const deferred: Readonly<Record<string, string>> = {
  // Needs a live drawing revision to be absent, so it is the seam test's:
  DRAWING_REVISION_NOT_FOUND: "db/__tests__/ingest.dbspec.ts — refuses an unknown revision id",
  // Boundary arms over the extractor's output. `cad/` writes a conforming artifact citing the
  // bytes it read, by construction, so neither can fire while it is the only extractor: there is
  // no seam to inject an artifact. They become drivable the day a second extractor or a
  // recorded-artifact seam lands, and this entry is what will fail then — a deferral with a
  // named reason, never an exemption.
  ARTIFACT_MALFORMED: "unreachable while cad/ is the only extractor — no artifact-injection seam",
  SOURCE_MISMATCH: "unreachable while cad/ is the only extractor — no artifact-injection seam",
};

/**
 * Ingest through the real subprocess (cad-ingestion.md §2–§3, §12; ADR-0001), against the
 * committed fixture, into a temp storage root. Pure of the database — the `ingests` row is the
 * seam test's (db/__tests__/ingest.dbspec.ts). The counters are pinned: a lower count means
 * stale pipeline code (§12), and a cap that trips must say so (§3).
 */
const fixtures = path.resolve(process.cwd(), "cad/tests/fixtures");
const r1 = { filename: "structural-r1.dxf", bytes: new Uint8Array(readFileSync(path.join(fixtures, "structural-r1.dxf"))) };
const ctx = mintTenantCtx("00000000-0000-0000-0000-00000000c0de");
const revisionId = "00000000-0000-0000-0000-0000000000a1";
let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "vextrus-ingest-"));
  process.env.VEXTRUS_STORAGE_ROOT = root;
});

describe("extractUpload", () => {
  it("ingests the structural fixture through cad/ and reads the pinned counters verbatim", async () => {
    const out = await extractUpload(ctx, revisionId, r1);
    if ("ok" in out) throw new Error(`${out.cause}: ${out.detail}`);
    const { graph } = out.artifact;
    expect(graph.counters).toEqual({
      original: 59,
      derived: 49,
      explode_truncated: false,
      flatten_capped: 1,
      lost_by_type: {},
      unsupported_by_type: { POINT: 4 },
    });
    expect(graph.units).toEqual({ insunits: 4, detected: "mm", insunits_unmapped: false });
    // Storage holds the bytes; the record holds references and digests (never blobs).
    const uploadSha = createHash("sha256").update(r1.bytes).digest("hex");
    expect(out.upload.sha256).toBe(uploadSha);
    expect(graph.source.sha256).toBe(uploadSha);
    expect(out.upload.ref).toBe(path.join(ctx.tenantId, revisionId, "uploads", `${uploadSha}.dxf`));
    expect(existsSync(path.join(root, out.upload.ref))).toBe(true);
    expect(out.artifact.ref).toBe(path.join(ctx.tenantId, revisionId, "artifacts", `${out.ingestId}.entitygraph.json`));
    expect(createHash("sha256").update(readFileSync(path.join(root, out.artifact.ref))).digest("hex")).toBe(out.artifact.sha256);
    // Extractor identity: version + parameter-set hash (cad-ingestion.md §2).
    expect(out.extractor.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(out.extractor.parameters).toEqual(INGEST_PARAMETERS);
    expect(out.extractor.parameterHash).toBe(ingestParameterHash(INGEST_PARAMETERS));
    // Every original entity is a DXF_HANDLE source key, read off the artifact, never minted here.
    expect(sourceKeysOf(graph).size).toBe(59);
    expect(sourceKeysOf(graph).has("DXF_HANDLE:A1")).toBe(true);
  });

  it("surfaces a tripped cap: explode_truncated and per-type losses, never one silent scalar", async () => {
    const out = await extractUpload(ctx, revisionId, r1, { explodeDepth: 4, derivedBudget: 3 });
    if ("ok" in out) throw new Error(`${out.cause}: ${out.detail}`);
    const { counters } = out.artifact.graph;
    expect(counters.explode_truncated).toBe(true);
    expect(counters.original).toBe(59);
    expect(counters.derived).toBe(3);
    const lost = Object.values(counters.lost_by_type).reduce((a, b) => a + b, 0);
    expect(lost).toBe(49 - 3);
    expect(Object.keys(counters.lost_by_type).length).toBeGreaterThan(0);
    // A different parameter set is a different extractor identity.
    expect(out.extractor.parameterHash).not.toBe(ingestParameterHash(INGEST_PARAMETERS));
  });

  it("reports an unmapped $INSUNITS as null + flagged; nothing multiplies geometry", async () => {
    // The fixture is ASCII DXF: the header carries `$INSUNITS / 70 / 4`; code 14 is unmapped.
    const text = Buffer.from(r1.bytes).toString("utf-8").replace(/\$INSUNITS\r?\n\s*70\r?\n4/, "$INSUNITS\n 70\n14");
    expect(text).not.toBe(Buffer.from(r1.bytes).toString("utf-8"));
    const out = await extractUpload(ctx, revisionId, { filename: "structural-r1-unmapped.dxf", bytes: new Uint8Array(Buffer.from(text)) });
    if ("ok" in out) throw new Error(`${out.cause}: ${out.detail}`);
    expect(out.artifact.graph.units).toEqual({ insunits: 14, detected: null, insunits_unmapped: true });
    expect(out.artifact.graph.counters.original).toBe(59);
  });

  it("refuses by name: a file type the lane cannot ingest, and a file the extractor rejects", async () => {
    const dwg = await extractUpload(ctx, revisionId, { filename: "plan.dwg", bytes: r1.bytes });
    expect(dwg).toMatchObject({ ok: false, cause: "UNSUPPORTED_FILE_TYPE" });
    observed.add("UNSUPPORTED_FILE_TYPE");
    const junk = await extractUpload(ctx, revisionId, { filename: "junk.dxf", bytes: new Uint8Array(Buffer.from("not a drawing")) });
    expect(junk).toMatchObject({ ok: false, cause: "EXTRACTOR_FAILED" });
    if (!("ok" in junk) || junk.ok) throw new Error("expected refusal");
    expect(junk.detail.length).toBeGreaterThan(0);
    observed.add("EXTRACTOR_FAILED");
  });
});

// Runs after every test above, so it is independent of their order (cad-ingestion.md §2).
afterAll(() => {
  expect([...observed, ...Object.keys(deferred)].sort()).toEqual([...INGEST_REFUSAL_CAUSES].sort());
});
