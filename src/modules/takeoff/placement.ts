import type { Entity, EntityGraph } from "@/core/entitygraph";
import type { ElementType, LevelBasis, RefusalCause } from "@/core/enums";
import type { GridAxis, GridBackbone } from "./grid";
import {
  boxOf,
  mayYieldInstances,
  unionBox,
  type Box,
  type View,
  type ViewPartition,
} from "./views";

/**
 * Instance placement (cad-ingestion.md §9). A layout-plan view's own evidence
 * becomes *placed instances* — a member anchor, the mark that names it, the
 * grid intersection it sits near — and every original entity that yields no
 * instance carries a **named absence** instead. Nothing here touches a
 * quantity: objects and identity only.
 *
 * ── Constants are shares, never lengths ──────────────────────────────────────
 *
 * Every threshold below is a share of the **minimum grid spacing** the ticket-06
 * backbone computed for this very view (§9). A threshold in drawing units is the
 * same species as a guessed scale, and a view that states no spacing states no
 * constants either — it defers whole, with a named reason, rather than measure
 * against a number nobody wrote down.
 *
 * ── What may be a member, and what says so ───────────────────────────────────
 *
 * Two channels, both anchored on ORIGINAL entities (§3 — derived paint may give
 * an original its *extent*, exactly as the view partition uses it, but never
 * positions or invents one):
 *
 * - **Block channel.** An original INSERT the drafter placed. Its position is
 *   the INSERT's own world point; its footprint is the extent of the paint it
 *   cites. A bubble the georeference already cited is grid evidence, never a
 *   member; paint spanning more than the footprint maximum is sheet furniture.
 * - **Outline channel.** An original closed path or circle — a member drawn
 *   directly rather than instanced. Here the footprint window is the only thing
 *   separating a member from the sheet: below the minimum it is annotation or
 *   hatch noise, above the maximum it is a floor-plate outline or a sheet frame
 *   (the fixture's bulged slab spans 3.0 of the grid spacing and is refused by
 *   name). A closed outline inside the window that no mark names — a building
 *   core, a lift shaft — still yields no instance, for want of a mark.
 *
 * **The mark is the gate.** Identity needs a mark (identity.md §2), so an
 * anchor no mark reaches is an honest absence, and a mark two anchors dispute is
 * refused rather than guessed.
 *
 * ── The element class comes from the drawing, never from the mark string ─────
 *
 * `C1` is not evidence that C1 is a column — reading a class out of a mark
 * prefix is a drawing literal (§10). The class comes from a view that may not
 * yield instances but *may* state types (§7): a view whose caption names an
 * element class witnesses the class of every mark its own text mentions
 * (`COLUMN SCHEDULE` → the marks in it are columns). A mark with no witness, or
 * with two disagreeing witnesses, yields no instance and says so. §11's
 * member-type registry will enrich these families with variants and rebar
 * zones; the class witness is the same evidence, read the same way.
 *
 * Everything here is pure: no I/O, no clock, no config.
 */

/**
 * §9's placement constants, as shares of the minimum grid spacing.
 * `containment` expands a footprint into the reach within which a mark names
 * it; `nearAnchor` bounds a grid reference (beyond it, honest absence);
 * `footprintMin`/`footprintMax` bound a member's own extent.
 */
export const PLACEMENT_SHARES = {
  containment: 0.08,
  nearAnchor: 0.9,
  footprintMin: 0.6,
  footprintMax: 2.5,
} as const;

/**
 * The level slot of a placed instance (§9, identity.md §3). Foundation classes
 * sit below the level stack and take the lawful-null `FOUNDATION` basis;
 * vertical classes expand per level and take `UNRESOLVED` until a level is
 * authored — **a machine may not author one** (authoring a level is a human
 * act, identity.md §7), and §3's one-hop carry is what moves the key when a
 * human does. So placement never mints a level, and never pretends there is one.
 */
const FOUNDATION_CLASSES: ReadonlySet<ElementType> = new Set<ElementType>([
  "pile",
  "pile_cap",
  "footing",
  // a footing is below the lowest level by the same law that puts a pile cap there
  "tie_grade_beam",
]);

export function levelSlotOf(elementType: ElementType): LevelBasis {
  return FOUNDATION_CLASSES.has(elementType) ? "FOUNDATION" : "UNRESOLVED";
}

// ── Marks (§9's label normalization) ─────────────────────────────────────────

