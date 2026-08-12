import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/core/auth";
import { mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { claimIngestJob } from "@/core/queue";
import { createIngest, failIngest } from "@/core/register";
import { readArtifact } from "@/core/storage";
import { createCaller } from "@/server/router";
import { runOnce } from "@/server/worker";

/**
 * Ticket 04 exit criteria against a live Postgres and the real cad CLI
 * (`pnpm test:db`): upload a fixture → a queued job → the worker runs the
 * pipeline as a subprocess → artifact reference and fidelity counters read
 * back through tRPC. And the loud half: a corrupt DXF ends as a *failed*
 * ingest with a named error — never a hang, never a zero-entity success.
 */

const fixtures = path.resolve(
  import.meta.dirname,
  "../../../cad/tests/fixtures",
);
const email = `ingest-${crypto.randomUUID()}@ingest-dbspec.local`;
const password = "ingest-dbspec-password";

let storageRoot: string;
let caller: ReturnType<typeof createCaller>;
let projectId: string;
let drawingId: string;
let tenantId: string;
let userId: string;

beforeAll(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "vextrus-ingest-dbspec-"));
  process.env.VEXTRUS_STORAGE_ROOT = storageRoot;

  const res = await auth.api.signUpEmail({
    body: { email, password, name: "Ingest Dbspec" },
    asResponse: true,
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  caller = createCaller({ headers: new Headers({ cookie }) });
  const me = await caller.me();
  tenantId = me.tenant.id;
  userId = me.user.id;
  const project = await caller.projects.create({ name: "Ingest Tower" });
  projectId = project.id;
  const drawing = await caller.drawings.create({
    projectId,
    title: "STRUCTURAL LAYOUT",
    disciplineProposed: "structural",
  });
  drawingId = drawing.id;
});

afterAll(async () => {
  await rm(storageRoot, { recursive: true, force: true });
  await runAsSystem("ingest dbspec teardown", async (tx) => {
    for (const table of [
      schema.ingestJobs,
      schema.ingests,
      schema.drawingRevisions,
      schema.drawings,
      schema.projects,
      schema.memberships,
    ] as const) {
      await tx.delete(table).where(eq(table.tenantId, tenantId));
    }
    await tx.delete(schema.users).where(inArray(schema.users.id, [userId]));
    await tx.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
  });
});

async function upload(fixture: string, bytes: Uint8Array) {
  return caller.drawings.uploadRevision({
    projectId,
    drawingId,
    filename: fixture,
    contentBase64: Buffer.from(bytes).toString("base64"),
  });
}

async function statusOf(revisionId: string) {
  const rows = await caller.drawings.status({ drawingId });
  const row = rows.find((r) => r.revisionId === revisionId);
  if (!row) throw new Error(`revision ${revisionId} missing from the status`);
  return row;
}

