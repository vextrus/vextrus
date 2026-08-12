import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { entityGraphSchema } from "@/core/entitygraph";
import {
  confirmDiscipline,
  createDrawing,
  createDrawingRevision,
  createIngest,
  createProject,
  listRefusedSightings,
  listRegisterObjectSightings,
  listRegisterObjects,
  registerSightings,
  type RegistrationOutcome,
  type Sighting,
} from "@/core/register";
import {
  carryBounds,
  georeferenceGrid,
  partitionViews,
  placeInstances,
} from "@/modules/takeoff";

/**
 * **The map's destination test** (ticket 08): the committed revision pair,
 * ingested against one project, produces a **delta and not a do-over**. One
 * column nudged, one deleted, one added off the schedule's witness, and the
 * sheet retitled — and the register comes out with the identical identity keys
 * for every member that survived, the nudged member's frozen ordinal intact,
 * the deleted member's ordinal retired by name, and nothing orphaned.
 *
 * This is the moat. If it fails, every downstream link — pricing, estimate,
 * bid — orphans itself on the next revision of any drawing.
 */

const fixtures = path.resolve(import.meta.dirname, "../../cad/tests/fixtures");

function walk(rev: 1 | 2): { sightings: Sighting[]; bounds: Record<string, number> } {
  const graph = entityGraphSchema.parse(
    JSON.parse(readFileSync(path.join(fixtures, `structural-r${rev}.entitygraph.json`), "utf-8")),
  );
  const partition = partitionViews(graph);
  const backbones = georeferenceGrid(graph, partition);
  const placements = placeInstances(graph, partition, backbones);
  expect(placements).toHaveLength(1);
  return {
    sightings: placements[0]!.instances,
    bounds: carryBounds(placements, backbones),
  };
}

let tenantId: string;
let actorId: string;
let projectId: string;
let drawingId: string;
const ctx = () => mintTenantCtx(tenantId);

/** Rev 1's outcome, then rev 2's — one drawing, two revisions, two ingests. */
let first: RegistrationOutcome;
let second: RegistrationOutcome;
const ingestIds: Record<number, string> = {};

async function ingestRevision(rev: 1 | 2): Promise<RegistrationOutcome> {
  const revision = await createDrawingRevision(ctx(), {
    projectId,
    drawingId,
    seq: rev,
    sourceFilename: `structural-r${rev}.dxf`,
    sourceRef: `artifacts/dbspec/structural-r${rev}.dxf`,
    sourceSha256: String(rev).repeat(64),
  });
  const ingest = await createIngest(ctx(), { projectId, drawingRevisionId: revision.id });
  ingestIds[rev] = ingest.id;
  const { sightings, bounds } = walk(rev);
  return registerSightings(ctx(), {
    projectId,
    drawingId,
    ingestId: ingest.id,
    sightings,
    carryBounds: bounds,
  });
}

beforeAll(async () => {
  await runAsSystem("revision delta dbspec setup", async (tx) => {
    const [tenant] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec Delta", slug: `dbspec-delta-${crypto.randomUUID()}` })
      .returning();
    const [actor] = await tx
      .insert(schema.users)
      .values({ email: `delta-${crypto.randomUUID()}@dbspec.local`, name: "QS" })
      .returning();
    if (!tenant || !actor) throw new Error("setup failed");
    tenantId = tenant.id;
    actorId = actor.id;
    await tx.insert(schema.memberships).values({ tenantId, userId: actorId, role: "owner" });
  });
  projectId = (await createProject(ctx(), { name: "Delta Tower" })).id;
  drawingId = (await createDrawing(ctx(), { projectId, title: "STRUCTURAL" })).id;
  await confirmDiscipline(ctx(), actorId, { projectId, drawingId, discipline: "structural" });
  first = await ingestRevision(1);
  second = await ingestRevision(2);
});

afterAll(async () => {
  await runAsSystem("revision delta dbspec teardown", async (tx) => {
    for (const table of [
      schema.refusedSightings,
      schema.registerObjectSightings,
      schema.registerObjects,
      schema.acts,
      schema.ingests,
      schema.drawingRevisions,
      schema.drawings,
      schema.projects,
      schema.memberships,
    ] as const) {
      await tx.delete(table).where(eq(table.tenantId, tenantId));
    }
    await tx.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    await tx.delete(schema.users).where(eq(schema.users.id, actorId));
  });
});

const NUDGED = "layout_plan:E6|C1|10300.0|9000.0";
const WAS_NUDGED = "layout_plan:E6|C1|10000.0|9000.0";
const DELETED = "layout_plan:E6|C1|0.0|9000.0";

