import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph";
import {
  PLACEMENT_SHARES,
  georeferenceGrid,
  isMemberMark,
  levelSlotOf,
  markFamilyOf,
  normalizeMark,
  partitionViews,
  placeInstances,
  type PlacedInstance,
  type ViewPlacement,
} from "@/modules/takeoff";

/**
 * Instance placement (cad-ingestion.md §9) against the committed fixture sheet.
 * The generator's own MARKS map is the truth: nine columns at nine grid
 * intersections, and every other entity on the plan accounted for by name.
 */

const fixtures = path.resolve(import.meta.dirname, "../../../../cad/tests/fixtures");

const load = (rev: 1 | 2): EntityGraph =>
  entityGraphSchema.parse(
    JSON.parse(readFileSync(path.join(fixtures, `structural-r${rev}.entitygraph.json`), "utf-8")),
  );

const R1 = load(1);

/** gen_structural.py's own MARKS — mark per (letter, numeral) intersection. */
const MARKS: Record<string, string> = {
  "A1": "C1",
  "C1": "C1",
  "A3": "C1",
  "C3": "C1",
  "B1": "C2",
  "A2": "C2",
  "C2": "C2",
  "B3": "C2",
  "B2": "C3",
};

function placeOf(graph: EntityGraph): ViewPlacement {
  const partition = partitionViews(graph);
  const placements = placeInstances(graph, partition, georeferenceGrid(graph, partition));
  expect(placements).toHaveLength(1);
  return placements[0]!;
}

const refOf = (i: PlacedInstance): string => `${i.gridRef.letter}${i.gridRef.numeral}`;

describe("placement on the fixture sheet", () => {
  const placement = placeOf(R1);

  it("places the nine columns of the plan, one per grid intersection", () => {
    expect(placement.deferral).toBeNull();
    expect(placement.instances).toHaveLength(9);
    expect(
      Object.fromEntries(placement.instances.map((i) => [refOf(i), i.mark])),
    ).toEqual(MARKS);
    for (const instance of placement.instances) {
      expect(instance.gridRef.absence).toBeNull();
      expect(instance.elementType).toBe("column");
      // No level stack is authored, and a machine may not author one: the
      // vertical class takes the lawful-null UNRESOLVED basis (identity.md §3).
      expect(instance.levelBasis).toBe("UNRESOLVED");
      expect(instance.handles).toHaveLength(2);
    }
  });

  it("takes the element class from the schedule's caption, never from the mark", () => {
    // `C1` says nothing about being a column; `COLUMN SCHEDULE` does. Strip the
    // witnessing view's caption and the marks lose their class — no instance,
    // and the absence is named rather than assumed.
    const schedule = partitionViews(R1).views.find((v) => v.caption?.text === "COLUMN SCHEDULE")!;
    const stripped = entityGraphSchema.parse({
      ...R1,
      entities: R1.entities.filter((e) => e.h !== schedule.caption!.handle),
    });
    const without = placeOf(stripped);
    expect(without.instances).toEqual([]);
    const codes = new Set(without.dispositions.map((d) => d.code));
    expect(codes).toContain("CLASS_NOT_WITNESSED");
    expect(
      without.dispositions.find((d) => d.code === "CLASS_NOT_WITNESSED")!.message,
    ).toMatch(/unwitnessed/);
  });

  it("keys each placement by content — view, mark, quantized position", () => {
    const plan = partitionViews(R1).views.find((v) => v.id === placement.viewId)!;
    expect(placement.viewKey).toBe(`${plan.type}:${plan.id}`);
    expect(placement.instances.map((i) => i.placementKey)).toContain(
      `${placement.viewKey}|C3|5000.0|4500.0`,
    );
    // Content-derived: a re-derivation reproduces the identical key multiset.
    expect(placeOf(load(1)).instances.map((i) => i.placementKey)).toEqual(
      placement.instances.map((i) => i.placementKey),
    );
  });

  it("signs each instance with its authored footprint only", () => {
    // All nine columns are the same block: one signature, so ordinals fall to
    // the placement-key tie-break (identity.md §4).
    expect(new Set(placement.instances.map((i) => i.signature)).size).toBe(1);
    expect(placement.instances[0]!.signature).toMatch(/^\d+\.\d+x\d+\.\d+$/);
  });

  it("accounts for every original in the view, exactly once", () => {
    const plan = partitionViews(R1).views.find((v) => v.id === placement.viewId)!;
    const handles = placement.dispositions.map((d) => d.handle);
    expect([...handles].sort()).toEqual([...plan.handles].sort());
    expect(new Set(handles).size).toBe(handles.length);
    for (const d of placement.dispositions) expect(d.message.length).toBeGreaterThan(0);
  });

  it("yields no instance from the bubble, the arc or the slab — each by name", () => {
    const codeOf = (handle: string): string =>
      placement.dispositions.find((d) => d.handle === handle)!.code;

    // The 1.5x-scaled bubble: the georeference cited it, so it is grid
    // evidence, and grid evidence is never a member.
    const bubble = R1.entities.find(
      (e) => e.t === "INSERT" && e.name === "GRID_BUBBLE" && e.p[0] === 10_000,
    )!;
    expect(codeOf(bubble.h!)).toBe("GRID_EVIDENCE");

    // The arc and the dimension state no closed footprint at all.
    const arc = R1.entities.find((e) => e.t === "ARC")!;
    expect(codeOf(arc.h!)).toBe("NO_MEMBER_GEOMETRY");
    const dimension = R1.entities.find((e) => e.t === "DIMENSION")!;
    expect(codeOf(dimension.h!)).toBe("NO_MEMBER_GEOMETRY");

    // The slab outline is closed, and spans beyond §9's footprint maximum —
    // a floor plate, never a member.
    const slab = R1.entities.find(
      (e) => e.t === "LWPOLYLINE" && e.layer === "SLAB" && e.closed,
    )!;
    expect(codeOf(slab.h!)).toBe("FOOTPRINT_OUT_OF_WINDOW");
    expect(
      placement.dispositions.find((d) => d.handle === slab.h)!.message,
    ).toMatch(/floor plate or sheet frame/);

    // The stray POINT never reached the graph at all: the pipeline counted it
    // as an unhandled entity type, which is its named absence (§3).
    expect(R1.counters.unsupported_by_type["POINT"]).toBeGreaterThan(0);
    expect(R1.entities.some((e) => e.t === ("POINT" as never))).toBe(false);
  });

  it("scales every constant by the grid spacing, and defers when there is none", () => {
    // A plan whose bubbles are gone states no spacing: §9's constants have no
    // scale, so placement defers whole rather than measure against a guess.
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
    const deferred = placeOf(stripped);
    expect(deferred.instances).toEqual([]);
    expect(deferred.dispositions).toEqual([]);
    expect(deferred.deferral?.cause).toBe("NOT_ESTABLISHED");
    expect(deferred.deferral?.message).toMatch(/never measured against a guessed length/);
  });

  it("holds the marks of a non-countable view out of the count", () => {
    // The `PLAN OF PILE CAP PC-1` detail draws two pile circles and names them
    // PC-1 — countable-looking evidence in a view that may not yield instances.
    // It witnesses the pile-cap class and places nothing.
    expect(placement.instances.some((i) => i.mark === "PC-1")).toBe(false);
    expect(placement.instances.every((i) => i.elementType === "column")).toBe(true);
  });
});

