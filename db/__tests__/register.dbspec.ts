import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { drawingSetRevisionDigest } from "@/core/identity";

/**
 * The register spine's seam test (identity.md §2, §7, §9; ADR-0004, ADR-0005), live against
 * Postgres via `pnpm test:db`: the double-count guard is a constraint, the refused-sightings
 * table is joined by nothing bill-shaped, an act and its state change commit together or
 * neither, and the frozen axes are frozen by grant.
 */

let tenantId: string;
let userId: string;
let projectId: string;
let drawingId: string;
let revisionId: string;
let levelId: string;

beforeAll(async () => {
  await runAsSystem("register dbspec setup", async (tx) => {
    const [t] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec register", slug: `dbspec-reg-${crypto.randomUUID()}` })
      .returning();
    if (!t) throw new Error("setup failed");
    tenantId = t.id;
    const [u] = await tx.insert(schema.users).values({ email: `reg-${t.id}@dbspec.local`, name: "QS" }).returning();
    if (!u) throw new Error("setup failed");
    userId = u.id;
    await tx.insert(schema.memberships).values({ tenantId, userId, role: "owner" });
    const [p] = await tx.insert(schema.projects).values({ tenantId, name: "register project" }).returning();
    if (!p) throw new Error("setup failed");
    projectId = p.id;
  });
  // The rest through the seam, as the app would.
  await forTenant(mintTenantCtx(tenantId), async (tx) => {
    const [d] = await tx.insert(schema.drawings).values({ tenantId, projectId, title: "S-01 column layout" }).returning();
    if (!d) throw new Error("setup failed");
    drawingId = d.id;
    const [r] = await tx
      .insert(schema.drawingRevisions)
      .values({ tenantId, projectId, drawingId, label: "R1" })
      .returning();
    if (!r) throw new Error("setup failed");
    revisionId = r.id;
    const [l] = await tx
      .insert(schema.levels)
      .values({ tenantId, projectId, label: "GF", ordinal: 0, height: "3.0500", heightBasis: "TRANSCRIBED" })
      .returning();
    if (!l) throw new Error("setup failed");
    levelId = l.id;
  });
});

afterAll(async () => {
  await runAsSystem("register dbspec teardown", async (tx) => {
    for (const table of [
      schema.acts,
      schema.refusedSightings,
      schema.registerObjects,
      schema.drawingSetRevisionMembers,
      schema.drawingSetRevisions,
      schema.drawingRevisions,
      schema.drawings,
      schema.levels,
      schema.projects,
      schema.memberships,
    ]) {
      await tx.delete(table).where(eq(table.tenantId, tenantId));
    }
    await tx.delete(schema.users).where(eq(schema.users.id, userId));
    await tx.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
  });
});

function messagesOf(err: unknown): string {
  const messages: string[] = [];
  for (let e = err; e instanceof Error; e = e.cause) messages.push(e.message);
  return messages.join(" | ");
}
async function refusal(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return messagesOf(err);
  }
  return "";
}
const ctx = () => mintTenantCtx(tenantId);

