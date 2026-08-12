import type { Entity, EntityGraph } from "@/core/entitygraph";
import { compareCanonical } from "@/core/order";

/**
 * The view partition (cad-ingestion.md §7). Every model-space ORIGINAL entity
 * of a drawing belongs to exactly one view; view types are a closed
 * vocabulary; **only layout-plan-class views may yield instances** — schedules,
 * sections and details yield types and dimensions only. That decision lives in
 * exactly one exported predicate here (`mayYieldInstances`), and
 * `src/__tests__/view-law.spec.ts` proves no second decision site exists.
 *
 * Classification follows caption grammar (en+bn stems), never title literals
 * and never layer or block names (§8/§10: a drawing-specific literal may
 * corroborate, never add or re-assign a role). A caption the grammar cannot
 * classify anchors nothing and its view is honestly `untyped`; an entity no
 * caption reaches lands in `unassigned`, named, never dropped.
 *
 * Everything here is pure and deterministic: no I/O, no clock, no config.
 */

/** §7's closed vocabulary. `unassigned` is a real member: the orphan bucket is
 *  a view so that "exactly one view" is literally true over `views`. */
export const viewTypes = [
  "layout_plan",
  "schedule",
  "long_section",
  "member_section",
  "detail",
  "stair_plan",
  "stair_section",
  "legend_notes",
  "title",
  "untyped",
  "unassigned",
] as const;
export type ViewType = (typeof viewTypes)[number];

/**
 * THE decision site for instance lawfulness (§7). A layout plan is the only
 * view that draws members in their placed positions; every other view repeats
 * members that are placed elsewhere, and counting from it is double-counting —
 * over-measurement, which is a hard block and never a disclosure
 * (quantity-contract.md §4).
 *
 * `stair_plan` reads false deliberately, and this is narrower than the legacy
 * pipeline (which admitted it as the stair family's layout-plan analogue): a
 * stair plan repeats columns and walls the floor plan already places, and
 * nothing in this system yet distinguishes the stair's own members from those
 * repeats. Under-measuring a stair and saying so is the lawful side of the
 * asymmetry; the stair lane re-opens this line, and nowhere else may.
 *
 * Any code that needs the countability decision MUST import this predicate.
 */
export function mayYieldInstances(type: ViewType): boolean {
  return type === "layout_plan";
}

/** Why a view is untyped, or why an entity reached no view. Every one of these
 *  is a named reason on the artifact — silence is the condemned state. */
export const viewReasonCodes = [
  "CAPTION_UNCLASSIFIABLE",
  "NO_CAPTION_IN_REACH",
  "NO_GEOMETRY_TO_PLACE",
] as const;
export type ViewReasonCode = (typeof viewReasonCodes)[number];

export type ViewReason = { code: ViewReasonCode; message: string };

export type ViewCaption = { handle: string; text: string; height: number };

export type View = {
  /** Deterministic within one graph: caption handle, or `unassigned`. */
  id: string;
  type: ViewType;
  caption: ViewCaption | null;
  /** The caption's subject fragment when the grammar isolates one
   *  (`COLUMN` of `COLUMN SCHEDULE`) — informational, never an identity key. */
  subject: string | null;
  /** [x0, y0, x1, y1] over the assigned entities; null when none carry
   *  geometry (the unassigned bucket of unplaceable entities). */
  bounds: [number, number, number, number] | null;
  /** The ORIGINAL handles this view owns — the assignment itself. */
  handles: string[];
  reasons: ViewReason[];
};

export type ViewPartition = {
  views: View[];
  /** The domain the partition ran over: `sum(view.handles.length)` equals it. */
  originalCount: number;
};

// ── Caption grammar (§7) ─────────────────────────────────────────────────────

/**
 * Bengali caption vocabulary → the English stems the grammar reads. A pure
 * vocabulary substitution: bn captions classify through the same rules, so
 * there is one grammar, not two. (Bengali digits are not mapped here — a view
 * caption's marks are drawn in ASCII even on bn sheets.)
 */
const BN_STEMS: Array<[RegExp, string]> = [
  [/সিঁড়ির?/gu, "STAIR"],
  [/পরিকল্পনা|প্ল্যান|নকশা/gu, "PLAN"],
  [/তফসিল|শিডিউল|তালিকা/gu, "SCHEDULE"],
  [/অনুদৈর্ঘ্য/gu, "LONG"],
  [/সেকশন|ছেদ|প্রস্থচ্ছেদ/gu, "SECTION"],
  [/বিস্তারিত|ডিটেইল/gu, "DETAIL"],
  [/নোট|টীকা/gu, "NOTES"],
  [/লিজেন্ড|সংকেত/gu, "LEGEND"],
  [/এর/gu, " OF "],
];

