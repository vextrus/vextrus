import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mintTenantCtx, runAsSystem, schema } from "@/core/db";
import {
  confirmDiscipline,
  createDrawing,
  createDrawingRevision,
  createIngest,
  createProject,
  familyIdentities,
  listRefusedSightings,
  listRegisterObjectSightings,
  listRegisterObjects,
  registerSightings,
  type Sighting,
} from "@/core/register";
import { entityGraphSchema } from "@/core/entitygraph";
import { georeferenceGrid, partitionViews, placeInstances } from "@/modules/takeoff";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The register's door, live (ticket 07). The sightings are the real ones: the
 * committed fixture sheet's nine placed columns, through the same partition →
 * grid → placement path the pipeline walks. What is proven here is what the
 * door decides — nine identities with frozen ordinals, a second pass that is a
 * no-op rather than nine refusals, and a genuine second sighting refused at the
 * door into refused_sightings with its cited handles.
 */

const fixtures = path.resolve(import.meta.dirname, "../../cad/tests/fixtures");
const graph = entityGraphSchema.parse(
  JSON.parse(readFileSync(path.join(fixtures, "structural-r1.entitygraph.json"), "utf-8")),
);

function fixtureSightings(): Sighting[] {
  const partition = partitionViews(graph);
  const placements = placeInstances(graph, partition, georeferenceGrid(graph, partition));
  expect(placements).toHaveLength(1);
  return placements[0]!.instances;
}

let tenantId: string;
let actorId: string;
let projectId: string;
let drawingId: string;
let unconfirmedDrawingId: string;
let ingestId: string;
const ctx = () => mintTenantCtx(tenantId);

function causeChain(err: unknown): string {
  const messages: string[] = [];
  for (let e = err; e instanceof Error; e = e.cause) messages.push(e.message);
  return messages.join(" | ");
}

async function refusalOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    return causeChain(err);
  }
  return "";
}

beforeAll(async () => {
  await runAsSystem("register door dbspec setup", async (tx) => {
    const [tenant] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec Door", slug: `dbspec-door-${crypto.randomUUID()}` })
      .returning();
    const [actor] = await tx
      .insert(schema.users)
      .values({ email: `door-${crypto.randomUUID()}@dbspec.local`, name: "QS" })
      .returning();
    if (!tenant || !actor) throw new Error("setup failed");
    tenantId = tenant.id;
    actorId = actor.id;
    await tx
      .insert(schema.memberships)
      .values({ tenantId, userId: actorId, role: "owner" });
  });
  projectId = (await createProject(ctx(), { name: "Door Tower" })).id;
  const drawing = await createDrawing(ctx(), { projectId, title: "STRUCTURAL R1" });
  drawingId = drawing.id;
  await confirmDiscipline(ctx(), actorId, {
    projectId,
    drawingId,
    discipline: "structural",
  });
  unconfirmedDrawingId = (
    await createDrawing(ctx(), { projectId, title: "UNCONFIRMED SHEET" })
  ).id;
  const revision = await createDrawingRevision(ctx(), {
    projectId,
    drawingId,
    seq: 1,
    sourceFilename: "structural-r1.dxf",
    sourceRef: "artifacts/dbspec/structural-r1.dxf",
    sourceSha256: "2".repeat(64),
  });
  ingestId = (await createIngest(ctx(), { projectId, drawingRevisionId: revision.id })).id;
});

