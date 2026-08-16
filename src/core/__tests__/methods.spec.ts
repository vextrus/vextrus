import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  METHOD_DECLARATIONS,
  acceptsGeometry,
  evaluateMethod,
  methodVariables,
  resolveMethod,
  type MethodDeclaration,
} from "@/core/methods";
import manifest from "@/core/methods.manifest.json";
import { geometryVariables, type GeometrySpec, type GeometryVariant } from "@/core/offer";
import { SEED_RULE_SET } from "@/core/rule-set";
import { WORK_ITEM_CATALOGUE } from "@/core/work-items";

/**
 * The registry resolves `(rule id, version)` to an evaluator and its declaration
 * (measurement-rules.md §1, ADR-0010). The gate is a later ticket; nothing here writes.
 */
const resolved = resolveMethod("RCC_COLUMN_CONCRETE_RECT_PRISM", 1);
if (!resolved.ok) throw new Error(`the first method must resolve: ${resolved.reason}`);
const column: MethodDeclaration = resolved.method;

describe("the method registry (measurement-rules.md §1)", () => {
  it("resolves every (rule id, version) the seed names — a seed naming code that does not exist is a fiction the edition key would certify", () => {
    expect(SEED_RULE_SET.methods.length).toBeGreaterThan(0);
    for (const method of SEED_RULE_SET.methods) {
      const resolution = resolveMethod(method.ruleId, method.version);
      expect(resolution.ok, `${method.ruleId}@${method.version} does not resolve`).toBe(true);
    }
  });

  it("refuses an unknown rule id and a version it does not implement, by name", () => {
    expect(resolveMethod("SLAB_SOFFIT_FORMWORK", 1)).toEqual({
      ok: false,
      reason: "METHOD_UNKNOWN",
      detail: "SLAB_SOFFIT_FORMWORK",
    });
    expect(resolveMethod("RCC_COLUMN_CONCRETE_RECT_PRISM", 2)).toEqual({
      ok: false,
      reason: "METHOD_IMPLEMENTATION_MISSING",
      detail: "RCC_COLUMN_CONCRETE_RECT_PRISM@2",
    });
  });

  it("carries the declaration the gate needs: variables, geometry variants, and a parameter key per channel", () => {
    expect(methodVariables(column)).toEqual(["count", "L", "B", "H"]);
    expect(column.geometryVariants).toEqual(["PRISM_RECT"]);
    expect(column.channels).toEqual({
      MEMBER_END: "memberEndNoDeductMaxCm2",
      EMBEDDED_DUCT: "embeddedDuctNoDeductMaxCm2",
    });
    // The kind decides the unit and the dimension; the method invents neither (measurement-rules.md §4).
    expect(WORK_ITEM_CATALOGUE[column.kind].unit).toBe("m³");
  });

  it("accepts the shapes it measures and refuses the rest by name", () => {
    expect(acceptsGeometry(column, "PRISM_RECT")).toEqual({ ok: true });
    // One variant exists today (offer.ts: a variant lands with the method that measures it), so the
    // refusal arm is reached through a cast until the second shape lands. A slab-soffit method
    // pointed at a frustum must be a typed refusal, never a plausible wrong number (ADR-0010).
    expect(acceptsGeometry(column, "FRUSTUM_RECT" as GeometryVariant)).toEqual({
      ok: false,
      reason: "METHOD_GEOMETRY_VARIANT_UNACCEPTED",
      detail: "RCC_COLUMN_CONCRETE_RECT_PRISM@1:FRUSTUM_RECT",
    });
  });

  it("names every method in the committed manifest, and only those", () => {
    const registered = METHOD_DECLARATIONS.map((m) => `${m.ruleId}@${m.version}`).sort();
    expect(Object.keys(manifest.methods).sort()).toEqual(registered);
    for (const entry of Object.values(manifest.methods)) {
      expect(existsSync(path.resolve(process.cwd(), "src/core/methods", entry.file))).toBe(true);
    }
  });
});

/**
 * `formulas.md` §2, *Rect prism*: `count × L × B × H`. `L`, `B` and `H` come from the geometry;
 * `count` is a binding. The gate normalises to SI before calling — unit normalisation is its job,
 * not the evaluator's.
 */
describe("RCC rectangular-prism column concrete (formulas.md §2)", () => {
  const spec: GeometrySpec = { variant: "PRISM_RECT", L: "0.3", B: "0.45", H: "3.2" };
  const values = { ...geometryVariables(spec), count: "4" };

  it("evaluates in decimal and prints the same template it evaluated", () => {
    const evaluated = evaluateMethod(column, values);
    if (!evaluated.ok) throw new Error(evaluated.reason);
    expect(evaluated.value.toFixed()).toBe("1.728");
    expect(evaluated.formula).toBe("count × L × B × H");
    expect(evaluated.rendered).toBe("4 × 0.3 × 0.45 × 3.2");
    expect(evaluated.variables).toEqual({ count: "4", L: "0.3", B: "0.45", H: "3.2" });
  });

  it("refuses a missing binding and an unread one, by name", () => {
    const withoutCount = geometryVariables(spec); // the geometry's three, and no count
    expect(evaluateMethod(column, withoutCount)).toEqual({
      ok: false,
      reason: "METHOD_BINDING_MISSING",
      detail: "count",
    });
    expect(evaluateMethod(column, { ...values, D: "1" })).toEqual({
      ok: false,
      reason: "METHOD_BINDING_UNKNOWN",
      detail: "D",
    });
  });

  /**
   * `Decimal` throws on `20,000` but builds `NaN` and `Infinity` without complaint, and Postgres
   * `numeric` stores both — a NaN quantity sorts above every measurement instead of refusing.
   */
  it("refuses a value that is not a finite decimal, by name", () => {
    // `Decimal` reads the last three as numbers — 31, 5 and 1000 — so a transcribed `1_000` would
    // measure as one thousand rather than refuse. A measurement is a decimal literal or it is a
    // named refusal.
    for (const bad of ["20,000", "NaN", "Infinity", "-Infinity", "", "0x1f", "0b101", "1_000"]) {
      expect(evaluateMethod(column, { ...values, H: bad })).toEqual({
        ok: false,
        reason: "METHOD_BINDING_MALFORMED",
        detail: "H",
      });
    }
  });
});
