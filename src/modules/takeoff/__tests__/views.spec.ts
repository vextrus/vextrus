import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { entityGraphSchema, type Entity, type EntityGraph } from "@/core/entitygraph";
import {
  DEFAULT_TUNING,
  classifyCaption,
  mayYieldInstances,
  partitionViews,
  type View,
  type ViewType,
} from "@/modules/takeoff";

/**
 * The view law (cad-ingestion.md §7) against the committed fixture sheet: a
 * floor plan, a column schedule, a member-scoped detail, an untyped sketch and
 * a stray line. The partition is total and disjoint on ORIGINAL entities, and
 * only the layout plan may yield instances.
 */

const fixtures = path.resolve(import.meta.dirname, "../../../../cad/tests/fixtures");

const load = (rev: 1 | 2): EntityGraph =>
  entityGraphSchema.parse(
    JSON.parse(readFileSync(path.join(fixtures, `structural-r${rev}.entitygraph.json`), "utf-8")),
  );

const R1 = load(1);
const R2 = load(2);

const byCaption = (views: View[], caption: string): View => {
  const view = views.find((v) => v.caption?.text.startsWith(caption));
  if (view === undefined) throw new Error(`no view captioned ${caption}: ${views.map((v) => v.caption?.text ?? v.type).join(" | ")}`);
  return view;
};

const textOf = (graph: EntityGraph, handle: string): string | null => {
  const e = graph.entities.find((x) => x.h === handle && x.src === null);
  return e !== undefined && (e.t === "TEXT" || e.t === "MTEXT") ? e.text : null;
};

