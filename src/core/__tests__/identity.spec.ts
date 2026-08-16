import { describe, expect, it } from "vitest";
import { drawingSetRevisionDigest } from "@/core/identity";

/** identity.md §9: content-addressed over sorted (drawing, revision) pairs; zero minted ids. */
const a = { drawingId: "d-a", drawingRevisionId: "r-a1" };
const b = { drawingId: "d-b", drawingRevisionId: "r-b1" };

describe("the drawing-set revision key (identity.md §9)", () => {
  it("is order-independent: an identical pinned set is the identical set revision", () => {
    expect(drawingSetRevisionDigest([a, b])).toBe(drawingSetRevisionDigest([b, a]));
    expect(drawingSetRevisionDigest([a, b])).toMatch(/^[0-9a-f]{64}$/);
  });
  it("re-revving one member yields a new set revision (advance, never drift)", () => {
    const b2 = { drawingId: "d-b", drawingRevisionId: "r-b2" };
    expect(drawingSetRevisionDigest([a, b2])).not.toBe(drawingSetRevisionDigest([a, b]));
  });
  it("refuses two revisions of one drawing and an empty set, by name", () => {
    expect(() => drawingSetRevisionDigest([a, { drawingId: "d-a", drawingRevisionId: "r-a2" }])).toThrow(
      /DRAWING_SET_DUPLICATE_DRAWING/,
    );
    expect(() => drawingSetRevisionDigest([])).toThrow(/DRAWING_SET_EMPTY/);
  });
});
