import { describe, expect, it } from "vitest";
import { formatTaka } from "@/core/format";

describe("formatTaka", () => {
  it("groups under a thousand with no separator", () => {
    expect(formatTaka("999")).toBe("৳999");
  });

  it("places the first separator three digits from the right", () => {
    expect(formatTaka("12345")).toBe("৳12,345");
  });

  it("groups lakh (2 digits) and crore (2 digits) after the first group of 3", () => {
    // 12,34,56,789 — one crore, thirty-four lakh, fifty-six thousand, seven
    // hundred eighty-nine.
    expect(formatTaka("123456789")).toBe("৳12,34,56,789");
  });

  it("groups a single crore correctly", () => {
    expect(formatTaka("10000000")).toBe("৳1,00,00,000");
  });

  it("carries a decimal (poisha) part unrounded", () => {
    expect(formatTaka("123456789.50")).toBe("৳12,34,56,789.50");
  });

  it("preserves a negative sign outside the grouping", () => {
    expect(formatTaka("-123456789")).toBe("-৳12,34,56,789");
  });

  it("never uses compact lakh/crore suffixes", () => {
    expect(formatTaka("123456789")).not.toMatch(/[LC]r?\b/);
  });

  it("rejects a float, which would lose decimal-seam precision", () => {
    // @ts-expect-error — the seam is string-decimal, never a JS number
    expect(() => formatTaka(123456789)).toThrow();
  });
});
