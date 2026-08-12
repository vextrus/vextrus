import { and, desc, eq, ne } from "drizzle-orm";
import type { RefusedSightingSubject } from "../../db/schema/core";
import { withAct } from "./acts";
import { forTenant, schema, type TenantCtx, type Tx } from "./db";
import type { Discipline, ElementType, LevelBasis, RefusalCause } from "./enums";
import type { EntityGraph } from "./entitygraph";

/**
 * Skeleton CRUD for the register spine (ticket 02). Every function crosses
 * the tenant seam; human writes ride `withAct` so the act row and the state
 * change commit together. Registration *logic* (the door, pairing, ordinals)
 * is ticket 05 — these are the typed primitives it will compose.
 */

export type Project = typeof schema.projects.$inferSelect;
export type Level = typeof schema.levels.$inferSelect;
export type Drawing = typeof schema.drawings.$inferSelect;
export type DrawingRevision = typeof schema.drawingRevisions.$inferSelect;
export type Ingest = typeof schema.ingests.$inferSelect;
export type RegisterObject = typeof schema.registerObjects.$inferSelect;
export type RefusedSighting = typeof schema.refusedSightings.$inferSelect;

/** A seam lookup that found nothing says so by name — silence is condemned. */
function found<T>(row: T | undefined, what: string, id: string): T {
  if (row === undefined) {
    throw new Error(`${what} ${id} not found in tenant scope`);
  }
  return row;
}

/* ---------------------------------- projects ------------------------------ */

export async function createProject(
  ctx: TenantCtx,
  input: { name: string },
): Promise<Project> {
  return forTenant(ctx, async (tx) => {
    const [row] = await tx
      .insert(schema.projects)
      .values({ tenantId: ctx.tenantId, name: input.name })
      .returning();
    return found(row, "project insert", input.name);
  });
}

export async function getProject(
  ctx: TenantCtx,
  id: string,
): Promise<Project | undefined> {
  return forTenant(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id));
    return row;
  });
}

export async function listProjects(ctx: TenantCtx): Promise<Project[]> {
  return forTenant(ctx, (tx) => tx.select().from(schema.projects));
}

/* ----------------------------------- levels ------------------------------- */

/** Authoring a level is a human act (identity.md §3, §7). */
export async function authorLevel(
  ctx: TenantCtx,
  actorUserId: string,
  input: {
    projectId: string;
    label: string;
    ordinal: number;
    heightMm?: string;
  },
): Promise<Level> {
  return withAct<Level>(
    ctx,
    {
      projectId: input.projectId,
      actorUserId,
      actType: "LEVEL_AUTHORED",
      subjects: (level) => [{ kind: "level", id: level.id }],
      payload: { label: input.label, ordinal: input.ordinal },
    },
    async (tx) => {
      const [row] = await tx
        .insert(schema.levels)
        .values({ tenantId: ctx.tenantId, ...input })
        .returning();
      return found(row, "level insert", input.label);
    },
  );
}

export async function listLevels(
  ctx: TenantCtx,
  projectId: string,
): Promise<Level[]> {
  return forTenant(ctx, (tx) =>
    tx
      .select()
      .from(schema.levels)
      .where(eq(schema.levels.projectId, projectId))
      .orderBy(schema.levels.ordinal),
  );
}

/* ---------------------------------- drawings ------------------------------ */

export async function createDrawing(
  ctx: TenantCtx,
  input: {
    projectId: string;
    title: string;
    /** Machine proposal only — confirmation is a human act. */
    disciplineProposed?: Discipline;
  },
): Promise<Drawing> {
  return forTenant(ctx, async (tx) => {
    const [row] = await tx
      .insert(schema.drawings)
      .values({ tenantId: ctx.tenantId, ...input })
      .returning();
    return found(row, "drawing insert", input.title);
  });
}

/**
 * Human confirmation of a drawing's discipline (identity.md §2). Until this
 * runs, `discipline` stays NULL and the drawing is not walked at all.
 */
