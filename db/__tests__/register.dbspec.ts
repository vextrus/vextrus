import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withAct } from "@/core/acts";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import {
  authorLevel,
  completeIngest,
  createDrawing,
  createDrawingRevision,
  createIngest,
  createProject,
  failIngest,
  listRefusedSightings,
  recordRefusedSighting,
  registerObject,
} from "@/core/register";

/**
 * Register spine dbspec (ticket 02): the identity unique constraint is the
 * double-count guard (including the level-null NULLS NOT DISTINCT case), a
 * refused sighting lands in its own table, an act and its state change roll
 * back together, the act log and the register are append-only/frozen on the
 * app lane, and the composite FKs refuse cross-tenant and cross-project
 * parents that plain FKs would wave through (RLS-bypass class).
 */

let tenantId: string;
let actorId: string;
let outsiderId: string;
let projectId: string;
let siblingProjectId: string;
let levelId: string;
let foreignTenantId: string;
let foreignDrawingId: string;
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
  await runAsSystem("register dbspec setup", async (tx) => {
    const [tenant] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec Register", slug: `dbspec-reg-${crypto.randomUUID()}` })
      .returning();
    const [foreign] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec Foreign", slug: `dbspec-reg-f-${crypto.randomUUID()}` })
      .returning();
    const [actor] = await tx
      .insert(schema.users)
      .values({ email: `reg-${crypto.randomUUID()}@dbspec.local`, name: "QS" })
      .returning();
    const [outsider] = await tx
      .insert(schema.users)
      .values({ email: `reg-out-${crypto.randomUUID()}@dbspec.local`, name: "Out" })
      .returning();
    if (!tenant || !foreign || !actor || !outsider) {
      throw new Error("setup failed");
    }
    tenantId = tenant.id;
    foreignTenantId = foreign.id;
    actorId = actor.id;
    outsiderId = outsider.id;
    // the actor is a member of the home tenant only; the outsider of neither
    await tx
      .insert(schema.memberships)
      .values({ tenantId, userId: actorId, role: "owner" });
  });
  const project = await createProject(ctx(), { name: "Spec Tower" });
  projectId = project.id;
  const sibling = await createProject(ctx(), { name: "Spec Annex" });
  siblingProjectId = sibling.id;
  const level = await authorLevel(ctx(), actorId, {
    projectId,
    label: "GF",
    ordinal: 1,
  });
  levelId = level.id;
  const foreignCtx = mintTenantCtx(foreignTenantId);
  const foreignProject = await createProject(foreignCtx, { name: "Foreign" });
  const foreignDrawing = await createDrawing(foreignCtx, {
    projectId: foreignProject.id,
    title: "FOREIGN LAYOUT",
  });
  foreignDrawingId = foreignDrawing.id;
});

afterAll(async () => {
  await runAsSystem("register dbspec teardown", async (tx) => {
    for (const table of [
      schema.refusedSightings,
      schema.registerObjects,
      schema.acts,
      schema.ingests,
      schema.drawingRevisions,
      schema.drawings,
      schema.levels,
      schema.projects,
      schema.memberships,
    ] as const) {
      for (const id of [tenantId, foreignTenantId]) {
        await tx.delete(table).where(eq(table.tenantId, id));
      }
    }
    for (const id of [tenantId, foreignTenantId]) {
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, id));
    }
    for (const id of [actorId, outsiderId]) {
      await tx.delete(schema.users).where(eq(schema.users.id, id));
    }
  });
});

