import { describe, expect, it } from "vitest";
import {
  pairRevision,
  placementAnchor,
  sightingSemantic,
  type PriorSighting,
  type Sighting,
} from "@/core/pairing";

/**
 * The revision delta, pure (identity.md §4–§5): what carries, what re-presents,
 * what is retired. The whole moat lives in this file's assertions — a nudged
 * member keeps the ordinal frozen at its first registration, a deleted member's
 * ordinal never migrates onto a surviving sibling, and every outcome carries a
 * named reason. Its live behaviour on the committed revision pair is
 * db/__tests__/revision-delta.dbspec.ts.
 */

const VIEW = "layout_plan:E6";
const BOUND = { [VIEW]: 2250 }; // 0.5 of the fixture sheet's 4500 minimum bay

const sighting = (over: Partial<Sighting> & { placementKey: string }): Sighting => ({
  viewKey: VIEW,
  elementType: "column",
  mark: "C1",
  family: "C1",
  signature: "620.0x450.0",
  levelBasis: "UNRESOLVED",
  handles: ["H1", "H2"],
  ...over,
});

const prior = (
  over: Partial<PriorSighting> & { placementKey: string; ordinal: number },
): PriorSighting => ({
  objectId: `obj-${over.ordinal}-${over.placementKey}`,
  viewKey: VIEW,
  semantic: sightingSemantic(sighting({ placementKey: over.placementKey })),
  elementType: "column",
  mark: "C1",
  levelBasis: "UNRESOLVED",
  levelId: null,
  ...over,
});

/** The fixture pair's C1 family as ticket 07 froze it: four columns, ordinals
 *  1–4 in placement-key order (identical signatures, so the key breaks the tie). */
const C1_REGISTERED = [
  prior({ placementKey: `${VIEW}|C1|0.0|0.0`, ordinal: 1 }),
  prior({ placementKey: `${VIEW}|C1|0.0|9000.0`, ordinal: 2 }),
  prior({ placementKey: `${VIEW}|C1|10000.0|0.0`, ordinal: 3 }),
  prior({ placementKey: `${VIEW}|C1|10000.0|9000.0`, ordinal: 4 }),
];

const keyed = (claims: ReturnType<typeof pairRevision>["claims"]) =>
  Object.fromEntries(claims.map((c) => [c.sighting.placementKey, `${c.key}:${c.carry}`]));