/** A size parenthetical is the drawing restating a schedule cell, never part of
 *  the mark: `C1 (450X600)` and `C1` are one mark. */
const SIZE_PARENTHETICAL = /\s*\([^)]*\)/g;

/** The mark as the drawing writes it, minus the size parenthetical: nothing is
 *  invented, and the drawing's own casing is normalised, not replaced. */
export function normalizeMark(raw: string): string {
  return raw.replace(SIZE_PARENTHETICAL, "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** The compare form: dotless-uppercase, so `TB` matches a registered `T.B`
 *  (§9). Both forms are the drawing's own; the family is what they share. */
export function markFamilyOf(raw: string): string {
  return normalizeMark(raw).replaceAll(".", "");
}

/**
 * A member mark names a family and an index (`C1`, `PC-1`, `T.B-3`, `B2A`) and
 * must be the WHOLE text. A bare letter or numeral is a grid label, a size pair
 * starts with digits, and a note sentence matches nothing — none of them is a
 * mark.
 */
const MEMBER_MARK = /^[A-Z]{1,2}(?:\.[A-Z]{1,2})?\.?[-\s]?\d{1,3}[A-Z]?$/;

export function isMemberMark(raw: string): boolean {
  return MEMBER_MARK.test(normalizeMark(raw));
}

// ── The element class witness (§7 types, §11 families) ──────────────────────

/** Element classes as a drawing names them. A domain vocabulary (the
 *  `elementTypes` enum), never one drawing's literals — specific before
 *  generic, so `PILE CAP` is not read as `PILE`. */
const CLASS_STEMS: ReadonlyArray<readonly [RegExp, ElementType]> = [
  [/\bPILE\s*CAPS?\b/, "pile_cap"],
  [/\bPILES?\b/, "pile"],
  [/\b(?:TIE|GRADE)\s*BEAMS?\b/, "tie_grade_beam"],
  [/\bFOOTINGS?\b/, "footing"],
  [/\bSHEAR\s*WALLS?\b/, "shear_wall"],
  [/\bCOLUMNS?\b/, "column"],
  [/\bBEAMS?\b/, "beam"],
  [/\bSLABS?\b/, "slab"],
  [/\bSTAIRS?(?:CASES?)?\b/, "stair"],
];

function classOfCaptionSubject(subject: string | null): ElementType | null {
  if (subject === null) return null;
  const s = subject.toUpperCase();
  return CLASS_STEMS.find(([re]) => re.test(s))?.[1] ?? null;
}

/**
 * Mark family → element class, witnessed by the views that may state types.
 * Evidence is view-membership-filtered before derivation (§11): a mark counts
 * as witnessed only where the witnessing view's own text carries it. Two views
 * naming one family differently leave it unwitnessed — a disagreement is
 * declared, never silently resolved (identity.md §2).
 */
export function classWitnesses(
  graph: EntityGraph,
  partition: ViewPartition,
): Map<string, ElementType | null> {
  const witnessed = new Map<string, ElementType | null>();
  for (const view of partition.views) {
    // The countable view states placements, not types; every other view may
    // witness a class, and the countability decision has exactly one site (§7).
    if (mayYieldInstances(view.type)) continue;
    const klass = classOfCaptionSubject(view.subject);
    if (klass === null) continue;
    const scope = new Set(view.handles);
    for (const e of graph.entities) {
      if (e.src !== null || e.h === null || !scope.has(e.h)) continue;
      if (e.t !== "TEXT" && e.t !== "MTEXT") continue;
      if (!isMemberMark(e.text)) continue;
      const family = markFamilyOf(e.text);
      const seen = witnessed.get(family);
      // null is a recorded disagreement, and never upgrades back to a class
      witnessed.set(family, seen === undefined || seen === klass ? klass : null);
    }
  }
  return witnessed;
}

// ── Dispositions: every original in the view is accounted for ────────────────

/**
 * What became of one original entity of a layout-plan view. `INSTANCE` and
 * `INSTANCE_MARK` are the two that yielded scope; every other code is a **named
 * absence** — silence is the condemned state (quantity-contract §2).
 */
export const placementDispositionCodes = [
  "INSTANCE",
  "INSTANCE_MARK",
  "GRID_EVIDENCE",
  "VIEW_CAPTION",
  "NOT_A_MEMBER_MARK",
  "NO_MEMBER_GEOMETRY",
  "FOOTPRINT_OUT_OF_WINDOW",
  "NO_MARK_IN_REACH",
  "MARK_REACHES_NO_ANCHOR",
  "ANCHOR_DISPUTED",
  "CLASS_NOT_WITNESSED",
] as const;
export type PlacementDispositionCode = (typeof placementDispositionCodes)[number];

export type PlacementDisposition = {
  handle: string;
  code: PlacementDispositionCode;
  message: string;
};

export type GridRef = {
  letter: string | null;
  numeral: string | null;
  /** Why a family contributed no reference — the honest absence beyond §9's
   *  near-anchor bound. Null when both families answered. */
  absence: string | null;
};

/** A placed instance: the sighting the register's door will judge. The world
 *  anchor and the grid reference are provenance and disposition aids — neither
 *  enters the identity key (identity.md §2). */
export type PlacedInstance = {
  /** Placement key (identity.md §3): view key + mark + world coordinates
   *  quantized to 0.1 drawing unit. Content-derived, zero minted ids. */
  placementKey: string;
  viewKey: string;
  elementType: ElementType;
  /** The drawing's own mark string, normalised of its size parenthetical. */
  mark: string;
  /** The dotless-uppercase compare form (§9). */
  family: string;
  levelBasis: LevelBasis;
  /** Content signature of authored inputs only (identity.md §4): the
   *  footprint's long × short extent at fixed precision. Correctable
   *  attributes are excluded by construction — none is read here. */
  signature: string;
  at: [number, number];
  gridRef: GridRef;
  /** The ORIGINAL handles this instance rests on: anchor, then mark (§2). */
  handles: string[];
};

export type PlacementDeferral = { cause: RefusalCause; message: string };

export type ViewPlacement = {
  viewId: string;
  /** View key (identity.md §3): view class + caption anchor handle. */
  viewKey: string;
  instances: PlacedInstance[];
  /** One per original in the view — total and disjoint, unless the view
   *  deferred whole (then there is nothing measured to account for). */
  dispositions: PlacementDisposition[];
  deferral: PlacementDeferral | null;
};

// ── Geometry helpers ────────────────────────────────────────────────────────

const quantize = (v: number): string => (Math.round(v * 10) / 10 + 0).toFixed(1);

const inside = (box: Box, p: [number, number], pad: number): boolean =>
  p[0] >= box.x0 - pad && p[0] <= box.x1 + pad && p[1] >= box.y0 - pad && p[1] <= box.y1 + pad;

const span = (box: Box): { long: number; short: number } => {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  return { long: Math.max(w, h), short: Math.min(w, h) };
};

const closedPath = (e: Entity): boolean =>
  (e.t === "LWPOLYLINE" || e.t === "POLYLINE" || e.t === "SOLID") && e.closed;

type Candidate = {
  handle: string;
  at: [number, number];
  footprint: Box;
  signature: string;
};

/** The nearest axis of one family whose own normal coordinate is within §9's
 *  near-anchor bound of the instance. Beyond it, nothing — never a snapped lie. */
function nearestAxis(
  axes: GridAxis[],
  at: [number, number],
  bound: number,
): GridAxis | null {
  let best: GridAxis | null = null;
  let bestD = Infinity;
  for (const axis of axes) {
    const d = Math.abs((axis.runs === "vertical" ? at[0] : at[1]) - axis.position);
    if (d < bestD) {
      bestD = d;
      best = axis;
    }
  }
  return best !== null && bestD <= bound ? best : null;
}

// ── Placement ───────────────────────────────────────────────────────────────

/**
 * Place the instances of every layout-plan view of a drawing. The backbones are
 * ticket 06's — already filtered to the countable views, and already carrying
 * the one computation of the minimum grid spacing every constant here scales by.
 */
export function placeInstances(
  graph: EntityGraph,
  partition: ViewPartition,
  backbones: GridBackbone[],
): ViewPlacement[] {
  const witnesses = classWitnesses(graph, partition);
  return backbones.map((backbone) => {
    const view = partition.views.find((v) => v.id === backbone.viewId);
    if (view === undefined) {
      throw new Error(
        `grid backbone cites view ${backbone.viewId}, which this partition does not contain`,
      );
    }
    return placeInView(graph, view, backbone, witnesses);
  });
}

function placeInView(
  graph: EntityGraph,
  view: View,
  backbone: GridBackbone,
  witnesses: Map<string, ElementType | null>,
): ViewPlacement {
  const viewKey = `${view.type}:${view.id}`;
  const spacing = backbone.minSpacing;
  if (spacing === null) {
    return {
      viewId: view.id,
      viewKey,
      instances: [],
      dispositions: [],
      deferral: {
        cause: "NOT_ESTABLISHED",
        message: `view ${view.id} states no grid spacing, so §9's placement constants have no scale — placement is deferred whole, never measured against a guessed length`,
      },
    };
  }
  const reach = spacing * PLACEMENT_SHARES.containment;
  const bound = spacing * PLACEMENT_SHARES.nearAnchor;
  const footprintMin = spacing * PLACEMENT_SHARES.footprintMin;
  const footprintMax = spacing * PLACEMENT_SHARES.footprintMax;

  const scope = new Set(view.handles);
  const originals = graph.entities.filter(
    (e) => e.src === null && e.h !== null && scope.has(e.h),
  );

  // Derived paint gives an original its extent and nothing else (§3).
  const paint = new Map<string, Box | null>();
  for (const e of graph.entities) {
    if (e.src === null) continue;
    paint.set(e.src, unionBox(paint.get(e.src) ?? null, boxOf(e)));
  }

  const gridEvidence = new Set(backbone.axes.flatMap((a) => a.handles));
  const dispositions: PlacementDisposition[] = [];
  const say = (handle: string, code: PlacementDispositionCode, message: string): void => {
    dispositions.push({ handle, code, message });
  };

  const candidates: Candidate[] = [];
  const marks: Array<{ handle: string; mark: string; at: [number, number] }> = [];

  for (const e of originals) {
    const handle = e.h!;
    if (view.caption?.handle === handle) {
      say(handle, "VIEW_CAPTION", `this view's own caption anchor, never a member`);
      continue;
    }
    if (gridEvidence.has(handle)) {
      say(
        handle,
        "GRID_EVIDENCE",
        `cited by this view's georeference as grid-bubble evidence — a grid bubble locates members, it is never one`,
      );
      continue;
    }
    if (e.t === "TEXT" || e.t === "MTEXT") {
      if (!isMemberMark(e.text)) {
        say(
          handle,
          "NOT_A_MEMBER_MARK",
          `${JSON.stringify(e.text.trim())} is not a member mark — it names no member and places nothing`,
        );
        continue;
      }
      marks.push({ handle, mark: normalizeMark(e.text), at: e.p });
      continue;
    }
    if (e.t === "INSERT") {
      const footprint = unionBox(boxOf(e), paint.get(handle) ?? null);
      if (footprint === null) {
        say(
          handle,
          "NO_MEMBER_GEOMETRY",
          `a block reference that paints nothing states no footprint — no instance, never a bounding-box guess`,
        );
        continue;
      }
      const extent = span(footprint);
      if (extent.long > footprintMax) {
        say(
          handle,
          "FOOTPRINT_OUT_OF_WINDOW",
          `spans ${extent.long.toFixed(1)} drawing units — beyond ${PLACEMENT_SHARES.footprintMax} of the ${spacing} grid spacing, which is sheet furniture, never a member`,
        );
        continue;
      }
      candidates.push({
        handle,
        at: e.p,
        footprint,
        signature: `${extent.long.toFixed(1)}x${extent.short.toFixed(1)}`,
      });
      continue;
    }
    if (closedPath(e) || e.t === "CIRCLE") {
      const footprint = boxOf(e)!;
      const extent = span(footprint);
      if (extent.long < footprintMin || extent.long > footprintMax) {
        say(
          handle,
          "FOOTPRINT_OUT_OF_WINDOW",
          `a closed outline spanning ${extent.long.toFixed(1)} drawing units, outside ${PLACEMENT_SHARES.footprintMin}–${PLACEMENT_SHARES.footprintMax} of the ${spacing} grid spacing — annotation below it, a floor plate or sheet frame above it, a member in neither case`,
        );
        continue;
      }
      candidates.push({
        handle,
        at: [footprint.cx, footprint.cy],
        footprint,
        signature: `${extent.long.toFixed(1)}x${extent.short.toFixed(1)}`,
      });
      continue;
    }
    say(
      handle,
      "NO_MEMBER_GEOMETRY",
      `a ${e.t} states no closed footprint — grid lines, arcs and dimensions locate and measure members, they never are one`,
    );
  }

  // Pairing: a mark names the candidate nearest it among those whose footprint,
  // expanded by the containment share, reaches it. A tie is a dispute, and a
  // dispute is refused by name — a wrong merge silently deletes quantity
  // (identity.md §2).
  const claims = new Map<string, Array<{ handle: string; mark: string; at: [number, number] }>>();
  for (const mark of marks) {
    const reaching = candidates.filter((c) => inside(c.footprint, mark.at, reach));
    if (reaching.length === 0) {
      say(
        mark.handle,
        "MARK_REACHES_NO_ANCHOR",
        `mark ${mark.mark} reaches no member footprint within ${PLACEMENT_SHARES.containment} of the ${spacing} grid spacing — it names nothing here`,
      );
      continue;
    }
    const distances = reaching.map((c) => ({
      candidate: c,
      d: Math.hypot(c.at[0] - mark.at[0], c.at[1] - mark.at[1]),
    }));
    const nearest = distances.reduce((a, b) => (b.d < a.d ? b : a));
    if (distances.filter((x) => x.d === nearest.d).length > 1) {
      say(
        mark.handle,
        "ANCHOR_DISPUTED",
        `mark ${mark.mark} is equidistant from ${distances.length} member footprints — which one it names is not stated, so nothing is placed`,
      );
      continue;
    }
    claims.set(nearest.candidate.handle, [
      ...(claims.get(nearest.candidate.handle) ?? []),
      mark,
    ]);
  }

  const instances: PlacedInstance[] = [];
  for (const candidate of candidates) {
    const claimed = claims.get(candidate.handle) ?? [];
    if (claimed.length === 0) {
      say(
        candidate.handle,
        "NO_MARK_IN_REACH",
        `a member footprint no mark names — without a mark there is no identity (identity.md §2), so it yields no instance and is not counted`,
      );
      continue;
    }
    if (claimed.length > 1) {
      say(
        candidate.handle,
        "ANCHOR_DISPUTED",
        `${claimed.length} marks (${claimed.map((m) => m.mark).join(", ")}) reach one footprint — which names it is not stated, so nothing is placed`,
      );
      for (const mark of claimed) {
        say(
          mark.handle,
          "ANCHOR_DISPUTED",
          `mark ${mark.mark} shares one member footprint with another mark — nothing is placed from either`,
        );
      }
      continue;
    }
    const mark = claimed[0]!;
    const family = markFamilyOf(mark.mark);
    const elementType = witnesses.get(family) ?? null;
    if (elementType === null) {
      const known = witnesses.has(family);
      const why = known
        ? `two views name family ${family} as different element classes — the disagreement is declared, never resolved here`
        : `no view that may state types names family ${family}, so its element class is unwitnessed`;
      say(candidate.handle, "CLASS_NOT_WITNESSED", `${why}; no instance is placed`);
      say(mark.handle, "CLASS_NOT_WITNESSED", `${why}; mark ${mark.mark} places nothing`);
      continue;
    }

    const letter = nearestAxis(
      backbone.axes.filter((a) => a.family === "letter"),
      candidate.at,
      bound,
    );
    const numeral = nearestAxis(
      backbone.axes.filter((a) => a.family === "numeral"),
      candidate.at,
      bound,
    );
    const missing = [
      ...(letter === null ? ["letter"] : []),
      ...(numeral === null ? ["numeral"] : []),
    ];
    instances.push({
      placementKey: `${viewKey}|${mark.mark}|${quantize(candidate.at[0])}|${quantize(candidate.at[1])}`,
      viewKey,
      elementType,
      mark: mark.mark,
      family,
      levelBasis: levelSlotOf(elementType),
      signature: candidate.signature,
      at: candidate.at,
      gridRef: {
        letter: letter?.label ?? null,
        numeral: numeral?.label ?? null,
        absence:
          missing.length === 0
            ? null
            : `no ${missing.join(" or ")} axis within ${PLACEMENT_SHARES.nearAnchor} of the ${spacing} grid spacing — this instance is off-grid on ${missing.length === 2 ? "both axes" : `its ${missing[0]} axis`}, stated as absent rather than snapped`,
      },
      handles: [candidate.handle, mark.handle],
    });
    say(
      candidate.handle,
      "INSTANCE",
      `placed as ${elementType} ${mark.mark}`,
    );
    say(mark.handle, "INSTANCE_MARK", `names the ${elementType} placed at ${candidate.handle}`);
  }

  instances.sort((a, b) => a.placementKey.localeCompare(b.placementKey));
  dispositions.sort((a, b) => a.handle.localeCompare(b.handle));
  return { viewId: view.id, viewKey, instances, dispositions, deferral: null };
}
