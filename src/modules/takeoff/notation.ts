import { Decimal } from "decimal.js";
import { MeasurementDecimal } from "@/core/formula";

/**
 * The BD drawing-notation parsers (cad-ingestion.md §6, golden-tested against the real strings the
 * clause enumerates). Pure string functions and nothing else: no entity, no view, no row, no
 * storage. They live **beside their consumer in the app** — §11's member-type registry — and never
 * in `cad/`, because the pipeline stays geometry/spatial-only and **text crosses the seam raw**
 * (§6's amendment of 2026-08-16, ADR-0009). §2's "decoded string" is the file's own character
 * decoding, which ezdxf resolves; AutoCAD's formatting escapes are still standing in the artifact
 * when a string reaches this file, and stripping them is the first thing that happens here.
 *
 * These parsers **grade on top of raw truth, never instead of it** (§11's raw-retention law): every
 * result carries the `raw` string it was read from, unmodified, so a parser improvement re-reads
 * old evidence rather than losing it, and a note tag rides beside a parse instead of corrupting it.
 *
 * Nothing here guesses. An unreadable string, an unmapped unit, an improper vulgar fraction and a
 * floor token no vocabulary names all **refuse by name**, and a string that reads in part refuses
 * too — a partial read of a drawing note is the partial faulty estimate the governing sentence
 * bans. Dimensions are `Decimal` throughout (CLAUDE.md: never floats for quantities); `4"` is
 * exactly 101.6 mm here and 101.59999999999999431566 in binary floating point.
 */

/**
 * Why a notation string did not parse — closed codes, never prose (CLAUDE.md). Each names a
 * distinct fault so a consumer can tell "nobody has taught me this form" from "this form is
 * written wrong":
 *
 * - `NOTATION_EMPTY` — the string carries no notation at all once decoded.
 * - `NOTATION_UNREADABLE` — no rule in the grammar matches: an unknown form, or a unit this
 *   parser has no mapping for. Never a fallthrough reading.
 * - `NOTATION_INCOMPLETE` — a **prefix** read and text was left over that is not a lawful note
 *   tag. Refused rather than returned, because a partial read is the one thing worse than none.
 * - `FRACTION_NOT_PROPER` — a vulgar fraction admits no proper reading (`9/2"`). §6 accepts the
 *   unspaced form **only** as a proper fraction, so the improper reading is refused, not taken.
 * - `FRACTION_AMBIGUOUS` — an unspaced vulgar fraction admits **more than one** proper reading
 *   (`115/16"` is 11 5/16" or 1 15/16"; nothing in the string says which). §6 admits the unspaced
 *   form only as a proper fraction; it does not license choosing between two proper fractions, and
 *   a 6× error in a dimension that feeds a measurement is the partial faulty read the governing
 *   sentence bans. Where the reading is undetermined the parser defers by name.
 * - `SPACING_AMBIGUOUS` — a two-member `n/m` spacing tail with no inch mark reads either as a
 *   two-member variable series or as an unspaced vulgar fraction, and nothing in the string
 *   decides (`@ 61/2` — the same notation with the inch mark dropped). Three members or more is a
 *   series unambiguously; two members that also read as a proper fraction refuse.
 * - `SIZE_PAIR_UNIT_MIXED` — one side of a size pair is imperial and the other metric. An
 *   unmapped pairing refuses; it is never resolved by assuming one of the two.
 * - `FLOOR_ZONE_UNMAPPED` — a floor-zone endpoint the vocabulary does not name. The level stack
 *   is the authority on levels (identity.md §3); a token nobody mapped is not invented here.
 */
export const NOTATION_REFUSALS = [
  "NOTATION_EMPTY",
  "NOTATION_UNREADABLE",
  "NOTATION_INCOMPLETE",
  "FRACTION_NOT_PROPER",
  "FRACTION_AMBIGUOUS",
  "SPACING_AMBIGUOUS",
  "SIZE_PAIR_UNIT_MIXED",
  "FLOOR_ZONE_UNMAPPED",
] as const;
export type NotationRefusal = (typeof NOTATION_REFUSALS)[number];

/** A refusal carries its named cause and the raw string, so the evidence survives the failure. */
export type NotationRefused = { readonly ok: false; readonly refusal: NotationRefusal; readonly raw: string };

