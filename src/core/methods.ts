import type { Decimal } from "decimal.js";
import type { QuantityKind } from "./enums";
import { MeasurementDecimal, evaluateFormula, formulaVariables, renderFormula, type Formula } from "./formula";
import { rccColumnConcreteRectPrism } from "./methods/rcc-column-concrete-rect-prism";
import type { DeductionChannel, GeometryVariant } from "./offer";
import { compareCanonical } from "./order";
import type { RuleSetParameterKey } from "./rule-set";

/**
 * The method registry (measurement-rules.md §1, ADR-0010): `(rule id, version)` resolves to an
 * **evaluator and its declaration** — the formula template, the declared variable names, the
 * geometry variants it accepts, and the rule-set parameter governing each candidate channel.
 *
 * Methods are **code, never configurable**. Parameters are per-project data pinned by a rule-set
 * edition; a method is enumerated by `(rule id, version)` with `pnpm verify`'s `methods:hash`
 * stage asserting a content hash of the implementation file. Adding one is a governed event —
 * implementation, hash, `SEED_METHODS` entry and edition key move together (identity.md §8) — and
 * a project measures under a method only once its edition names it.
 *
 * The gate is the sole caller and is a later ticket. Nothing here reads a database, and nothing
 * here decides whether the method is the *right* one: choosing the formula is the rail's `ruleId`,
 * and this file only says what that name means.
 */

/** What the registry resolves to, per `(rule id, version)`. */
export type MethodDeclaration = {
  readonly ruleId: string;
  readonly version: number;
  /** The kind the method measures — the catalogue supplies its dimension and SI unit. */
  readonly kind: QuantityKind;
  /** The arithmetic and the printed string, one object (formula.ts). */
  readonly formula: Formula;
  /** The shapes it accepts; anything else is `METHOD_GEOMETRY_VARIANT_UNACCEPTED`, never a guess. */
  readonly geometryVariants: readonly [GeometryVariant, ...GeometryVariant[]];
  /** Per candidate channel, the rule-set parameter that governs it — never a literal threshold. */
  readonly channels: { readonly [K in DeductionChannel]?: RuleSetParameterKey };
};

/**
 * Why the registry or the evaluator refuses. Closed codes, never prose (CLAUDE.md); returned,
 * never thrown (ADR-0010: a caught exception silently shortens a bill).
 *
 * - `METHOD_UNKNOWN` — no method of that rule id exists in this binary.
 * - `METHOD_IMPLEMENTATION_MISSING` — the rule id is known and that **version** is not; the case
 *   an edition naming a version this deployment lacks produces.
 * - `METHOD_GEOMETRY_VARIANT_UNACCEPTED` — the offer's shape is not one this method measures.
 * - `METHOD_BINDING_MISSING` / `METHOD_BINDING_UNKNOWN` — a declared variable was not supplied, or
 *   a value was supplied for a name the template never reads. Both refuse: the second is how a
 *   variable rename silently drops a term.
 * - `METHOD_BINDING_MALFORMED` — a value that is not a finite decimal. NaN and Infinity build
 *   without complaint in `Decimal` and store in `numeric`, and a NaN quantity sorts above every
 *   measurement instead of refusing.
 * - `METHOD_VALUE_NON_FINITE` — every input was finite and the result is not.
 *
 * `METHOD_NOT_IN_EDITION` is the gate's, not the registry's: it is answered by the project's
 * pinned edition, which this file never reads.
 */
export const METHOD_REFUSALS = [
  "METHOD_UNKNOWN",
  "METHOD_IMPLEMENTATION_MISSING",
  "METHOD_GEOMETRY_VARIANT_UNACCEPTED",
  "METHOD_BINDING_MISSING",
  "METHOD_BINDING_UNKNOWN",
  "METHOD_BINDING_MALFORMED",
  "METHOD_VALUE_NON_FINITE",
] as const;
export type MethodRefusal = (typeof METHOD_REFUSALS)[number];

/** A refusal states **what** it refused, never merely that it refused. */
export type MethodRefused = { readonly ok: false; readonly reason: MethodRefusal; readonly detail: string };

const refuse = (reason: MethodRefusal, detail: string): MethodRefused => ({ ok: false, reason, detail });

/** What a decimal reads as: sign, digits, an optional fraction, an optional exponent. Nothing else. */
const DECIMAL_LITERAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * The methods this binary implements. One entry per file in `./methods/`; the `methods:hash`
 * verify stage proves the two sets agree and that no file moved under a held version.
 */
const REGISTERED = [rccColumnConcreteRectPrism] as const satisfies readonly MethodDeclaration[];

/** `(rule id, version)` — the key measurement-rules.md §1 enumerates methods by. */
const methodKey = (ruleId: string, version: number) => `${ruleId}@${version}`;

