import { describe, expect, it } from "vitest";
import { ELEMENT_TYPES, QUANTITY_KINDS } from "@/core/enums";
import {
  BEARS,
  BEARS_PAIRS,
  CATALOGUE_DIGEST,
  UNBORNE_ELEMENT_TYPES,
  UNBORNE_CAUSE,
  bornKinds,
  catalogueDigest,
  kindNamingViolation,
} from "@/core/kinds";

/**
 * measurement-rules.md §4 (2026-08-16: the naming law, the widened dimension ban) and §8 (the four
 * code-owned artifacts). Totality of the two maps is a type, not a test — a kind with no
 * discipline or no algebra fails `typecheck`, and a test for it would be theatre.
 */
describe("the naming law (measurement-rules.md §4)", () => {
  it("passes every shipped kind", () => {
    for (const kind of QUANTITY_KINDS) expect(kindNamingViolation(kind)).toBeNull();
  });
  it("rejects a synthetic COLUMN_CONCRETE — a kind may not name an element class", () => {
    expect(kindNamingViolation("COLUMN_CONCRETE")).toEqual({ reason: "KIND_NAMES_ELEMENT_CLASS", token: "COLUMN" });
  });
  it("rejects a synthetic AREA — a kind may not name a dimension", () => {
    expect(kindNamingViolation("AREA")).toEqual({ reason: "KIND_NAMES_DIMENSION", token: "AREA" });
  });
  it("rejects a synthetic CUM_MASONRY — a unit abbreviation names a dimension in shorthand", () => {
    expect(kindNamingViolation("CUM_MASONRY")).toEqual({ reason: "KIND_NAMES_UNIT", token: "CUM" });
  });
  it("reads the element-class enum, so adding a class re-runs the ban with no edit", () => {
    for (const elementType of ELEMENT_TYPES) {
      expect(kindNamingViolation(`${elementType}_CONCRETE`)?.reason).toBe("KIND_NAMES_ELEMENT_CLASS");
    }
  });
  it("catches a multi-token class named whole", () => {
    expect(kindNamingViolation("PILE_CAP_CONCRETE")?.reason).toBe("KIND_NAMES_ELEMENT_CLASS");
  });
});

describe("bears (measurement-rules.md §8)", () => {
  it("bears every kind at least once — no dead vocabulary in the denominator", () => {
    expect([...bornKinds(BEARS_PAIRS)].sort()).toEqual([...QUANTITY_KINDS].sort());
  });
  it("declares every element class — in bears or in the unborne set, exhaustively", () => {
    const borne = Object.keys(BEARS);
    const declared = [...borne, ...UNBORNE_ELEMENT_TYPES].sort();
    expect(declared).toEqual([...ELEMENT_TYPES].sort());
    expect(borne.filter((c) => (UNBORNE_ELEMENT_TYPES as readonly string[]).includes(c))).toEqual([]);
  });
  it("names why an unborne class bears nothing — declared, never absent", () => {
    expect(UNBORNE_CAUSE).toBe("KIND_NOT_YET_SEEDED");
  });
});

describe("the catalogue digest (identity.md §8)", () => {
  const pair = (elementType: string, kind: string) => ({ elementType, kind }) as (typeof BEARS_PAIRS)[number];
  const a = pair("COLUMN", "RCC_CONCRETE");
  const b = pair("COLUMN", "FORMWORK");

  it("is stable across input order", () => {
    expect(catalogueDigest([a, b])).toBe(catalogueDigest([b, a]));
    expect(catalogueDigest([a, b])).toMatch(/^[0-9a-f]{64}$/);
  });
  it("moves when a (class, kind) pair is added or removed", () => {
    expect(catalogueDigest([a, b])).not.toBe(catalogueDigest([a]));
  });
  it("does not move when a description or label is edited — the digest reads the relation alone", () => {
    const labelled = BEARS_PAIRS.map((p) => ({ ...p, description: "edited", label: "edited" }));
    expect(catalogueDigest(labelled)).toBe(CATALOGUE_DIGEST);
    expect(CATALOGUE_DIGEST).toBe(catalogueDigest(BEARS_PAIRS));
  });
  it("refuses an empty relation and a duplicate pair, each by a closed reason code", () => {
    expect(() => catalogueDigest([])).toThrow(/^CATALOGUE_BEARS_EMPTY/);
    expect(() => catalogueDigest([a, a])).toThrow(/^CATALOGUE_BEARS_DUPLICATE_PAIR/);
  });
});
