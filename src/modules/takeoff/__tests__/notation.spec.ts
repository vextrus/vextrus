import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  NOTATION_REFUSALS,
  decodeNotation,
  parseFeetInches,
  parseFloorZone,
  parseRebarGroups,
  parseSizePair,
  parseSpacing,
  stripAutocadEscapes,
  type Dimension,
  type NotationRefusal,
  type NotationRefused,
  type Spacing,
} from "../notation";

/**
 * The golden vectors for the BD drawing-notation parsers (cad-ingestion.md §6). Every case below is
 * a string §6 enumerates, or a string the committed artifact actually contains — never a form
 * invented to make a parser look good. The two the clause states as laws rather than examples are
 * asserted as laws: the `N of` multiplier spans **all** its groups, and `@ 61/2"` is six and a half
 * inches with the improper reading asserted **absent**.
 *
 * The refusal register at the foot of the file is the same discipline as
 * `src/modules/takeoff/__tests__/ingest.spec.ts`: every member of `NOTATION_REFUSALS` is driven by
 * a case here, so a code added without a case — or a case for a code that no longer exists — turns
 * verify red. Silence is the only condemned state (CLAUDE.md).
 */
const observed = new Set<NotationRefusal>();

/** Assert a result refused, record which code fired, and hand the code back to the caller. */
function refusalOf(result: { readonly ok: true } | NotationRefused): NotationRefusal {
  if (result.ok) throw new Error("expected a refusal, got a parse");
  observed.add(result.refusal);
  return result.refusal;
}

/** A parse, or a test failure naming the refusal that came back instead. */
function parsed<T extends { readonly ok: true }>(result: T | NotationRefused): T {
  if (!result.ok) throw new Error(`expected a parse, got ${result.refusal}`);
  return result;
}

/** The millimetre value of a dimension, and of the one a parse may have left null. */
const mm = (dimension: Dimension) => dimension.millimetres.toFixed();
function diameterOf(dimension: Dimension | null): string {
  if (dimension === null) throw new Error("expected a diameter");
  return mm(dimension);
}

/** The pitch of a uniform spacing, and the members of a variable series — each asserting its kind. */
function pitchOf(spacing: Spacing): string {
  if (spacing.kind !== "UNIFORM") throw new Error(`expected a uniform spacing, got ${spacing.kind}`);
  return mm(spacing.pitch);
}
function seriesOf(spacing: Spacing): readonly string[] {
  if (spacing.kind !== "SERIES") throw new Error(`expected a series, got ${spacing.kind}`);
  return spacing.pitches.map((pitch) => mm(pitch));
}

describe("AutoCAD escapes strip first (§6, amended 2026-08-16)", () => {
  it("maps the three escapes the clause names", () => {
    expect(stripAutocadEscapes("12%%C")).toBe("12Ø");
    expect(stripAutocadEscapes("90%%D")).toBe("90°");
    expect(stripAutocadEscapes("%%P0.5")).toBe("±0.5");
    // AutoCAD's escape is case-insensitive by the format's own rule — a decoding fact, not a
    // reading of BD notation.
    expect(decodeNotation("12%%c")).toBe("12Ø");
  });

  it("strips before any other rule runs — the escape is the only diameter marker there is", () => {
    const spacing = parsed(parseSpacing('12%%C @ 5" c/c.'));
    expect(diameterOf(spacing.diameter)).toBe("12");
    expect(pitchOf(spacing.spacing)).toBe("127");
    // The rebar grammar demands a unit marker; without the escape coming off first there is none.
    const rebar = parsed(parseRebarGroups("2-25+1-20%%C ext."));
    expect(rebar.groups.map((group) => group.diameter.millimetres.toFixed())).toEqual(["25", "20"]);
    expect(rebar.note).toBe("ext.");
  });

  it("retains the raw string verbatim beside the parse (§11's raw-retention law)", () => {
    expect(parsed(parseSpacing('12%%C @ 5" c/c.')).raw).toBe('12%%C @ 5" c/c.');
    expect(parsed(parseRebarGroups("8-20mmØ")).raw).toBe("8-20mmØ");
  });
});