describe("the identity unique constraint", () => {
  it("refuses a duplicate identity insert", async () => {
    const identity = {
      projectId,
      discipline: "structural",
      levelId,
      levelBasis: "LEVEL",
      elementType: "column",
      mark: "C1",
      ordinal: 1,
    } as const;
    await registerObject(ctx(), identity);
    let refused: unknown;
    try {
      await registerObject(ctx(), identity);
    } catch (err) {
      refused = err;
    }
    expect(refused).toBeDefined();
    expect(causeChain(refused)).toMatch(/register_objects_identity_uq/);
  });

  it("refuses duplicates on a level-null identity (NULLS NOT DISTINCT)", async () => {
    const identity = {
      projectId,
      discipline: "structural",
      levelBasis: "FOUNDATION",
      elementType: "pile_cap",
      mark: "P1",
      ordinal: 1,
    } as const;
    await registerObject(ctx(), identity);
    let refused: unknown;
    try {
      await registerObject(ctx(), identity);
    } catch (err) {
      refused = err;
    }
    expect(refused).toBeDefined();
    expect(causeChain(refused)).toMatch(/register_objects_identity_uq/);
  });

  it("refuses a LEVEL basis without a level id (lawful-null slot)", async () => {
    let refused: unknown;
    try {
      await registerObject(ctx(), {
        projectId,
        discipline: "structural",
        levelBasis: "LEVEL",
        elementType: "beam",
        mark: "B1",
        ordinal: 1,
      });
    } catch (err) {
      refused = err;
    }
    expect(refused).toBeDefined();
    expect(causeChain(refused)).toMatch(/register_objects_level_slot_ck/);
  });
});

describe("composite FKs (FK validation bypasses RLS)", () => {
  it("refuses a revision against another tenant's drawing", async () => {
    const refused = await refusalOf(() =>
      createDrawingRevision(ctx(), {
        drawingId: foreignDrawingId,
        seq: 1,
        sourceFilename: "intruder.dxf",
        sourceRef: "artifacts/dbspec/intruder.dxf",
        sourceSha256: "1".repeat(64),
      }),
    );
    expect(refused).toMatch(/drawing_revisions_drawing_tenant_fk/);
  });

  it("refuses a register object citing a sibling project's level", async () => {
    const refused = await refusalOf(() =>
      registerObject(ctx(), {
        projectId: siblingProjectId,
        discipline: "structural",
        levelId, // belongs to Spec Tower, not Spec Annex
        levelBasis: "LEVEL",
        elementType: "column",
        mark: "C1",
        ordinal: 1,
      }),
    );
    expect(refused).toMatch(/register_objects_level_project_fk/);
  });
});

describe("refused sightings", () => {
  it("land in their own table, never on the register", async () => {
    const sighting = await recordRefusedSighting(ctx(), {
      projectId,
      cause: "DUPLICATE_IDENTITY",
      subject: {
        identity: {
          discipline: "structural",
          levelId,
          levelBasis: "LEVEL",
          elementType: "column",
          mark: "C1",
          ordinal: 1,
        },
        handles: ["2A3F"],
      },
    });
    expect(sighting.cause).toBe("DUPLICATE_IDENTITY");
    const listed = await listRefusedSightings(ctx(), projectId);
    expect(listed.map((s) => s.id)).toContain(sighting.id);
    // the register itself holds no refusal state to forget in a WHERE
    const registerColumns = Object.keys(schema.registerObjects);
    expect(registerColumns).not.toContain("status");
    expect(registerColumns).not.toContain("cause");
  });
});

describe("the frozen register", () => {
  it("the app lane cannot UPDATE a register object", async () => {
    const refused = await refusalOf(() =>
      forTenant(ctx(), (tx) =>
        tx
          .update(schema.registerObjects)
          .set({ ordinal: 2 })
          .where(eq(schema.registerObjects.projectId, projectId)),
      ),
    );
    expect(refused).toMatch(/permission denied/i);
  });

  it("the app lane cannot DELETE a register object", async () => {
    const refused = await refusalOf(() =>
      forTenant(ctx(), (tx) =>
        tx
          .delete(schema.registerObjects)
          .where(eq(schema.registerObjects.projectId, projectId)),
      ),
    );
    expect(refused).toMatch(/permission denied/i);
  });
});