/** AutoCAD escapes strip first (§6): `%%C`→Ø, `%%D`→°, `%%P`→±. MTEXT arrives
 *  already plain from the pipeline; TEXT carries its escapes verbatim. */
function stripAutocadEscapes(raw: string): string {
  return raw
    .replace(/%%[cC]/g, "Ø")
    .replace(/%%[dD]/g, "°")
    .replace(/%%[pP]/g, "±")
    .replace(/%%(\d{1,3})/g, "");
}

/** A trailing revision or sheet tag (`(R1)`, `(REV. 2)`) is bookkeeping, not
 *  subject: left in, its digits read as a member mark and every revised floor
 *  plan would classify as a member-scoped detail. */
const REVISION_TAG = /\(\s*(?:REV(?:ISION)?)?\.?\s*R?\.?-?\s*\d{1,3}[A-Z]?\s*\)\s*$/i;

function normalizeCaption(raw: string): string {
  let s = stripAutocadEscapes(raw).replace(REVISION_TAG, "");
  for (const [re, en] of BN_STEMS) s = s.replace(re, ` ${en} `);
  return s.replace(/\s+/g, " ").trim();
}

/**
 * A member mark inside a caption (`PC-1`, `C4`, `B2A`, `T.B-3`) — the signal
 * that a plan is scoped to one member rather than to a floor. Generic form,
 * not a drawing's own literals (§10).
 */
const MARK_TOKEN = /\b[A-Z]{1,3}\.?-?\s?\d{1,3}[A-Z]?\b/;

const STAIR = /\bSTAIR/;
const SCHEDULE = /\bSCHEDULE\b/;
const LONG_SECTION = /\bLONG(?:ITUDINAL)?\s+SECTION\b/;
const SECTION = /\bSECTION\b/;
const PLAN = /\bPLAN\b/;
const PLAN_OF = /\b(?:REINF?\.?|REINFORCEMENT)?\s*PLAN\s+OF\b/;
const LAYOUT = /\bLAYOUT\b/;
const DETAIL = /\bDETAILS?\b|\bELEVATION\b/;
const LEGEND_NOTES = /\bLEGEND\b|\bNOTES?\b/;

/**
 * Weak single-stem forms (a bare DETAIL/NOTES) must also read as a *heading*
 * to anchor a view — a note line that merely contains the word "details" is
 * not a caption. The structural forms below are precise enough to stand on
 * grammar alone.
 */
function isStrongForm(s: string): boolean {
  return PLAN.test(s) || SECTION.test(s) || SCHEDULE.test(s) || STAIR.test(s);
}

export type CaptionClass = {
  type: Exclude<ViewType, "untyped" | "unassigned">;
  subject: string | null;
};

/** The subject fragment before a trailing stem (`COLUMN` of `COLUMN SCHEDULE`,
 *  `PILE CAP PC-1` of `PLAN OF PILE CAP PC-1`) — informational only. */
function subjectBefore(s: string, stem: RegExp): string | null {
  const m = new RegExp(`^(.*?)\\s*${stem.source}`).exec(s);
  const raw = m?.[1]?.replace(/[.,\-\s]+$/, "").trim();
  return raw ? raw.slice(0, 120) : null;
}

function subjectAfterPlanOf(s: string): string | null {
  const raw = /\bPLAN\s+OF\s+(.+)$/.exec(s)?.[1]?.replace(/[.,\-\s]+$/, "").trim();
  return raw ? raw.slice(0, 120) : null;
}

/**
 * Classify one caption into the closed vocabulary, or null when the grammar
 * recognises no caption form (the caller makes that view `untyped`). Order
 * encodes specificity: stair before the generic plan/section forms, LONG
 * SECTION before SECTION, and every member-scoped plan before LAYOUT_PLAN.
 *
 * The §7 trap, twice guarded: `PLAN OF <subject>` is a DETAIL, and so is any
 * plan whose caption names a member mark (`PILE CAP PC-2 PLAN`) — a
 * member-scoped plan is never countable, however it is phrased.
 */
