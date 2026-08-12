import { and, desc, eq, isNull, ne } from "drizzle-orm";
import type { RefusedSightingSubject } from "../../db/schema/core";
import { withAct } from "./acts";
import { forTenant, schema, type TenantCtx, type Tx } from "./db";
import type { Discipline, ElementType, LevelBasis, RefusalCause } from "./enums";
import type { EntityGraph } from "./entitygraph";
import {
  pairRevision,
  sightingSemantic,
  type PairedClaim,
  type PriorSighting,
  type VacatedIdentity,
} from "./pairing";

/** The identity law itself is `./pairing` — pure, and the one site ordinals are
 *  derived or inherited. It is re-exported here because the door is its only
 *  caller and callers read this file. */
export {
  familyIdentities,
  markFamily,
  pairRevision,
  placementAnchor,
  sightingSemantic,
  type Carry,
  type ClaimedIdentity,
  type PairedClaim,
  type Pairing,
  type PriorSighting,
  type Sighting,
  type VacatedIdentity,
} from "./pairing";
import type { Sighting } from "./pairing";

/**
 * The register spine: typed primitives crossing the tenant seam, and — at the
 * bottom of this file — **the register's door** (ticket 07): the one place a
 * sighting becomes an identity. Human writes ride `withAct` so the act row and
 * the state change commit together.
 */

export type Project = typeof schema.projects.$inferSelect;
export type Level = typeof schema.levels.$inferSelect;
export type Drawing = typeof schema.drawings.$inferSelect;
export type DrawingRevision = typeof schema.drawingRevisions.$inferSelect;
export type Ingest = typeof schema.ingests.$inferSelect;
export type RegisterObject = typeof schema.registerObjects.$inferSelect;
export type RegisterObjectSighting =
  typeof schema.registerObjectSightings.$inferSelect;
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
 * Tx-level primitive so the registration door below can compose it with
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

/* ------------------------------- the door --------------------------------- */

export type RegistrationOutcome = {
  /** Identities that landed on the register in this pass. */
  registered: Array<{ claim: PairedClaim; object: RegisterObject }>;
  /** Sighted again with an identical semantic: identity *and* filed human
   *  dispositions carry forward untouched (identity.md §5). A re-run of the
   *  same drawing is wholly this — a no-op, never a refusal. */
  unchanged: Array<{ claim: PairedClaim; object: RegisterObject }>;
  /** Identity inherited, semantic changed — a move, or cited evidence that
   *  moved. The row **re-presents for disposition** (§5); it never re-keys. */
  represented: Array<{ claim: PairedClaim; object: RegisterObject }>;
  /** Prior identities this revision does not sight: a named disposition, never
   *  a silent absence. The ordinal stays retired. */
  removed: Array<{ vacated: VacatedIdentity; object: RegisterObject }>;
  /** Second sightings of an identity already on the register: unpriceable
   *  evidence in its own table, with no join from any bill (identity.md §2). */
  refused: Array<{ claim: PairedClaim; sighting: RefusedSighting }>;
};

/** PostgreSQL unique_violation, anywhere down the driver's cause chain. */
function uniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e !== undefined && e !== null; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

/**
 * **The register's door** (identity.md §2, §4, §5). Every placed instance of
 * one drawing arrives here; each one either registers, inherits an identity the
 * register already froze, or is **refused as a second sighting of the same
 * physical scope** — and a refusal lands in `refused_sightings`, never on the
 * register with a status flag (one forgotten WHERE from over-measurement).
 *
 * A second revision of a drawing comes through this same door, and what comes
 * out is a **delta, not a do-over** (ticket 08): the pairing law inherits the
 * frozen ordinals, the removals are named, and the semantic — not the key —
 * decides which rows re-present for disposition.
 *
 * Four laws are load-bearing in the order below:
 *
 * 1. **Fails closed on discipline.** An unconfirmed drawing is not walked at
 *    all (§2) — the door refuses the whole pass by name rather than guess an
 *    authority.
 * 2. **Identity is inherited, never re-derived.** `pairRevision` sees what this
 *    drawing already registered (one prior per register object: its latest
 *    sighting) and decides what carries. Only a family this view has never
 *    sighted derives ordinals from the offered batch.
 * 3. **The semantic is the invalidator.** An identical semantic is `unchanged`
 *    and carries filed dispositions forward; a changed one re-presents the row.
 *    Neither ever moves the key.
 * 4. **The constraint is the guard.** The identity insert runs on a savepoint
 *    and the DUPLICATE_IDENTITY refusal is written from its unique-violation —
 *    a pre-flight SELECT would leave a race between two workers, and the guard
 *    must be the one thing no concurrency can step around.
 *
 * The whole pass is one transaction: either this drawing's registration and all
 * its refusals are visible, or none of it is.
 */
