import type { Basis, ElementType, QuantityKind } from "./enums";
import type { SourceKey } from "./model";

/**
 * The offer contract (ADR-0010; measurement-rules.md §8 as amended 2026-08-17 by #135;
 * quantity-contract.md §1, §2.2): what a rail hands over, and — far more of the work — what a
 * rail **cannot express**.
 *
 * A rail is a pure function returning offers; the gate is the spine's sole writer of quantity
 * lines. The rail owns geometry, the spine owns arithmetic. Every guarantee in that clause is a
 * guarantee about a **type**: a rail that can express a computed value has authored *done* no
 * matter what the prose says. So there is **no field on `Offer` where a computed value could
 * land** — no value, no `quantityBasis`, no `selectionBasis`, no line — and none where a rail
 * could deny something either: there is no `absent()` constructor anywhere in this tree, and an
 * empty `offers` list says nothing rather than denying anything (quantity-contract.md §2.2).
 *
 * Nothing in this file writes, computes or refuses. The gate that consumes it is a later ticket.
 */

/**
 * A reference to the register object the offer enriches (identity.md §2). The **level is the
 * object's**, never the offer's: identity is `(project, discipline, level, element type, mark,
 * ordinal)`, and a vertical member expanded across the level stack registers one object per level
 * (cad-ingestion.md §9, quantity-contract.md §1 as amended 2026-08-17 by #134). A level on the
 * offer would be a second spelling of a fact the key already carries, free to disagree with it.
 * The project scope comes from the seam (`forTenant`), never from a field here.
 */
export type RegisterObjectRef = { readonly objectId: string };

/**
 * Where the reading was taken (identity.md §3: a view key is view class + caption-anchor source
 * key; measurement-rules.md §5 as amended: *an offer carries geometry in drawing units plus the
 * view it was read from, and the gate resolves the calibration in force*). The view key is an
 * opaque token here — its grammar lands with the view partition (cad-ingestion.md §11), and this
 * contract must not fix it early.
 */
export type ViewRef = {
  readonly drawingId: string;
  readonly drawingRevisionId: string;
  readonly viewKey: string;
};

/**
 * The calibration a `MEASURED` reading was taken under (measurement-rules.md §5 as amended
 * 2026-08-16, identity.md §6): a **content-addressed key** over `(view key, factorX, factorY)`
 * with the affirming act id beside it, so a re-affirmation deriving the identical factor
 * supersedes nothing. The digest itself belongs to the scale arc; carrying the reference is this
 * contract's job.
 */
export type CalibrationRef = { readonly key: string; readonly actId: string };

/**
 * Provenance, per reading — quantity-contract.md §1's *basis is carried per attribute* and
 * identity.md §6's *calibration reference per measured attribute*, read literally. The
 * calibration reference is present **exactly where the basis is `MEASURED`**, and that is a
 * discriminated union rather than an optional field plus a check: a measured reading with no
 * calibration does not compile, and a transcribed one cannot smuggle a calibration it never had.
 *
 * `sources` is a non-empty tuple: every reading names the entity it was read off
 * (cad-ingestion.md §3 — a source key names exactly one EntityGraph original entity).
 */
export type Provenance =
  | { readonly basis: "MEASURED"; readonly calibration: CalibrationRef; readonly sources: readonly [SourceKey, ...SourceKey[]] }
  | { readonly basis: Exclude<Basis, "MEASURED">; readonly sources: readonly [SourceKey, ...SourceKey[]] };

/**
 * A bound reading — **never a bare number** (ADR-0010). The raw value as read plus the unit it was
 * read in: the gate normalises in decimal and refuses `UNIT_UNMAPPED`, which is only reachable if
 * the unit *reaches* the refusing party. A rail converting privately produces a number that
 * arrives already plausible, so a wrong factor is invisible.
 *
 * `value` is a decimal string, never a float (CLAUDE.md); the gate refuses one that is not a
 * finite decimal. `unit` is deliberately **not** a closed union: the unit canon (formulas.md §6)
 * is the gate's, and a type that admitted only mapped units would make `UNIT_UNMAPPED`
 * unreachable — a refusal no input can produce is a refusal that does not exist.
 */
export type BoundValue = { readonly value: string; readonly unit: string } & Provenance;

/**
 * The shapes a rail may offer (formulas.md §1's discriminated union). **One variant, because one
 * method measures one shape**: a variant enters this union with the method that measures it, for
 * `SEED_METHODS`' reason — a name for a shape no code can measure is a fiction, and a rail able to
 * spell it would be offering geometry no method accepts. `PRISM_POLY`, `FRUSTUM_RECT`,
 * `TAPER_LINEAR` and `AREA_THICK` arrive with theirs.
 *
 * The dimension fields are the method's variable names for this shape (`geometryVariables` below),
 * so the template's `L × B × H` and the geometry that supplies them are one vocabulary.
 */
export type GeometrySpec = {
  readonly variant: "PRISM_RECT";
  readonly L: string;
  readonly B: string;
  readonly H: string;
};

/** The variants the register's shapes are enumerated by — the closed set a method accepts from. */
export const GEOMETRY_VARIANTS = ["PRISM_RECT"] as const;
export type GeometryVariant = (typeof GEOMETRY_VARIANTS)[number];

