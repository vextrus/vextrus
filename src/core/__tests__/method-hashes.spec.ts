import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildManifest, checkMethodHashes, manifestDrift } from "../../../scripts/method-hashes.mjs";

/**
 * The `methods:hash` verify stage, proved to fail closed (measurement-rules.md §1: *CI asserting a
 * content hash of the implementation*; ADR-0010). A stage that cannot be shown failing is a stage
 * nobody knows is running — the paid-for lesson behind `src/__tests__/boundaries.spec.ts`.
 *
 * The fixture is built rather than committed: the committed manifest beside `src/core/rule-set.ts`
 * is the real artifact, and a second committed one would go stale for reasons that say nothing
 * about drift.
 */
const SOURCE = `export const fixtureMethod = {
  ruleId: "FIXTURE_RECT_PRISM",
  version: 1,
} as const;
`;

const root = mkdtempSync(path.join(tmpdir(), "vextrus-method-hashes-"));
const methodsDir = path.join(root, "methods");
mkdirSync(methodsDir);
writeFileSync(path.join(methodsDir, "fixture-rect-prism.ts"), SOURCE);
const sha256 = createHash("sha256").update(SOURCE).digest("hex");

const manifestAt = (name: string, contents: unknown) => {
  const file = path.join(root, name);
  writeFileSync(file, JSON.stringify(contents, null, 2));
  return file;
};
const entry = { file: "fixture-rect-prism.ts", sha256 };
const check = (manifestPath: string) => checkMethodHashes({ methodsDir, manifestPath });

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("the method content-hash stage", () => {
  it("reads (rule id, version) off the file itself and digests the whole file", () => {
    const { manifest, faults } = buildManifest(methodsDir);
    expect(faults).toEqual([]);
    expect(manifest).toEqual({ methods: { "FIXTURE_RECT_PRISM@1": entry } });
  });

  it("passes when the file and its manifest entry agree", () => {
    expect(check(manifestAt("ok.json", { methods: { "FIXTURE_RECT_PRISM@1": entry } }))).toEqual({ ok: true, faults: [] });
  });

  it("FAILS when a method file and its manifest entry diverge", () => {
    const stale = { methods: { "FIXTURE_RECT_PRISM@1": { ...entry, sha256: "0".repeat(64) } } };
    const result = check(manifestAt("drifted.json", stale));
    expect(result.ok).toBe(false);
    expect(result.faults.join("\n")).toMatch(/METHOD_HASH_DRIFT: fixture-rect-prism\.ts/);
  });

  it("FAILS on a method file no entry covers, and on an entry no file backs", () => {
    expect(check(manifestAt("empty.json", { methods: {} })).faults.join("\n")).toMatch(/METHOD_FILE_UNMANIFESTED/);
    const orphaned = { methods: { "FIXTURE_RECT_PRISM@1": entry, "WITHDRAWN@3": { file: "gone.ts", sha256 } } };
    expect(check(manifestAt("orphan.json", orphaned)).faults.join("\n")).toMatch(/METHOD_MANIFEST_ORPHAN: WITHDRAWN@3/);
  });

  it("refuses a file whose (rule id, version) cannot be read — never hashed under a guessed key", () => {
    const strayDir = path.join(root, "stray");
    mkdirSync(strayDir);
    writeFileSync(path.join(strayDir, "no-identity.ts"), "export const x = 1;\n");
    expect(buildManifest(strayDir).faults.join("\n")).toMatch(/METHOD_IDENTITY_UNREADABLE: no-identity\.ts/);
  });
});

/**
 * The landed-method guard the CI job runs against the pull request's base — the landed-migration
 * law applied to methods (identity.md §8: a method version bump is a governed event).
 */
describe("a landed (rule id, version) is immutable", () => {
  const base = { methods: { "FIXTURE_RECT_PRISM@1": entry } };

  it("passes when a new version is added beside the landed one", () => {
    const head = { methods: { ...base.methods, "FIXTURE_RECT_PRISM@2": { file: "fixture-rect-prism-2.ts", sha256: "a".repeat(64) } } };
    expect(manifestDrift(base, head)).toEqual([]);
  });

  it("fails when a landed entry's hash moved, or the entry vanished", () => {
    const mutated = { methods: { "FIXTURE_RECT_PRISM@1": { ...entry, sha256: "b".repeat(64) } } };
    expect(manifestDrift(base, mutated).join("\n")).toMatch(/METHOD_ENTRY_MUTATED: FIXTURE_RECT_PRISM@1/);
    expect(manifestDrift(base, { methods: {} }).join("\n")).toMatch(/METHOD_ENTRY_WITHDRAWN: FIXTURE_RECT_PRISM@1/);
  });
});

/** The real artifact: the committed manifest matches the tree the stage will hash. */
describe("the committed manifest", () => {
  it("matches src/core/methods/ as shipped", () => {
    const cwd = process.cwd();
    const result = checkMethodHashes({
      methodsDir: path.join(cwd, "src/core/methods"),
      manifestPath: path.join(cwd, "src/core/methods.manifest.json"),
    });
    expect(result).toEqual({ ok: true, faults: [] });
    expect(JSON.parse(readFileSync(path.join(cwd, "src/core/methods.manifest.json"), "utf8")).methods).toBeTruthy();
  });
});
