import { describe, expect, it } from "vitest";
import { RULE_SET_PARAMETER_KEYS, SEED_RULE_SET, ruleSetEditionKey } from "@/core/rule-set";

/**
 * identity.md §8: an edition's key is a digest over its parameter values × the (rule id, version)
 * pairs of the methods in force — a method version bump moves it, an edit that rewrites a value to
 * itself does not.
 */
const parameters = [
  { key: "openingDeductionMinM2", value: "0.1" },
  { key: "memberEndNoDeductMaxCm2", value: "500" },
] as const;
const methods = [{ ruleId: "REBAR_NOT_DEDUCTED_FROM_CONCRETE", version: 1 }] as const;

describe("the rule-set edition key (identity.md §8)", () => {
  it("is order-independent over its members", () => {
    const key = ruleSetEditionKey({ parameters, methods });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(ruleSetEditionKey({ parameters: [...parameters].reverse(), methods })).toBe(key);
  });

  it("moves on a method version bump and holds on a value rewritten to itself", () => {
    const key = ruleSetEditionKey({ parameters, methods });
    expect(ruleSetEditionKey({ parameters, methods: [{ ruleId: methods[0].ruleId, version: 2 }] })).not.toBe(key);
    expect(
      ruleSetEditionKey({ parameters: [{ key: "openingDeductionMinM2", value: "0.100" }, parameters[1]], methods }),
    ).toBe(key);
  });

  it("refuses an empty member set, a repeated parameter and a repeated rule, by name", () => {
    expect(() => ruleSetEditionKey({ parameters: [], methods: [] })).toThrow(/RULE_SET_EMPTY/);
    expect(() =>
      ruleSetEditionKey({ parameters: [parameters[0], { key: "openingDeductionMinM2", value: "0.2" }], methods: [] }),
    ).toThrow(/RULE_SET_DUPLICATE_MEMBER: parameter:openingDeductionMinM2/);
    expect(() =>
      ruleSetEditionKey({ parameters, methods: [methods[0], { ruleId: methods[0].ruleId, version: 2 }] }),
    ).toThrow(/RULE_SET_DUPLICATE_MEMBER: method:REBAR_NOT_DEDUCTED_FROM_CONCRETE/);
  });

  it("refuses a parameter value that is not a decimal, by name", () => {
    expect(() => ruleSetEditionKey({ parameters: [{ key: "finishMaxOutlineArea", value: "20,000" }], methods: [] })).toThrow(
      /RULE_SET_PARAMETER_MALFORMED: finishMaxOutlineArea/,
    );
  });

  /**
   * A threshold is compared against a measurement, and Postgres sorts NaN above every number: a
   * NaN or infinite threshold silently inverts every deduction rule instead of refusing. Decimal
   * builds all three without complaining, so the refusal is here.
   */
  it("refuses a parameter value that is not finite, by name", () => {
    for (const value of ["NaN", "Infinity", "-Infinity"]) {
      expect(() => ruleSetEditionKey({ parameters: [{ key: "openingDeductionMinM2", value }], methods: [] })).toThrow(
        /RULE_SET_PARAMETER_MALFORMED: openingDeductionMinM2/,
      );
    }
  });
});

describe("the platform seed IS1200_IN @ 2026.08 (measurement-rules.md §1)", () => {
  /** The table in measurement-rules.md §1, transcribed — the doc is the source, not the constant. */
  const table: Record<string, string> = {
    openingDeductionMinM2: "0.1",
    memberEndNoDeductMaxCm2: "500",
    embeddedDuctNoDeductMaxCm2: "100",
    finishOpeningDeductionMinM2: "0.1",
    finishMinOutlineArea: "0.2",
    finishMaxOutlineArea: "20000",
    scaleVerificationTolerance: "0.01",
    scaleAnisotropyTolerance: "0.01",
  };

  it("carries every parameter the rule table names, at the table's value, with its clause", () => {
    expect(Object.fromEntries(SEED_RULE_SET.parameters.map((p) => [p.key, p.value]))).toEqual(table);
    expect([...RULE_SET_PARAMETER_KEYS].sort()).toEqual(Object.keys(table).sort());
    for (const p of SEED_RULE_SET.parameters) expect(p.clause).toMatch(/\.md §/);
  });

  it("names India, because Bangladesh has no measurement authority for these values", () => {
    expect(SEED_RULE_SET.id).toBe("IS1200_IN@2026.08");
  });

  /**
   * A change detector, not a derivation: the seed's key is stored on every template edition and
   * inherited by every project edition, so a serialisation change that moved it would orphan every
   * stored key and void every signature scoped to one. Moving it is a governed act, never a diff.
   */
  it("has a frozen key", () => {
    expect(ruleSetEditionKey(SEED_RULE_SET)).toBe("56454c22d6485619dd2a4d5793557caf41de3a32747220f5fbee69492a2c928a");
  });
});
