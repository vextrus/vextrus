/**
 * The register's closed vocabularies (ADR-0002: a domain enum is a TS const; the column stores
 * text with a CHECK derived from the same const — one declaration site, `enumCheck` in
 * db/schema/core.ts is its emission). Adding a value is a diff here and a new migration, never a
 * string at a call site. Reason codes are closed enums, never prose (CLAUDE.md).
 */

/**
 * The disciplines a drawing may be confirmed as (identity.md §2: discipline is drawing-scoped,
 * machine-proposed, human-confirmed, fails closed; each quantity kind has exactly one
 * authoritative discipline). The four the law names: measurement-rules.md §8 (structural
 * members, the architectural sheet, MEP runs), bd-authority.md (Electrical · Plumbing bills).
 */
export const DISCIPLINES = ["STRUCTURAL", "ARCHITECTURAL", "PLUMBING", "ELECTRICAL"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

/**
 * The element classes the register keys on (identity.md §2 — the class is in the key, the
 * kind is not, measurement-rules.md §8). Foundation classes take the lawful-null level basis
 * and vertical classes expand per level (cad-ingestion.md §9); the rest are the members and
 * faces formulas.md prices. The first slice is COLUMN (docs/specs/genesis-ii.md §8).
 */
export const ELEMENT_TYPES = [
  "PILE",
  "PILE_CAP",
  "FOOTING",
  "GRADE_BEAM",
  "COLUMN",
  "SHEAR_WALL",
  "BEAM",
  "SLAB",
  "STAIR",
  "WALL",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

/**
 * The lawful-null level slot (identity.md §3): a register object without a level names why —
 * a foundation class has no storey; an unresolved one has not been placed on the stack yet
 * (the one-hop carry authors it exactly once). A null level with no basis is unrepresentable.
 */
export const LEVEL_BASES = ["FOUNDATION", "UNRESOLVED"] as const;
export type LevelBasis = (typeof LEVEL_BASES)[number];

/** Basis — where a number came from (quantity-contract.md §1), ordered by strength. */
export const BASES = ["MEASURED", "TRANSCRIBED", "DERIVED", "IMPORTED", "ENTERED", "INTERPRETED", "DEFAULTED"] as const;
export type Basis = (typeof BASES)[number];

/**
 * A storey height is quantity-determining, so DEFAULTED is barred; it is read from a schedule,
 * derived, or typed by a named human — never measured off a plan (measurement-rules.md §7).
 */
export const LEVEL_HEIGHT_BASES = ["TRANSCRIBED", "DERIVED", "ENTERED"] as const satisfies readonly Basis[];
export type LevelHeightBasis = (typeof LEVEL_HEIGHT_BASES)[number];

/**
 * The human acts the skeleton's tables can carry (identity.md §7: append-only, human-only,
 * act and state change in one transaction). CONFIRM_DISCIPLINE — §2, a drawing is walked only
 * once a human confirms its discipline. RENAME_MARK — §2, a mark rename is an authored event,
 * never automatic detection. REPUDIATE — §7, "that is not a column" moves the object to the
 * refused-sightings table; human-only. Acts that need tables not yet built (pinning a set
 * revision, deferral, transcription, corroboration) land with those tables.
 */
export const ACT_TYPES = ["CONFIRM_DISCIPLINE", "RENAME_MARK", "REPUDIATE"] as const;
export type ActType = (typeof ACT_TYPES)[number];

/**
 * Why a sighting sits in the refused-sightings table instead of the register (identity.md §2,
 * §7, §9): a second sighting of registered scope within one set revision is refused at the door
 * as DUPLICATE_IDENTITY; a human repudiation retires the object as REPUDIATED. Machine and human
 * share one taxonomy — one closed enum, two originators.
 */
export const REFUSED_SIGHTING_CAUSES = ["DUPLICATE_IDENTITY", "REPUDIATED"] as const;
export type RefusedSightingCause = (typeof REFUSED_SIGHTING_CAUSES)[number];