export async function confirmDiscipline(
  ctx: TenantCtx,
  actorUserId: string,
  input: { projectId: string; drawingId: string; discipline: Discipline },
): Promise<Drawing> {
  return withAct<Drawing>(
    ctx,
    {
      projectId: input.projectId,
      actorUserId,
      actType: "DISCIPLINE_CONFIRMED",
      subjects: [{ kind: "drawing", id: input.drawingId }],
      payload: { discipline: input.discipline },
    },
    async (tx) => {
      const [row] = await tx
        .update(schema.drawings)
        .set({ discipline: input.discipline, updatedAt: new Date() })
        .where(
          and(
            eq(schema.drawings.id, input.drawingId),
            eq(schema.drawings.projectId, input.projectId),
          ),
        )
        .returning();
      return found(row, "drawing", input.drawingId);
    },
  );
}

export async function listDrawings(
  ctx: TenantCtx,
  projectId: string,
): Promise<Drawing[]> {
  return forTenant(ctx, (tx) =>
    tx
      .select()
      .from(schema.drawings)
      .where(eq(schema.drawings.projectId, projectId)),
  );
}

/* ------------------------------ drawing revisions ------------------------- */

export type DrawingRevisionInput = {
  projectId: string;
  drawingId: string;
  seq: number;
  sourceFilename: string;
  sourceRef: string;
  sourceSha256: string;
};

/**
 * Tx-level primitive: an upload lands the revision, its ingest and its queued
 * job in one transaction, so a revision can never exist with no work queued
 * against it (the shape of a silently unprocessed drawing).
 */
export async function insertDrawingRevision(
  tx: Tx,
  tenantId: string,
  input: DrawingRevisionInput,
): Promise<DrawingRevision> {
  const [row] = await tx
    .insert(schema.drawingRevisions)
    .values({ tenantId, ...input })
    .returning();
  return found(row, "drawing revision insert", input.drawingId);
}

export async function createDrawingRevision(
  ctx: TenantCtx,
  input: DrawingRevisionInput,
): Promise<DrawingRevision> {
  return forTenant(ctx, (tx) =>
    insertDrawingRevision(tx, ctx.tenantId, input),
  );
}

/**
 * The next revision seq, under a row lock on the drawing: concurrent uploads
 * to one drawing serialise here rather than racing to the same seq and losing
 * one to a raw constraint error. The unique (drawing, seq) still backstops it.
 *
 * The lock doubles as the ownership check — the drawing must be in tenant
 * scope and in the named project, or the upload refuses before it costs
 * anything.
 */
export async function nextRevisionSeq(
  tx: Tx,
  projectId: string,
  drawingId: string,
): Promise<number> {
  const [drawing] = await tx
    .select({ id: schema.drawings.id })
    .from(schema.drawings)
    .where(
      and(
        eq(schema.drawings.id, drawingId),
        eq(schema.drawings.projectId, projectId),
      ),
    )
    .for("update");
  if (!drawing) {
    throw new Error(
      `drawing ${drawingId} is not in project ${projectId} within tenant scope`,
    );
  }
  const rows = await tx
    .select({ seq: schema.drawingRevisions.seq })
    .from(schema.drawingRevisions)
    .where(eq(schema.drawingRevisions.drawingId, drawingId))
    .orderBy(desc(schema.drawingRevisions.seq))
    .limit(1);
  return (rows[0]?.seq ?? 0) + 1;
}

export async function getDrawingRevision(
  ctx: TenantCtx,
  id: string,
): Promise<DrawingRevision | undefined> {
  return forTenant(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.drawingRevisions)
      .where(eq(schema.drawingRevisions.id, id));
    return row;
  });
}

export async function listDrawingRevisions(
  ctx: TenantCtx,
  drawingId: string,
): Promise<DrawingRevision[]> {
  return forTenant(ctx, (tx) =>
    tx
      .select()
      .from(schema.drawingRevisions)
      .where(eq(schema.drawingRevisions.drawingId, drawingId))
      .orderBy(schema.drawingRevisions.seq),
  );
}

/* ----------------------------------- ingests ------------------------------ */

export type IngestInput = { projectId: string; drawingRevisionId: string };

/** Tx-level for the same reason as insertDrawingRevision. */
export async function insertIngest(
  tx: Tx,
  tenantId: string,
  input: IngestInput,
): Promise<Ingest> {
  const [row] = await tx
    .insert(schema.ingests)
    .values({ tenantId, ...input })
    .returning();
  return found(row, "ingest insert", input.drawingRevisionId);
}