describe("all four Ø-lookalikes (§6)", () => {
  // Ø U+00D8 is the form the committed artifacts contain; the other three are the clause's
  // enumeration of what the drafter's font may have supplied instead.
  const lookalikes = ["Ø", "Φ", "ø", "∅"];

  it("reads the same diameter whichever glyph the drawing carries", () => {
    const readings = lookalikes.map((glyph) => {
      const rebar = parsed(parseRebarGroups(`8-20mm${glyph}`));
      return rebar.groups.map((group) => [group.count.toFixed(), group.diameter.millimetres.toFixed()]);
    });
    for (const reading of readings) expect(reading).toEqual([["8", "20"]]);
  });

  it("reads the same spacing diameter whichever glyph the drawing carries", () => {
    const pitches = lookalikes.map((glyph) => {
      const spacing = parsed(parseSpacing(`10${glyph} @ 4" c/c`));
      return [diameterOf(spacing.diameter), pitchOf(spacing.spacing)];
    });
    for (const pitch of pitches) expect(pitch).toEqual(["10", "101.6"]);
  });
});

describe("feet-inches (§6)", () => {
  it("reads the three forms the clause writes", () => {
    const hyphenated = parsed(parseFeetInches(`8'-4"`));
    expect([hyphenated.feet.toFixed(), hyphenated.inches.toFixed(), mm(hyphenated.dimension)]).toEqual(["8", "4", "2540"]);

    const unhyphenated = parsed(parseFeetInches(`8'4"`));
    expect(mm(unhyphenated.dimension)).toBe("2540");

    const fractional = parsed(parseFeetInches(`8'-4 1/2"`));
    expect([fractional.feet.toFixed(), fractional.inches.toFixed(), mm(fractional.dimension)]).toEqual(["8", "4.5", "2552.7"]);
    expect(fractional.dimension.unit).toBe("INCH");
  });

  it("refuses an inch length with no inch mark rather than assuming a unit", () => {
    expect(refusalOf(parseFeetInches(`8'-4`))).toBe("NOTATION_UNREADABLE");
  });

  it("refuses an empty string by name", () => {
    expect(refusalOf(parseFeetInches("   "))).toBe("NOTATION_EMPTY");
  });
});

describe("size pairs (§6)", () => {
  it("reads the imperial pair", () => {
    const pair = parsed(parseSizePair(`12"X24"`));
    expect([mm(pair.width), mm(pair.depth)]).toEqual(["304.8", "609.6"]);
    expect([pair.width.unit, pair.depth.unit]).toEqual(["INCH", "INCH"]);
  });

  it("reads the metric pair — the form the committed artifact carries", () => {
    const fixture = path.resolve(process.cwd(), "cad/tests/fixtures/structural-r1.entitygraph.json");
    const artifact = JSON.parse(readFileSync(fixture, "utf8")) as { entities: readonly { text?: string }[] };
    const texts = new Set(artifact.entities.flatMap((entity) => (entity.text === undefined ? [] : [entity.text])));
    expect(texts.has("450X600")).toBe(true);
    expect(texts.has("8-20mmØ")).toBe(true);

    const pair = parsed(parseSizePair("450X600"));
    expect([mm(pair.width), mm(pair.depth)]).toEqual(["450", "600"]);
    expect([pair.width.unit, pair.depth.unit]).toEqual(["MILLIMETRE", "MILLIMETRE"]);
    // And the rebar form the same artifact carries, read from the artifact's own string.
    expect(parsed(parseRebarGroups("8-20mmØ")).groups.map((group) => group.bars.toFixed())).toEqual(["8"]);
  });

  it("refuses a pair written half imperial and half metric", () => {
    expect(refusalOf(parseSizePair(`12"X600`))).toBe("SIZE_PAIR_UNIT_MIXED");
  });
});