export function classifyCaption(raw: string): CaptionClass | null {
  const s = normalizeCaption(raw).toUpperCase();
  if (s.length < 2 || s.length > 160) return null;

  if (STAIR.test(s) && SECTION.test(s)) return { type: "stair_section", subject: null };
  if (STAIR.test(s) && PLAN.test(s)) return { type: "stair_plan", subject: null };
  if (SCHEDULE.test(s)) return { type: "schedule", subject: subjectBefore(s, SCHEDULE) };
  if (LONG_SECTION.test(s)) return { type: "long_section", subject: null };
  if (SECTION.test(s)) return { type: "member_section", subject: subjectBefore(s, SECTION) };
  if (PLAN.test(s)) {
    // A layout plan phrased with OF stays a layout plan (`PLAN OF COLUMN
    // LAYOUT`) — the LAYOUT stem outranks the OF form, and a mark makes it
    // member-scoped either way.
    if (LAYOUT.test(s) && !MARK_TOKEN.test(s)) {
      return { type: "layout_plan", subject: subjectBefore(s, LAYOUT) };
    }
    if (PLAN_OF.test(s)) return { type: "detail", subject: subjectAfterPlanOf(s) };
    if (MARK_TOKEN.test(s)) return { type: "detail", subject: subjectBefore(s, PLAN) };
    return { type: "layout_plan", subject: subjectBefore(s, PLAN) };
  }
  if (DETAIL.test(s)) return { type: "detail", subject: null };
  if (LEGEND_NOTES.test(s)) return { type: "legend_notes", subject: null };
  return null;
}

// ── The partition ────────────────────────────────────────────────────────────

/**
 * Dimensionless ratios, never drawing units — a tuning constant in drawing
 * units is the same species as a guessed scale (§5), and this stage runs
 * before any scale is affirmed. Each is a share of a length the drawing itself
 * states:
 *
 * - `bandGap`: the empty strip that separates two views, as a share of the
 *   *caption* height. Keyed to the body text it would be smaller than a
 *   schedule's own column spacing, and a table would shatter into columns; the
 *   air a drafter leaves between two views scales with the titles, which is
 *   also the only text height a sheet states at view scale rather than at
 *   annotation scale.
 * - `heading`: how much taller than body text a weak-stem caption must read.
 *
 * `views.spec.ts` sweeps `bandGap` across the whole window the sheet's own
 * geometry allows and asserts the partition does not move: the views are
 * separated by real empty strips, not by a tuned threshold. Below that window
 * a view fragments into `unassigned` — the lawful failure — and never into a
 * neighbouring view.
 */
export type ViewTuning = { bandGap: number; heading: number };
export const DEFAULT_TUNING: ViewTuning = { bandGap: 12, heading: 1.3 };

/** A sheet border or a full-width rule must not BRIDGE every view into one
 *  band: an entity spanning this share of the drawing keeps its own membership
 *  but contributes no coverage interval. */
const FRAME_SPAN_SHARE = 0.4;

export type Box = { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number };

export function boxOf(e: Entity): Box | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (x: number, y: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  };
  switch (e.t) {
    case "LINE":
      grow(e.p1[0], e.p1[1]);
      grow(e.p2[0], e.p2[1]);
      break;
    case "LWPOLYLINE":
    case "POLYLINE":
    case "SOLID":
      for (const p of e.pts) grow(p[0], p[1]);
      break;
    case "CIRCLE":
    case "ARC":
      grow(e.c[0] - e.r, e.c[1] - e.r);
      grow(e.c[0] + e.r, e.c[1] + e.r);
      break;
    case "TEXT":
    case "MTEXT":
    case "INSERT":
      grow(e.p[0], e.p[1]);
      break;
    case "DIMENSION":
      break; // no geometry of its own — its rendered paint carries it (§3)
  }
  if (x0 === Infinity) return null;
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (a === null) return b;
  if (b === null) return a;
  const x0 = Math.min(a.x0, b.x0);
  const y0 = Math.min(a.y0, b.y0);
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Merge 1-D intervals whose gaps are ≤ tolerance. Views are found by
 *  INTERVAL union, not by point gaps: a plan's bays project as gaps between
 *  entity centres, but its grid lines and slab edge BRIDGE it as intervals, so
 *  a view stays whole and only a true empty strip splits it. */
