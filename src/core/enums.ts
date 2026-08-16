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
 * refused-sightings table; human-only. PIN_DRAWING_SET — §9, opening a campaign pins a set
 * revision and snapshots the rules that will measure it; the act is minted, the scope it names is
 * derived. Acts that need tables not yet built (re-pin, deferral, transcription, corroboration)
 * land with those tables.
 */
export const ACT_TYPES = ["CONFIRM_DISCIPLINE", "RENAME_MARK", "REPUDIATE", "PIN_DRAWING_SET"] as const;
export type ActType = (typeof ACT_TYPES)[number];

/**
 * A campaign's state (identity.md §8, §9): one live measurement effort per project — two lineages
 * over one project scope would both claim first registration for one ordinal — and a superseded
 * campaign that stays readable, because a superseded pin is history, like a superseded placement.
 * Not a status flag standing in for a fact: it is the slot the partial unique index keys on.
 */
export const CAMPAIGN_STATES = ["LIVE", "SUPERSEDED"] as const;
export type CampaignState = (typeof CAMPAIGN_STATES)[number];

/**
 * Why a sighting sits in the refused-sightings table instead of the register (identity.md §2,
 * §7, §9): a second sighting of registered scope within one set revision is refused at the door
 * as DUPLICATE_IDENTITY; a human repudiation retires the object as REPUDIATED. Machine and human
 * share one taxonomy — one closed enum, two originators.
 */
export const REFUSED_SIGHTING_CAUSES = ["DUPLICATE_IDENTITY", "REPUDIATED"] as const;
export type RefusedSightingCause = (typeof REFUSED_SIGHTING_CAUSES)[number];

/**
 * The quantity kinds — the trade axis every quantity line is keyed on (measurement-rules.md §4:
 * `kind = (chapter × dimension), named for the trade`; §8: the closed enum selection runs on).
 * Code-owned and closed: no tenant, project or drawing invents a kind, because the coverage
 * denominator is enumerated from this list and a kind nothing knows how to price is a hole in the
 * certificate. The naming law is closed too — trade and material tokens only, never a dimension,
 * a unit, an element class, a pricing role or a chapter code (`kindNamingViolation` in kinds.ts
 * is its mechanical form).
 *
 * The chapter is **cited as evidence here, never carried as a field** (§4's 2026-08-16 amendment,
 * bd-authority.md §4: a chapter reference is `(book, chapter)` and numbering differs across books,
 * so a code-owned chapter column would pin a platform enum to one edition of one book):
 *
 * - `RCC_CONCRETE` — PWD SoR Ch. 07 (items 07.1–07.11), measured on the gross concrete section
 *   with no deduction for reinforcement (bd-authority.md §4).
 * - `FORMWORK` — ships **uncited**: contact area priced by structural member is PWD's twelve
 *   sub-items, whose chapter this repo has not established. Uncited, never under a fallback name.
 * - `REINFORCEMENT` — a separate chapter from the concrete it sits in (bd-authority.md §4), also
 *   uncited here. Seeded although nothing measures it: `bears` states what a class **lawfully
 *   bears**, never what a rail emits, so column steel can be reported absent rather than in
 *   silence.
 */
export const QUANTITY_KINDS = ["RCC_CONCRETE", "FORMWORK", "REINFORCEMENT"] as const;
export type QuantityKind = (typeof QUANTITY_KINDS)[number];

/**
 * The four measurement algebras (measurement-rules.md §8): member (section × run + bar rule —
 * structure and brick walls), face (a face of a space, gross less scheduled openings), network
 * (runs by diameter), topology (a pipe tee is a junction in the run graph, not a symbol anyone
 * drew). The algebra is selected **per quantity kind, never per drawing**.
 */
export const MEASUREMENT_ALGEBRAS = ["MEMBER", "FACE", "NETWORK", "TOPOLOGY"] as const;
export type MeasurementAlgebra = (typeof MEASUREMENT_ALGEBRAS)[number];

/**
 * The physical dimensions a quantity may carry. Two jobs: the catalogue states each kind's
 * dimension beside its SI unit (the unit is the dimension's lock when a rate item joins up on the
 * kind — measurement-rules.md §4), and the naming ban is a token test over this set (§4's
 * 2026-08-16 amendment: *the ban is on the dimension category, not on a list of four*).
 */
export const QUANTITY_DIMENSIONS = ["LENGTH", "AREA", "VOLUME", "MASS", "COUNT"] as const;
export type QuantityDimension = (typeof QUANTITY_DIMENSIONS)[number];

/**
 * The canonical SI units a quantity is stored and computed in (bd-authority.md §3: Standards of
 * Weights and Measures Act 2018 §4(1) makes SI the standard, §68(2) bars keeping any written
 * measurement record in a non-standard unit). Imperial is lawful only as an input read off a
 * sheet, retained as provenance; documents own presentation, the register never does.
 */
export const SI_UNITS = ["m", "m²", "m³", "kg", "nr"] as const;
export type SiUnit = (typeof SI_UNITS)[number];
