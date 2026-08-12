import type { Entity, EntityGraph } from "@/core/entitygraph";
import type { RefusalCause } from "@/core/enums";
import { mayYieldInstances, type ViewPartition } from "./views";

/**
 * The grid backbone (cad-ingestion.md §8). Axes in two families
 * (letter / numeral) with a per-view georeference, derived **only from
 * layout-plan evidence** — the ticket-05 partition filters the entities
 * *before* detection runs, so a grid stamp inside a detail can never shift an
 * axis. A layout-plan view without lawful bubble evidence georeferences as
 * **deferred with a named reason** from the shared refusal taxonomy
 * (identity.md §7 — one enum, two originators). Machine proposes; disposition
 * is human.
 *
 * ── The ruling on derived paint ──────────────────────────────────────────────
 *
 * §8's content signature is "a bare letter/numeral text anchored inside a
 * circle", but in the CAD convention the fixture reproduces, a bubble block's
 * circle is *derived paint* (it carries `src`), and §3 bars derived geometry
 * from the extractor. The rule, by name: **the circle is admissible as
 * corroboration of a signature anchored on an original — never as the thing
 * that invents the bubble.** Two lawful anchors follow, and only these two:
 *
 * - **Attributed bubble.** An ORIGINAL INSERT whose attribute channel (§3:
 *   block attributes collect separately off the INSERT, and are original
 *   evidence) carries a bare letter/numeral label, with a circle from either
 *   channel enclosing that label. The axis position is the INSERT's own world
 *   point — an original coordinate — so no derived geometry ever positions an
 *   axis; the circle only witnesses that the label is a bubble.
 * - **Free-standing bubble.** An ORIGINAL bare letter/numeral text inside an
 *   ORIGINAL circle. Both channels original, position from the circle centre.
 *
 * A label with no circle around it is a mark or a leader tag, never an axis; a
 * block that merely *paints* a lettered bubble and states no attribute
 * contributes nothing at all. Block names are never matched — `GRID_BUBBLE` is
 * the same species as a layer name (§8/§10).
 *
 * Everything here is pure: no I/O, no clock, no config, no drawing-unit
 * constants (this stage runs before any scale is affirmed).
 */

/** §8's two families, told apart by the label's own form — never by which
 *  direction the axis line runs. */
export const axisFamilies = ["letter", "numeral"] as const;
export type AxisFamily = (typeof axisFamilies)[number];

export type GridAxis = {
  label: string;
  family: AxisFamily;
  /** How the axis line itself runs, derived from the drawing's own bubble
   *  geometry (never assumed from the family). */
  runs: "vertical" | "horizontal";
  /** The axis's world coordinate on its normal: x for a vertical axis, y for a
   *  horizontal one. Native drawing units, uninterpreted (§2). */
  position: number;
  /** The ORIGINAL handles this axis rests on — provenance, never identity. */
  handles: string[];
};

/** A machine refusal in the taxonomy identity.md §7 shares with human
 *  deferrals. The note names the gap; the note is never itself the cause. */
export type GridDeferral = { cause: RefusalCause; message: string };

export type GridBackbone = {
  /** The layout-plan view this grid georeferences (the partition's view id). */
  viewId: string;
  /** Letters by position, then numerals by position. */
  axes: GridAxis[];
  /**
   * The smallest spacing between consecutive parallel axes, over both
   * families — **computed here and nowhere else**. §9's placement constants
   * are content-scaled shares of it; ticket 07 reads this number and must not
   * recompute it. Null when no family states two axes, which is a deferral.
   */
  minSpacing: number | null;
  deferral: GridDeferral | null;
};

// ── The bubble signature ─────────────────────────────────────────────────────

/** A grid label is *bare*: one or two letters, or a number. Anything else —
 *  `C1`, `450X600` — is a mark or a dimension string, never an axis. */