export async function createIngest(
  ctx: TenantCtx,
  input: IngestInput,
): Promise<Ingest> {
  return forTenant(ctx, (tx) => insertIngest(tx, ctx.tenantId, input));
}

/**
 * A succeeded ingest is terminal: its evidence never changes afterwards. Both
 * transitions below carry this predicate, so a late worker — one whose job was
 * reclaimed and re-run by another — cannot overwrite the finished row or NULL
 * its counters. The transition simply finds no row and says so by name.
 */
const notYetSucceeded = (ingestId: string) =>
  and(eq(schema.ingests.id, ingestId), ne(schema.ingests.status, "succeeded"));

function transitioned(
  row: Ingest | undefined,
  transition: string,
  ingestId: string,
): Ingest {
  if (row === undefined) {
    throw new Error(
      `${transition} refused: ingest ${ingestId} is not in tenant scope, or has already succeeded`,
    );
  }
  return row;
}

/** Claimed by a worker: the screen says "running", never nothing. */
export async function startIngest(
  ctx: TenantCtx,
  ingestId: string,
): Promise<Ingest> {
  return forTenant(ctx, async (tx) => {
    const [row] = await tx
      .update(schema.ingests)
      .set({ status: "running" })
      .where(notYetSucceeded(ingestId))
      .returning();
    return transitioned(row, "startIngest", ingestId);
  });
}

/**
 * Success writes the artifact reference and the fidelity block verbatim from
 * the EntityGraph — counters are the artifact's own, never re-derived
 * (cad-ingestion.md §3; the succeeded CHECK refuses a counterless success).
 */
export async function completeIngest(
  ctx: TenantCtx,
  input: {
    ingestId: string;
    artifactRef: string;
    artifactSha256: string;
    fidelity: Pick<EntityGraph, "counters" | "units">;
  },
): Promise<Ingest> {
  const { counters, units } = input.fidelity;
  return forTenant(ctx, async (tx) => {
    const [row] = await tx
      .update(schema.ingests)
      .set({
        status: "succeeded",
        artifactRef: input.artifactRef,
        artifactSha256: input.artifactSha256,
        entitiesOriginal: counters.original,
        entitiesDerived: counters.derived,
        explodeTruncated: counters.explode_truncated,
        lostByType: counters.lost_by_type,
        unsupportedByType: counters.unsupported_by_type,
        insunits: units.insunits,
        unitDetected: units.detected,
        insunitsUnmapped: units.insunits_unmapped,
        // a retry after a failure must not leave the old error beside a
        // success (the succeeded CHECK also refuses the residue)
        error: null,
        finishedAt: new Date(),
      })
      .where(notYetSucceeded(input.ingestId))
      .returning();
    return transitioned(row, "completeIngest", input.ingestId);
  });
}

/** Failure is loud and named — an empty error is refused at the seam. */
export async function failIngest(
  ctx: TenantCtx,
  input: { ingestId: string; error: string },
): Promise<Ingest> {
  if (!input.error.trim()) {
    throw new Error("failIngest requires a named error");
  }
  return forTenant(ctx, async (tx) => {
    const [row] = await tx
      .update(schema.ingests)
      .set({
        status: "failed",
        error: input.error,
        // no half-success residue on a failed row
        artifactRef: null,
        artifactSha256: null,
        entitiesOriginal: null,
        entitiesDerived: null,
        explodeTruncated: null,
        lostByType: null,
        unsupportedByType: null,
        insunits: null,
        unitDetected: null,
        insunitsUnmapped: null,
        finishedAt: new Date(),
      })
      .where(notYetSucceeded(input.ingestId))
      .returning();
    return transitioned(row, "failIngest", input.ingestId);
  });
}

export async function getIngest(
  ctx: TenantCtx,
  id: string,
): Promise<Ingest | undefined> {
  return forTenant(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.ingests)
      .where(eq(schema.ingests.id, id));
    return row;
  });
}

