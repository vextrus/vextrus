import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { ingestDrawingRevision } from "@/modules/takeoff";

/**
 * The ingest record through the seam (cad-ingestion.md §2–§3; ADR-0004): one immutable row per
 * run, counters verbatim, extractor identity pinned, and a revision the tenant cannot see is a
 * named refusal — never a row. Live Postgres via `pnpm test:db`; the extractor runs for real.
 */
let tenantA: string;
let tenantB: string;
let revisionA: string;
let revisionB: string;
const r1 = {
  filename: "structural-r1.dxf",
  bytes: new Uint8Array(readFileSync(path.resolve(process.cwd(), "cad/tests/fixtures/structural-r1.dxf"))),
};

beforeAll(async () => {
  process.env.VEXTRUS_STORAGE_ROOT = mkdtempSync(path.join(os.tmpdir(), "vextrus-ingest-db-"));
  await runAsSystem("ingest dbspec setup", async (tx) => {
    for (const who of ["a", "b"] as const) {
      const [t] = await tx.insert(schema.tenants).values({ name: `dbspec ingest ${who}`, slug: `dbspec-ing-${who}-${crypto.randomUUID()}` }).returning();
      if (!t) throw new Error("setup failed");
      const [p] = await tx.insert(schema.projects).values({ tenantId: t.id, name: "ingest project" }).returning();
      if (!p) throw new Error("setup failed");
      const [d] = await tx.insert(schema.drawings).values({ tenantId: t.id, projectId: p.id, title: "S-01" }).returning();
      if (!d) throw new Error("setup failed");
      const [r] = await tx.insert(schema.drawingRevisions).values({ tenantId: t.id, projectId: p.id, drawingId: d.id, label: "R1" }).returning();
      if (!r) throw new Error("setup failed");
      if (who === "a") {
        tenantA = t.id;
        revisionA = r.id;
      } else {
        tenantB = t.id;
        revisionB = r.id;
      }
    }
  });
});

afterAll(async () => {
  await runAsSystem("ingest dbspec teardown", async (tx) => {
    for (const id of [tenantA, tenantB]) {
      for (const table of [schema.ingests, schema.drawingRevisions, schema.drawings, schema.projects]) {
        await tx.delete(table).where(eq(table.tenantId, id));
      }
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, id));
    }
  });
});

function messagesOf(err: unknown): string {
  const messages: string[] = [];
  for (let e = err; e instanceof Error; e = e.cause) messages.push(e.message);
  return messages.join(" | ");
}

describe("ingestDrawingRevision", () => {
  it("records exactly one row per run, counters and unit verbatim, extractor identity pinned", async () => {
    const out = await ingestDrawingRevision(mintTenantCtx(tenantA), { drawingRevisionId: revisionA, upload: r1 });
    if (!out.ok) throw new Error(`${out.cause}: ${out.detail}`);
    const rows = await forTenant(mintTenantCtx(tenantA), (tx) => tx.select().from(schema.ingests));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error("expected a row");
    expect(row.id).toBe(out.extraction.ingestId);
    expect(row.drawingRevisionId).toBe(revisionA);
    expect([row.original, row.derived, row.explodeTruncated]).toEqual([59, 49, false]);
    expect(row.lostByType).toEqual({});
    expect(row.unsupportedByType).toEqual({ POINT: 4 });
    expect([row.insunits, row.unitDetected, row.insunitsUnmapped]).toEqual([4, "mm", false]);
    expect(row.uploadSha256).toBe(out.extraction.upload.sha256);
    expect(row.artifactRef).toBe(out.extraction.artifact.ref);
    expect(row.extractorVersion).toBe(out.extraction.extractor.version);
    expect(row.extractorParameterHash).toBe(out.extraction.extractor.parameterHash);
    // Immutable: the artifact froze at ingest.
    let refused: unknown;
    try {
      await forTenant(mintTenantCtx(tenantA), (tx) => tx.update(schema.ingests).set({ original: 0 }).where(eq(schema.ingests.id, row.id)));
    } catch (err) {
      refused = err;
    }
    expect(messagesOf(refused)).toMatch(/permission denied/i);
  });

  it("refuses by name a revision the tenant cannot see — no row, no subprocess", async () => {
    const out = await ingestDrawingRevision(mintTenantCtx(tenantA), { drawingRevisionId: revisionB, upload: r1 });
    expect(out).toMatchObject({ ok: false, cause: "DRAWING_REVISION_NOT_FOUND" });
    const rows = await forTenant(mintTenantCtx(tenantB), (tx) => tx.select().from(schema.ingests));
    expect(rows).toHaveLength(0);
  });
});
