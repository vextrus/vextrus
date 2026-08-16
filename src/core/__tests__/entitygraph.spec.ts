import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { entityGraphSchema } from "../entitygraph";

const fixturesDir = path.resolve(import.meta.dirname, "../../../cad/tests/fixtures");

const load = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), "utf-8"));

describe("EntityGraph contract mirror", () => {
  it("parses the minimal fixture the python side emits", () => {
    const parsed = entityGraphSchema.parse(load("entitygraph-minimal.json"));
    expect(parsed.units.detected).toBe("inch");
    expect(parsed.counters.explode_truncated).toBe(false);
  });

  it("parses the structural ingest artifact with real entities", () => {
    const parsed = entityGraphSchema.parse(load("structural-r1.entitygraph.json"));
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
    doc.version = 2;
    expect(() => entityGraphSchema.parse(doc)).toThrow();
  });

  it.each([null, ""])("refuses an original entity with handle %j", (h) => {
    const doc = load("structural-r1.entitygraph.json") as { entities: unknown[] };
    doc.entities.push({
      h,
      t: "DIMENSION",
      layer: "DIM",
      color: "#0000ff",
      src: null,
    });
    expect(() => entityGraphSchema.parse(doc)).toThrow(/must carry its DXF handle/);
  });

  it("refuses a closed path without its area", () => {
    const doc = load("structural-r1.entitygraph.json") as { entities: unknown[] };
    doc.entities.push({
      h: "FF",
      t: "LWPOLYLINE",
      layer: "SLAB",
      color: "#00ff00",
      src: null,
      pts: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      closed: true,
      area: null,
    });
    expect(() => entityGraphSchema.parse(doc)).toThrow(/closed path carries its area/);
  });
});
