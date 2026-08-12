import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { entityGraphSchema, type Entity, type EntityGraph } from "@/core/entitygraph";
import { georeferenceGrid, mayYieldInstances, partitionViews } from "@/modules/takeoff";

/**
 * The grid backbone (cad-ingestion.md §8) against the committed fixture sheet.
 * The generator's own `GRID_X` / `GRID_Y` are the truth these positions are
 * asserted against — a grid read from the artifact must reproduce the grid the
 * drawing was built from, to the unit.
 */

const fixtures = path.resolve(import.meta.dirname, "../../../../cad/tests/fixtures");

const load = (rev: 1 | 2): EntityGraph =>
  entityGraphSchema.parse(
    JSON.parse(readFileSync(path.join(fixtures, `structural-r${rev}.entitygraph.json`), "utf-8")),
  );

const R1 = load(1);
const R2 = load(2);

/** gen_structural.py's own constants — the fixture's ground truth. */
const GRID_X: Record<string, number> = { A: 0, B: 5000, C: 10000 };
const GRID_Y: Record<string, number> = { "1": 0, "2": 4500, "3": 9000 };

const backboneOf = (graph: EntityGraph) => {
  const partition = partitionViews(graph);
  const backbones = georeferenceGrid(graph, partition);
  expect(backbones).toHaveLength(1);
  const plan = partition.views.find((v) => mayYieldInstances(v.type))!;
  return { ...backbones[0]!, viewHandles: plan.handles };
};

describe("the grid backbone", () => {
  it.each([1, 2] as const)("georeferences rev %i against the generator's own grid", (rev) => {
    const backbone = backboneOf(rev === 1 ? R1 : R2);
    expect(backbone.deferral).toBeNull();

    const letters = backbone.axes.filter((a) => a.family === "letter");
    const numerals = backbone.axes.filter((a) => a.family === "numeral");
    expect(letters.map((a) => a.label)).toEqual(["A", "B", "C"]);
    expect(numerals.map((a) => a.label)).toEqual(["1", "2", "3"]);

    // Families are separated by the label's own form; the axis line each one
    // stands for runs perpendicular to the row of bubbles that names it.
    expect(letters.every((a) => a.runs === "vertical")).toBe(true);
    expect(numerals.every((a) => a.runs === "horizontal")).toBe(true);

    for (const axis of letters) expect(axis.position).toBe(GRID_X[axis.label]);
    for (const axis of numerals) expect(axis.position).toBe(GRID_Y[axis.label]);

    // Every axis cites the original it rests on (§2: provenance is the handle).
    for (const axis of backbone.axes) {
      expect(axis.handles.length).toBeGreaterThan(0);
      for (const h of axis.handles) {
        expect(backbone.viewHandles).toContain(h);
      }
    }
  });

  it("computes the minimum grid spacing once, here", () => {
    // Letters space 5000, numerals 4500 — the minimum over both families is
    // what ticket 07's placement constants are shares of, and it is computed
    // in exactly one place (§9: shares of the minimum spacing, never absolute).
    expect(backboneOf(R1).minSpacing).toBe(4500);
    expect(backboneOf(R2).minSpacing).toBe(4500);
  });

  it("honours the world transform of the 1.5x-scaled bubble", () => {
    // Bubble C is inserted at 1.5x: its corroborating circle reads r=375, not
    // the block's own 250. An axis read off assumed-unit paint would either
    // lose the corroboration or shift; C sits exactly on GRID_X.
    const backbone = backboneOf(R1);
    const c = backbone.axes.find((a) => a.label === "C")!;
    expect(c.position).toBe(GRID_X["C"]);
    const circle = R1.entities.find((e) => e.t === "CIRCLE" && c.handles.includes(e.src ?? ""));
    expect(circle).toMatchObject({ t: "CIRCLE", r: 375 });
  });

  it("moves no axis for a grid bubble stamped inside a non-layout view", () => {
    // The fixture's `PLAN OF PILE CAP PC-1` detail carries a bubble labelled
    // "A" at x=20500. The partition filters BEFORE detection (§8), so that
    // stamp can never shift axis A off x=0 — nor add an axis of its own.
    const partition = partitionViews(R1);
    const detail = partition.views.find((v) => v.caption?.text === "PLAN OF PILE CAP PC-1")!;
    const stamp = R1.entities.find(
      (e) => e.t === "INSERT" && e.h !== null && detail.handles.includes(e.h),
    )!;
    expect(stamp.h).not.toBeNull();
    expect(mayYieldInstances(detail.type)).toBe(false);

    const backbones = georeferenceGrid(R1, partition);
    expect(backbones.map((b) => b.viewId)).toEqual([
      partition.views.find((v) => mayYieldInstances(v.type))!.id,
    ]);
    const backbone = backbones[0]!;
    expect(backbone.axes.find((a) => a.label === "A")!.position).toBe(0);
    expect(backbone.axes.map((a) => a.position)).not.toContain(20_500);
    expect(backbone.axes.flatMap((a) => a.handles)).not.toContain(stamp.h);
  });

  it("defers with a named reason when the layout plan is stripped of bubble evidence", () => {
    // Same sheet, same partition, bubbles removed: the machine proposes
    // nothing and says why. Silence is the only condemned state.
    const bubbles = new Set(
      R1.entities
        .filter((e) => e.t === "INSERT" && e.attrs.some((a) => a.tag === "LABEL"))
        .map((e) => e.h!),
    );
    const stripped = entityGraphSchema.parse({
      ...R1,
      entities: R1.entities.filter(
        (e) => !(e.h !== null && bubbles.has(e.h)) && !(e.src !== null && bubbles.has(e.src)),
      ),
    });

    const backbone = backboneOf(stripped);
    expect(backbone.axes).toEqual([]);
    expect(backbone.minSpacing).toBeNull();
    expect(backbone.deferral?.cause).toBe("NOT_ESTABLISHED");
    expect(backbone.deferral?.message).toMatch(/never guessed/);
  });
});

