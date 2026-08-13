/**
 * Domain enums (ADR-0002): TS consts as the single declaration site. Columns
 * store text; db/schema/core.ts derives CHECK constraints from these same
 * consts, so a value exists exactly once. Adding a value is a schema change
 * and rides a new migration — never an edit to a landed one.
 */

/** Drawing-scoped, machine-proposed, human-confirmed (identity.md §2). */
export const disciplines = [
  "structural",
  "architectural",
  "plumbing",
  "electrical",
] as const;
export type Discipline = (typeof disciplines)[number];

/**
 * Structural element classes v1, from the domain corpus (cad-ingestion.md §9,
 * formulas.md). "tie/grade beam" is one class with two drawing names — two
 * enum values would let one physical member register twice, defeating the
 * double-count guard.
 */
export const elementTypes = [
  "pile",
  "pile_cap",
  "footing",
  "tie_grade_beam",
  "column",
  "shear_wall",
  "beam",
  "slab",
  "stair",
] as const;
export type ElementType = (typeof elementTypes)[number];

/**
 * The identity key's level slot (identity.md §3): a surrogate level id, or a
 * lawful null naming its basis — FOUNDATION (below the level stack) or
 * UNRESOLVED (level not yet authored). Never a bare NULL.
 */
export const levelBases = ["LEVEL", "FOUNDATION", "UNRESOLVED"] as const;
export type LevelBasis = (typeof levelBases)[number];

/**
 * Human acts (identity.md §7): a human write that changes what the machine
 * would derive. Machine authorship is basis + rule id, never an act.
 */
export const actTypes = [
  "LEVEL_AUTHORED",
  "DISCIPLINE_CONFIRMED",
  "MARK_RENAMED",
  "DEFERRAL_FILED",
] as const;
export type ActType = (typeof actTypes)[number];

/**
 * One refusal taxonomy, two originators (identity.md §7, quantity-contract §2).
 * Door refusals: DUPLICATE_IDENTITY (second sighting of the same physical
 * scope), DISCIPLINE_NOT_AUTHORITATIVE (sighting from a discipline that does
 * not own the kind). Scope causes: NOT_IN_PROJECT_SCOPE / NOT_IN_THIS_BILL are
 * human-only; NOT_ESTABLISHED is the machine default; INGESTION_TRUNCATED
 * (a cap you raise) splits from ENTITY_TYPE_UNHANDLED (code nobody wrote).
 *
 * The two scale causes (measurement-rules.md §5, ruled by takeoff ticket 12)
 * are machine-originated and split for the same reason: opposite remedies.
 * SCALE_NOT_AFFIRMED clears with **one** QS act on the family — the ~6–8-act
 * economy the scale group exists for. SCALE_ANISOTROPIC clears with no act at
 * all: X and Y disagree beyond tolerance, so the sheet itself must be
 * re-supplied or rectified, and a two-point act on either axis would only
 * affirm one half of a contradiction. Collapsing them into NOT_ESTABLISHED
 * would route a one-click fix and an un-fixable view into one queue bucket.
 */
export const refusalCauses = [
  "DUPLICATE_IDENTITY",
  "DISCIPLINE_NOT_AUTHORITATIVE",
  "NOT_ESTABLISHED",
  "NOT_IN_PROJECT_SCOPE",
  "NOT_IN_THIS_BILL",
  "INGESTION_TRUNCATED",
  "ENTITY_TYPE_UNHANDLED",
  "SCALE_NOT_AFFIRMED",
  "SCALE_ANISOTROPIC",
] as const;
export type RefusalCause = (typeof refusalCauses)[number];

/**
 * Ingest lifecycle — the screen-facing status of a drawing revision. Failures
 * are loud: a failed ingest carries a named error (CHECK-enforced). `running`
 * exists so a claimed-but-unfinished ingest reads as work in progress rather
 * than as a queue that never started (quantity-contract §2: silence is the
 * condemned state).
 */
export const ingestStatuses = [
  "pending",
  "running",
  "succeeded",
  "failed",
] as const;
export type IngestStatus = (typeof ingestStatuses)[number];

/**
 * The queue row's own lifecycle (ADR-0009), distinct from the ingest's: it
 * describes the *work*, not the evidence. A job is claimed by exactly one
 * worker (`FOR UPDATE SKIP LOCKED`); `running` past its lease is reclaimable.
 */
export const ingestJobStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;
export type IngestJobStatus = (typeof ingestJobStatuses)[number];