/**
 * Geometry is **its own field with its own basis** (ADR-0010), not dissolved into scalars:
 * quantity-contract.md §1's roll-up ranges over *determining attributes and the geometry*,
 * formulas.md §1's refusals are shape judgements, and a method that declares which variants it
 * accepts turns a slab-soffit method pointed at a frustum into a typed refusal rather than a
 * plausible wrong number. An **expanded** member's geometry carries basis `DERIVED` — the outline
 * on the seventh floor was not read from the seventh floor's drawing (quantity-contract.md §1,
 * amended 2026-08-17).
 *
 * The dimensions are in **drawing units** and the gate applies the calibration in force
 * (measurement-rules.md §5): a rail handing over metres has applied a factor the gate never
 * checked, which makes the NOT NULL calibration reference decorative.
 */
export type OfferGeometry = { readonly spec: GeometrySpec; readonly unit: string } & Provenance;

/**
 * A shape's dimensions as the method's variables see them. The one place the shape's field names
 * meet the template's variable names, so a method whose formula reads `L × B × H` and a geometry
 * variant that supplies `L`, `B` and `H` agree by construction — and a variant that supplies other
 * names refuses as a missing binding rather than measuring something else.
 */
export function geometryVariables(spec: GeometrySpec): Readonly<Record<string, string>> {
  return { L: spec.L, B: spec.B, H: spec.H };
}

/**
 * The channels a deduction candidate may ride (measurement-rules.md §2, §3). The **method**
 * declares the rule-set parameter governing each channel it recognises; the rail supplies
 * candidates and **no sums**. Were the rail to name the threshold it could route an opening at the
 * duct threshold and deduct what the law retains.
 */
export const DEDUCTION_CHANNELS = ["OPENING", "MEMBER_END", "EMBEDDED_DUCT"] as const;
export type DeductionChannel = (typeof DEDUCTION_CHANNELS)[number];

/**
 * A candidate: geometry, basis and source entity — **no sum, no area, no verdict**. Whether it
 * deducts is the pinned parameter's answer, computed at the gate on **strictly greater**, with the
 * deducted sum, the ignored sum, both counts and the threshold in force landing in the line's
 * variables (measurement-rules.md §2).
 */
export type DeductionCandidate = { readonly geometry: OfferGeometry };

/**
 * Candidates per channel. Partial by design: a channel a rail says nothing about is a channel it
 * says nothing about — quantity-contract.md §2.2's one-way valve, which an empty array would also
 * satisfy and a mandatory key would quietly turn into a claim.
 */
export type DeductionCandidates = { readonly [K in DeductionChannel]?: readonly DeductionCandidate[] };

/**
 * What a rail hands over. It names a **`ruleId` and no version**: the gate resolves the version
 * from the project's pinned rule-set edition (identity.md §8) and refuses `METHOD_NOT_IN_EDITION`
 * when the edition does not name it. A rail naming its own version would let two rails price one
 * campaign under two versions of one method while the edition key certifies them as one rule set.
 *
 * Two attribute channels, not one (ADR-0010): `bindings` are the method's declared variables,
 * `selectors` are item-selecting attributes, and an attribute whose role is *both* appears in
 * each. They are consumed by different machinery — evaluator and catalogue selection — which makes
 * quantity-contract.md §1's two roll-ups mechanical: `quantityBasis` weakest over bindings plus
 * geometry, `selectionBasis` weakest over selectors. Neither is on this type; both are derived at
 * the gate and neither is stored.
 */
export type Offer = {
  readonly object: RegisterObjectRef;
  readonly kind: QuantityKind;
  readonly view: ViewRef;
  readonly ruleId: string;
  readonly geometry: OfferGeometry;
  readonly bindings: Readonly<Record<string, BoundValue>>;
  readonly selectors: Readonly<Record<string, BoundValue>>;
  readonly deductions?: DeductionCandidates;
};

/**
 * What a rail says when it did not offer (quantity-contract.md §2.2, ADR-0010). The code is
 * **rail-local** — §2.2 requires the rail's *own vocabulary* while CLAUDE.md requires a closed
 * enum, and a rail-local closed enum is both, and can never be coerced into a **cause**, whose
 * taxonomy carries originator legality. It is keyed by `(element class × quantity kind)` because
 * that is §2.2's residue grain: an observation keyed only by an object cannot be joined to the
 * cell whose absence it explains, and a rail that sighted a class with no measurable instance has
 * no object to point at — hence the optional reference.
 *
 * This is evidence riding the residue, never an absence: the residue query stays the sole author
 * of causes.
 */
export type RailObservation<Code extends string> = {
  readonly code: Code;
  readonly elementType: ElementType;
  readonly kind: QuantityKind;
  readonly sources: readonly [SourceKey, ...SourceKey[]];
  readonly object?: RegisterObjectRef;
};

/**
 * A rail's return type — `{ offers, observations }` and nothing else. There is no third arm: a
 * rail that cannot measure must not be able to launder that into a refusal the gate owns, and
 * malformed geometry is a **non-offer** carrying an observation, because it is a geometry
 * judgement (measurement-rules.md §8 gives the rail geometry) and it must reach the residue as
 * evidence so the certificate declares the unmeasured scope.
 */
export type RailResult<Code extends string> = {
  readonly offers: readonly Offer[];
  readonly observations: readonly RailObservation<Code>[];
};

/**
 * A rail: **pure**, taking whatever its algebra needs and returning offers and observations. Core
 * declares the interface and a rail is passed in — a rail lives in `src/modules/takeoff/` and core
 * never imports a module (ADR-0005), which is what makes the gate structurally unable to depend on
 * the rails it polices.
 */
export type Rail<Input, Code extends string> = (input: Input) => RailResult<Code>;