describe("rebar groups (§6)", () => {
  it("reads one group", () => {
    const rebar = parsed(parseRebarGroups("14-20mmØ"));
    expect(rebar.multiplier.toFixed()).toBe("1");
    expect(rebar.groups.map((group) => [group.count.toFixed(), group.diameter.millimetres.toFixed(), group.bars.toFixed()])).toEqual([
      ["14", "20", "14"],
    ]);
  });

  it("reads a summed expression, the unit marker written once at the end", () => {
    const rebar = parsed(parseRebarGroups("8-20+6-16mmØ"));
    expect(rebar.groups.map((group) => [group.count.toFixed(), group.diameter.millimetres.toFixed()])).toEqual([
      ["8", "20"],
      ["6", "16"],
    ]);
  });

  it("keeps a trailing note tag verbatim beside the parse", () => {
    const rebar = parsed(parseRebarGroups("2-25+1-20Ø ext."));
    expect(rebar.note).toBe("ext.");
    expect(rebar.groups.map((group) => [group.count.toFixed(), group.diameter.millimetres.toFixed()])).toEqual([
      ["2", "25"],
      ["1", "20"],
    ]);
  });

  it("applies the `N of` multiplier to every group in its expression — the multi-group curtain", () => {
    const single = parsed(parseRebarGroups("1 of 24-25mmØ"));
    expect(single.multiplier.toFixed()).toBe("1");
    expect(single.groups.map((group) => group.bars.toFixed())).toEqual(["24"]);

    const curtain = parsed(parseRebarGroups("2 of 8-20+6-16mmØ"));
    expect(curtain.multiplier.toFixed()).toBe("2");
    // The multiplier spans **both** groups — 2×8 and 2×6 — never only the group it stands beside.
    expect(curtain.groups.map((group) => [group.count.toFixed(), group.bars.toFixed()])).toEqual([
      ["8", "16"],
      ["6", "12"],
    ]);
  });

  it("lets a note tag ride beside the parse without moving a diameter or a count", () => {
    const tagged = parsed(parseRebarGroups("8-20+6-16mmØ (BOT.)"));
    const untagged = parsed(parseRebarGroups("8-20+6-16mmØ"));
    expect(tagged.note).toBe("(BOT.)");
    expect(untagged.note).toBeNull();
    const shape = (rebar: typeof tagged) =>
      rebar.groups.map((group) => [group.count.toFixed(), group.diameter.millimetres.toFixed(), group.bars.toFixed()]);
    expect(shape(tagged)).toEqual(shape(untagged));
  });

  it("refuses a group with no unit marker rather than defaulting to millimetres", () => {
    expect(refusalOf(parseRebarGroups("14-20"))).toBe("NOTATION_UNREADABLE");
  });

  it("refuses a partial read — a spec-bleed remainder is never filed as a note tag", () => {
    expect(refusalOf(parseRebarGroups("14-20mmØ 450X600"))).toBe("NOTATION_INCOMPLETE");
  });

  it("refuses a string that is not notation at all", () => {
    expect(refusalOf(parseRebarGroups("C1"))).toBe("NOTATION_UNREADABLE");
  });
});