describe("identity (identity.md §2–§3)", () => {
  it("refuses a second sighting of registered scope — the double-count guard is a constraint", async () => {
    const identity = { tenantId, projectId, discipline: "STRUCTURAL", elementType: "COLUMN", mark: "C1", ordinal: 1 } as const;
    await forTenant(ctx(), (tx) => tx.insert(schema.registerObjects).values({ ...identity, levelId }));
    expect(await refusal(() => forTenant(ctx(), (tx) => tx.insert(schema.registerObjects).values({ ...identity, levelId })))).toMatch(
      /register_objects_identity_uq/,
    );
    // The next ordinal is a different object.
    await forTenant(ctx(), (tx) => tx.insert(schema.registerObjects).values({ ...identity, levelId, ordinal: 2 }));
  });

  it("guards a lawful-null level slot too (NULLS NOT DISTINCT; FOUNDATION is one slot in the key)", async () => {
    const pc = { tenantId, projectId, discipline: "STRUCTURAL", elementType: "PILE_CAP", mark: "PC1", ordinal: 1, levelBasis: "FOUNDATION" } as const;
    await forTenant(ctx(), (tx) => tx.insert(schema.registerObjects).values(pc));
    expect(await refusal(() => forTenant(ctx(), (tx) => tx.insert(schema.registerObjects).values(pc)))).toMatch(
      /register_objects_identity_uq/,
    );
  });

  it("refuses a null level with no basis, and a level with a basis", async () => {
    const base = { tenantId, projectId, discipline: "STRUCTURAL", elementType: "BEAM", mark: "B1", ordinal: 1 } as const;
    expect(await refusal(() => forTenant(ctx(), (tx) => tx.insert(schema.registerObjects).values(base)))).toMatch(
      /register_objects_level_slot_check/,
    );
    expect(
      await refusal(() => forTenant(ctx(), (tx) => tx.insert(schema.registerObjects).values({ ...base, levelId, levelBasis: "UNRESOLVED" }))),
    ).toMatch(/register_objects_level_slot_check/);
  });

  it("freezes the ordinal at first registration — by grant, not convention", async () => {
    const [row] = await forTenant(ctx(), (tx) =>
      tx.select().from(schema.registerObjects).where(eq(schema.registerObjects.mark, "C1")).limit(1),
    );
    if (!row) throw new Error("expected C1");
    expect(
      await refusal(() =>
        forTenant(ctx(), (tx) => tx.update(schema.registerObjects).set({ ordinal: 9 }).where(eq(schema.registerObjects.id, row.id))),
      ),
    ).toMatch(/permission denied/i);
    // A mark rename is an authored event and is permitted (identity.md §2).
    await forTenant(ctx(), (tx) => tx.update(schema.registerObjects).set({ mark: "C-1" }).where(eq(schema.registerObjects.id, row.id)));
    await forTenant(ctx(), (tx) => tx.update(schema.registerObjects).set({ mark: "C1" }).where(eq(schema.registerObjects.id, row.id)));
  });
});

describe("refused sightings (identity.md §2, §7)", () => {
  it("has no FK path to anything bill-shaped: nothing references it; it references only its provenance", async () => {
    const incoming = await runAsSystem("fk census", (tx) =>
      tx.execute<{ table_name: string }>(sql`
        select c.conrelid::regclass::text as table_name
        from pg_constraint c
        where c.contype = 'f' and c.confrelid = 'refused_sightings'::regclass`),
    );
    expect([...incoming]).toEqual([]);
    const outgoing = await runAsSystem("fk census", (tx) =>
      tx.execute<{ table_name: string }>(sql`
        select c.confrelid::regclass::text as table_name
        from pg_constraint c
        where c.contype = 'f' and c.conrelid = 'refused_sightings'::regclass`),
    );
    const targets = [...outgoing].map((r) => r.table_name).sort();
    // Provenance only — never register_objects, and never a quantity, bill or estimate table.
    for (const t of targets) expect(["tenants", "projects", "levels", "drawing_revisions"]).toContain(t);
    expect(targets).not.toContain("register_objects");
  });

  it("keeps a duplicate as evidence with its source keys and no ordinal, and is append-only", async () => {
    const [row] = await forTenant(ctx(), (tx) =>
      tx
        .insert(schema.refusedSightings)
        .values({
          tenantId,
          projectId,
          cause: "DUPLICATE_IDENTITY",
          discipline: "STRUCTURAL",
          levelId,
          elementType: "COLUMN",
          mark: "C1",
          drawingRevisionId: revisionId,
          sourceKeys: ["DXF_HANDLE:1F3", "DXF_HANDLE:1F4"],
        })
        .returning(),
    );
    if (!row) throw new Error("expected refused row");
    expect(
      await refusal(() =>
        forTenant(ctx(), (tx) =>
          tx.insert(schema.refusedSightings).values({
            tenantId,
            projectId,
            cause: "DUPLICATE_IDENTITY",
            discipline: "STRUCTURAL",
            levelId,
            elementType: "COLUMN",
            mark: "C1",
            ordinal: 3,
            drawingRevisionId: revisionId,
            sourceKeys: ["DXF_HANDLE:1F5"],
          }),
        ),
      ),
    ).toMatch(/refused_sightings_ordinal_check/);
    expect(
      await refusal(() =>
        forTenant(ctx(), (tx) => tx.update(schema.refusedSightings).set({ mark: "C2" }).where(eq(schema.refusedSightings.id, row.id))),
      ),
    ).toMatch(/permission denied/i);
  });
});