const refuse = (raw: string, refusal: NotationRefusal): NotationRefused => ({ ok: false, refusal, raw });

/**
 * The unit a dimension was **written in** on the sheet, retained beside the SI value: imperial is
 * lawful only as an input read off a drawing and is kept as provenance (bd-authority.md §3;
 * measurement-rules.md §5 — the unit is reported, never interpreted).
 */
export const NOTATION_UNITS = ["MILLIMETRE", "INCH"] as const;
export type NotationUnit = (typeof NOTATION_UNITS)[number];

/**
 * One dimension read off a drawing: the SI value in millimetres at full precision, the unit it was
 * written in, and the source text it was read from.
 */
export type Dimension = {
  readonly millimetres: Decimal;
  readonly unit: NotationUnit;
  readonly text: string;
};

/** Exact by definition (1 in = 25.4 mm), and exact in `Decimal` — the reason no float appears here. */
const MM_PER_INCH = new MeasurementDecimal("25.4");
const INCHES_PER_FOOT = new MeasurementDecimal("12");

const millimetres = (value: Decimal, text: string): Dimension => ({ millimetres: value, unit: "MILLIMETRE", text });
const inches = (value: Decimal, text: string): Dimension => ({ millimetres: value.times(MM_PER_INCH), unit: "INCH", text });

/* ── Decoding: the escapes come off before any other rule runs ─────────────────────────────── */

/**
 * AutoCAD's formatting escapes (§6: `%%C`→Ø, `%%D`→°, `%%P`→±). The extractor leaves them standing
 * — the artifact keeps exactly what the file said — so every parser here decodes first and reads
 * second. The escape is case-insensitive by AutoCAD's own rule, which is a fact about the format's
 * text encoding, not a guess about BD notation.
 */
const AUTOCAD_ESCAPES: Readonly<Record<string, string>> = { C: "Ø", D: "°", P: "±" };

export function stripAutocadEscapes(raw: string): string {
  return raw.replace(/%%([CDP])/gi, (match: string, code: string) => AUTOCAD_ESCAPES[code.toUpperCase()] ?? match);
}

/**
 * The four Ø-lookalikes §6 names, folded to one glyph: Ø U+00D8 (the form the committed artifacts
 * actually contain), Φ U+03A6, ø U+00F8 and ∅ U+2205. Grounded in observed forms and the clause's
 * enumeration — nothing beyond the four is folded, because a fifth glyph nobody has seen would be
 * a guess about a font.
 */
const DIAMETER_LOOKALIKES = /[ØøΦ∅]/g;

export function normaliseDiameterGlyphs(text: string): string {
  return text.replace(DIAMETER_LOOKALIKES, "Ø");
}

/** Escapes first, glyphs second — the order §6 fixes, and the order every parser below runs in. */
export function decodeNotation(raw: string): string {
  return normaliseDiameterGlyphs(stripAutocadEscapes(raw));
}

/* ── Numbers: the proper-fraction law ──────────────────────────────────────────────────────── */

type Reading = { readonly ok: true; readonly value: Decimal } | { readonly ok: false; readonly refusal: NotationRefusal };

const SPACED_MIXED = /^(\d+)\s+(\d+)\/(\d+)$/;
const VULGAR = /^(\d+)\/(\d+)$/;
const WHOLE = /^(\d+)$/;

function properFraction(whole: string, numerator: string, denominator: string): Reading {
  const n = new MeasurementDecimal(numerator);
  const d = new MeasurementDecimal(denominator);
  if (d.lte(0) || n.lte(0) || n.gte(d)) return { ok: false, refusal: "FRACTION_NOT_PROPER" };
  return { ok: true, value: new MeasurementDecimal(whole).plus(n.div(d)) };
}

/**
 * The unspaced vulgar fraction, accepted **only as a proper fraction** (§6): `61/2"` is six and a
 * half inches, never thirty and a half. The whole number is written first, so a split takes some
 * trailing run of the digits as the numerator — `61/2` splits 6 + 1/2 and nothing else reads
 * proper, `123/16` splits 12 + 3/16.
 *
 * **Every** split is enumerated and the reading is taken only where **exactly one** reads proper.
 * `115/16"` — an ordinary imperial dimension — splits 11 + 5/16 *and* 1 + 15/16, six times apart;
 * `13/16"` splits 1 + 3/16 *and* 0 + 13/16. §6 admits the unspaced form as a proper fraction, not
 * as a choice between two of them, so a digit string that admits more than one refuses
 * `FRACTION_AMBIGUOUS` rather than picking the shortest run and returning a wrong dimension. A
 * string with no proper split (`9/2`) refuses `FRACTION_NOT_PROPER` rather than falling back to
 * the improper reading. A leading-zero numerator is not a split anyone writes.
 */