describe("spacing (§6)", () => {
  it("reads a diameter, a pitch and the c/c marker", () => {
    const spacing = parsed(parseSpacing(`10Ø @ 4" c/c`));
    expect(diameterOf(spacing.diameter)).toBe("10");
    expect(pitchOf(spacing.spacing)).toBe("101.6");
    expect(spacing.note).toBeNull();
  });

  it("reads the variable series in written order, never averaged", () => {
    expect(seriesOf(parsed(parseSpacing("@113/175/113")).spacing)).toEqual(["113", "175", "113"]);
  });

  it("consumes the `@125m` mm-typo so it cannot corrupt the note tag", () => {
    const bare = parsed(parseSpacing("@125m"));
    expect(pitchOf(bare.spacing)).toBe("125");
    expect(bare.note).toBeNull();

    const tagged = parsed(parseSpacing("@125m ALT. CKD"));
    expect(tagged.note).toBe("ALT. CKD");
    expect(pitchOf(tagged.spacing)).toBe("125");
  });

  it("reads the unspaced vulgar fraction as a proper fraction — six and a half inches", () => {
    const spacing = parsed(parseSpacing(`@ 61/2"`));
    expect(pitchOf(spacing.spacing)).toBe("165.1");
    // The improper reading, asserted absent: 61/2 inches would be 30.5" = 774.7 mm.
    expect(pitchOf(spacing.spacing)).not.toBe("774.7");
    expect(parsed(parseFeetInches(`61/2"`)).inches.toFixed()).toBe("6.5");
  });

  it("refuses a vulgar fraction that admits no proper reading", () => {
    expect(refusalOf(parseSpacing(`@ 9/2"`))).toBe("FRACTION_NOT_PROPER");
  });

  it("lets a note tag ride beside the parse without moving the diameter or the spacing", () => {
    const tagged = parsed(parseSpacing(`10Ø @ 4" c/c ALT. CKD`));
    const untagged = parsed(parseSpacing(`10Ø @ 4" c/c`));
    expect(tagged.note).toBe("ALT. CKD");
    expect(diameterOf(tagged.diameter)).toBe(diameterOf(untagged.diameter));
    expect(pitchOf(tagged.spacing)).toBe(pitchOf(untagged.spacing));
  });

  it("refuses a spacing string with no pitch", () => {
    expect(refusalOf(parseSpacing("10Ø @"))).toBe("NOTATION_UNREADABLE");
  });
});

describe("floor zones (§6)", () => {
  it("expands a storey range", () => {
    const zone = parsed(parseFloorZone("1st-2nd"));
    expect(zone.expanded).toEqual([
      { kind: "STOREY", storey: 1 },
      { kind: "STOREY", storey: 2 },
    ]);
    expect(parsed(parseFloorZone("1st-4th")).expanded).toHaveLength(4);
  });

  it("keeps endpoint semantics where an endpoint is an anchor — the level stack says what lies between", () => {
    const zone = parsed(parseFloorZone("7th-Roof"));
    expect(zone.from).toEqual({ kind: "STOREY", storey: 7 });
    expect(zone.to).toEqual({ kind: "ANCHOR", anchor: "ROOF" });
    expect(zone.expanded).toBeNull();
  });

  it("maps TOP→ROOF and `Below GF`→BGF", () => {
    const top = parsed(parseFloorZone("1ST TO TOP FLOOR"));
    expect(top.from).toEqual({ kind: "STOREY", storey: 1 });
    expect(top.to).toEqual({ kind: "ANCHOR", anchor: "ROOF" });
    expect(top.expanded).toBeNull();

    const below = parsed(parseFloorZone("Below GF"));
    expect(below.from).toEqual({ kind: "ANCHOR", anchor: "BGF" });
    expect(below.to).toEqual({ kind: "ANCHOR", anchor: "BGF" });
    expect(below.expanded).toEqual([{ kind: "ANCHOR", anchor: "BGF" }]);
  });

  it("refuses a floor token no vocabulary names", () => {
    expect(refusalOf(parseFloorZone("MEZZANINE"))).toBe("FLOOR_ZONE_UNMAPPED");
  });
});

describe("no float where a dimension feeds a measurement (CLAUDE.md)", () => {
  it("converts inches in decimal — the vectors binary floating point gets wrong", () => {
    // 4 × 25.4 is 101.59999999999999431566 in binary floating point, and 100.5 × 25.4 is
    // 2552.69999999999981810106. Both are exact here.
    expect(parsed(parseFeetInches(`4"`)).dimension.millimetres.toFixed(20)).toBe("101.60000000000000000000");
    expect(parsed(parseFeetInches(`8'-4 1/2"`)).dimension.millimetres.toFixed(20)).toBe("2552.70000000000000000000");
    const spacing = parsed(parseSpacing(`@ 61/2"`));
    const pitch = spacing.spacing.kind === "UNIFORM" ? spacing.spacing.pitch.millimetres : null;
    expect(pitch?.toFixed(20)).toBe("165.10000000000000000000");
  });
});

/**
 * The register: every closed refusal code is driven by a case above. A code with no case, and a
 * case for a code that has been removed, both turn verify red.
 */
afterAll(() => {
  expect([...observed].sort()).toEqual([...NOTATION_REFUSALS].sort());
});