function familyOf(raw: string): AxisFamily | null {
  const s = raw.trim().toUpperCase();
  if (/^[A-Z]{1,2}$/.test(s)) return "letter";
  if (/^(?:[1-9]\d?)$/.test(s)) return "numeral";
  return null;
}

type Bubble = {
  label: string;
  family: AxisFamily;
  /** The bubble's world anchor — an original coordinate in both forms. */
  at: [number, number];
  handles: string[];
};

function contains(circle: { c: [number, number]; r: number }, p: [number, number]): boolean {
  const dx = p[0] - circle.c[0];
  const dy = p[1] - circle.c[1];
  return dx * dx + dy * dy <= circle.r * circle.r;
}

/**
 * The bubbles of ONE view. `scope` is that view's original handles; derived
 * paint enters only through the original it cites, and only as corroboration.
 */
function bubblesOf(entities: Entity[], scope: Set<string>): Bubble[] {
  const inScope = (e: Entity): boolean =>
    e.src === null ? e.h !== null && scope.has(e.h) : scope.has(e.src);

  const circles = entities.filter(
    (e): e is Extract<Entity, { t: "CIRCLE" }> => e.t === "CIRCLE" && inScope(e),
  );
  const originalCircles = circles.filter((e) => e.src === null);

  const bubbles: Bubble[] = [];
  for (const e of entities) {
    if (e.src !== null || e.h === null || !scope.has(e.h)) continue; // originals only (§3)

    if (e.t === "INSERT") {
      for (const attr of e.attrs) {
        const family = familyOf(attr.text);
        if (family === null) continue;
        // Corroboration from either channel; the position stays the INSERT's.
        if (!circles.some((c) => contains(c, attr.p))) continue;
        const witness = circles.find((c) => contains(c, attr.p))!;
        bubbles.push({
          label: attr.text.trim().toUpperCase(),
          family,
          at: e.p,
          handles: [e.h, ...(witness.src !== null || witness.h === null ? [] : [witness.h])],
        });
      }
      continue;
    }

    if (e.t !== "TEXT" && e.t !== "MTEXT") continue;
    const family = familyOf(e.text);
    if (family === null) continue;
    const witness = originalCircles.find((c) => contains(c, e.p));
    if (witness === undefined || witness.h === null) continue;
    bubbles.push({
      label: e.text.trim().toUpperCase(),
      family,
      at: witness.c,
      handles: [e.h, witness.h],
    });
  }
  return bubbles;
}

// ── Georeference ─────────────────────────────────────────────────────────────

type Axis = "x" | "y";

const spread = (values: number[]): number =>
  values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);

const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

/**
 * Which coordinate an axis of this family is *constant* on — its normal. Read
 * off the drawing's own bubbles, in two readings, strongest first:
 *
 * 1. **Repeated labels.** A sheet stamps one axis at both ends of its line, so
 *    the bubbles sharing a label are collinear along the axis: the direction
 *    they spread is the direction the axis runs, and the normal is the other.
 * 2. **The bubble row.** Distinct labels of a family are strung out
 *    perpendicular to their axes, so the direction they spread IS the normal.
 *
 * A family whose bubbles decide neither reading (a single bubble, or a
 * perfectly square scatter) returns null — undecidable, and nothing is
 * guessed; the caller takes the other family's perpendicular or defers.
 */
function normalOf(bubbles: Bubble[]): Axis | null {
  const byLabel = new Map<string, Bubble[]>();
  for (const b of bubbles) byLabel.set(b.label, [...(byLabel.get(b.label) ?? []), b]);

  const intraX = Math.max(...[...byLabel.values()].map((g) => spread(g.map((b) => b.at[0]))), 0);
  const intraY = Math.max(...[...byLabel.values()].map((g) => spread(g.map((b) => b.at[1]))), 0);
  if (intraX > intraY) return "y"; // runs horizontally → constant in y
  if (intraY > intraX) return "x";

  const interX = spread([...byLabel.values()].map((g) => median(g.map((b) => b.at[0]))));
  const interY = spread([...byLabel.values()].map((g) => median(g.map((b) => b.at[1]))));
  if (interX > interY) return "x";
  if (interY > interX) return "y";
  return null;
}