function splitUnspacedVulgar(digits: string, denominator: string): Reading {
  const d = new MeasurementDecimal(denominator);
  let only: Decimal | null = null;
  for (let take = 1; take <= digits.length; take++) {
    const numerator = digits.slice(digits.length - take);
    const whole = digits.slice(0, digits.length - take);
    if (numerator.length > 1 && numerator.startsWith("0")) continue;
    const n = new MeasurementDecimal(numerator);
    if (n.lte(0) || n.gte(d)) continue;
    if (only !== null) return { ok: false, refusal: "FRACTION_AMBIGUOUS" };
    only = new MeasurementDecimal(whole === "" ? "0" : whole).plus(n.div(d));
  }
  if (only === null) return { ok: false, refusal: "FRACTION_NOT_PROPER" };
  return { ok: true, value: only };
}

/**
 * Does this text read as an unspaced vulgar fraction at all — either determinately, or ambiguously
 * between two proper readings? Both answers mean a competing reading exists, which is what the
 * spacing grammar needs to know before it commits a two-member `n/m` tail to a series.
 */
function admitsVulgarReading(text: string): boolean {
  const vulgar = VULGAR.exec(text);
  if (!vulgar) return false;
  const [, digits = "", denominator = ""] = vulgar;
  const reading = splitUnspacedVulgar(digits, denominator);
  return reading.ok || reading.refusal === "FRACTION_AMBIGUOUS";
}

/** A whole number, a spaced mixed number (`4 1/2`) or an unspaced vulgar fraction (`61/2`). */
function readMixedNumber(text: string): Reading {
  const spaced = SPACED_MIXED.exec(text);
  if (spaced) {
    const [, whole = "", numerator = "", denominator = ""] = spaced;
    return properFraction(whole, numerator, denominator);
  }
  const vulgar = VULGAR.exec(text);
  if (vulgar) {
    const [, digits = "", denominator = ""] = vulgar;
    return splitUnspacedVulgar(digits, denominator);
  }
  const whole = WHOLE.exec(text);
  if (whole) return { ok: true, value: new MeasurementDecimal(whole[0]) };
  return { ok: false, refusal: "NOTATION_UNREADABLE" };
}

const METRIC = /^(\d+(?:\.\d+)?)$/;
const FEET = /^(\d+)\s*'\s*(.*)$/;

type ImperialReading =
  | { readonly ok: true; readonly feet: Decimal; readonly inches: Decimal; readonly total: Decimal }
  | { readonly ok: false; readonly refusal: NotationRefusal };

/**
 * An imperial length as BD drawings write it: `8'-4"`, `8'4"`, `8'-4 1/2"`, a bare `8'`, or a bare
 * inch length (`4"`, `61/2"`). The inch mark is required where inches are written — a trailing
 * number with no unit is an unmapped unit and refuses.
 */
function readImperialLength(text: string): ImperialReading {
  const trimmed = text.trim();
  const feetMatch = FEET.exec(trimmed);
  const feet = new MeasurementDecimal(feetMatch?.[1] ?? "0");
  let rest = (feetMatch?.[2] ?? trimmed).trim();
  if (feetMatch) rest = rest.replace(/^-\s*/, "");
  if (rest === "") {
    if (!feetMatch) return { ok: false, refusal: "NOTATION_UNREADABLE" };
    return { ok: true, feet, inches: new MeasurementDecimal("0"), total: feet.times(INCHES_PER_FOOT) };
  }
  if (!rest.endsWith('"')) return { ok: false, refusal: "NOTATION_UNREADABLE" };
  const reading = readMixedNumber(rest.slice(0, -1).trim());
  if (!reading.ok) return reading;
  return { ok: true, feet, inches: reading.value, total: feet.times(INCHES_PER_FOOT).plus(reading.value) };
}

/* ── Note tags: retained verbatim, never part of a number ──────────────────────────────────── */