// ── Synthetic graphs: bubble forms the fixture sheet does not carry ──────────

const graphOf = (entities: Entity[]): EntityGraph =>
  entityGraphSchema.parse({
    artifact: "vextrus.entitygraph",
    version: 1,
    source: { filename: "synthetic.dxf", sha256: "0".repeat(64) },
    units: { insunits: 4, detected: "mm", insunits_unmapped: false },
    counters: {
      original: entities.filter((e) => e.src === null).length,
      derived: entities.filter((e) => e.src !== null).length,
      explode_truncated: false,
      lost_by_type: {},
      unsupported_by_type: {},
    },
    entities,
  });

let handle = 0;
const next = (): string => `G${++handle}`;
const text = (t: string, p: [number, number], height = 200): Entity => ({
  t: "TEXT",
  h: next(),
  src: null,
  layer: "PILE", // §8: a template whose bubbles live on layer PILE detects identically
  color: "#ffffff",
  text: t,
  p,
  height,
  rot: 0,
});
const circle = (c: [number, number], r: number, src: string | null = null): Entity => ({
  t: "CIRCLE",
  h: src === null ? next() : null,
  src,
  layer: "PILE",
  color: "#ffffff",
  c,
  r,
});
const caption = (t: string, p: [number, number]): Entity => ({
  t: "MTEXT",
  h: next(),
  src: null,
  layer: "TITLE",
  color: "#ffffff",
  text: t,
  p,
  height: 400,
  rot: 0,
});
/** A free-standing bubble: bare label TEXT inside an ORIGINAL circle. */
const freeBubble = (label: string, c: [number, number]): Entity[] => [
  circle(c, 250),
  text(label, [c[0] - 100, c[1] - 100]),
];

const only = (graph: EntityGraph) => georeferenceGrid(graph, partitionViews(graph));