function coverageBands(
  intervals: Array<[number, number]>,
  tolerance: number,
): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const bands: Array<[number, number]> = [];
  let [lo, hi] = sorted[0]!;
  for (const [a, b] of sorted.slice(1)) {
    if (a - hi > tolerance) {
      bands.push([lo, hi]);
      [lo, hi] = [a, b];
    } else if (b > hi) {
      hi = b;
    }
  }
  bands.push([lo, hi]);
  return bands;
}

/** The band a value sits in; a value outside every band takes the nearest. */
function bandIndexOf(bands: Array<[number, number]>, v: number): number {
  let best = 0;
  let bestD = Infinity;
  for (const [i, [lo, hi]] of bands.entries()) {
    if (v >= lo && v <= hi) return i;
    const d = v < lo ? lo - v : v - hi;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

type Placed = { entity: Entity; handle: string; box: Box };
type Anchor = { handle: string; text: string; height: number; x: number; y: number };
type Cell = { col: number; y0: number; y1: number; members: Placed[]; anchors: Anchor[] };

/**
 * Partition one drawing's original entities into views. Total and disjoint by
 * construction: every original lands in exactly one view, and an entity no
 * caption reaches lands in `unassigned` with a named reason.
 */
export function partitionViews(
  graph: EntityGraph,
  tuning: ViewTuning = DEFAULT_TUNING,
): ViewPartition {
  // §3: only originals are partitioned. Derived paint has no membership of its
  // own — it resolves through the original it cites, and is used HERE only to
  // give that original its extent (an INSERT states one point; a DIMENSION
  // states none).
  const originals = graph.entities.filter((e) => e.src === null && e.h !== null);
  const paintBySrc = new Map<string, Box | null>();
  for (const e of graph.entities) {
    if (e.src === null) continue;
    paintBySrc.set(e.src, unionBox(paintBySrc.get(e.src) ?? null, boxOf(e)));
  }

  const placed: Placed[] = [];
  const unplaceable: string[] = [];
  for (const entity of originals) {
    const handle = entity.h!;
    const box = unionBox(boxOf(entity), paintBySrc.get(handle) ?? null);
    if (box === null) unplaceable.push(handle);
    else placed.push({ entity, handle, box });
  }
  placed.sort((a, b) => a.box.cx - b.box.cx || a.box.cy - b.box.cy || compareCanonical(a.handle, b.handle));

  // The drawing's own annotation scale: the median body-text height. With no
  // text there are no captions, so every entity is honestly unassigned.
  const pitch = median(
    originals
      .filter((e) => (e.t === "TEXT" || e.t === "MTEXT") && e.height > 0)
      .map((e) => (e.t === "TEXT" || e.t === "MTEXT" ? e.height : 0)),
  );

  // Caption anchors: grammar, or a heading that the grammar cannot classify.
  const anchors: Anchor[] = [];
  for (const { entity, handle, box } of placed) {
    if (entity.t !== "TEXT" && entity.t !== "MTEXT") continue;
    const text = entity.text.trim();
    if (!text) continue;
    const heading = pitch > 0 && entity.height >= tuning.heading * pitch;
    const classified = classifyCaption(text) !== null;
    const strong = classified && isStrongForm(normalizeCaption(text).toUpperCase());
    if (!strong && !heading) continue;
    anchors.push({ handle, text, height: entity.height, x: box.cx, y: box.cy });
  }

  // The sheet's layout scale: the median caption height. No captions means no
  // views to separate, and the gap is never consulted.
  const gap = median(anchors.map((a) => a.height)) * tuning.bandGap;

  // Two-level coverage partition: columns over x, then rows within a column.
  const spanX = placed.length > 0 ? Math.max(...placed.map((p) => p.box.x1)) - Math.min(...placed.map((p) => p.box.x0)) : 0;
  const spanY = placed.length > 0 ? Math.max(...placed.map((p) => p.box.y1)) - Math.min(...placed.map((p) => p.box.y0)) : 0;
  const spansX = (b: Box): boolean => b.x1 - b.x0 > spanX * FRAME_SPAN_SHARE;
  const spansY = (b: Box): boolean => b.y1 - b.y0 > spanY * FRAME_SPAN_SHARE;

  // The frame guard withholds coverage, never membership: if it withheld
  // every interval (a drawing that is nothing but full-span lines), the bands
  // fall back to the whole population — an entity that reaches no band would
  // be an entity dropped, and nothing here may drop an entity.
  const intervalsX = placed.filter((p) => !spansX(p.box));
  const colBands = coverageBands(
    (intervalsX.length > 0 ? intervalsX : placed).map(
      (p) => [p.box.x0, p.box.x1] as [number, number],
    ),
    gap,
  );
  const cells: Cell[] = [];
  for (const [col] of colBands.entries()) {
    const members = placed.filter((p) => bandIndexOf(colBands, p.box.cx) === col);
    if (members.length === 0) continue;
    const intervalsY = members.filter((p) => !spansY(p.box));
    const rowBands = coverageBands(
      (intervalsY.length > 0 ? intervalsY : members).map(
        (p) => [p.box.y0, p.box.y1] as [number, number],
      ),
      gap,
    );
    const byRow = new Map<number, Cell>();
    for (const member of members) {
      const row = rowBands.length > 0 ? bandIndexOf(rowBands, member.box.cy) : 0;
      let cell = byRow.get(row);
      if (cell === undefined) {
        const [y0, y1] = rowBands[row] ?? [member.box.cy, member.box.cy];
        cell = { col, y0, y1, members: [], anchors: [] };
        byRow.set(row, cell);
      }
      cell.members.push(member);
    }
    cells.push(...byRow.values());
  }
  for (const anchor of anchors) {
    const cell = cells.find((c) => c.members.some((m) => m.handle === anchor.handle));
    cell?.anchors.push(anchor);
  }

  cells.sort((a, b) => a.col - b.col || a.y0 - b.y0);

  // Cells → views. A caption sits BELOW its view (the BD drafting convention),
  // so a cell holding several captions splits the same way: an entity belongs
  // to the nearest caption at or below it.
  const views: View[] = [];
  const orphans: Placed[] = [];
  for (const cell of cells) {
    if (cell.anchors.length === 0) {
      orphans.push(...cell.members);
      continue;
    }
    const ordered = [...cell.anchors].sort((a, b) => a.y - b.y || a.x - b.x || compareCanonical(a.handle, b.handle));
    const owned = new Map<string, Placed[]>(ordered.map((a) => [a.handle, []]));
    for (const member of cell.members) {
      let owner = ordered[0]!;
      for (const anchor of ordered) {
        if (anchor.y <= member.box.cy) owner = anchor;
      }
      owned.get(owner.handle)!.push(member);
    }
    for (const anchor of ordered) {
      const members = owned.get(anchor.handle)!;
      const klass = classifyCaption(anchor.text);
      const bounds = members.reduce<Box | null>((acc, m) => unionBox(acc, m.box), null);
      views.push({
        id: anchor.handle,
        type: klass?.type ?? "untyped",
        caption: { handle: anchor.handle, text: anchor.text, height: anchor.height },
        subject: klass?.subject ?? null,
        bounds: bounds && [bounds.x0, bounds.y0, bounds.x1, bounds.y1],
        handles: members.map((m) => m.handle).sort(),
        reasons:
          klass === null
            ? [
                {
                  code: "CAPTION_UNCLASSIFIABLE",
                  message: `the caption grammar does not classify ${JSON.stringify(anchor.text)} — this view is untyped, never guessed`,
                },
              ]
            : [],
      });
    }
  }
  views.sort((a, b) => (a.bounds?.[0] ?? 0) - (b.bounds?.[0] ?? 0) || compareCanonical(a.id, b.id));

  const reasons: ViewReason[] = [];
  if (orphans.length > 0) {
    reasons.push({
      code: "NO_CAPTION_IN_REACH",
      message: `${orphans.length} original entities sit outside every caption's reach — assigned to no view, never dropped`,
    });
  }
  const orphanBounds = orphans.reduce<Box | null>((acc, m) => unionBox(acc, m.box), null);
  if (unplaceable.length > 0) {
    reasons.push({
      code: "NO_GEOMETRY_TO_PLACE",
      message: `${unplaceable.length} original entities carry no geometry to place (a dimension whose paint was truncated) — assigned to no view, never dropped`,
    });
  }
  views.push({
    id: "unassigned",
    type: "unassigned",
    caption: null,
    subject: null,
    bounds: orphanBounds && [
      orphanBounds.x0,
      orphanBounds.y0,
      orphanBounds.x1,
      orphanBounds.y1,
    ],
    handles: [...orphans.map((m) => m.handle), ...unplaceable].sort(),
    reasons,
  });

  return { views, originalCount: originals.length };
}