/**
 * The words the grammar itself owns. A trailing `c/c` is a spacing marker and a trailing `mm` is a
 * unit; neither is a note, and neither may be swallowed into one. `parseSpacing` strips the c/c
 * marker before it splits a note, which is what handles the spaced `c / c` form; these entries are
 * the backstop for the forms the strip does not spell (`cc`) and for callers that do not strip.
 */
const GRAMMAR_TOKENS = new Set(["mm", "of", "to", "c/c", "c/c.", "cc", "x", "@", "+", "-"]);

/** A note token carries no digit and no diameter glyph — those belong to a reading, not to a tag. */
const NOTE_TOKEN = /^[^\dØ]+$/;

const isNoteToken = (token: string): boolean => !GRAMMAR_TOKENS.has(token.toLowerCase()) && NOTE_TOKEN.test(token);

/**
 * Split a trailing note tag off a notation string (§6: `ALT. CKD`, `(BOT.)`, `ext.` are retained
 * **verbatim** and never corrupt a dia or a spacing). The tag is the longest run of trailing
 * whitespace-separated tokens that carry no digit, no diameter glyph and no grammar word, sliced
 * out of the decoded string so its own spacing and punctuation survive untouched.
 *
 * A trailing fragment carrying digits — a spec-bleed cell, a second dimension — is **not** a note
 * tag: it stays in the body, where the grammar refuses it by name rather than filing it as prose.
 */
function splitNoteTag(text: string): { readonly body: string; readonly note: string | null } {
  const tokens = [...text.matchAll(/\S+/g)].map((token) => ({ text: token[0], at: token.index }));
  let noteAt: number | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token === undefined || !isNoteToken(token.text)) break;
    noteAt = token.at;
  }
  if (noteAt === null) return { body: text.trim(), note: null };
  return { body: text.slice(0, noteAt).trim(), note: text.slice(noteAt).trim() };
}

/* ── Feet-inches ───────────────────────────────────────────────────────────────────────────── */

export type FeetInchesParse = {
  readonly ok: true;
  readonly raw: string;
  readonly feet: Decimal;
  readonly inches: Decimal;
  readonly dimension: Dimension;
};

/**
 * `8'-4"`, `8'4"`, `8'-4 1/2"` (§6). `feet` and `inches` are the parts as written; `dimension`
 * carries the whole length in millimetres with `INCH` as its written unit.
 */
export function parseFeetInches(raw: string): FeetInchesParse | NotationRefused {
  const decoded = decodeNotation(raw).trim();
  if (decoded === "") return refuse(raw, "NOTATION_EMPTY");
  const reading = readImperialLength(decoded);
  if (!reading.ok) return refuse(raw, reading.refusal);
  return { ok: true, raw, feet: reading.feet, inches: reading.inches, dimension: inches(reading.total, decoded) };
}

/* ── Size pairs ────────────────────────────────────────────────────────────────────────────── */

export type SizePairParse = {
  readonly ok: true;
  readonly raw: string;
  readonly width: Dimension;
  readonly depth: Dimension;
};

function readSizeMember(text: string): { readonly ok: true; readonly dimension: Dimension } | { readonly ok: false; readonly refusal: NotationRefusal } {
  const trimmed = text.trim();
  const metric = METRIC.exec(trimmed);
  if (metric) return { ok: true, dimension: millimetres(new MeasurementDecimal(metric[0]), trimmed) };
  const imperial = readImperialLength(trimmed);
  if (!imperial.ok) return imperial;
  return { ok: true, dimension: inches(imperial.total, trimmed) };
}

/**
 * A size pair, imperial `12"X24"` or metric `450X600` (§6). Both sides must be written in the same
 * unit: a mixed pair refuses `SIZE_PAIR_UNIT_MIXED` rather than assuming which side is the typo.
 */
export function parseSizePair(raw: string): SizePairParse | NotationRefused {
  const decoded = decodeNotation(raw).trim();
  if (decoded === "") return refuse(raw, "NOTATION_EMPTY");
  const parts = decoded.split(/\s*[xX]\s*/);
  if (parts.length !== 2) return refuse(raw, "NOTATION_UNREADABLE");
  const [first = "", second = ""] = parts;
  const width = readSizeMember(first);
  if (!width.ok) return refuse(raw, width.refusal);
  const depth = readSizeMember(second);
  if (!depth.ok) return refuse(raw, depth.refusal);
  if (width.dimension.unit !== depth.dimension.unit) return refuse(raw, "SIZE_PAIR_UNIT_MIXED");
  return { ok: true, raw, width: width.dimension, depth: depth.dimension };
}