describe("the act log", () => {
  it("refuses an act by a non-member actor", async () => {
    const refused = await refusalOf(() =>
      authorLevel(ctx(), outsiderId, {
        projectId,
        label: "L9",
        ordinal: 9,
      }),
    );
    expect(refused).toMatch(/not a member/);
  });

  it("commits the act row with its state change", async () => {
    const level = await authorLevel(ctx(), actorId, {
      projectId,
      label: "L1",
      ordinal: 2,
    });
    const acts = await forTenant(ctx(), (tx) =>
      tx.select().from(schema.acts).where(eq(schema.acts.projectId, projectId)),
    );
    const subjectIds = acts
      .filter((a) => a.actType === "LEVEL_AUTHORED")
      .flatMap((a) => a.subjects.map((s) => s.id));
    expect(subjectIds).toContain(level.id);
  });

  it("rolls the act and its state change back together", async () => {
    const before = await forTenant(ctx(), async (tx) => ({
      acts: (await tx.select().from(schema.acts)).length,
      levels: (await tx.select().from(schema.levels)).length,
    }));
    let thrown: unknown;
    try {
      await withAct(
        ctx(),
        {
          projectId,
          actorUserId: actorId,
          actType: "LEVEL_AUTHORED",
          subjects: [],
        },
        async (tx) => {
          await tx.insert(schema.levels).values({
            tenantId,
            projectId,
            label: "DOOMED",
            ordinal: 99,
          });
          throw new Error("state change failed after insert");
        },
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    const after = await forTenant(ctx(), async (tx) => ({
      acts: (await tx.select().from(schema.acts)).length,
      levels: (await tx.select().from(schema.levels)).length,
    }));
    expect(after).toEqual(before);
  });

  it("is append-only on the app lane: UPDATE is refused", async () => {
    let refused: unknown;
    try {
      await forTenant(ctx(), (tx) =>
        tx
          .update(schema.acts)
          .set({ actType: "MARK_RENAMED" })
          .where(eq(schema.acts.projectId, projectId)),
      );
    } catch (err) {
      refused = err;
    }
    expect(refused).toBeDefined();
    expect(causeChain(refused)).toMatch(/permission denied/i);
  });

  it("is append-only on the app lane: DELETE is refused", async () => {
    let refused: unknown;
    try {
      await forTenant(ctx(), (tx) =>
        tx.delete(schema.acts).where(eq(schema.acts.projectId, projectId)),
      );
    } catch (err) {
      refused = err;
    }
    expect(refused).toBeDefined();
    expect(causeChain(refused)).toMatch(/permission denied/i);
  });
});

describe("ingests", () => {
  it("a failed ingest carries a named error, never silence", async () => {
    const drawing = await createDrawing(ctx(), {
      projectId,
      title: "STRUCTURAL LAYOUT",
      disciplineProposed: "structural",
    });
    const revision = await createDrawingRevision(ctx(), {
      drawingId: drawing.id,
      seq: 1,
      sourceFilename: "layout.dxf",
      sourceRef: "artifacts/dbspec/layout.dxf",
      sourceSha256: "0".repeat(64),
    });
    const ingest = await createIngest(ctx(), {
      drawingRevisionId: revision.id,
    });
    await expect(
      failIngest(ctx(), { ingestId: ingest.id, error: "   " }),
    ).rejects.toThrow(/named error/);
    const failed = await failIngest(ctx(), {
      ingestId: ingest.id,
      error: "ezdxf: not a DXF file",
    });
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/not a DXF/);
    // and the DB refuses a "succeeded" row without real counters
    let refused: unknown;
    try {
      await forTenant(ctx(), (tx) =>
        tx
          .update(schema.ingests)
          .set({ status: "succeeded" })
          .where(eq(schema.ingests.id, ingest.id)),
      );
    } catch (err) {
      refused = err;
    }
    expect(refused).toBeDefined();
    expect(causeChain(refused)).toMatch(/ingests_succeeded_ck/);
    // a retried ingest that succeeds clears the failure residue
    const succeeded = await completeIngest(ctx(), {
      ingestId: ingest.id,
      artifactRef: "artifacts/dbspec/layout.entitygraph.json",
      artifactSha256: "2".repeat(64),
      fidelity: {
        counters: {
          original: 42,
          derived: 7,
          explode_truncated: false,
          lost_by_type: {},
          unsupported_by_type: {},
        },
        units: { insunits: 4, detected: "mm", insunits_unmapped: false },
      },
    });
    expect(succeeded.status).toBe("succeeded");
    expect(succeeded.error).toBeNull();
    expect(succeeded.entitiesOriginal).toBe(42);
  });
});

describe("tenant isolation on the spine", () => {
  it("a foreign tenant sees no projects", async () => {
    const rows = await forTenant(
      mintTenantCtx("00000000-0000-0000-0000-000000000000"),
      (tx) => tx.select().from(schema.projects),
    );
    expect(rows).toHaveLength(0);
  });
});
