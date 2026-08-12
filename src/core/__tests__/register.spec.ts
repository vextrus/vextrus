import { describe, expect, it } from "vitest";
import { familyIdentities, type Sighting } from "@/core/register";

/**
 * The ordinal law (identity.md §4), pure: mark families sort by a content
 * signature of authored inputs only, tie-break on the row's own id (a
 * placement's content key), and key `mark#i` — singletons keeping the bare
 * mark. The register spine's live behaviour is db/__tests__/register.dbspec.ts.
 */

const sighting = (over: Partial<Sighting> & { placementKey: string }): Sighting => ({
  viewKey: "plan:E6",
  elementType: "column",
  mark: "C1",
  family: "C1",
  signature: "600.0x450.0",
  levelBasis: "UNRESOLVED",
  handles: ["H1"],
  ...over,
});

describe("mark families and ordinals", () => {
  it("keys a family of several as mark#i, and a singleton by its bare mark", () => {
    const claims = familyIdentities([
      sighting({ placementKey: "plan:E6|C1|0.0|0.0" }),
      sighting({ placementKey: "plan:E6|C1|10000.0|0.0" }),
      sighting({ placementKey: "plan:E6|C3|5000.0|4500.0", mark: "C3", family: "C3" }),
    ]);
    expect(claims.map((c) => c.key)).toEqual(["C1#1", "C1#2", "C3"]);
    // a singleton still carries ordinal 1, so a family that later grows gains
    // an index without moving anybody
    expect(claims.find((c) => c.key === "C3")!.ordinal).toBe(1);
  });

  it("orders a family by its content signature, not by where its members sit", () => {
    const claims = familyIdentities([
      // the member at the origin carries the LATER signature: if position led
      // the sort, it would take ordinal 1
      sighting({ placementKey: "plan:E6|C1|0.0|0.0", signature: "900.0x450.0" }),
      sighting({ placementKey: "plan:E6|C1|9000.0|0.0", signature: "600.0x450.0" }),
    ]);
    expect(Object.fromEntries(claims.map((c) => [c.sighting.signature, c.key]))).toEqual({
      "600.0x450.0": "C1#1",
      "900.0x450.0": "C1#2",
    });
  });

  it("tie-breaks identical signatures on the placement key, never on order", () => {
    const keys = ["plan:E6|C1|0.0|0.0", "plan:E6|C1|10000.0|0.0", "plan:E6|C1|5000.0|9000.0"];
    const forward = familyIdentities(keys.map((placementKey) => sighting({ placementKey })));
    const reversed = familyIdentities(
      [...keys].reverse().map((placementKey) => sighting({ placementKey })),
    );
    const shown = (claims: ReturnType<typeof familyIdentities>) =>
      claims.map((c) => `${c.key}=${c.sighting.placementKey}`);
    expect(shown(forward)).toEqual(shown(reversed));
    expect(shown(forward)).toEqual([
      "C1#1=plan:E6|C1|0.0|0.0",
      "C1#2=plan:E6|C1|10000.0|0.0",
      "C1#3=plan:E6|C1|5000.0|9000.0",
    ]);
  });

  it("keeps one family per (class, level slot, dotless mark)", () => {
    const claims = familyIdentities([
      sighting({ placementKey: "plan:E6|C1|0.0|0.0" }),
      sighting({
        placementKey: "plan:E6|C1|0.0|4500.0",
        elementType: "shear_wall",
      }),
      sighting({
        placementKey: "plan:E6|C1|0.0|9000.0",
        elementType: "pile_cap",
        levelBasis: "FOUNDATION",
      }),
    ]);
    // three classes, three families, three singletons — a shared mark string is
    // not a shared family
    expect(claims.map((c) => c.key)).toEqual(["C1", "C1", "C1"]);
    expect(claims.map((c) => c.ordinal)).toEqual([1, 1, 1]);
  });

  it("registers two spellings of one family under one mark", () => {
    const claims = familyIdentities([
      sighting({ placementKey: "plan:E6|T.B-3|0.0|0.0", mark: "T.B-3", family: "TB-3" }),
      sighting({ placementKey: "plan:E6|TB-3|9000.0|0.0", mark: "TB-3", family: "TB-3" }),
    ]);
    expect(claims.map((c) => c.mark)).toEqual(["T.B-3", "T.B-3"]);
    expect(claims.map((c) => c.key)).toEqual(["T.B-3#1", "T.B-3#2"]);
  });

  it("orders spellings that differ only in case by code unit, not by locale", () => {
    // The one shape where the comparator is visible in the answer. ICU orders
    // lowercase before uppercase at the tertiary level; code units order
    // uppercase first — so `localeCompare` here would freeze c1#1, C1#2 and
    // register the family under `c1`. Both the ordinals and the family's
    // spelling are identity (identity.md §4), and neither may depend on the
    // runtime's locale or ICU build (.wayfinder/harness ticket 09).
    const claims = familyIdentities([
      sighting({ placementKey: "plan:E6|C1|9000.0|0.0", mark: "C1", family: "C1" }),
      sighting({ placementKey: "plan:E6|c1|0.0|0.0", mark: "c1", family: "C1" }),
    ]);
    expect(claims.map((c) => c.key)).toEqual(["C1#1", "C1#2"]);
    expect(claims.map((c) => c.sighting.mark)).toEqual(["C1", "c1"]);
  });
});
