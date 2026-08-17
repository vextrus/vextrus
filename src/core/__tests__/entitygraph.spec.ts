import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { entityGraphSchema, layoutOf } from "../entitygraph";

const fixturesDir = path.resolve(
  import.meta.dirname,
  "../../../cad/tests/fixtures",
);

const load = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), "utf-8"));

describe("EntityGraph contract mirror", () => {
  it("parses the minimal fixture the python side emits", () => {
    const parsed = entityGraphSchema.parse(load("entitygraph-minimal.json"));
    expect(parsed.units.detected).toBe("inch");
    expect(parsed.counters.explode_truncated).toBe(false);
  });

  it("parses the structural ingest artifact with real entities", () => {
    const parsed = entityGraphSchema.parse(
      load("structural-r1.entitygraph.json"),
    );
    expect(parsed.units.detected).toBe("mm");
    expect(parsed.counters.original).toBeGreaterThan(0);
    expect(parsed.counters.derived).toBeGreaterThan(0);
    expect(parsed.counters.unsupported_by_type).toEqual({ POINT: 4 });
    expect(parsed.entities).toHaveLength(
      parsed.counters.original + parsed.counters.derived,
    );
    // The extractor invariant, visible from this side of the seam: src null
    // marks an original (with handle); derived entities cite an original.
    const handles = new Set(
      parsed.entities.filter((e) => e.src === null).map((e) => e.h),
    );
    for (const e of parsed.entities) {
      if (e.src === null) expect(e.h).toBeTypeOf("string");
      else expect(handles.has(e.src)).toBe(true);
    }
  });

  it("refuses a version bump", () => {
    const doc = load("entitygraph-minimal.json") as Record<string, unknown>;
    doc.version = 3;
    expect(() => entityGraphSchema.parse(doc)).toThrow();
  });

  // ── Version 2 (ADR-0009): the four facts the app can never recover, because the CLI is
  //    one-shot and nothing on this side may re-open the drawing.

  it("reads the space marker on every entity, and the layout inventory beside it", () => {
    const parsed = entityGraphSchema.parse(
      load("structural-r1.entitygraph.json"),
    );
    // The fixture is a single model-space sheet; its stock empty Layout1 is dropped as
    // content-less, and counted — never silently absent (cad-ingestion.md §3, §4).
    expect(new Set(parsed.entities.map((e) => e.space))).toEqual(
      new Set(["model"]),
    );
    expect(parsed.entities.every((e) => layoutOf(e.space) === null)).toBe(true);
    expect(parsed.layouts).toEqual({ paper: [], dropped_contentless: 1 });
  });

  it("reads the robust extents and the count the percentile window rejected", () => {
    const parsed = entityGraphSchema.parse(
      load("structural-r1.entitygraph.json"),
    );
    // The fixture plants one stray line at (60000, 60000) — the xref junk §4 rejects. It is
    // still shipped: rejection sets the extents, it is never a loss channel.
    expect(parsed.extents.rejected).toBe(1);
    const [, , maxX, maxY] = parsed.extents.bbox!;
    expect(maxX).toBeLessThan(60000);
    expect(maxY).toBeLessThan(60000);
    expect(
      parsed.entities.some((e) => e.t === "LINE" && e.p1[0] === 60000),
    ).toBe(true);
  });

  it("reads the flatten point-cap counter, which said nothing at v1", () => {
    const parsed = entityGraphSchema.parse(
      load("structural-r1.entitygraph.json"),
    );
    expect(parsed.counters.flatten_capped).toBe(1); // the slab's bulged corner
  });

  // "paper:" names no layout; "Model" and "sheet:" are not the vocabulary.
  it.each(["", "paper:", "Model", "sheet:S-01"])(
    "refuses %j as a space marker",
    (space) => {
      const doc = load("structural-r1.entitygraph.json") as {
        entities: { space: string }[];
      };
      doc.entities[0]!.space = space;
      expect(() => entityGraphSchema.parse(doc)).toThrow();
    },
  );

  it("refuses an entity in a layout the inventory dropped", () => {
    // Otherwise `dropped_contentless` is a lie: the two readings of one drawing must agree.
    const doc = load("structural-r1.entitygraph.json") as {
      entities: { space: string }[];
    };
    doc.entities[0]!.space = "paper:SHEET 1";
    expect(() => entityGraphSchema.parse(doc)).toThrow(
      /absent from layouts.paper/,
    );
  });

  it("admits the entity once its layout is shipped with a bbox", () => {
    const doc = load("structural-r1.entitygraph.json") as {
      entities: { space: string }[];
      layouts: { paper: unknown[] };
    };
    doc.entities[0]!.space = "paper:SHEET 1";
    doc.layouts.paper.push({ name: "SHEET 1", bbox: [0, 0, 420, 297] });
    const parsed = entityGraphSchema.parse(doc);
    expect(layoutOf(parsed.entities[0]!.space)).toBe("SHEET 1");
  });

  it("refuses a bbox whose maximum falls below its minimum", () => {
    const doc = load("entitygraph-minimal.json") as {
      extents: { bbox: unknown };
    };
    doc.extents.bbox = [10, 0, 0, 10];
    expect(() => entityGraphSchema.parse(doc)).toThrow();
  });

  it.each(["flatten_capped", "extents", "layouts"])(
    "refuses an artifact missing %s — a field one side knows about and the other does not",
    (field) => {
      const doc = load("entitygraph-minimal.json") as Record<
        string,
        unknown
      > & {
        counters: Record<string, unknown>;
      };
      if (field === "flatten_capped") delete doc.counters[field];
      else delete doc[field];
      expect(() => entityGraphSchema.parse(doc)).toThrow();
    },
  );

  it.each([null, ""])("refuses an original entity with handle %j", (h) => {
    const doc = load("structural-r1.entitygraph.json") as {
      entities: unknown[];
    };
    doc.entities.push({
      h,
      t: "DIMENSION",
      layer: "DIM",
      color: "#0000ff",
      space: "model",
      src: null,
    });
    expect(() => entityGraphSchema.parse(doc)).toThrow(
      /must carry its DXF handle/,
    );
  });

  it("refuses a closed path without its area", () => {
    const doc = load("structural-r1.entitygraph.json") as {
      entities: unknown[];
    };
    doc.entities.push({
      h: "FF",
      t: "LWPOLYLINE",
      layer: "SLAB",
      color: "#00ff00",
      space: "model",
      src: null,
      pts: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      closed: true,
      area: null,
    });
    expect(() => entityGraphSchema.parse(doc)).toThrow(
      /closed path carries its area/,
    );
  });
});