describe("the placement constants", () => {
  it("are shares, and only shares", () => {
    expect(PLACEMENT_SHARES).toEqual({
      containment: 0.08,
      nearAnchor: 0.9,
      footprintMin: 0.6,
      footprintMax: 2.5,
    });
  });
});

describe("mark normalization (§9)", () => {
  it("strips the size parenthetical — both forms are the drawing's own", () => {
    expect(normalizeMark("C1 (450X600)")).toBe("C1");
    expect(normalizeMark(" c1 ")).toBe("C1");
  });

  it("compares dotless-uppercase, so TB matches a registered T.B", () => {
    expect(markFamilyOf("T.B-3")).toBe(markFamilyOf("TB-3"));
    expect(markFamilyOf("T.B-3")).toBe("TB-3");
  });

  it("reads a member mark, and nothing that merely looks like one", () => {
    for (const mark of ["C1", "PC-1", "T.B-3", "B2A", "C12"]) {
      expect(isMemberMark(mark)).toBe(true);
    }
    // grid labels, size pairs, rebar strings, sentences: none is a mark
    for (const other of ["A", "1", "450X600", "8-20mmØ", "MAIN BAR", "MARK"]) {
      expect(isMemberMark(other)).toBe(false);
    }
  });
});

describe("the level slot (§9)", () => {
  it("puts foundation classes on the lawful-null FOUNDATION basis", () => {
    for (const type of ["pile", "pile_cap", "footing", "tie_grade_beam"] as const) {
      expect(levelSlotOf(type)).toBe("FOUNDATION");
    }
  });

  it("leaves vertical classes UNRESOLVED until a human authors a level", () => {
    for (const type of ["column", "shear_wall", "beam", "slab"] as const) {
      expect(levelSlotOf(type)).toBe("UNRESOLVED");
    }
  });
});