/**
 * The drawing's screen-facing ingestion state: every revision with its ingest,
 * newest revision first. A revision whose ingest is still queued reads
 * `pending` — there is no row shape here that means "nothing happened".
 *
 * A re-run is a new ingest, so a revision may have several. DISTINCT ON keeps
 * the newest: one row per revision, and the state shown is the current one —
 * a superseded failure must never render as the revision's state.
 */
export async function listRevisionIngests(
  ctx: TenantCtx,
  drawingId: string,
): Promise<{ revision: DrawingRevision; ingest: Ingest | null }[]> {
  const rows = await forTenant(ctx, (tx) =>
    tx
      .selectDistinctOn([schema.drawingRevisions.id], {
        revision: schema.drawingRevisions,
        ingest: schema.ingests,
      })
      .from(schema.drawingRevisions)
      .leftJoin(
        schema.ingests,
        eq(schema.ingests.drawingRevisionId, schema.drawingRevisions.id),
      )
      .where(eq(schema.drawingRevisions.drawingId, drawingId))
      // DISTINCT ON demands its own column lead the sort; the seq order the
      // caller wants is applied after
      .orderBy(schema.drawingRevisions.id, desc(schema.ingests.createdAt)),
  );
  return rows.sort((a, b) => b.revision.seq - a.revision.seq);
}

/* ------------------------------ register objects -------------------------- */

export type RegisterObjectInput = {
  projectId: string;
  discipline: Discipline;
  levelId?: string;
  levelBasis: LevelBasis;
  elementType: ElementType;
  mark: string;
  /** Frozen at first registration; never re-derived (identity.md §4). */
  ordinal: number;
};

/**
 * Tx-level primitive so ticket 05's registration door can compose it with
 * refusal handling in one transaction. A duplicate identity surfaces as the
 * unique-constraint error from `register_objects_identity_uq` — the
 * double-count guard is the constraint, not this function. To catch that
 * refusal and continue in the same transaction (insert the refused sighting),
 * wrap this call in a nested `tx.transaction` — after a constraint error the
 * outer transaction is aborted (25P02) unless the insert ran on a savepoint.
 */
export async function insertRegisterObject(
  tx: Tx,
  tenantId: string,
  input: RegisterObjectInput,
): Promise<RegisterObject> {
  const [row] = await tx
    .insert(schema.registerObjects)
    .values({ tenantId, ...input })
    .returning();
  return found(row, "register object insert", input.mark);
}

export async function registerObject(
  ctx: TenantCtx,
  input: RegisterObjectInput,
): Promise<RegisterObject> {
  return forTenant(ctx, (tx) =>
    insertRegisterObject(tx, ctx.tenantId, input),
  );
}

export async function listRegisterObjects(
  ctx: TenantCtx,
  projectId: string,
): Promise<RegisterObject[]> {
  return forTenant(ctx, (tx) =>
    tx
      .select()
      .from(schema.registerObjects)
      .where(eq(schema.registerObjects.projectId, projectId)),
  );
}

/* ------------------------------ refused sightings ------------------------- */

export type RefusedSightingInput = {
  projectId: string;
  cause: RefusalCause;
  subject: RefusedSightingSubject;
  ingestId?: string;
  /** The register row a DUPLICATE_IDENTITY duplicated, where known. */
  registerObjectId?: string;
  note?: string;
};

/** Tx-level for the same reason as insertRegisterObject. */
export async function insertRefusedSighting(
  tx: Tx,
  tenantId: string,
  input: RefusedSightingInput,
): Promise<RefusedSighting> {
  const [row] = await tx
    .insert(schema.refusedSightings)
    .values({ tenantId, ...input })
    .returning();
  return found(row, "refused sighting insert", input.cause);
}

export async function recordRefusedSighting(
  ctx: TenantCtx,
  input: RefusedSightingInput,
): Promise<RefusedSighting> {
  return forTenant(ctx, (tx) =>
    insertRefusedSighting(tx, ctx.tenantId, input),
  );
}

export async function listRefusedSightings(
  ctx: TenantCtx,
  projectId: string,
): Promise<RefusedSighting[]> {
  return forTenant(ctx, (tx) =>
    tx
      .select()
      .from(schema.refusedSightings)
      .where(eq(schema.refusedSightings.projectId, projectId)),
  );
}
