import { createHash } from "node:crypto";
import {
  ELEMENT_TYPES,
  QUANTITY_DIMENSIONS,
  SI_UNITS,
  type Discipline,
  type ElementType,
  type MeasurementAlgebra,
  type QuantityKind,
} from "./enums";
import { compareCanonical } from "./order";

/**
 * The kind axis and the guarantees that keep it honest (measurement-rules.md §8): selection runs
 * on four code-owned artifacts — the closed `QUANTITY_KINDS` enum (declared with the register's
 * other vocabularies in enums.ts), a total **kind → authoritative discipline** map, a total
 * **kind → algebra** map, and the **`bears`** relation on `(element class × kind)`. This file is
 * the declaration site of the other three, of the naming law §4 closes, and of the catalogue
 * digest a campaign later pins (identity.md §8). Nothing here measures anything.
 */

/**
 * Kind → the one discipline authorised to originate it (identity.md §2: each quantity kind has
 * exactly one authoritative discipline, which is what makes a second sighting of the same
 * physical scope refusable at the door instead of a merge nobody can audit).
 *
 * Typed as a total record: adding a kind without deciding its discipline fails `typecheck`.
 * **Not derived from the algebra map below, and never collapsed into it** — collapsing the two
 * yields discipline → algebra, which is the per-drawing rail selection §8 bans. All three seed
 * kinds are structural, so the two maps look redundant today; the first architectural kind, where
 * one sheet originates both a brick volume and a finish area, is what exercises the split.
 */
export const KIND_AUTHORITATIVE_DISCIPLINE = {
  RCC_CONCRETE: "STRUCTURAL",
  FORMWORK: "STRUCTURAL",
  REINFORCEMENT: "STRUCTURAL",
} as const satisfies Record<QuantityKind, Discipline>;

/**
 * Kind → the algebra that measures it (measurement-rules.md §8: the rail is selected per quantity
 * kind, never per drawing). Total for the same reason as the map above, and declared
 * independently of it. Reinforcement is member algebra too — *section × run + bar rule* is the
 * bar rule's own clause — although no rail emits it yet.
 */
export const KIND_ALGEBRA = {
  RCC_CONCRETE: "MEMBER",
  FORMWORK: "MEMBER",
  REINFORCEMENT: "MEMBER",
} as const satisfies Record<QuantityKind, MeasurementAlgebra>;

/**
 * The element classes that bear no kind yet, and why (measurement-rules.md §4: *a class that
 * bears no kind is declared, never absent* — a sighted class missing from both sets contributes
 * zero rows to the residue denominator and its wholly unmeasured scope then reports nothing).
 * The certificate prints the **sighted** members of this set as a boundary statement.
 */
export const UNBORNE_ELEMENT_TYPES = [
  "PILE",
  "PILE_CAP",
  "FOOTING",
  "GRADE_BEAM",
  "SHEAR_WALL",
  "BEAM",
  "SLAB",
  "STAIR",
  "WALL",
] as const satisfies readonly ElementType[];
export type UnborneElementType = (typeof UNBORNE_ELEMENT_TYPES)[number];

/** The one cause an unborne class carries: the vocabulary has not reached it, nothing else. */
export const UNBORNE_CAUSE = "KIND_NOT_YET_SEEDED";

/** A class that bears at least one kind: exactly the classes the unborne set does not name. */
export type BearingElementType = Exclude<ElementType, UnborneElementType>;

/**
 * `bears` — what an element class **lawfully bears**, never what a rail emits (measurement-rules.md
 * §8). It carries the kind axis **outside the identity key**: the class is in the key, the kind is
 * not, and the kinds a class bears are looked up, never stored on the register row.
 *
 * Exhaustive membership is a type, not a test: the key type excludes every unborne class, so a
 * class in both sets is unrepresentable, and a class in neither leaves this record missing a key.
 * Adding an element class therefore fails `typecheck` until it is declared borne or unborne.
 *
 * Reinforcement is seeded although nothing measures it — seeded to the build state, the relation
 * becomes a changelog and the residue reports nothing.
 */
export const BEARS = {
  COLUMN: ["RCC_CONCRETE", "FORMWORK", "REINFORCEMENT"],
} as const satisfies Record<BearingElementType, readonly [QuantityKind, ...QuantityKind[]]>;

/** One cell of the relation: the pair the residue is keyed on and the digest is computed over. */
export type BearsPair = { readonly elementType: ElementType; readonly kind: QuantityKind };

/** `bears` flattened to its cells, the form the digest and the residue denominator both read. */
export const BEARS_PAIRS: readonly BearsPair[] = Object.entries(BEARS).flatMap(([elementType, kinds]) =>
  (kinds as readonly QuantityKind[]).map((kind) => ({ elementType: elementType as ElementType, kind })),
);

/** The kind set as a **projection of `bears`**, never as its own content (identity.md §8). */
export function bornKinds(pairs: readonly BearsPair[]): readonly QuantityKind[] {
  return [...new Set(pairs.map((p) => p.kind))].sort(compareCanonical);
}