/* ── Rebar groups ──────────────────────────────────────────────────────────────────────────── */

export type RebarGroup = {
  /** The count as written in the group. */
  readonly count: Decimal;
  /** The bar diameter — always millimetres in BD practice (`20mmØ`). */
  readonly diameter: Dimension;
  /** The bars this group stands for once the expression's `N of` multiplier is applied. */
  readonly bars: Decimal;
};

export type RebarGroupsParse = {
  readonly ok: true;
  readonly raw: string;
  /** The `N of` multiplier, 1 where none is written. It spans **every** group in the expression. */
  readonly multiplier: Decimal;
  readonly groups: readonly RebarGroup[];
  readonly note: string | null;
};

const MULTIPLIER = /^(\d+)\s*of\s+(.*)$/i;
/** `14-20mmØ`, `6-16`, `1-20Ø` — count, dia, and whichever unit marker the drafter wrote. */
const REBAR_GROUP = /^(\d+)\s*-\s*(\d+)\s*(mm)?\s*(Ø)?/i;

/**
 * Rebar groups as §6 enumerates them: `14-20mmØ`, `8-20+6-16mmØ`, `2-25+1-20Ø ext.`, and the
 * shear-wall curtain `1 of 24-25mmØ` where **the `N of` multiplier spans its groups** — every
 * group in the expression is multiplied, not just the one it stands next to.
 *
 * At least one group must carry a unit marker (`mm` or a Ø-lookalike): `14-20` on its own states
 * no unit and refuses rather than defaulting to millimetres.
 */
export function parseRebarGroups(raw: string): RebarGroupsParse | NotationRefused {
  const decoded = decodeNotation(raw).trim();
  if (decoded === "") return refuse(raw, "NOTATION_EMPTY");
  const { body, note } = splitNoteTag(decoded);
  if (body === "") return refuse(raw, "NOTATION_UNREADABLE");

  const multiplied = MULTIPLIER.exec(body);
  const multiplier = new MeasurementDecimal(multiplied?.[1] ?? "1");
  const expression = multiplied?.[2] ?? body;

  const groups: RebarGroup[] = [];
  let marked = false;
  for (const part of expression.split("+")) {
    // A trailing full stop is punctuation, not notation; everything else must be consumed.
    const text = part.trim().replace(/\.$/, "").trimEnd();
    const match = REBAR_GROUP.exec(text);
    if (!match) return refuse(raw, groups.length === 0 ? "NOTATION_UNREADABLE" : "NOTATION_INCOMPLETE");
    // Anything the group grammar did not consume is a partial read, never a silent remainder.
    if (match[0].length < text.length) return refuse(raw, "NOTATION_INCOMPLETE");
    if (match[3] !== undefined || match[4] !== undefined) marked = true;
    const count = new MeasurementDecimal(match[1] ?? "");
    groups.push({
      count,
      diameter: millimetres(new MeasurementDecimal(match[2] ?? ""), text),
      bars: count.times(multiplier),
    });
  }
  if (groups.length === 0) return refuse(raw, "NOTATION_UNREADABLE");
  if (!marked) return refuse(raw, "NOTATION_UNREADABLE");
  return { ok: true, raw, multiplier, groups, note };
}

/* ── Spacing ───────────────────────────────────────────────────────────────────────────────── */

export type Spacing =
  | { readonly kind: "UNIFORM"; readonly pitch: Dimension }
  /** The variable series `@113/175/113` — pitches in written order, never averaged into one. */
  | { readonly kind: "SERIES"; readonly pitches: readonly Dimension[] };

export type SpacingParse = {
  readonly ok: true;
  readonly raw: string;
  readonly diameter: Dimension | null;
  readonly spacing: Spacing;
  readonly note: string | null;
};

/**
 * The `c/c` centre-to-centre marker, as written with or without spaces around the slash (`c/c`,
 * `c/c.`, `c / c`). It is **stripped before the note tag is split**, not after: the note split
 * tokenises on whitespace, so a spaced `c / c` would otherwise present as three wordlike tokens
 * and be filed as prose — the marker corrupting the note tag §6 forbids the reverse of. The
 * capture keeps whatever non-letter preceded it, which is how the match is bounded without
 * eating a word that merely ends in `c`.
 */