const REGISTRY: ReadonlyMap<string, MethodDeclaration> = (() => {
  const map = new Map<string, MethodDeclaration>();
  for (const method of REGISTERED) {
    const key = methodKey(method.ruleId, method.version);
    // A load-time code fault, not a runtime refusal: two implementations under one key would let
    // one edition key certify two different arithmetics.
    if (map.has(key)) throw new Error(`METHOD_DUPLICATE_REGISTRATION: ${key}`);
    if (!Number.isInteger(method.version) || method.version < 1) {
      throw new Error(`METHOD_VERSION_MALFORMED: ${key}`);
    }
    map.set(key, method);
  }
  return map;
})();

/** Every method in force, in canonical key order — what the manifest and `SEED_METHODS` face. */
export const METHOD_DECLARATIONS: readonly MethodDeclaration[] = [...REGISTRY.entries()]
  .sort(([a], [b]) => compareCanonical(a, b))
  .map(([, method]) => method);

export type MethodResolution = { readonly ok: true; readonly method: MethodDeclaration } | MethodRefused;

/**
 * Resolve `(rule id, version)`. The version is the **edition's**, never the rail's (ADR-0010): an
 * offer names a rule id and no version, and the gate reads the version off the project's pinned
 * edition before calling this.
 */
export function resolveMethod(ruleId: string, version: number): MethodResolution {
  const method = REGISTRY.get(methodKey(ruleId, version));
  if (method) return { ok: true, method };
  const known = METHOD_DECLARATIONS.some((m) => m.ruleId === ruleId);
  return known
    ? refuse("METHOD_IMPLEMENTATION_MISSING", methodKey(ruleId, version))
    : refuse("METHOD_UNKNOWN", ruleId);
}

/** The declared variable names, read off the template so the two cannot disagree. */
export function methodVariables(method: MethodDeclaration): readonly string[] {
  return formulaVariables(method.formula);
}

/**
 * Does this method measure this shape? A slab-soffit method pointed at a frustum is a typed
 * refusal rather than a plausible wrong number (ADR-0010).
 */
export function acceptsGeometry(method: MethodDeclaration, variant: GeometryVariant): { readonly ok: true } | MethodRefused {
  return method.geometryVariants.includes(variant)
    ? { ok: true }
    : refuse("METHOD_GEOMETRY_VARIANT_UNACCEPTED", `${methodKey(method.ruleId, method.version)}:${variant}`);
}

/** What one evaluation produced — the number, and identity.md §6's two artifacts beside it. */
export type MethodEvaluated = {
  readonly ok: true;
  readonly value: Decimal;
  /** The human-auditable formula string, in variable names: `count × L × B × H`. */
  readonly formula: string;
  /** The same template with the values in it — one template, two readings, no second spelling. */
  readonly rendered: string;
  /** The named variables, canonicalised in decimal, as the arithmetic read them. */
  readonly variables: Readonly<Record<string, string>>;
};
export type MethodEvaluation = MethodEvaluated | MethodRefused;

/**
 * Evaluate in **decimal, never a float** (CLAUDE.md). `values` are the variables already
 * normalised to SI by the gate — unit normalisation and `UNIT_UNMAPPED` are the gate's, because a
 * rail converting privately produces a number that arrives already plausible.
 *
 * Missing before unknown, both by name: a variable the template reads and nobody supplied is a
 * shortened bill, and a value nobody reads is a term that silently left the arithmetic.
 */
export function evaluateMethod(
  method: MethodDeclaration,
  values: Readonly<Record<string, string>>,
): MethodEvaluation {
  const declared = methodVariables(method);
  const bound = new Map<string, Decimal>();
  for (const name of declared) {
    const raw = values[name];
    if (raw === undefined) return refuse("METHOD_BINDING_MISSING", name);
    // The literal grammar first, then the constructor: `Decimal` reads `0x1f`, `0b101` and
    // `1_000` as numbers, so a transcribed `1_000` would measure as one thousand instead of
    // refusing, and it builds `NaN` and `Infinity` without complaint. A measurement is a decimal
    // literal or it is a named refusal — never a guess (CLAUDE.md).
    if (!DECIMAL_LITERAL.test(raw)) return refuse("METHOD_BINDING_MALFORMED", name);
    const value = new MeasurementDecimal(raw);
    if (!value.isFinite()) return refuse("METHOD_BINDING_MALFORMED", name);
    bound.set(name, value);
  }
  for (const name of Object.keys(values).sort(compareCanonical)) {
    if (!bound.has(name)) return refuse("METHOD_BINDING_UNKNOWN", name);
  }

  // `bound` is total over the template's variables, checked immediately above, so the resolver is
  // total and there is no lookup failure to swallow inside the arithmetic.
  const resolved = (name: string): Decimal => bound.get(name) as Decimal;
  const value = evaluateFormula(method.formula, resolved);
  if (!value.isFinite()) return refuse("METHOD_VALUE_NON_FINITE", methodKey(method.ruleId, method.version));

  return {
    ok: true,
    value,
    formula: renderFormula(method.formula),
    rendered: renderFormula(method.formula, (name) => resolved(name).toFixed()),
    variables: Object.fromEntries(declared.map((name) => [name, resolved(name).toFixed()])),
  };
}