export async function registerSightings(
  ctx: TenantCtx,
  input: {
    projectId: string;
    drawingId: string;
    ingestId: string;
    sightings: Sighting[];
    /** Per view key, the distance within which a moved member is still the
     *  same member — a share of that view's own grid spacing, from the takeoff
     *  module. A view with no bound carries nobody across a move, and says so. */
    carryBounds?: Record<string, number>;
    /** The views this pass walked, when that is more than the views its
     *  sightings name — a view emptied by a revision still reports its losses. */
    walkedViewKeys?: string[];
  },
): Promise<RegistrationOutcome> {
  const offered = new Set<string>();
  for (const sighting of input.sightings) {
    if (offered.has(sighting.placementKey)) {
      throw new Error(
        `registerSightings refused: placement ${sighting.placementKey} was offered twice in one pass — one placement is one sighting`,
      );
    }
    offered.add(sighting.placementKey);
  }

  return forTenant(ctx, async (tx) => {
    const [drawing] = await tx
      .select()
      .from(schema.drawings)
      .where(
        and(
          eq(schema.drawings.id, input.drawingId),
          eq(schema.drawings.projectId, input.projectId),
        ),
      );
    const discipline = found(drawing, "drawing", input.drawingId).discipline;
    if (discipline === null) {
      throw new Error(
        `registerSightings refused: drawing ${input.drawingId} has no confirmed discipline — an unconfirmed drawing is not walked at all (identity.md §2)`,
      );
    }

    // What this drawing already registered: one prior per register object —
    // its LATEST sighting. A superseded placement is history, and history is
    // never a pairing candidate.
    const priorRows = await tx
      .selectDistinctOn([schema.registerObjectSightings.registerObjectId], {
        sighting: schema.registerObjectSightings,
        object: schema.registerObjects,
      })
      .from(schema.registerObjectSightings)
      .innerJoin(
        schema.registerObjects,
        eq(schema.registerObjects.id, schema.registerObjectSightings.registerObjectId),
      )
      .where(
        and(
          eq(schema.registerObjectSightings.projectId, input.projectId),
          eq(schema.registerObjectSightings.drawingId, input.drawingId),
        ),
      )
      .orderBy(
        schema.registerObjectSightings.registerObjectId,
        desc(schema.registerObjectSightings.createdAt),
        // two sightings filed in one transaction share a timestamp; the id
        // settles it, so "the latest" is a fact and not a coin toss
        desc(schema.registerObjectSightings.id),
      );

    const objectsById = new Map<string, RegisterObject>();
    const priors: PriorSighting[] = [];
    for (const row of priorRows) {
      objectsById.set(row.object.id, row.object);
      priors.push({
        objectId: row.object.id,
        placementKey: row.sighting.placementKey,
        viewKey: row.sighting.viewKey,
        semantic: row.sighting.semantic,
        elementType: row.object.elementType,
        mark: row.object.mark,
        ordinal: row.object.ordinal,
        levelBasis: row.object.levelBasis,
        levelId: row.object.levelId,
      });
    }

    const pairing = pairRevision({
      offered: input.sightings,
      priors,
      carryBounds: input.carryBounds ?? {},
      walkedViewKeys: input.walkedViewKeys,
    });

    const outcome: RegistrationOutcome = {
      registered: [],
      unchanged: [],
      represented: [],
      removed: [],
      refused: [],
    };
    for (const claim of pairing.claims) {
      const { sighting } = claim;
      const identity = {
        projectId: input.projectId,
        discipline,
        levelId: sighting.levelId,
        levelBasis: sighting.levelBasis,
        elementType: sighting.elementType,
        mark: claim.mark,
        ordinal: claim.ordinal,
      };
      const semantic = sightingSemantic(sighting);

      if (claim.prior !== null) {
        const object = found(
          objectsById.get(claim.prior.objectId),
          "register object",
          claim.prior.objectId,
        );
        if (claim.carry === "EXACT" && claim.prior.semantic === semantic) {
          outcome.unchanged.push({ claim, object });
          continue;
        }
        // The identity is inherited whole; only the evidence is restated. A
        // moved member cites a new placement, an unmoved one whose evidence
        // moved restates its own — and either way the row re-presents (§5).
        // The restatement is a NEW sighting against this ingest: evidence is
        // append-only, so the superseded placement stays as history and no
        // sighting is ever rewritten to point somewhere else.
        await tx.insert(schema.registerObjectSightings).values({
          tenantId: ctx.tenantId,
          projectId: input.projectId,
          registerObjectId: object.id,
          drawingId: input.drawingId,
          ingestId: input.ingestId,
          placementKey: sighting.placementKey,
          viewKey: sighting.viewKey,
          semantic,
          handles: sighting.handles,
        });
        outcome.represented.push({ claim, object });
        continue;
      }

      try {
        const object = await tx.transaction(async (sp) => {
          const row = await insertRegisterObject(sp, ctx.tenantId, identity);
          await sp.insert(schema.registerObjectSightings).values({
            tenantId: ctx.tenantId,
            projectId: input.projectId,
            registerObjectId: row.id,
            drawingId: input.drawingId,
            ingestId: input.ingestId,
            placementKey: sighting.placementKey,
            viewKey: sighting.viewKey,
            semantic,
            handles: sighting.handles,
          });
          return row;
        });
        outcome.registered.push({ claim, object });
      } catch (err) {
        if (!uniqueViolation(err)) throw err;
        const [held] = await tx
          .select()
          .from(schema.registerObjects)
          .where(
            and(
              eq(schema.registerObjects.projectId, input.projectId),
              eq(schema.registerObjects.discipline, discipline),
              identity.levelId === undefined
                ? isNull(schema.registerObjects.levelId)
                : eq(schema.registerObjects.levelId, identity.levelId),
              eq(schema.registerObjects.levelBasis, identity.levelBasis),
              eq(schema.registerObjects.elementType, identity.elementType),
              eq(schema.registerObjects.mark, identity.mark),
              eq(schema.registerObjects.ordinal, identity.ordinal),
            ),
          );
        const sightingRow = await insertRefusedSighting(tx, ctx.tenantId, {
          projectId: input.projectId,
          cause: "DUPLICATE_IDENTITY",
          ingestId: input.ingestId,
          registerObjectId: held?.id,
          subject: {
            identity: {
              discipline,
              levelId: sighting.levelId ?? null,
              levelBasis: sighting.levelBasis,
              elementType: sighting.elementType,
              mark: claim.mark,
              ordinal: claim.ordinal,
            },
            handles: sighting.handles,
          },
          note: `placement ${sighting.placementKey} claims identity ${claim.key}, which is already registered — a second sighting of one physical scope is refused at the door and kept as unpriceable evidence`,
        });
        outcome.refused.push({ claim, sighting: sightingRow });
      }
    }

    // The absent, by name. Nothing is deleted from the register: a member the
    // revision dropped keeps its row, its ordinal stays retired, and the delta
    // reports the loss so a human dispositions it. Silence is the only
    // condemned state.
    for (const vacated of pairing.vacated) {
      outcome.removed.push({
        vacated,
        object: found(
          objectsById.get(vacated.prior.objectId),
          "register object",
          vacated.prior.objectId,
        ),
      });
    }
    return outcome;
  });
}

export async function listRegisterObjectSightings(
  ctx: TenantCtx,
  projectId: string,
): Promise<RegisterObjectSighting[]> {
  return forTenant(ctx, (tx) =>
    tx
      .select()
      .from(schema.registerObjectSightings)
      .where(eq(schema.registerObjectSightings.projectId, projectId)),
  );
}