describe("the act log (identity.md §7)", () => {
  const confirm = (type: string) =>
    forTenant(ctx(), async (tx) => {
      await tx.update(schema.drawings).set({ disciplineConfirmed: "STRUCTURAL" }).where(eq(schema.drawings.id, drawingId));
      await tx.insert(schema.acts).values({
        tenantId,
        projectId,
        actorUserId: userId,
        type: type as "CONFIRM_DISCIPLINE",
        subjectKind: "drawings",
        subjectIds: [drawingId],
        detail: { discipline: "STRUCTURAL" },
      });
    });

  it("an act row and its state change commit together or neither", async () => {
    // A refused act (outside the closed type enum) rolls the state change back with it.
    expect(await refusal(() => confirm("NOT_AN_ACT"))).toMatch(/acts_type_check/);
    const [before] = await forTenant(ctx(), (tx) => tx.select().from(schema.drawings).where(eq(schema.drawings.id, drawingId)));
    expect(before?.disciplineConfirmed).toBeNull();
    const acts0 = await forTenant(ctx(), (tx) => tx.select().from(schema.acts));
    expect(acts0).toHaveLength(0);
    // The lawful act lands both.
    await confirm("CONFIRM_DISCIPLINE");
    const [after] = await forTenant(ctx(), (tx) => tx.select().from(schema.drawings).where(eq(schema.drawings.id, drawingId)));
    expect(after?.disciplineConfirmed).toBe("STRUCTURAL");
    const acts1 = await forTenant(ctx(), (tx) => tx.select().from(schema.acts));
    expect(acts1).toHaveLength(1);
    expect(acts1[0]?.subjectIds).toEqual([drawingId]);
  });

  it("is append-only and human-only: no update, and no actor who is not a member of the tenant", async () => {
    const [act] = await forTenant(ctx(), (tx) => tx.select().from(schema.acts).limit(1));
    if (!act) throw new Error("expected an act");
    expect(
      await refusal(() => forTenant(ctx(), (tx) => tx.update(schema.acts).set({ subjectKind: "x" }).where(eq(schema.acts.id, act.id)))),
    ).toMatch(/permission denied/i);
    expect(
      await refusal(() =>
        forTenant(ctx(), (tx) =>
          tx.insert(schema.acts).values({
            tenantId,
            projectId,
            actorUserId: crypto.randomUUID(),
            type: "RENAME_MARK",
            subjectKind: "register_objects",
            subjectIds: [crypto.randomUUID()],
          }),
        ),
      ),
    ).toMatch(/acts_actor_membership_fk/);
  });
});

describe("the drawing-set revision (identity.md §9)", () => {
  it("is content-addressed and immutable: the digest is the key, and the manifest cannot be edited", async () => {
    const digest = drawingSetRevisionDigest([{ drawingId, drawingRevisionId: revisionId }]);
    await forTenant(ctx(), async (tx) => {
      await tx.insert(schema.drawingSetRevisions).values({ digest, tenantId, projectId });
      await tx.insert(schema.drawingSetRevisionMembers).values({ setDigest: digest, tenantId, projectId, drawingId, drawingRevisionId: revisionId });
    });
    // An identical pinned set IS the identical set revision — the same digest already exists.
    expect(
      await refusal(() => forTenant(ctx(), (tx) => tx.insert(schema.drawingSetRevisions).values({ digest, tenantId, projectId }))),
    ).toMatch(/drawing_set_revisions_pkey/);
    expect(
      await refusal(() =>
        forTenant(ctx(), (tx) => tx.delete(schema.drawingSetRevisionMembers).where(eq(schema.drawingSetRevisionMembers.setDigest, digest))),
      ),
    ).toMatch(/permission denied/i);
  });

  it("refuses a member pair that is not a revision of that drawing", async () => {
    const digest = "f".repeat(64);
    expect(
      await refusal(() =>
        forTenant(ctx(), async (tx) => {
          await tx.insert(schema.drawingSetRevisions).values({ digest, tenantId, projectId });
          await tx.insert(schema.drawingSetRevisionMembers).values({
            setDigest: digest,
            tenantId,
            projectId,
            drawingId,
            drawingRevisionId: crypto.randomUUID(),
          });
        }),
      ),
    ).toMatch(/drawing_set_revision_members_revision_drawing_fk/);
  });
});