describe("the view partition", () => {
  it.each([1, 2] as const)("assigns every original in rev %i to exactly one view", (rev) => {
    const graph = rev === 1 ? R1 : R2;
    const { views, originalCount } = partitionViews(graph);

    const originals = graph.entities.filter((e) => e.src === null).map((e) => e.h);
    expect(originalCount).toBe(originals.length);
    const assigned = views.flatMap((v) => v.handles);
    // Total AND disjoint: the multiset of assignments is the set of originals.
    expect(assigned.length).toBe(originals.length);
    expect([...assigned].sort()).toEqual([...originals].sort());
  });

  it("reads the sheet's four captions into their lawful types", () => {
    const { views } = partitionViews(R1);
    const typed = views
      .filter((v) => v.caption !== null)
      .map((v) => [v.caption!.text, v.type] as const);
    expect(new Map(typed)).toEqual(
      new Map([
        ["TYPICAL FLOOR PLAN (R1)", "layout_plan"],
        ["COLUMN SCHEDULE", "schedule"],
        ["PLAN OF PILE CAP PC-1", "detail"],
        ["SK-04 REF. AS-BUILT", "untyped"],
      ]),
    );
  });

  it("keeps the schedule's mark cells out of the layout plan", () => {
    // The trap: `C1` reads identically in the plan (a placed column's mark)
    // and in the schedule (a row's mark cell). A partition that leaks the
    // schedule into the plan invents columns that were never built.
    const { views } = partitionViews(R1);
    const plan = byCaption(views, "TYPICAL FLOOR PLAN");
    const schedule = byCaption(views, "COLUMN SCHEDULE");

    const marksIn = (v: View): string[] =>
      v.handles.map((h) => textOf(R1, h)).filter((t): t is string => t !== null && /^C\d$/.test(t));
    expect(marksIn(plan).sort()).toEqual(["C1", "C1", "C1", "C1", "C2", "C2", "C2", "C2", "C3"]);
    expect(marksIn(schedule).sort()).toEqual(["C1", "C2", "C3"]);
    expect(schedule.handles.some((h) => plan.handles.includes(h))).toBe(false);
  });

  it("keeps the member-scoped detail's pile circles out of the layout plan", () => {
    const { views } = partitionViews(R1);
    const detail = byCaption(views, "PLAN OF PILE CAP");
    const plan = byCaption(views, "TYPICAL FLOOR PLAN");
    const circles = (v: View): number =>
      v.handles.filter((h) =>
        R1.entities.some((e) => e.h === h && e.src === null && e.t === "CIRCLE"),
      ).length;
    expect(circles(detail)).toBe(2);
    expect(circles(plan)).toBe(0);
    expect(detail.subject).toBe("PILE CAP PC-1");
  });

  it("names the stray line unassigned rather than dropping it", () => {
    const { views } = partitionViews(R1);
    const unassigned = views.find((v) => v.type === "unassigned")!;
    expect(unassigned.handles).toHaveLength(1);
    const junk = R1.entities.find((e) => e.h === unassigned.handles[0]);
    expect(junk?.t).toBe("LINE");
    expect(unassigned.reasons.map((r) => r.code)).toEqual(["NO_CAPTION_IN_REACH"]);
    expect(unassigned.reasons[0]!.message).toMatch(/never dropped/);
  });

  it("makes an unclassifiable caption untyped with a named reason", () => {
    const { views } = partitionViews(R1);
    const sketch = byCaption(views, "SK-04");
    expect(sketch.type).toBe("untyped");
    expect(sketch.reasons.map((r) => r.code)).toEqual(["CAPTION_UNCLASSIFIABLE"]);
    expect(sketch.reasons[0]!.message).toMatch(/never guessed/);
    expect(sketch.handles.length).toBeGreaterThan(0); // untyped, not empty
  });

  it("holds the partition across the whole window the sheet's geometry allows", () => {
    // The window is the sheet's own geometry, not a preference: measured, it
    // runs from 5 caption-heights (below which the schedule's table starts
    // fragmenting) to 16.5 (above which the sketch's caption reaches across
    // the strip and swallows the floor plan). The default, 12, sits inside it
    // with room on both sides, and nowhere in the window does one entity move.
    const baseline = partitionViews(R1).views.map((v) => [v.id, v.type, v.handles.join()] as const);
    for (const bandGap of [5, 6, 8, 10, 12, 14, 16]) {
      const swept = partitionViews(R1, { ...DEFAULT_TUNING, bandGap }).views;
      expect(swept.map((v) => [v.id, v.type, v.handles.join()] as const)).toEqual(baseline);
    }
  });

  it("never lets the layout plan GAIN an entity, at any tuning", () => {
    // The asymmetry, as a property: mistuning may cost the plan entities (it
    // measures less, and the unassigned bucket says so), but it may never hand
    // the plan an entity from a schedule or a detail — that would be counting
    // members that were never built.
    const lawful = new Set(byCaption(partitionViews(R1).views, "TYPICAL FLOOR PLAN").handles);
    for (const bandGap of [3, 4, 5, 8, 12, 16, 17, 20, 30]) {
      const { views } = partitionViews(R1, { ...DEFAULT_TUNING, bandGap });
      for (const view of views.filter((v) => mayYieldInstances(v.type))) {
        for (const handle of view.handles) expect(lawful).toContain(handle);
      }
    }
  });

  it("fails to honest absence, never to a wrong view, below that window", () => {
    // A band gap under the schedule's own column spacing shatters the table.
    // The lawful outcome is unassigned-with-a-reason; those mark cells must
    // never land in the plan instead, where they would count as columns that
    // were never built (over-measurement — a hard block, never a disclosure).
    const { views } = partitionViews(R1, { ...DEFAULT_TUNING, bandGap: 4 });
    const plan = byCaption(views, "TYPICAL FLOOR PLAN");
    const unassigned = views.find((v) => v.type === "unassigned")!;
    expect(unassigned.reasons.map((r) => r.code)).toEqual(["NO_CAPTION_IN_REACH"]);

    const cell = R1.entities.find(
      (e) => e.src === null && (e.t === "TEXT" || e.t === "MTEXT") && e.text === "MAIN BAR",
    )!;
    expect(unassigned.handles).toContain(cell.h);
    expect(plan.handles).not.toContain(cell.h);
    // Still total: fragmenting may not lose an entity.
    expect(views.flatMap((v) => v.handles)).toHaveLength(
      R1.entities.filter((e) => e.src === null).length,
    );
  });

  it("partitions the revision pair identically outside the changed columns", () => {
    // Ticket 08 reads a delta off these views; a partition that reshuffles
    // between revisions would report churn that never happened.
    const typesOf = (g: EntityGraph): string[] =>
      partitionViews(g)
        .views.map((v) => `${v.caption?.text.replace(/\(R\d\)/, "").trim() ?? v.type}:${v.type}`)
        .sort();
    expect(typesOf(R2)).toEqual(typesOf(R1));

    const sizes = (g: EntityGraph): Record<string, number> =>
      Object.fromEntries(
        partitionViews(g).views.map((v) => [v.caption?.text.replace(/\(R\d\)/, "").trim() ?? v.type, v.handles.length]),
      );
    const [s1, s2] = [sizes(R1), sizes(R2)];
    expect(s2["COLUMN SCHEDULE"]).toBe(s1["COLUMN SCHEDULE"]);
    expect(s2["PLAN OF PILE CAP PC-1"]).toBe(s1["PLAN OF PILE CAP PC-1"]);
    expect(s2["SK-04 REF. AS-BUILT"]).toBe(s1["SK-04 REF. AS-BUILT"]);
    expect(s2["TYPICAL FLOOR PLAN"]).toBe(s1["TYPICAL FLOOR PLAN"]); // -1 column, +1 column
  });
});

describe("the instance predicate", () => {
  it("admits the layout plan and refuses every other view of the sheet", () => {
    const { views } = partitionViews(R1);
    const admitted = views.filter((v) => mayYieldInstances(v.type)).map((v) => v.caption?.text);
    expect(admitted).toEqual(["TYPICAL FLOOR PLAN (R1)"]);
  });

  it("refuses every non-layout-plan type in the vocabulary", () => {
    const others: ViewType[] = [
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
    ];
    expect(others.filter(mayYieldInstances)).toEqual([]);
  });
});

