import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph";
import { sightingSemantic } from "@/core/pairing";
import { carryBounds, placeInstances, REVISION_CARRY_SHARE } from "../placement";
import { georeferenceGrid } from "../grid";
import { partitionViews } from "../views";

/**
 * The revision pair through the whole takeoff pipeline (ticket 08). What the
 * committed fixtures actually differ by — a nudged column, a deleted column, an
 * added one, and a retitled caption — read as a delta of *columns*, and every
 * absence along the way is named. Registration itself is
 * db/__tests__/revision-delta.dbspec.ts.
 */

const fixtures = path.resolve(import.meta.dirname, "../../../../cad/tests/fixtures");

const graphOf = (rev: 1 | 2): EntityGraph =>
  entityGraphSchema.parse(
    JSON.parse(readFileSync(path.join(fixtures, `structural-r${rev}.entitygraph.json`), "utf-8")),
  );

function walk(rev: 1 | 2) {
  const graph = graphOf(rev);
  const partition = partitionViews(graph);
  const backbones = georeferenceGrid(graph, partition);
  const placements = placeInstances(graph, partition, backbones);
  return { graph, partition, backbones, placements };
}

const r1 = walk(1);
const r2 = walk(2);

describe("the revision pair, walked", () => {
  it("keeps one layout-plan view under a retitled caption", () => {
    const plan = (w: typeof r1) => w.partition.views.find((v) => v.type === "layout_plan")!;
    // the caption changed — R1 → R2 — and the view key did not: a view key is
    // its class plus its caption *anchor*, never the caption's words
    expect(plan(r2).caption!.text).not.toBe(plan(r1).caption!.text);
    expect(plan(r2).caption!.text).toContain("(R2)");
    expect(r2.placements.map((p) => p.viewKey)).toEqual(r1.placements.map((p) => p.viewKey));
    expect(r2.partition.views.map((v) => `${v.type}:${v.id}`)).toEqual(
      r1.partition.views.map((v) => `${v.type}:${v.id}`),
    );
  });

  it("states the carry bound as a share of the view's own grid spacing", () => {
    const plan = r2.placements[0]!;
    const spacing = r2.backbones.find((b) => b.viewId === plan.viewId)!.minSpacing!;
    expect(carryBounds(r2.placements, r2.backbones)).toEqual({
      [plan.viewKey]: spacing * REVISION_CARRY_SHARE,
    });
    // a view that stated no spacing states no bound either — never a length
    expect(carryBounds(r2.placements, [])).toEqual({});
  });

  it("differs from rev 1 by columns and nothing else", () => {
    const keys = (w: typeof r1) => w.placements.flatMap((p) => p.instances.map((i) => i.placementKey));
    const gone = keys(r1).filter((k) => !keys(r2).includes(k));
    const arrived = keys(r2).filter((k) => !keys(r1).includes(k));
    // (A,3) deleted and (C,3) nudged +300 — the added C4 is accounted for below
    expect(gone).toEqual([
      "layout_plan:E6|C1|0.0|9000.0",
      "layout_plan:E6|C1|10000.0|9000.0",
    ]);
    expect(arrived).toEqual(["layout_plan:E6|C1|10300.0|9000.0"]);
  });

  it("re-presents the members whose cited evidence moved, and only carries the rest", () => {
    const semantics = (w: typeof r1) =>
      new Map(
        w.placements[0]!.instances.map((i) => [i.placementKey, sightingSemantic(i)] as const),
      );
    const before = semantics(r1);
    const after = semantics(r2);
    const same = [...after].filter(([k, s]) => before.get(k) === s).map(([k]) => k);
    // the two C1s the revision left alone — every other survivor cites handles
    // the revision shifted, and a moved lineage re-presents (identity.md §5)
    expect(same).toEqual(["layout_plan:E6|C1|0.0|0.0", "layout_plan:E6|C1|10000.0|0.0"]);
  });

  it("names the added column's absence rather than placing an unwitnessed class", () => {
    // C4 is drawn but no view that may state types names it: its element class
    // is unwitnessed, so it places nothing — and says why, twice (footprint and
    // mark). The register never hears of it, which is honest, not silent.
    const added = r2.placements[0]!.dispositions.filter((d) => d.code === "CLASS_NOT_WITNESSED");
    expect(added).toHaveLength(2);
    for (const disposition of added) {
      expect(disposition.message).toMatch(/no view that may state types names family C4/);
    }
    expect(r1.placements[0]!.dispositions.some((d) => d.code === "CLASS_NOT_WITNESSED")).toBe(
      false,
    );
  });

  it("carries a named reason on every absence, deferral and disposition it states", () => {
    for (const view of r2.partition.views) {
      for (const reason of view.reasons) {
        expect(reason.code).toBeTruthy();
        expect(reason.message.trim().length).toBeGreaterThan(0);
      }
    }
    for (const backbone of r2.backbones) {
      if (backbone.deferral === null) continue;
      expect(backbone.deferral.cause).toBeTruthy();
      expect(backbone.deferral.message.trim().length).toBeGreaterThan(0);
    }
    for (const placement of r2.placements) {
      expect(placement.deferral?.message ?? "stated").toBeTruthy();
      for (const disposition of placement.dispositions) {
        expect(disposition.message.trim().length).toBeGreaterThan(0);
      }
      // and every original the view owns is accounted for by name
      const view = r2.partition.views.find((v) => v.id === placement.viewId)!;
      const said = new Set(placement.dispositions.map((d) => d.handle));
      const originals = new Set(
        r2.graph.entities
          .filter((e) => e.src === null && e.h !== null && view.handles.includes(e.h))
          .map((e) => e.h!),
      );
      expect([...originals].filter((h) => !said.has(h))).toEqual([]);
    }
    // the off-grid statement is an absence too, and it is never a snap
    for (const instance of r2.placements[0]!.instances) {
      if (instance.gridRef.letter === null || instance.gridRef.numeral === null) {
        expect(instance.gridRef.absence).toMatch(/stated as absent rather than snapped/);
      }
    }
  });
});
