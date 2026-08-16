import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";
import { compareCanonical } from "./order";

/**
 * The measurement rule set (measurement-rules.md §1, identity.md §8): rules a human may author
 * are **data** — parameters, versioned and clause-cited; methods stay code, enumerated by
 * `(rule id, version)`. This file is the parameter vocabulary, the platform seed, and the key.
 */

/**
 * The parameter keys a rule set carries (measurement-rules.md §1's table). A closed vocabulary
 * beside the register's others (src/core/enums.ts): the const is the single declaration site and
 * the CHECK on `rule_set_edition_parameters.key` is its emission (ADR-0002).
 */
export const RULE_SET_PARAMETER_KEYS = [
  "openingDeductionMinM2",
  "memberEndNoDeductMaxCm2",
  "embeddedDuctNoDeductMaxCm2",
  "finishOpeningDeductionMinM2",
  "finishMinOutlineArea",
  "finishMaxOutlineArea",
  "scaleVerificationTolerance",
  "scaleAnisotropyTolerance",
] as const;
export type RuleSetParameterKey = (typeof RULE_SET_PARAMETER_KEYS)[number];

/** A parameter value is decimal at the seam and `numeric` in the DB — never a float (CLAUDE.md). */
export type RuleSetParameter = { readonly key: RuleSetParameterKey; readonly value: string };

/**
 * The two forks identity.md §8 names (three layers, two forks): a tenant's **template** edition
 * forks from the platform seed at tenant creation; a **project** edition forks from that template
 * at project creation, in the same transaction as the project row — so an unpinned project is
 * unrepresentable. The const is the single declaration site; the CHECK on `rule_set_editions.scope`
 * is its emission (ADR-0002).
 */
export const RULE_SET_EDITION_SCOPES = ["TEMPLATE", "PROJECT"] as const;
export type RuleSetEditionScope = (typeof RULE_SET_EDITION_SCOPES)[number];

/** A method in force: code, identified by rule id and version, never configurable (§1). */
export type RuleSetMethod = { readonly ruleId: string; readonly version: number };

/** What an edition holds, and what its key digests. */
export type RuleSetContent = {
  readonly parameters: readonly RuleSetParameter[];
  readonly methods: readonly RuleSetMethod[];
};

/**
 * The platform seed (identity.md §8): the rule set the first fork materialises. It ships as an
 * **effective-dated constant in code**, never as a row — a platform-owned row would need a null
 * tenant, which is a hole in RLS and in every composite FK the spine uses (ADR-0002's
 * vocabulary-as-constant rule, ADR-0004's composite FKs). Nothing is seeded into the database:
 * creating a tenant forks a template edition from this, and creating a project forks the project
 * edition from that template.
 *
 * **The version string names India** — Bangladesh has no measurement authority for these values,
 * and mislabelling them Bangladeshi was a named legacy defect (bd-authority.md).
 */
export const SEED_RULE_SET_ID = "IS1200_IN@2026.08";

/** The seed ids an edition may name as its origin — the CHECK on `forked_from_seed`. */
export const RULE_SET_SEED_IDS = [SEED_RULE_SET_ID] as const;
export type RuleSetSeedId = (typeof RULE_SET_SEED_IDS)[number];

/**
 * The seed's parameters, each carrying the clause that sets it (measurement-rules.md §1's table).
 * The citation is documentation, never key material: the digest is over values, so correcting a
 * citation moves no edition and voids no signature.
 */
const SEED_PARAMETERS = [
  { key: "openingDeductionMinM2", value: "0.1", clause: "measurement-rules.md §1, §2" },
  { key: "memberEndNoDeductMaxCm2", value: "500", clause: "measurement-rules.md §1, §3" },
  { key: "embeddedDuctNoDeductMaxCm2", value: "100", clause: "measurement-rules.md §1, §3" },
  { key: "finishOpeningDeductionMinM2", value: "0.1", clause: "measurement-rules.md §1, §2" },
  { key: "finishMinOutlineArea", value: "0.2", clause: "measurement-rules.md §1" },
  { key: "finishMaxOutlineArea", value: "20000", clause: "measurement-rules.md §1" },
  { key: "scaleVerificationTolerance", value: "0.01", clause: "measurement-rules.md §1, §5" },
  { key: "scaleAnisotropyTolerance", value: "0.01", clause: "measurement-rules.md §1, §5" },
] as const satisfies readonly (RuleSetParameter & { readonly clause: string })[];

/**
 * The methods in force. A method is code (measurement-rules.md §1), enumerated by
 * `(rule id, version)` with CI asserting the version against a content hash of the implementation
 * — so a method enters this list the day its implementation lands, with that hash, and not before:
 * a `(rule id, version)` pair naming code that does not exist would be a fiction the edition key
 * then certifies. The first one landing moved the seed's key, which is the governed event
 * identity.md §8 describes.
 *
 * The pairs are **spelled here, not imported from the registry**: this file is the edition key's
 * declaration site and must not move when the registry does. `methods.spec.ts` asserts every pair
 * below resolves in the registry, so a seed naming an implementation this binary lacks is a red
 * build rather than a project pinned to a fiction.
 */
const SEED_METHODS: readonly RuleSetMethod[] = [{ ruleId: "RCC_COLUMN_CONCRETE_RECT_PRISM", version: 1 }];

export const SEED_RULE_SET = {
  id: SEED_RULE_SET_ID,
  parameters: SEED_PARAMETERS,
  methods: SEED_METHODS,
} as const satisfies RuleSetContent & { readonly id: RuleSetSeedId };

/**
 * The edition key (identity.md §8): a digest over the parameter values × the `(rule id, version)`
 * pairs of the methods in force, members sorted by code units (`compareCanonical`) so an
 * identical rule set *is* the identical edition key. A method version bump moves it; an edit that
 * rewrites a value to itself does not.
 */
export function ruleSetEditionKey(content: RuleSetContent): string {
  const named: readonly (readonly [name: string, line: string])[] = [
    ...content.parameters.map((p) => [`parameter:${p.key}`, `parameter:${p.key}=${canonicalValue(p)}`] as const),
    ...content.methods.map((m) => [`method:${m.ruleId}`, `method:${m.ruleId}@${m.version}`] as const),
  ];
  if (named.length === 0) throw new Error("RULE_SET_EMPTY: an edition has at least one parameter or method");
  const seen = new Set<string>();
  const members: string[] = [];
  for (const [name, line] of named) {
    if (seen.has(name)) throw new Error(`RULE_SET_DUPLICATE_MEMBER: ${name}`);
    seen.add(name);
    members.push(line);
  }
  members.sort(compareCanonical);
  return createHash("sha256").update(members.join("\n")).digest("hex");
}

/**
 * The value as the digest sees it: one decimal form per number, so `0.10` and `0.1` are the same
 * rule set and re-authoring a value to itself moves nothing. A value that is not a finite decimal
 * is a refusal by name, never a guess: `Decimal` throws on `20,000` but builds `NaN` and
 * `Infinity` without complaint, and Postgres `numeric` stores both — a NaN threshold then sorts
 * above every measurement and inverts the deduction rule it governs instead of refusing. The
 * column carries the same check, so neither this seam nor the database can hold one.
 */
function canonicalValue(p: RuleSetParameter): string {
  let value: Decimal;
  try {
    value = new Decimal(p.value);
  } catch {
    throw new Error(`RULE_SET_PARAMETER_MALFORMED: ${p.key}`);
  }
  if (!value.isFinite()) throw new Error(`RULE_SET_PARAMETER_MALFORMED: ${p.key}`);
  return value.toFixed();
}