describe("the caption grammar", () => {
  it.each([
    ["TYPICAL FLOOR PLAN", "layout_plan"],
    ["COLUMN LAYOUT PLAN", "layout_plan"],
    ["GROUND FLOOR SLAB PLAN", "layout_plan"],
    ["COLUMN SCHEDULE", "schedule"],
    ["PILE CAP & FOOTING SCHEDULE", "schedule"],
    ["LONG SECTION OF BEAM", "long_section"],
    ["SECTION 1-1", "member_section"],
    ["TYPICAL STAIR PLAN", "stair_plan"],
    ["SECTION OF STAIR", "stair_section"],
    ["GENERAL NOTES", "legend_notes"],
    ["LEGEND", "legend_notes"],
    ["TYPICAL COLUMN DETAILS", "detail"],
    // The §7 trap, both phrasings: a member-scoped plan is never countable.
    ["PLAN OF PILE CAP PC-1", "detail"],
    ["REINF. PLAN OF PILE CAP, P.C-2", "detail"],
    ["PILE CAP PC-2 PLAN", "detail"],
  ])("classifies %j as %s", (caption, type) => {
    expect(classifyCaption(caption)?.type).toBe(type);
  });

  it.each([
    ["তলার প্ল্যান", "layout_plan"],
    ["কলাম শিডিউল", "schedule"],
    ["সিঁড়ির প্ল্যান", "stair_plan"],
  ])("classifies the bn caption %j as %s", (caption, type) => {
    expect(classifyCaption(caption)?.type).toBe(type);
  });

  it("classifies lowercase and escaped captions the same way", () => {
    expect(classifyCaption("typical floor plan")?.type).toBe("layout_plan");
    // %%C is Ø: the escape strips first (§6), never leaking into the grammar.
    expect(classifyCaption("SCHEDULE OF 20%%C BARS")?.type).toBe("schedule");
  });

  it("returns null on a caption the grammar does not recognise", () => {
    expect(classifyCaption("SK-04 REF. AS-BUILT")).toBeNull();
    expect(classifyCaption("")).toBeNull();
  });
});

// ── Synthetic graphs: shapes the fixture sheet cannot carry ──────────────────

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
const next = (): string => `${++handle}`;
const text = (t: string, p: [number, number], height: number): Entity => ({
  t: "TEXT",
  h: next(),
  src: null,
  layer: "ANNO",
  color: "#ffffff",
  text: t,
  p,
  height,
  rot: 0,
});
const line = (p1: [number, number], p2: [number, number]): Entity => ({
  t: "LINE",
  h: next(),
  src: null,
  layer: "0",
  color: "#ffffff",
  p1,
  p2,
});

describe("the partition's edges", () => {
  it("does not let a sheet border bridge two views into one", () => {
    const graph = graphOf([
      line([0, 0], [100_000, 0]), // the sheet border: spans everything
      line([0, 0], [0, 60_000]),
      text("TYPICAL FLOOR PLAN", [1000, 1000], 400),
      line([1000, 2000], [5000, 6000]),
      text("COLUMN SCHEDULE", [80_000, 1000], 400),
      text("C1", [80_000, 3000], 150),
    ]);
    const { views } = partitionViews(graph);
    const plan = views.find((v) => v.type === "layout_plan")!;
    const schedule = views.find((v) => v.type === "schedule")!;
    expect(plan.handles).not.toEqual(expect.arrayContaining(schedule.handles));
    expect(mayYieldInstances(schedule.type)).toBe(false);
  });

  it("assigns nothing when the drawing carries no caption at all", () => {
    const { views } = partitionViews(graphOf([line([0, 0], [1000, 1000])]));
    expect(views.map((v) => v.type)).toEqual(["unassigned"]);
    expect(views[0]!.handles).toHaveLength(1);
    expect(views[0]!.reasons.map((r) => r.code)).toEqual(["NO_CAPTION_IN_REACH"]);
  });

  it("names a dimension whose paint never arrived rather than dropping it", () => {
    // A DIMENSION states no geometry of its own (§3) — if its rendered paint
    // was truncated away, it cannot be placed, and that must be said.
    const graph = graphOf([
      text("TYPICAL FLOOR PLAN", [0, 0], 400),
      line([0, 1000], [5000, 1000]),
      { t: "DIMENSION", h: next(), src: null, layer: "DIM", color: "#ffffff" },
    ]);
    const { views } = partitionViews(graph);
    const unassigned = views.find((v) => v.type === "unassigned")!;
    expect(unassigned.handles).toHaveLength(1);
    expect(unassigned.reasons.map((r) => r.code)).toEqual(["NO_GEOMETRY_TO_PLACE"]);
  });

  it("places a dimension by the paint that cites it", () => {
    const dim: Entity = { t: "DIMENSION", h: next(), src: null, layer: "DIM", color: "#ffffff" };
    const graph = graphOf([
      text("TYPICAL FLOOR PLAN", [0, 0], 400),
      line([0, 1000], [5000, 1000]),
      dim,
      { ...line([0, 900], [5000, 900]), h: null, src: dim.h },
    ]);
    const { views } = partitionViews(graph);
    expect(views.find((v) => v.type === "unassigned")!.handles).toEqual([]);
    expect(views.find((v) => v.type === "layout_plan")!.handles).toContain(dim.h);
  });
});