describe("upload → job → worker → counters", () => {
  it("lands the fixture's artifact and its fidelity counters, visible via tRPC", async () => {
    const bytes = await readFile(path.join(fixtures, "structural-r1.dxf"));
    const uploaded = await upload("structural-r1.dxf", bytes);
    expect(uploaded.seq).toBe(1);
    expect(uploaded.status).toBe("pending");
    // queued, not run inline: the answer is not there yet, and says so
    expect((await statusOf(uploaded.revisionId)).status).toBe("pending");

    const outcome = await runOnce();
    expect(outcome).toMatchObject({
      result: "succeeded",
      ingestId: uploaded.ingestId,
    });

    const status = await statusOf(uploaded.revisionId);
    expect(status.status).toBe("succeeded");
    expect(status.error).toBeNull();
    expect(status.artifactRef).toBeTruthy();
    // the counters are the artifact's own, carried across verbatim
    const committed = JSON.parse(
      await readFile(
        path.join(fixtures, "structural-r1.entitygraph.json"),
        "utf-8",
      ),
    ) as { counters: Record<string, unknown> };
    expect(status.fidelity).toMatchObject({
      entitiesOriginal: committed.counters.original,
      entitiesDerived: committed.counters.derived,
      explodeTruncated: committed.counters.explode_truncated,
      lostByType: committed.counters.lost_by_type,
      unsupportedByType: committed.counters.unsupported_by_type,
    });
    // and the artifact itself is on disk under the reference the row cites
    const stored = JSON.parse(
      (await readArtifact(status.artifactRef ?? "")).toString("utf-8"),
    ) as { artifact: string };
    expect(stored.artifact).toBe("vextrus.entitygraph");
    // an unhandled entity type is surfaced, never summarised away
    const unsupported = committed.counters.unsupported_by_type as Record<
      string,
      number
    >;
    if (Object.keys(unsupported).length > 0) {
      expect(status.warnings.join(" ")).toMatch(/does not handle/);
    }
  });

  it("a second upload of the same drawing takes the next seq", async () => {
    const bytes = await readFile(path.join(fixtures, "structural-r2.dxf"));
    const uploaded = await upload("structural-r2.dxf", bytes);
    expect(uploaded.seq).toBe(2);
    expect(await runOnce()).toMatchObject({ result: "succeeded" });
    expect((await statusOf(uploaded.revisionId)).status).toBe("succeeded");
  });

  it("a corrupt DXF fails loudly with a named error", async () => {
    const uploaded = await upload(
      "corrupt.dxf",
      new TextEncoder().encode("this is not a DXF file at all\n"),
    );
    const outcome = await runOnce();
    expect(outcome.result).toBe("failed");

    const status = await statusOf(uploaded.revisionId);
    expect(status.status).toBe("failed");
    expect(status.error).toMatch(/cad ingest failed/);
    // no half-success residue: no artifact, no counters to price against
    expect(status.artifactRef).toBeNull();
    expect(status.fidelity).toBeNull();
    // the job records the same named failure
    const [job] = await runAsSystem("ingest dbspec: read the job", (tx) =>
      tx
        .select()
        .from(schema.ingestJobs)
        .where(eq(schema.ingestJobs.ingestId, uploaded.ingestId)),
    );
    expect(job?.status).toBe("failed");
    expect(job?.error).toMatch(/cad ingest failed/);
  });

  it("refuses a source that is not a DXF, before anything is queued", async () => {
    await expect(
      upload("schedule.pdf", new TextEncoder().encode("%PDF-1.7\n")),
    ).rejects.toThrow(/dxf/i);
  });

  it("refuses a drawing that is not this project's, before it costs disk", async () => {
    const other = await caller.projects.create({ name: "Ingest Annex" });
    const before = await readdir(storageRoot, { recursive: true });
    await expect(
      caller.drawings.uploadRevision({
        projectId: other.id, // the drawing belongs to Ingest Tower
        drawingId,
        filename: "structural-r1.dxf",
        contentBase64: (
          await readFile(path.join(fixtures, "structural-r1.dxf"))
        ).toString("base64"),
      }),
    ).rejects.toThrow(/not in project/);
    expect(await readdir(storageRoot, { recursive: true })).toEqual(before);
  });

  it("shows the newest ingest of a revision, never a superseded one", async () => {
    const bytes = await readFile(path.join(fixtures, "structural-r1.dxf"));
    const uploaded = await upload("structural-r1.dxf", bytes);
    await runOnce();
    expect((await statusOf(uploaded.revisionId)).status).toBe("succeeded");
    // a re-run is a new ingest against the same revision; the older one must
    // not be what the drawing's screen reads
    const superseding = await createIngest(mintTenantCtx(tenantId), {
      projectId,
      drawingRevisionId: uploaded.revisionId,
    });
    const rows = await caller.drawings.status({ drawingId });
    const forRevision = rows.filter((r) => r.revisionId === uploaded.revisionId);
    expect(forRevision).toHaveLength(1); // one row per revision, not one per run
    expect(forRevision[0]?.status).toBe("pending");
    expect(forRevision[0]?.artifactRef).toBeNull();
    await failIngest(mintTenantCtx(tenantId), {
      ingestId: superseding.id,
      error: "dbspec: closing the superseding run",
    });
  });

  it("reclaims a job a dead worker left running past its lease", async () => {
    const bytes = await readFile(path.join(fixtures, "structural-r1.dxf"));
    const uploaded = await upload("structural-r1.dxf", bytes);
    // a worker claimed this and died: running, lease long expired
    await runAsSystem("ingest dbspec: simulate a dead worker", (tx) =>
      tx
        .update(schema.ingestJobs)
        .set({
          status: "running",
          attempts: 1,
          lockedAt: new Date(Date.now() - 60 * 60_000),
        })
        .where(eq(schema.ingestJobs.ingestId, uploaded.ingestId)),
    );
    const reclaimed = await claimIngestJob();
    expect(reclaimed?.ingestId).toBe(uploaded.ingestId);
    expect(reclaimed?.attempts).toBe(2);
    // and it is not claimable again while this claim's lease holds
    expect(await claimIngestJob()).toBeUndefined();
  });

  it("an empty queue is idle, not a silent success", async () => {
    expect(await runOnce()).toEqual({ result: "idle" });
  });
});