describe("the bubble signature", () => {
  it("reads free-standing bubbles — bare text inside an original circle", () => {
    const graph = graphOf([
      caption("TYPICAL FLOOR PLAN", [0, -2000]),
      ...freeBubble("A", [0, 6000]),
      ...freeBubble("B", [3000, 6000]),
      ...freeBubble("1", [-2000, 0]),
      ...freeBubble("2", [-2000, 2000]),
      { ...circle([0, 0], 10), h: next() }, // a plan needs a body
    ]);
    const [backbone] = only(graph);
    expect(backbone!.deferral).toBeNull();
    expect(backbone!.axes.map((a) => `${a.family}:${a.label}:${a.position}`)).toEqual([
      "letter:A:0",
      "letter:B:3000",
      "numeral:1:0",
      "numeral:2:2000",
    ]);
    expect(backbone!.minSpacing).toBe(2000);
  });

  it("never invents a bubble from a bare label with no circle around it", () => {
    // A mark, a leader tag, a note letter: text alone is not a bubble.
    const graph = graphOf([
      caption("TYPICAL FLOOR PLAN", [0, -2000]),
      text("A", [0, 6000]),
      text("B", [3000, 6000]),
      ...freeBubble("1", [-2000, 0]),
      ...freeBubble("2", [-2000, 2000]),
    ]);
    const [backbone] = only(graph);
    expect(backbone!.axes.map((a) => a.label)).toEqual(["1", "2"]);
  });

  it("never reads a bubble out of derived paint alone", () => {
    // §3: the circle corroborates a signature anchored on an original; it may
    // never be the thing that invents one. A block that PAINTS a lettered
    // bubble but states no attribute contributes nothing.
    const insert: Entity = {
      t: "INSERT",
      h: next(),
      src: null,
      layer: "PILE",
      color: "#ffffff",
      name: "SOME_BLOCK",
      p: [0, 6000],
      attrs: [],
    };
    const graph = graphOf([
      caption("TYPICAL FLOOR PLAN", [0, -2000]),
      insert,
      circle([0, 6000], 250, insert.h),
      { ...text("A", [-100, 5900]), h: null, src: insert.h },
      ...freeBubble("1", [-2000, 0]),
      ...freeBubble("2", [-2000, 2000]),
    ]);
    const [backbone] = only(graph);
    expect(backbone!.axes.map((a) => a.label)).toEqual(["1", "2"]);
  });

  it("refuses a label that is neither a bare letter nor a bare numeral", () => {
    const graph = graphOf([
      caption("TYPICAL FLOOR PLAN", [0, -2000]),
      ...freeBubble("C1", [0, 6000]),
      ...freeBubble("450X600", [3000, 6000]),
      ...freeBubble("1", [-2000, 0]),
      ...freeBubble("2", [-2000, 2000]),
    ]);
    const [backbone] = only(graph);
    expect(backbone!.axes.map((a) => a.label)).toEqual(["1", "2"]);
  });

  it("defers rather than guess when one family's direction is undecidable", () => {
    // A single lettered bubble and no other family: nothing in the drawing
    // says which way its axis runs, so nothing is proposed for it.
    const graph = graphOf([caption("TYPICAL FLOOR PLAN", [0, -2000]), ...freeBubble("A", [0, 2000])]);
    const [backbone] = only(graph);
    expect(backbone!.axes).toEqual([]);
    expect(backbone!.deferral?.cause).toBe("NOT_ESTABLISHED");
    expect(backbone!.deferral?.message).toMatch(/direction/);
  });

  it("takes a lone axis's direction from the other family, never from a guess", () => {
    const graph = graphOf([
      caption("TYPICAL FLOOR PLAN", [0, -2000]),
      ...freeBubble("A", [0, 6000]),
      ...freeBubble("1", [-2000, 0]),
      ...freeBubble("2", [-2000, 2000]),
    ]);
    const [backbone] = only(graph);
    expect(backbone!.axes.map((a) => `${a.label}:${a.runs}:${a.position}`)).toEqual([
      "A:vertical:0",
      "1:horizontal:0",
      "2:horizontal:2000",
    ]);
  });

  it("collapses a repeated label to one axis and keeps both its bubbles as evidence", () => {
    // Real sheets stamp an axis at both ends of its line.
    const graph = graphOf([
      caption("TYPICAL FLOOR PLAN", [0, -2000]),
      ...freeBubble("A", [0, 6000]),
      ...freeBubble("A", [0, -1000]),
      ...freeBubble("B", [3000, 6000]),
      ...freeBubble("1", [-2000, 0]),
      ...freeBubble("2", [-2000, 2000]),
    ]);
    const [backbone] = only(graph);
    expect(backbone!.axes.map((a) => a.label)).toEqual(["A", "B", "1", "2"]);
    // Both stamps ride as evidence — text and circle of each (§2: every
    // figure cites its handles), and the axis is still one axis.
    expect(backbone!.axes.find((a) => a.label === "A")!.handles).toHaveLength(4);
    expect(backbone!.axes.find((a) => a.label === "A")!.position).toBe(0);
  });

  it("reports no spacing, with a named reason, when no family has two axes", () => {
    // One lettered axis (stamped twice, so its direction is stated) and one
    // numbered axis: a lawful georeference that states no spacing at all.
    const graph = graphOf([
      caption("TYPICAL FLOOR PLAN", [0, -2000]),
      ...freeBubble("A", [0, 2000]),
      ...freeBubble("A", [0, 4000]),
      ...freeBubble("1", [-2000, 0]),
    ]);
    const [backbone] = only(graph);
    expect(backbone!.axes.map((a) => a.label)).toEqual(["A", "1"]);
    expect(backbone!.minSpacing).toBeNull();
    expect(backbone!.deferral?.cause).toBe("NOT_ESTABLISHED");
    expect(backbone!.deferral?.message).toMatch(/spacing/);
  });

  it("georeferences every layout-plan view of a sheet separately", () => {
    const graph = graphOf([
      caption("TYPICAL FLOOR PLAN", [0, -2000]),
      ...freeBubble("A", [0, 6000]),
      ...freeBubble("B", [3000, 6000]),
      ...freeBubble("1", [-2000, 0]),
      ...freeBubble("2", [-2000, 2000]),
      caption("ROOF SLAB PLAN", [60_000, -2000]),
      ...freeBubble("A", [60_000, 6000]),
      ...freeBubble("B", [64_000, 6000]),
      ...freeBubble("1", [58_000, 0]),
      ...freeBubble("2", [58_000, 3000]),
    ]);
    const backbones = only(graph);
    expect(backbones).toHaveLength(2);
    expect(backbones.map((b) => b.minSpacing)).toEqual([2000, 3000]);
    expect(backbones[1]!.axes.find((a) => a.label === "B")!.position).toBe(64_000);
  });
});