/** Why a catalogue digest refuses. Closed codes, never prose (CLAUDE.md). */
export const CATALOGUE_DIGEST_REFUSALS = ["CATALOGUE_BEARS_EMPTY", "CATALOGUE_BEARS_DUPLICATE_PAIR"] as const;
export type CatalogueDigestRefusal = (typeof CATALOGUE_DIGEST_REFUSALS)[number];

/**
 * The catalogue digest (identity.md §8, as amended 2026-08-16): a content address over **`bears`**
 * — canonically sorted `class:kind` pairs — that a campaign pins, so a kind or a `bears` row
 * shipped after a signature cannot silently widen what that signature covered. A label or
 * description change moves no denominator and voids nothing, which is why the digest reads the
 * relation and not the catalogue's strings.
 *
 * The construction is the drawing-set revision key's, deliberately (identity.ts): SHA-256 over
 * members joined by newline, sorted with the one canonical comparator, refusals by closed code.
 * An empty relation is refused because a denominator of nothing certifies everything as measured.
 */
export function catalogueDigest(pairs: readonly BearsPair[]): string {
  if (pairs.length === 0) throw new Error("CATALOGUE_BEARS_EMPTY: the relation has at least one (class, kind) pair");
  const seen = new Set<string>();
  const members: string[] = [];
  for (const p of pairs) {
    const member = `${p.elementType}:${p.kind}`;
    if (seen.has(member)) throw new Error(`CATALOGUE_BEARS_DUPLICATE_PAIR: ${member}`);
    seen.add(member);
    members.push(member);
  }
  members.sort(compareCanonical);
  return createHash("sha256").update(members.join("\n")).digest("hex");
}

/**
 * The digest of the relation **as shipped in this binary**. A campaign pins the digest of the
 * relation as *deployed* (`catalogueDigestInForce` in campaigns.ts reads the table), so this const
 * is the code side of that pair: the seed guard and the campaign tests assert the two agree.
 */
export const CATALOGUE_DIGEST = catalogueDigest(BEARS_PAIRS);

/** Which arm of the naming law a name breaks (measurement-rules.md §4). Closed, never prose. */
export const KIND_NAMING_REFUSALS = [
  "KIND_NAMES_DIMENSION",
  "KIND_NAMES_UNIT",
  "KIND_NAMES_ELEMENT_CLASS",
] as const;
export type KindNamingRefusal = (typeof KIND_NAMING_REFUSALS)[number];

/** The offending token, named: a refusal states what it refused, never that it refused. */
export type KindNamingViolation = { readonly reason: KindNamingRefusal; readonly token: string };

/**
 * The dimension tokens, from the dimension vocabulary itself plus the synonym §4 names. The clause
 * lists four (`AREA · LENGTH · COUNT · WEIGHT`) and the amendment widens it to the category:
 * `VOLUME` is a dimension the list omitted, and `WEIGHT` is the colloquial name for `MASS`.
 */
const DIMENSION_TOKENS: readonly string[] = [...QUANTITY_DIMENSIONS, "WEIGHT"];

/**
 * Unit abbreviations — *a unit abbreviation names a dimension in shorthand* (§4). The SI units the
 * register stores, plus the market's shorthand: BD's private market prices in sft/cft/rft
 * (bd-authority.md §3), and a kind named for one is the dimension ban wearing a local costume.
 */
const UNIT_TOKENS: readonly string[] = [
  ...SI_UNITS.map((u) => u.toUpperCase()),
  "CUM",
  "CUFT",
  "CFT",
  "SQM",
  "SQFT",
  "SFT",
  "RFT",
  "RM",
  "LM",
  "MM",
  "M2",
  "M3",
  "NO",
  "NOS",
  "MT",
  "TON",
  "TONNE",
];

/** Does `tokens` contain `phrase` as a contiguous run — so `PILE_CAP` is caught whole, not halved? */
function containsPhrase(tokens: readonly string[], phrase: readonly string[]): boolean {
  return tokens.some((_, i) => phrase.every((t, j) => tokens[i + j] === t));
}

/**
 * The naming law, mechanical (measurement-rules.md §4, 2026-08-16): a kind's name may carry trade
 * and material tokens only. A dimension-named kind is the defect class that produced a measured
 * 20.2× overcharge (plaster waved through at a painting rate). A class-named kind is the same
 * category error: a kind is deliberately coarser than the book item — one kind covers PWD's twelve
 * member-type sub-items — so `RCC_COLUMN_CONCRETE` would cover exactly one of them, and it would
 * make `bears` derivable from a substring, which is *the class is in the key, the kind is not*
 * violated by spelling.
 *
 * The element-class arm reads `ELEMENT_TYPES`, so adding a class re-runs the ban with no edit here.
 */
export function kindNamingViolation(name: string): KindNamingViolation | null {
  const tokens = name.split("_");
  for (const token of tokens) {
    if (DIMENSION_TOKENS.includes(token)) return { reason: "KIND_NAMES_DIMENSION", token };
    if (UNIT_TOKENS.includes(token)) return { reason: "KIND_NAMES_UNIT", token };
  }
  for (const elementType of ELEMENT_TYPES) {
    if (containsPhrase(tokens, elementType.split("_"))) return { reason: "KIND_NAMES_ELEMENT_CLASS", token: elementType };
  }
  return null;
}