function axesOf(bubbles: Bubble[], family: AxisFamily, normal: Axis): GridAxis[] {
  const byLabel = new Map<string, Bubble[]>();
  for (const b of bubbles) byLabel.set(b.label, [...(byLabel.get(b.label) ?? []), b]);

  const axes = [...byLabel.entries()].map(([label, group]) => ({
    label,
    family,
    runs: normal === "x" ? ("vertical" as const) : ("horizontal" as const),
    position: median(group.map((b) => b.at[normal === "x" ? 0 : 1])),
    handles: [...new Set(group.flatMap((b) => b.handles))].sort(),
  }));
  return axes.sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
}

/** The smallest gap between consecutive parallel axes, over both families
 *  (§9's scale for every placement constant). Zero gaps — two labels stamped
 *  on one line — state no spacing and are not one. */
function minSpacingOf(axes: GridAxis[]): number | null {
  const gaps: number[] = [];
  for (const family of axisFamilies) {
    const positions = axes.filter((a) => a.family === family).map((a) => a.position);
    for (let i = 1; i < positions.length; i += 1) gaps.push(positions[i]! - positions[i - 1]!);
  }
  const positive = gaps.filter((g) => g > 0);
  return positive.length === 0 ? null : Math.min(...positive);
}

/**
 * Georeference every layout-plan view of a drawing. Views that may not yield
 * instances (`mayYieldInstances` — the one decision site, §7) are filtered out
 * before any detection runs, so their grid stamps are not evidence at all.
 */
export function georeferenceGrid(graph: EntityGraph, partition: ViewPartition): GridBackbone[] {
  return partition.views
    .filter((view) => mayYieldInstances(view.type))
    .map((view) => {
      const bubbles = bubblesOf(graph.entities, new Set(view.handles));
      if (bubbles.length === 0) {
        return {
          viewId: view.id,
          axes: [],
          minSpacing: null,
          deferral: {
            cause: "NOT_ESTABLISHED" as RefusalCause,
            message: `no lawful grid-bubble evidence in view ${view.id} (${view.handles.length} originals examined) — this view's georeference is deferred, never guessed`,
          },
        };
      }

      const families = axisFamilies.map((family) => {
        const own = bubbles.filter((b) => b.family === family);
        return { family, bubbles: own, normal: own.length > 0 ? normalOf(own) : null };
      });
      // A family whose own bubbles decide nothing takes the perpendicular of a
      // family that did decide — the drawing's own statement, one step away.
      const decided = families.find((f) => f.normal !== null)?.normal ?? null;
      const undecided: AxisFamily[] = [];
      const axes: GridAxis[] = [];
      for (const { family, bubbles: own, normal } of families) {
        if (own.length === 0) continue;
        const resolved = normal ?? (decided === null ? null : decided === "x" ? "y" : "x");
        if (resolved === null) {
          undecided.push(family);
          continue;
        }
        axes.push(...axesOf(own, family, resolved));
      }
      axes.sort(
        (a, b) =>
          axisFamilies.indexOf(a.family) - axisFamilies.indexOf(b.family) ||
          a.position - b.position,
      );

      const minSpacing = minSpacingOf(axes);
      let deferral: GridDeferral | null = null;
      if (undecided.length > 0) {
        deferral = {
          cause: "NOT_ESTABLISHED",
          message: `the ${undecided.join(" and ")} axes of view ${view.id} state no direction — nothing in this view says which way they run, so they are deferred, never guessed`,
        };
      } else if (minSpacing === null) {
        deferral = {
          cause: "NOT_ESTABLISHED",
          message: `view ${view.id} states no two parallel axes, so its grid spacing is not established — deferred, never guessed`,
        };
      }
      return { viewId: view.id, axes, minSpacing, deferral };
    });
}