describe("the revision delta", () => {
  it("registers rev 1's nine columns, then reports rev 2 as a delta", () => {
    expect(first.registered).toHaveLength(9);
    expect(first.unchanged).toEqual([]);
    expect(first.represented).toEqual([]);
    expect(first.removed).toEqual([]);
    expect(first.refused).toEqual([]);

    // rev 2 originates nothing and refuses nothing: eight survivors and one
    // named loss, out of a sheet that was redrawn
    expect(second.registered).toEqual([]);
    expect(second.refused).toEqual([]);
    expect(second.unchanged).toHaveLength(2);
    expect(second.represented).toHaveLength(6);
    expect(second.removed).toHaveLength(1);
  });

  it("keeps an identical multiset of identity keys for every surviving member", () => {
    const before = new Map(
      first.registered.map((r) => [r.claim.sighting.placementKey, r.claim.key] as const),
    );
    const survivors = [...second.unchanged, ...second.represented];
    for (const { claim } of survivors) {
      const key = claim.carry === "NUDGED" ? before.get(WAS_NUDGED) : before.get(claim.sighting.placementKey);
      expect(claim.key).toBe(key);
    }
    // the multiset itself: rev 1's keys, minus exactly the deleted member's
    const retired = `${second.removed[0]!.object.mark}#${second.removed[0]!.object.ordinal}`;
    expect(survivors.map((s) => s.claim.key).sort()).toEqual(
      [...before.values()].filter((k) => k !== retired).sort(),
    );
  });

  it("carries the nudged column's frozen ordinal, and never onto a sibling", () => {
    const nudged = second.represented.find((r) => r.claim.sighting.placementKey === NUDGED)!;
    const wasRegistered = first.registered.find(
      (r) => r.claim.sighting.placementKey === WAS_NUDGED,
    )!;
    // the same register row — position moved, identity did not
    expect(nudged.object.id).toBe(wasRegistered.object.id);
    expect(nudged.claim.key).toBe("C1#4");
    expect(nudged.claim.ordinal).toBe(wasRegistered.claim.ordinal);
    expect(nudged.claim.carry).toBe("NUDGED");
    expect(nudged.claim.reason).toMatch(/moved 300.0 drawing units/);

    // the deleted member's ordinal is retired, not reused
    const deleted = first.registered.find((r) => r.claim.sighting.placementKey === DELETED)!;
    expect(deleted.claim.key).toBe("C1#2");
    expect(second.removed[0]!.object.id).toBe(deleted.object.id);
    expect(second.removed[0]!.vacated.reason).toMatch(/absent from this revision/);
    expect(
      [...second.unchanged, ...second.represented].filter(
        (s) => s.claim.mark === "C1" && s.claim.ordinal === 2,
      ),
    ).toEqual([]);
  });

  it("leaves every frozen ordinal on the register exactly where rev 1 put it", async () => {
    const objects = await listRegisterObjects(ctx(), projectId);
    // no row was added, none was rewritten, none was deleted — a revision is a
    // delta over the register, never a rebuild of it
    expect(objects).toHaveLength(9);
    expect(
      objects.map((o) => `${o.mark}#${o.ordinal}=${o.id}`).sort(),
    ).toEqual(
      first.registered.map((r) => `${r.object.mark}#${r.object.ordinal}=${r.object.id}`).sort(),
    );
    for (const object of objects) {
      expect(object.levelBasis).toBe("UNRESOLVED");
      expect(object.elementType).toBe("column");
    }
  });

  it("re-presents a member whose cited evidence moved, unchanged as it looks", async () => {
    // (B,2)'s C3 did not move an inch; the revision handed it different DXF
    // handles, and a stale lineage may never ride forward invisibly (§5)
    const c3 = second.represented.find((r) => r.claim.sighting.mark === "C3")!;
    expect(c3.claim.carry).toBe("EXACT");
    expect(c3.claim.key).toBe("C3");
    const sightings = await listRegisterObjectSightings(ctx(), projectId);
    const rows = sightings
      .filter((s) => s.registerObjectId === c3.object.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // one identity, two revisions of evidence — the rev-1 sighting is not
    // rewritten, it is superseded
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.placementKey)).toEqual([
      c3.claim.sighting.placementKey,
      c3.claim.sighting.placementKey,
    ]);
    expect(rows[0]!.semantic).toContain('"handles":["D1","D3"]');
    expect(rows[1]!.semantic).toContain('"handles":["CE","D0"]');
    expect(rows[1]!.handles).toEqual(c3.claim.sighting.handles);
  });

  it("keeps the superseded placement as history, and never as a second scope row", async () => {
    const sightings = await listRegisterObjectSightings(ctx(), projectId);
    // nine sightings in rev 1, six restated in rev 2 — and still nine
    // identities: a revision adds evidence, never members
    expect(sightings).toHaveLength(15);
    expect(new Set(sightings.map((s) => s.registerObjectId)).size).toBe(9);
    const nudgedObject = second.represented.find(
      (r) => r.claim.sighting.placementKey === NUDGED,
    )!.object.id;
    expect(
      sightings.filter((s) => s.registerObjectId === nudgedObject).map((s) => s.placementKey).sort(),
    ).toEqual([NUDGED, WAS_NUDGED].sort());
    // over-measurement is a hard block: no duplicate scope row, no refusal
    expect(await listRefusedSightings(ctx(), projectId)).toEqual([]);
  });

  it("states a reason on every claim and every loss", () => {
    for (const entry of [
      ...second.unchanged,
      ...second.represented,
      ...second.registered,
    ]) {
      expect(entry.claim.reason.trim().length).toBeGreaterThan(0);
    }
    for (const entry of second.removed) {
      expect(entry.vacated.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("takes a re-run of rev 2 as a no-op — the delta is stable", async () => {
    const { sightings, bounds } = walk(2);
    const again = await registerSightings(ctx(), {
      projectId,
      drawingId,
      ingestId: ingestIds[2]!,
      sightings,
      carryBounds: bounds,
    });
    expect(again.registered).toEqual([]);
    expect(again.represented).toEqual([]);
    expect(again.refused).toEqual([]);
    expect(again.unchanged).toHaveLength(8);
    // the loss is still reported: absence does not lapse into silence
    expect(again.removed).toHaveLength(1);
    expect(await listRegisterObjects(ctx(), projectId)).toHaveLength(9);
  });
});
