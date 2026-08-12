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
 */
export const refusalCauses = [
  "DUPLICATE_IDENTITY",
  "DISCIPLINE_NOT_AUTHORITATIVE",
  "NOT_ESTABLISHED",
  "NOT_IN_PROJECT_SCOPE",
  "NOT_IN_THIS_BILL",
  "INGESTION_TRUNCATED",
  "ENTITY_TYPE_UNHANDLED",
] as const;
export type RefusalCause = (typeof refusalCauses)[number];

/**
 * Ingest lifecycle. Failures are loud: a failed ingest carries a named error
 * (CHECK-enforced). Ticket 04's queue decision may extend this.
 */
export const ingestStatuses = ["pending", "succeeded", "failed"] as const;
export type IngestStatus = (typeof ingestStatuses)[number];