afterAll(async () => {
  await runAsSystem("register door dbspec teardown", async (tx) => {
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

describe("the register's door", () => {
  it("fails closed on a drawing whose discipline nobody confirmed", async () => {
    const refused = await refusalOf(() =>
      registerSightings(ctx(), {
        projectId,
        drawingId: unconfirmedDrawingId,
        ingestId,
        sightings: fixtureSightings(),
      }),
    );
    expect(refused).toMatch(/no confirmed discipline/);
    expect(await listRegisterObjects(ctx(), projectId)).toEqual([]);
  });

  it("registers the fixture's nine columns with frozen ordinals", async () => {
    const sightings = fixtureSightings();
    expect(sightings).toHaveLength(9);
    const outcome = await registerSightings(ctx(), {
      projectId,
      drawingId,
      ingestId,
      sightings,
    });
    expect(outcome.registered).toHaveLength(9);
    expect(outcome.unchanged).toEqual([]);
    expect(outcome.refused).toEqual([]);

    // C1 ×4 → C1#1..#4, C2 ×4 → C2#1..#4, C3 a singleton keeping its bare mark
    expect(outcome.registered.map((r) => r.claim.key).sort()).toEqual([
      "C1#1",
      "C1#2",
      "C1#3",
      "C1#4",
      "C2#1",
      "C2#2",
      "C2#3",
      "C2#4",
      "C3",
    ]);
    const objects = await listRegisterObjects(ctx(), projectId);
    expect(objects).toHaveLength(9);
    for (const object of objects) {
      expect(object.discipline).toBe("structural");
      expect(object.elementType).toBe("column");
      // no level stack is authored, and the machine may not author one
      expect(object.levelBasis).toBe("UNRESOLVED");
      expect(object.levelId).toBeNull();
    }
    expect(objects.filter((o) => o.mark === "C3").map((o) => o.ordinal)).toEqual([1]);

    // every registered identity cites the placement that sighted it, with its
    // own handles — provenance beside the register, never inside its key
    const sighted = await listRegisterObjectSightings(ctx(), projectId);
    expect(sighted).toHaveLength(9);
    expect(new Set(sighted.map((s) => s.placementKey))).toEqual(
      new Set(sightings.map((s) => s.placementKey)),
    );
    for (const row of sighted) {
      expect(row.ingestId).toBe(ingestId);
      expect(row.handles).toHaveLength(2);
    }
  });

  it("takes a second pass over the same ingest as a no-op, not nine refusals", async () => {
    const outcome = await registerSightings(ctx(), {
      projectId,
      drawingId,
      ingestId,
      sightings: fixtureSightings(),
    });
    expect(outcome.registered).toEqual([]);
    expect(outcome.refused).toEqual([]);
    expect(outcome.unchanged).toHaveLength(9);
    // and the register did not grow
    expect(await listRegisterObjects(ctx(), projectId)).toHaveLength(9);
    expect(await listRegisterObjectSightings(ctx(), projectId)).toHaveLength(9);
    expect(await listRefusedSightings(ctx(), projectId)).toEqual([]);
  });

  it("refuses a genuine second sighting of one identity at the door", async () => {
    // The same physical column, sighted again from a second view of the sheet:
    // a new placement key, the same identity. Counting it would be
    // over-measurement, which is a hard block, never a disclosure.
    const singleton = fixtureSightings().find((s) => s.family === "C3")!;
    const again: Sighting = {
      ...singleton,
      viewKey: "second-view",
      placementKey: singleton.placementKey.replace(singleton.viewKey, "second-view"),
      handles: ["ZZ01", "ZZ02"],
    };
    expect(again.placementKey).not.toBe(singleton.placementKey);
    expect(familyIdentities([again])[0]!.key).toBe("C3");

    const outcome = await registerSightings(ctx(), {
      projectId,
      drawingId,
      ingestId,
      sightings: [again],
    });
    expect(outcome.registered).toEqual([]);
    expect(outcome.unchanged).toEqual([]);
    expect(outcome.refused).toHaveLength(1);

    const refusal = outcome.refused[0]!.sighting;
    expect(refusal.cause).toBe("DUPLICATE_IDENTITY");
    expect(refusal.subject.handles).toEqual(["ZZ01", "ZZ02"]);
    expect(refusal.subject.identity).toMatchObject({
      discipline: "structural",
      elementType: "column",
      levelBasis: "UNRESOLVED",
      mark: "C3",
      ordinal: 1,
    });
    expect(refusal.ingestId).toBe(ingestId);
    // it points AT the register row it duplicated, and never onto it
    const held = (await listRegisterObjects(ctx(), projectId)).find((o) => o.mark === "C3")!;
    expect(refusal.registerObjectId).toBe(held.id);

    // the refusal is evidence, not scope: nothing was added to the register
    expect(await listRegisterObjects(ctx(), projectId)).toHaveLength(9);
    expect(await listRegisterObjectSightings(ctx(), projectId)).toHaveLength(9);
    expect((await listRefusedSightings(ctx(), projectId)).map((s) => s.id)).toEqual([
      refusal.id,
    ]);
  });

  it("refuses a pass that offers one placement twice", async () => {
    const singleton = fixtureSightings().find((s) => s.family === "C3")!;
    const refused = await refusalOf(() =>
      registerSightings(ctx(), {
        projectId,
        drawingId,
        ingestId,
        sightings: [singleton, singleton],
      }),
    );
    expect(refused).toMatch(/offered twice in one pass/);
  });
});