const CENTRE_TO_CENTRE = /(^|[^A-Za-z])c\s*\/\s*c\.?(?![A-Za-z])/gi;
const DIAMETER_LEADING = /^(\d+)\s*(?:mm)?\s*Ø$/i;
const DIAMETER_TRAILING = /^Ø\s*(\d+)\s*(?:mm)?$/i;
/** `125`, `125mm`, and §6's `@125m` mm-typo — the stray `m` is consumed, not left to become a note. */
const METRIC_PITCH = /^(\d+(?:\.\d+)?)\s*(?:mm|m)?$/i;

/**
 * Spacing as §6 writes it: `10Ø @ 4" c/c`, `12%%C @ 5" c/c.` (escapes stripped first), the
 * variable series `@113/175/113`, the `@125m` mm-typo, and the unspaced vulgar fraction `@ 61/2"`
 * — six and a half inches, never thirty and a half.
 *
 * The inch mark chooses the imperial branch before the series branch is considered, so `61/2"` can
 * never be read as a two-member series. Where the inch mark is **absent** it does not silently
 * decide the other way either: a two-member `n/m` tail that also reads as a proper fraction is
 * ambiguous between the two forms and refuses `SPACING_AMBIGUOUS`, because `@ 61/2` returning a
 * 61 mm-then-2 mm series is a physically impossible reading returned as fact. Three members or
 * more (`@113/175/113`) is a series unambiguously, and so is a two-member tail no proper fraction
 * reads (`@200/150`).
 */
export function parseSpacing(raw: string): SpacingParse | NotationRefused {
  const decoded = decodeNotation(raw).trim();
  if (decoded === "") return refuse(raw, "NOTATION_EMPTY");
  // The c/c marker comes off first, so the note split never sees it — spaced or unspaced, it is
  // grammar and not prose.
  const { body, note } = splitNoteTag(decoded.replace(CENTRE_TO_CENTRE, "$1"));
  const expression = body.trim();
  if (expression === "") return refuse(raw, "NOTATION_UNREADABLE");

  const at = expression.indexOf("@");
  if (at < 0 || expression.indexOf("@", at + 1) >= 0) return refuse(raw, "NOTATION_UNREADABLE");
  const head = expression.slice(0, at).trim();
  const tail = expression.slice(at + 1).trim();

  let diameter: Dimension | null = null;
  if (head !== "") {
    const written = DIAMETER_LEADING.exec(head) ?? DIAMETER_TRAILING.exec(head);
    if (!written) return refuse(raw, "NOTATION_UNREADABLE");
    diameter = millimetres(new MeasurementDecimal(written[1] ?? ""), head);
  }

  if (tail === "") return refuse(raw, "NOTATION_UNREADABLE");
  if (tail.includes('"')) {
    const reading = readImperialLength(tail);
    if (!reading.ok) return refuse(raw, reading.refusal);
    return { ok: true, raw, diameter, spacing: { kind: "UNIFORM", pitch: inches(reading.total, tail) }, note };
  }
  if (tail.includes("/")) {
    const members = tail.split("/");
    // Two members and no inch mark: a series and a vulgar fraction both read it, and nothing in
    // the string chooses. It defers by name rather than returning one of the two.
    if (members.length === 2 && admitsVulgarReading(tail)) return refuse(raw, "SPACING_AMBIGUOUS");
    const pitches: Dimension[] = [];
    for (const part of members) {
      const member = METRIC_PITCH.exec(part.trim());
      if (!member) return refuse(raw, pitches.length === 0 ? "NOTATION_UNREADABLE" : "NOTATION_INCOMPLETE");
      pitches.push(millimetres(new MeasurementDecimal(member[1] ?? ""), part.trim()));
    }
    if (pitches.length < 2) return refuse(raw, "NOTATION_UNREADABLE");
    return { ok: true, raw, diameter, spacing: { kind: "SERIES", pitches }, note };
  }
  const uniform = METRIC_PITCH.exec(tail);
  if (!uniform) return refuse(raw, "NOTATION_UNREADABLE");
  return {
    ok: true,
    raw,
    diameter,
    spacing: { kind: "UNIFORM", pitch: millimetres(new MeasurementDecimal(uniform[1] ?? ""), tail) },
    note,
  };
}

