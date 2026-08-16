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
 * derived. REPIN_DRAWING_SET — §9, the only way a campaign's pins advance: one act naming the
 * outgoing and incoming keys, the member changes between them, and the consequences stated before
 * it commits. Acts that need tables not yet built (deferral, transcription, corroboration) land
 * with those tables.
 */
export const ACT_TYPES = [
  "CONFIRM_DISCIPLINE",
  "RENAME_MARK",
  "REPUDIATE",
  "PIN_DRAWING_SET",
  "REPIN_DRAWING_SET",
] as const;
export type ActType = (typeof ACT_TYPES)[number];

/**
 * A campaign's state (identity.md §8, §9): one **current** measurement effort per project — two
 * lineages over one project scope would both claim first registration for one ordinal — and a
 * superseded campaign that stays readable, because a superseded pin is history, like a superseded
 * placement. Not a status flag standing in for a fact: it is the slot the partial unique index
 * keys on, and the slot the state-transition trigger walks.
 *
 * SIGNED is the campaign-level fact §8 states in its own words — *one edition, two consequences:
 * unsigned → stale (freshness gate); signed → voids whole*. The signature's own row (credential,
 * verdict, boundary) belongs to the signature arc and is not here; what is here is the slot the
 * re-pin act must read to know whether it voids something, because §9 forbids a re-pin under a
 * signature from being silently blocked or silently applied. A signed campaign is still current —
 * it holds the project's one lineage slot — and a re-pin moves it to SUPERSEDED, which **is** the
 * voiding: the void is a transition in the log, never a flag somebody must remember to set.
 */
export const CAMPAIGN_STATES = ["LIVE", "SIGNED", "SUPERSEDED"] as const;
export type CampaignState = (typeof CAMPAIGN_STATES)[number];

/**
 * What a campaign pins, and therefore what the freshness diff reads (identity.md §8, amended
 * 2026-08-16: *a campaign snapshots what it cites; staleness is a diff, never a flag*). Two
 * snapshots, two independent ways to diverge: the project's rule-set edition, which a re-pin
 * advances, and the catalogue digest, which a shipped kind or `bears` row moves. The drawing-set
 * revision is not here — a campaign's manifest never follows a newer set (§9: advance, never
 * drift), so it cannot go out of date underneath itself; it changes only by an authored re-pin.
 */
export const CAMPAIGN_PINS = ["CATALOGUE", "RULE_SET_EDITION"] as const;
export type CampaignPin = (typeof CAMPAIGN_PINS)[number];

/**
 * The freshness verdict — closed, and computed on every read (identity.md §8): the campaign's
 * snapshots against what is in force now. Nothing stores it, because a stored flag is one
 * forgotten write from lying, and the diff is cheap enough to be the truth every time.
 */
export const CAMPAIGN_FRESHNESS_VERDICTS = ["CURRENT", "STALE"] as const;
export type CampaignFreshnessVerdict = (typeof CAMPAIGN_FRESHNESS_VERDICTS)[number];

/**
 * The refusal a stale campaign carries (identity.md §8: *the signature act refuses `PIN_STALE`,
 * cleared only by an authored re-pin*). It is a **signing** refusal and nothing else: measuring,
 * ingest and registration continue on a stale campaign, because a partial faulty estimate is
 * harmful and an unmeasured one is merely unfinished. The gate that consumes this code lands with
 * the signature arc; the code is declared here so that when it does, it is closed and not prose.
 */
export const CAMPAIGN_FRESHNESS_REFUSALS = ["PIN_STALE"] as const;
export type CampaignFreshnessRefusal = (typeof CAMPAIGN_FRESHNESS_REFUSALS)[number];

/**
 * What a re-pin does to the work already done — the consequences identity.md §9 requires stated
 * **at the act, before it commits**, so a QS learns that a signature is about to void before
 * voiding it. Closed, and canonically ordered: the consequence list is content-addressed into the
 * statement the caller must carry back, so its order is part of an identity, not a display choice.
 *
 * - CATALOGUE_MOVES — the campaign's catalogue snapshot advances, so the coverage denominator
 *   `quantity-contract.md` §6 enumerates is a different denominator (§8, amended 2026-08-16).
 * - DENOMINATOR_WIDENS — a member was **added** to the manifest, widening the scope register's
 *   denominator (`quantity-contract.md` §2.2), so a line that was COMPLETE may become
 *   PARTIAL_DECLARED. §9 names this one alone as what forbids an implicit re-pin.
 * - EVIDENCE_MOVED — a member was removed or re-revved, so rows whose cited evidence moved
 *   re-present for disposition (§5).
 * - RULE_SET_EDITION_MOVES — the campaign's rule-set snapshot advances: different thresholds and
 *   methods measure from here on.
 * - SIGNATURE_VOIDS_WHOLE — the outgoing campaign is signed, and §8 voids a signature **whole**.
 *   Partial invalidation is not on offer; a re-pin under a signature is permitted and voids it.
 */
export const REPIN_CONSEQUENCES = [
  "CATALOGUE_MOVES",
  "DENOMINATOR_WIDENS",
  "EVIDENCE_MOVED",
  "RULE_SET_EDITION_MOVES",
  "SIGNATURE_VOIDS_WHOLE",
] as const;
export type RepinConsequence = (typeof REPIN_CONSEQUENCES)[number];

/**
 * Why a re-pin refuses (identity.md §9). Closed codes, never prose.
 *
 * - REPIN_CAMPAIGN_NOT_CURRENT — the campaign named is superseded. History is read, never
 *   re-pinned; its successor is the campaign that advances.
 * - REPIN_CONSEQUENCES_NOT_CARRIED — the caller did not carry back the statement it was given, or
 *   the world moved between the statement and the act. A re-pin cannot be performed blind: the
 *   consequences are recomputed inside the writing transaction and must still address what the
 *   caller acknowledged.
 * - REPIN_NOTHING_MOVED — the incoming set revision and both pins are the outgoing ones. §9's
 *   reason exactly: *re-pinning an unchanged set would void a signature that nothing invalidated*.
 */
export const REPIN_REFUSALS = [
  "REPIN_CAMPAIGN_NOT_CURRENT",
  "REPIN_CONSEQUENCES_NOT_CARRIED",
  "REPIN_NOTHING_MOVED",
] as const;
export type RepinRefusal = (typeof REPIN_REFUSALS)[number];

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
