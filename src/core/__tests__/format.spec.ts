import { describe, expect, it } from "vitest";
import { formatQuantity, formatTaka } from "../format";

describe("formatTaka — lakh/crore, never Western grouping", () => {
  it("groups the last three digits, then twos", () => {
    expect(formatTaka("100.00")).toBe("৳100.00");
    expect(formatTaka("1000.00")).toBe("৳1,000.00");
    expect(formatTaka("100000.00")).toBe("৳1,00,000.00");
    expect(formatTaka("10000000.00")).toBe("৳1,00,00,000.00");
    expect(formatTaka("16744725.75")).toBe("৳1,67,44,725.75");
  });

  it("disagrees with toLocaleString('en-US') exactly where the ban bites", () => {
    expect(formatTaka("10000000.00")).not.toContain("10,000,000");
    expect((10_000_000).toLocaleString("en-US")).toBe("10,000,000");
  });

  it("never emits a compact L or Cr suffix", () => {
    const crore = formatTaka("125000000.00");
    expect(crore).toBe("৳12,50,00,000.00");
    expect(crore).not.toMatch(/Cr|L\b/);
  });

  it("keeps the sign outside the currency mark", () => {
    expect(formatTaka("-250000.50")).toBe("-৳2,50,000.50");
  });

  it("pads to the document's declared precision", () => {
    expect(formatTaka("1200")).toBe("৳1,200.00");
    expect(formatTaka("1200.5")).toBe("৳1,200.50");
    expect(formatTaka("1200", 0)).toBe("৳1,200");
  });

  it("refuses rather than rounding silently", () => {
    expect(() => formatTaka("1200.567")).toThrow(/round before formatting/);
  });

  it("refuses a float and a malformed string", () => {
    // @ts-expect-error — the type already bans it; the runtime guard is the real gate
    expect(() => formatTaka(1200.5)).toThrow(TypeError);
    expect(() => formatTaka("1,200.00")).toThrow(/not a decimal string/);
    expect(() => formatTaka("")).toThrow(/not a decimal string/);
  });
});

describe("formatQuantity — same grouping, per-kind precision, no currency mark", () => {
  it("carries the precision the kind declares", () => {
    expect(formatQuantity("48.72", 3)).toBe("48.720");
    expect(formatQuantity("6412.4", 2)).toBe("6,412.40");
    expect(formatQuantity("250000", 0)).toBe("2,50,000");
  });

  it("refuses a precision the value cannot honour", () => {
    expect(() => formatQuantity("48.7205", 3)).toThrow(/round before formatting/);
    expect(() => formatQuantity("48.72", 1.5)).toThrow(RangeError);
  });
});
