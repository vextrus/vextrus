import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { MeasurementDecimal, evaluateFormula, formulaVariables, product, renderFormula, variable } from "@/core/formula";

/**
 * The formula template is walked twice — once to evaluate, once to print (identity.md §6,
 * ADR-0010: the printed string and the arithmetic have one source). These are the golden vectors
 * that pin the interpreter's meaning: the interpreter is shared code outside the content-hashed
 * method files, so a change to what `PRODUCT` means moves no method hash and must fail here.
 */
const volume = product(variable("count"), variable("L"), variable("B"), variable("H"));
const values: Record<string, string> = { count: "4", L: "0.3", B: "0.45", H: "3.2" };
const resolve = (name: string) => new MeasurementDecimal(values[name] as string);

describe("the formula template (identity.md §6)", () => {
  it("names its variables in template order, each once", () => {
    expect(formulaVariables(volume)).toEqual(["count", "L", "B", "H"]);
    expect(formulaVariables(product(variable("L"), variable("L")))).toEqual(["L"]);
  });

  it("renders the human-auditable string from the same template it evaluates", () => {
    expect(renderFormula(volume)).toBe("count × L × B × H");
    expect(renderFormula(volume, (name) => resolve(name).toFixed())).toBe("4 × 0.3 × 0.45 × 3.2");
  });

  it("multiplies in decimal — the vector a float gets wrong", () => {
    expect(evaluateFormula(volume, resolve).toFixed()).toBe("1.728");
    // 0.1 × 0.2 is 0.020000000000000004 in binary floating point, and money and quantities are
    // decimal at the seam (CLAUDE.md).
    expect(
      evaluateFormula(product(variable("a"), variable("b")), (n) => new MeasurementDecimal(n === "a" ? "0.1" : "0.2")).toFixed(),
    ).toBe("0.02");
  });

  /**
   * The precision vector, and the reason `MEASUREMENT_PRECISION` exists: this product is **26
   * significant digits**, and `decimal.js` at its default 20 rounds the tail off silently. Exact
   * under the pinned precision, lossy under the default — asserted side by side, because the
   * precision lives outside the content-hashed method files and nothing else would catch it moving.
   */
  it("multiplies exactly, at the pinned precision", () => {
    const wide: Record<string, string> = { count: "4", L: "123456.789", B: "234567.891", H: "345678.912" };
    const exact = evaluateFormula(volume, (name) => new MeasurementDecimal(wide[name] as string));
    expect(exact.toFixed()).toBe("40042060549698525.681860352");
    const rounded = evaluateFormula(volume, (name) => new Decimal(wide[name] as string));
    expect(rounded.toFixed()).not.toBe(exact.toFixed());
  });
});