describe("pairing a revision with the register", () => {
  it("carries a nudged member's ordinal, and retires the deleted sibling's", () => {
    // The committed fixture pair's own delta: (C,3) nudged +300, (A,3) deleted.
    const { claims, vacated } = pairRevision({
      offered: [
        sighting({ placementKey: `${VIEW}|C1|0.0|0.0` }),
        sighting({ placementKey: `${VIEW}|C1|10000.0|0.0` }),
        sighting({ placementKey: `${VIEW}|C1|10300.0|9000.0` }),
      ],
      priors: C1_REGISTERED,
      carryBounds: BOUND,
    });

    expect(keyed(claims)).toEqual({
      [`${VIEW}|C1|0.0|0.0`]: "C1#1:EXACT",
      [`${VIEW}|C1|10000.0|0.0`]: "C1#3:EXACT",
      // the nudge: ordinal 4 inherited, NOT the deleted sibling's 2
      [`${VIEW}|C1|10300.0|9000.0`]: "C1#4:NUDGED",
    });
    expect(vacated.map((v) => v.prior.ordinal)).toEqual([2]);
    expect(vacated[0]!.reason).toMatch(/absent from this revision/);
    // nothing orphans and nothing is invented: three claims, one retirement
    expect(claims.filter((c) => c.prior === null)).toEqual([]);
  });

  it("never lets an ordinal migrate when the deleted member sorts first", () => {
    // The 82.6%-phantom-money class (identity.md §4): a by-position or
    // by-order map would hand the survivor the dropped member's ordinal.
    const { claims } = pairRevision({
      offered: [sighting({ placementKey: `${VIEW}|C1|10300.0|9000.0` })],
      priors: C1_REGISTERED,
      carryBounds: BOUND,
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]!.ordinal).toBe(4);
    expect(claims[0]!.reason).toMatch(/ordinal 4 is inherited unmoved/);
  });

  it("refuses to pair a member two priors sit equally near, and says which", () => {
    const { claims, vacated } = pairRevision({
      offered: [sighting({ placementKey: `${VIEW}|C1|5000.0|0.0` })],
      priors: [
        prior({ placementKey: `${VIEW}|C1|4000.0|0.0`, ordinal: 1 }),
        prior({ placementKey: `${VIEW}|C1|6000.0|0.0`, ordinal: 2 }),
      ],
      carryBounds: BOUND,
    });
    expect(claims[0]!.prior).toBeNull();
    expect(claims[0]!.carry).toBe("APPENDED");
    expect(claims[0]!.ordinal).toBe(3); // never 1 or 2 — a retired ordinal is not reused
    expect(claims[0]!.reason).toMatch(/equally|exactly 1000 drawing units from 2 prior members/);
    expect(vacated.map((v) => v.prior.ordinal)).toEqual([1, 2]);
  });

  it("carries nobody beyond the bound, and nobody at all where no bound is stated", () => {
    const far = sighting({ placementKey: `${VIEW}|C1|9000.0|0.0` });
    const beyond = pairRevision({
      offered: [far],
      priors: [prior({ placementKey: `${VIEW}|C1|0.0|0.0`, ordinal: 1 })],
      carryBounds: BOUND,
    });
    expect(beyond.claims[0]!.carry).toBe("APPENDED");
    expect(beyond.claims[0]!.reason).toMatch(/within 2250 drawing units/);

    const unstated = pairRevision({
      offered: [sighting({ placementKey: `${VIEW}|C1|300.0|0.0` })],
      priors: [prior({ placementKey: `${VIEW}|C1|0.0|0.0`, ordinal: 1 })],
      carryBounds: {},
    });
    expect(unstated.claims[0]!.carry).toBe("APPENDED");
    expect(unstated.claims[0]!.reason).toMatch(/states no carry bound/);
  });

  it("pairs nobody across views, so a second sighting still meets the door's guard", () => {
    // The same column sighted from a second view of the sheet: it must derive
    // its ordinal from its own batch and collide, never inherit and pass.
    const { claims, vacated } = pairRevision({
      offered: [
        sighting({
          viewKey: "second-view",
          placementKey: "second-view|C1|0.0|0.0",
        }),
      ],
      priors: [prior({ placementKey: `${VIEW}|C1|0.0|0.0`, ordinal: 1 })],
      carryBounds: { ...BOUND, "second-view": 2250 },
    });
    expect(claims[0]!.carry).toBe("FRESH");
    expect(claims[0]!.ordinal).toBe(1);
    expect(claims[0]!.prior).toBeNull();
    // and the view this pass never walked reports no losses
    expect(vacated).toEqual([]);
  });

  it("keeps its result independent of the order the sightings arrive in", () => {
    const offered = [
      sighting({ placementKey: `${VIEW}|C1|0.0|0.0` }),
      sighting({ placementKey: `${VIEW}|C1|10000.0|0.0` }),
      sighting({ placementKey: `${VIEW}|C1|10300.0|9000.0` }),
    ];
    const forward = pairRevision({ offered, priors: C1_REGISTERED, carryBounds: BOUND });
    const reversed = pairRevision({
      offered: [...offered].reverse(),
      priors: [...C1_REGISTERED].reverse(),
      carryBounds: BOUND,
    });
    expect(keyed(reversed.claims)).toEqual(keyed(forward.claims));
  });

  it("reports a whole family the revision dropped, rather than saying nothing", () => {
    const { claims, vacated } = pairRevision({
      offered: [],
      priors: [prior({ placementKey: `${VIEW}|C1|0.0|0.0`, ordinal: 1 })],
      carryBounds: BOUND,
      walkedViewKeys: [VIEW],
    });
    expect(claims).toEqual([]);
    expect(vacated).toHaveLength(1);
    expect(vacated[0]!.reason).toMatch(/whole mark family is unsighted/);
  });
});

describe("the semantic (identity.md §5)", () => {
  it("changes when the cited evidence moves, though the numbers do not", () => {
    const before = sighting({ placementKey: `${VIEW}|C1|0.0|0.0`, handles: ["B9", "BB"] });
    const after = { ...before, handles: ["CE", "D0"] };
    expect(sightingSemantic(after)).not.toBe(sightingSemantic(before));
  });

  it("is order-normalized: the same content in any order is the same string", () => {
    const one = sighting({ placementKey: `${VIEW}|C1|0.0|0.0`, handles: ["B9", "BB"] });
    const other: Sighting = {
      handles: ["BB", "B9"],
      signature: one.signature,
      levelBasis: one.levelBasis,
      family: one.family,
      mark: one.mark,
      elementType: one.elementType,
      viewKey: one.viewKey,
      placementKey: one.placementKey,
    };
    expect(sightingSemantic(other)).toBe(sightingSemantic(one));
  });

  it("reads the anchor back out of the placement key, and never invents one", () => {
    expect(placementAnchor(`${VIEW}|C1|10300.0|9000.0`)).toEqual([10300, 9000]);
    expect(placementAnchor("no-position")).toBeNull();
  });
});
