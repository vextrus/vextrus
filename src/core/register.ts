import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import type { RefusedSightingSubject } from "../../db/schema/core";
import { withAct } from "./acts";
import { forTenant, schema, type TenantCtx, type Tx } from "./db";
import type { Discipline, ElementType, LevelBasis, RefusalCause } from "./enums";
import type { EntityGraph } from "./entitygraph";

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

/**
 * A sighting offered at the register's door: one placed instance, described
 * only by content (identity.md §3 — content-derived keys, zero minted ids). The
 * takeoff module's placement stage produces these; the door decides what they
 * mean. Nothing here is a quantity.
 */
export type Sighting = {
  /** Placement key (§3): view key + mark + coordinates quantized to 0.1 unit.
   *  Idempotency and provenance — **never** part of the identity key. */
  placementKey: string;
  viewKey: string;
  elementType: ElementType;
  /** The drawing's own mark string. */
  mark: string;
  /** The dotless-uppercase compare form: two spellings, one family
   *  (cad-ingestion.md §9). */
  family: string;
  /** Content signature of authored inputs ONLY, fixed-precision (§4).
   *  Correctable attributes — height, grade, rebar spec — are excluded. */
  signature: string;
  levelId?: string;
  levelBasis: LevelBasis;
  /** The DXF handles this sighting cites (cad-ingestion.md §2). */
  handles: string[];
};

/**
 * The identity a sighting claims, plus the human-facing key form: `mark#i`
 * within a mark family of several, the bare mark for a singleton (§4).
 */
export type ClaimedIdentity = {
  sighting: Sighting;
  mark: string;
  ordinal: number;
  key: string;
};

/**
 * Ordinals, by identity.md §4 and nothing else:
 *
 * - A **mark family** is one (element class, level slot, dotless mark) — the
 *   identity key's own axes minus the ordinal. Two classes sharing a mark
 *   string are two families, and so are two levels.
 * - Its members sort by a canonical **content signature of authored inputs
 *   only**, tie-broken by the row's own id — here the placement key, the one
 *   axis no correction can touch, since a placement mints no id at all.
 * - The ordinal is that 1-based index. It is assigned once, at first
 *   registration, and this function is deliberately the only place it is
 *   derived: an ordinal re-derived from moved geometry migrates, which is the
 *   exact defect the freeze exists to prevent.
 * - A family of one keeps the bare mark as its key form; its ordinal is still
 *   1, so a family that later grows gains an index without moving anybody.
 *
 * A family's members may be spelled two ways (`T.B` / `TB`); the family
 * registers under the spelling of its first-sorted member, so one physical
 * family is never two register families.
 */
export function familyIdentities(sightings: Sighting[]): ClaimedIdentity[] {
  const families = new Map<string, Sighting[]>();
  for (const sighting of sightings) {
    const key = [
      sighting.elementType,
      sighting.levelBasis,
      sighting.levelId ?? "",
      sighting.family,
    ].join("|");
    families.set(key, [...(families.get(key) ?? []), sighting]);
  }
  const claims: ClaimedIdentity[] = [];
  for (const members of families.values()) {
    const sorted = [...members].sort(
      (a, b) =>
        a.signature.localeCompare(b.signature) ||
        a.placementKey.localeCompare(b.placementKey),
    );
    const mark = sorted[0]!.mark;
    for (const [i, sighting] of sorted.entries()) {
      const ordinal = i + 1;
      claims.push({
        sighting,
        mark,
        ordinal,
        key: sorted.length > 1 ? `${mark}#${ordinal}` : mark,
      });
    }
  }
  return claims.sort((a, b) =>
    a.sighting.placementKey.localeCompare(b.sighting.placementKey),
  );
}

export type RegistrationOutcome = {
  /** Identities that landed on the register in this pass. */
  registered: Array<{ claim: ClaimedIdentity; object: RegisterObject }>;
  /** Placements already registered — a re-run is a no-op, never a refusal. */
  unchanged: Array<{ claim: ClaimedIdentity; object: RegisterObject }>;
  /** Second sightings of an identity already on the register: unpriceable
   *  evidence in its own table, with no join from any bill (identity.md §2). */
  refused: Array<{ claim: ClaimedIdentity; sighting: RefusedSighting }>;
};

/** PostgreSQL unique_violation, anywhere down the driver's cause chain. */
function uniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e !== undefined && e !== null; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

/**
 * **The register's door** (identity.md §2, §4). Every placed instance of one
 * drawing arrives here; each one either registers, is recognised as already
 * registered, or is **refused as a second sighting of the same physical
 * scope** — and a refusal lands in `refused_sightings`, never on the register
 * with a status flag (one forgotten WHERE from over-measurement).
 *
 * Three laws are load-bearing in the order below:
 *
 * 1. **Fails closed on discipline.** An unconfirmed drawing is not walked at
 *    all (§2) — the door refuses the whole pass by name rather than guess an
 *    authority.
 * 2. **A known placement is a no-op.** Placement keys are content-derived, so
 *    re-running the same drawing offers the same keys; they are matched before
 *    any identity is derived. This is what keeps a re-run from reading as nine
 *    duplicate refusals — and what keeps a genuine second sighting readable.
 * 3. **The constraint is the guard.** The identity insert runs on a savepoint
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

    const known = new Map<string, string>();
    if (input.sightings.length > 0) {
      const rows = await tx
        .select({
          placementKey: schema.registerObjectSightings.placementKey,
          registerObjectId: schema.registerObjectSightings.registerObjectId,
        })
        .from(schema.registerObjectSightings)
        .where(
          and(
            eq(schema.registerObjectSightings.projectId, input.projectId),
            eq(schema.registerObjectSightings.drawingId, input.drawingId),
            inArray(schema.registerObjectSightings.placementKey, [...offered]),
          ),
        );
      for (const row of rows) known.set(row.placementKey, row.registerObjectId);
    }

    const outcome: RegistrationOutcome = {
      registered: [],
      unchanged: [],
      refused: [],
    };
    for (const claim of familyIdentities(input.sightings)) {
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

      const knownId = known.get(sighting.placementKey);
      if (knownId !== undefined) {
        const [object] = await tx
          .select()
          .from(schema.registerObjects)
          .where(eq(schema.registerObjects.id, knownId));
        outcome.unchanged.push({
          claim,
          object: found(object, "register object", knownId),
        });
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
