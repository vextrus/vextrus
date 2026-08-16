import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { geometryVariables, type Offer, type OfferGeometry, type Rail } from "@/core/offer";

/**
 * The offer contract's guarantees are **type** guarantees (ADR-0010): a rail that can express a
 * computed value has authored *done* no matter what the prose says. So the assertions below are
 * `@ts-expect-error` — they fail `pnpm verify`'s typecheck stage the day the field becomes
 * expressible, not at runtime on some path a test happens to walk.
 */

const geometry: OfferGeometry = {
  spec: { variant: "PRISM_RECT", L: "0.3", B: "0.45", H: "3.2" },
  unit: "mm",
  basis: "MEASURED",
  calibration: { key: "a".repeat(64), actId: "act-1" },
  sources: ["DXF_HANDLE:1A2B"],
};

const offer: Offer = {
  object: { objectId: "object-1" },
  kind: "RCC_CONCRETE",
  view: { drawingId: "drawing-1", drawingRevisionId: "revision-1", viewKey: "PLAN:DXF_HANDLE:7F" },
  ruleId: "RCC_COLUMN_CONCRETE_RECT_PRISM",
  geometry,
  bindings: { count: { value: "4", unit: "nr", basis: "TRANSCRIBED", sources: ["DXF_HANDLE:3C"] } },
  selectors: { grade: { value: "25", unit: "MPa", basis: "TRANSCRIBED", sources: ["DXF_HANDLE:4D"] } },
  deductions: { MEMBER_END: [{ geometry }] },
};

describe("what a rail cannot express (ADR-0010, quantity-contract.md §1)", () => {
  it("has no field a computed value could land in", () => {
    // @ts-expect-error a rail may not supply the value — the gate evaluates the pinned method.
    const withValue: Offer = { ...offer, value: "1.728" };
    // @ts-expect-error the two roll-ups are derived at the gate and neither is stored (§1).
    const withQuantityBasis: Offer = { ...offer, quantityBasis: "MEASURED" };
    // @ts-expect-error selectionBasis is the second derived roll-up, likewise not a rail's.
    const withSelectionBasis: Offer = { ...offer, selectionBasis: "TRANSCRIBED" };
    // @ts-expect-error a rail that hands over a line has authored done (measurement-rules.md §8).
    const withLine: Offer = { ...offer, line: { id: "line-1" } };
    expect([withValue, withQuantityBasis, withSelectionBasis, withLine]).toHaveLength(4);
  });

  it("has no method version — the edition owns it, never the rail", () => {
    // @ts-expect-error two rails would otherwise price one campaign under two versions of one method.
    const versioned: Offer = { ...offer, version: 1 };
    expect(versioned.ruleId).toBe("RCC_COLUMN_CONCRETE_RECT_PRISM");
  });

  it("cannot carry a measured reading with no calibration, nor a calibration on a reading that is not measured", () => {
    // @ts-expect-error identity.md §6: the calibration reference is per **measured** attribute, NOT NULL.
    const uncalibrated: OfferGeometry = { spec: geometry.spec, unit: "mm", basis: "MEASURED", sources: ["DXF_HANDLE:1A"] };
    const overcalibrated: OfferGeometry = {
      spec: geometry.spec,
      unit: "mm",
      basis: "TRANSCRIBED",
      // @ts-expect-error a transcribed reading was never taken off a calibrated view.
      calibration: { key: "b".repeat(64), actId: "act-2" },
      sources: ["DXF_HANDLE:1A"],
    };
    expect([uncalibrated, overcalibrated]).toHaveLength(2);
  });

  it("cannot carry a reading with no source entity", () => {
    // @ts-expect-error cad-ingestion.md §3: every reading names the entity it was read off.
    const unsourced: OfferGeometry = { ...geometry, sources: [] };
    expect(unsourced.sources).toHaveLength(0);
  });
});

describe("a rail's return type (quantity-contract.md §2.2)", () => {
  type Code = "GEOMETRY_MALFORMED" | "MARK_UNREADABLE";
  const rail: Rail<{ objectId: string }, Code> = (input) => ({
    offers: [{ ...offer, object: { objectId: input.objectId } }],
    observations: [
      { code: "GEOMETRY_MALFORMED", elementType: "COLUMN", kind: "RCC_CONCRETE", sources: ["DXF_HANDLE:9E"] },
    ],
  });

  it("is { offers, observations } and nothing else", () => {
    const result = rail({ objectId: "object-2" });
    expect(Object.keys(result).sort()).toEqual(["observations", "offers"]);
    // @ts-expect-error there is no third arm: a rail may not launder an unmeasurable shape into a
    // refusal the gate owns (ADR-0010).
    const withRefusal: ReturnType<typeof rail> = { ...result, refused: [] };
    expect(withRefusal.offers).toHaveLength(1);
  });

  it("says nothing by offering nothing — an empty list is not a denial", () => {
    const silent: Rail<void, Code> = () => ({ offers: [], observations: [] });
    expect(silent()).toEqual({ offers: [], observations: [] });
  });
});

describe("geometry supplies the method's dimension variables", () => {
  it("names L, B and H for a rectangular prism (formulas.md §2)", () => {
    expect(geometryVariables(geometry.spec)).toEqual({ L: "0.3", B: "0.45", H: "3.2" });
  });
});

/**
 * quantity-contract.md §2.2: *the one-way valve is the output type's shape — a recogniser returns a
 * list of sightings and there is no `absent()` constructor anywhere, so finding nothing returns an
 * empty list, which says nothing rather than denying something*. Prose cannot enforce that; this
 * walk can. Comments are stripped first, so the clause may be quoted (as it is here) while the
 * construct stays unwritable. Over-stripping can only hide a match, never invent one, and the
 * declaration it would have to hide is one nobody can write by accident.
 */
describe("the one-way valve", () => {
  const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [full] : [];
    });

  it("has no absence constructor anywhere in src/", () => {
    const offenders = walk(path.resolve(process.cwd(), "src")).filter((file) =>
      /\babsent\s*[(=]/.test(stripComments(readFileSync(file, "utf8"))),
    );
    expect(offenders).toEqual([]);
  });
});