/* ── Floor zones ───────────────────────────────────────────────────────────────────────────── */

/**
 * The floor-zone endpoints that are not storey numbers (§6): `Below GF`→BGF, ground floor, and
 * roof — which `Roof`, `TOP` and `TOP FLOOR` all land on. Nothing else is invented: a token this
 * vocabulary does not name refuses `FLOOR_ZONE_UNMAPPED`.
 */
export const FLOOR_ZONE_ANCHORS = ["BGF", "GF", "ROOF"] as const;
export type FloorZoneAnchor = (typeof FLOOR_ZONE_ANCHORS)[number];

export type FloorLevel =
  | { readonly kind: "ANCHOR"; readonly anchor: FloorZoneAnchor }
  | { readonly kind: "STOREY"; readonly storey: number };

export type FloorZoneParse = {
  readonly ok: true;
  readonly raw: string;
  readonly from: FloorLevel;
  readonly to: FloorLevel;
  /**
   * The levels the notation itself enumerates — a storey-to-storey range, or the single level a
   * one-token zone names. `null` where an endpoint is an anchor (`7th-Roof`, `1ST TO TOP FLOOR`):
   * **endpoint semantics are kept** and what lies between is the level stack's to say, never this
   * parser's (identity.md §3; cad-ingestion.md §9's `LEVEL_RANGE_ENDPOINT_UNMAPPED`).
   */
  readonly expanded: readonly FloorLevel[] | null;
};

const FLOOR_ALIASES: Readonly<Record<string, FloorZoneAnchor>> = {
  "BGF": "BGF",
  "BELOW GF": "BGF",
  "BELOW G.F.": "BGF",
  "BELOW GROUND FLOOR": "BGF",
  "GF": "GF",
  "G.F.": "GF",
  "GROUND": "GF",
  "GROUND FLOOR": "GF",
  "ROOF": "ROOF",
  "TOP": "ROOF",
  "TOP FLOOR": "ROOF",
  "ROOF FLOOR": "ROOF",
};

const STOREY = /^(\d+)\s*(?:ST|ND|RD|TH)?(?:\s+FLOOR)?$/;

function readFloorLevel(token: string): FloorLevel | null {
  const text = token.trim().replace(/\s+/g, " ");
  const anchor = FLOOR_ALIASES[text];
  if (anchor !== undefined) return { kind: "ANCHOR", anchor };
  const storey = STOREY.exec(text);
  if (storey) return { kind: "STOREY", storey: Number.parseInt(storey[1] ?? "", 10) };
  return null;
}

/**
 * Floor zones as §6 writes them: `1st-2nd` expands, `7th-Roof` keeps endpoint semantics,
 * `1ST TO TOP FLOOR` maps TOP→ROOF, `Below GF`→BGF. Case-insensitive, because a drawing writes
 * the same zone in both cases on the same sheet.
 */
export function parseFloorZone(raw: string): FloorZoneParse | NotationRefused {
  const decoded = decodeNotation(raw).toUpperCase().replace(/\s+/g, " ").trim();
  if (decoded === "") return refuse(raw, "NOTATION_EMPTY");

  const separated = /\s+TO\s+/.test(decoded) ? decoded.split(/\s+TO\s+/) : decoded.split(/\s*-\s*/);
  if (separated.length > 2) return refuse(raw, "NOTATION_UNREADABLE");

  const [head = "", tail] = separated;
  const from = readFloorLevel(head);
  if (!from) return refuse(raw, "FLOOR_ZONE_UNMAPPED");
  const to = tail === undefined ? from : readFloorLevel(tail);
  if (!to) return refuse(raw, "FLOOR_ZONE_UNMAPPED");

  if (from.kind === "STOREY" && to.kind === "STOREY") {
    const low = Math.min(from.storey, to.storey);
    const high = Math.max(from.storey, to.storey);
    const expanded: FloorLevel[] = [];
    for (let storey = low; storey <= high; storey++) expanded.push({ kind: "STOREY", storey });
    return { ok: true, raw, from, to, expanded };
  }
  if (tail === undefined) return { ok: true, raw, from, to, expanded: [from] };
  return { ok: true, raw, from, to, expanded: null };
}
