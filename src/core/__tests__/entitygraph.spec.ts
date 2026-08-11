import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { entityGraphSchema } from "../entitygraph";

const fixturePath = path.resolve(
  import.meta.dirname,
  "../../../cad/tests/fixtures/entitygraph-minimal.json",
);

describe("EntityGraph contract mirror", () => {
  it("parses the fixture the python side emits", () => {
    const doc: unknown = JSON.parse(readFileSync(fixturePath, "utf-8"));
    const parsed = entityGraphSchema.parse(doc);
    expect(parsed.units.detected).toBe("inch");
    expect(parsed.counters.explode_truncated).toBe(false);
  });

  it("refuses a version bump", () => {
    const doc = JSON.parse(readFileSync(fixturePath, "utf-8")) as Record<
      string,
      unknown
    >;
    doc.version = 2;
    expect(() => entityGraphSchema.parse(doc)).toThrow();
  });
});
