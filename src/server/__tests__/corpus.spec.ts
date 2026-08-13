import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph";
import {
  CORPUS_ENV,
  LaneRefusal,
  WORK_DIRNAME,
  assertOutsideRepo,
  census,
  containedBy,
  findRepoRoot,
  renderReport,
  resolveCorpusRoot,
} from "../corpus";

/**
 * The private corpus lane's guard must FAIL CLOSED, in the same shape as
 * `src/__tests__/boundaries.spec.ts`: the whole value of this lane is that
 * "competitor data never enters this repo" (CLAUDE.md) is mechanical rather
 * than remembered, so a guard that quietly stops firing must go red here.
 *
 * The lane itself is deliberately NOT exercised against a real corpus — there
 * is none in any container, by construction — and never runs as a verify or CI
 * stage. The last test in this file proves that by reading those files.
 */

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const fixtures = path.join(repoRoot, "cad/tests/fixtures");

const graph: EntityGraph = entityGraphSchema.parse(
  JSON.parse(readFileSync(path.join(fixtures, "structural-r1.entitygraph.json"), "utf-8")),
);

const scratch = () => mkdtemp(path.join(tmpdir(), "vextrus-corpus-"));

/** The extractor seam, stubbed: the lane's report path is what is under test,
 *  and a `uv` subprocess in `pnpm verify` would be a second contract. */
const stubIngest =
  (result: EntityGraph | Error) =>
  async (_drawing: string, outPath: string): Promise<EntityGraph> => {
    if (result instanceof Error) throw result;
    await writeFile(outPath, JSON.stringify(result), "utf-8");
    return result;
  };

describe("the containment guard", () => {
  it("locates the repo root from inside the tree", async () => {
    expect(await findRepoRoot(import.meta.dirname)).toBe(await realish(repoRoot));
  });

  it("refuses a corpus that resolves inside the repo", async () => {
    await expect(assertOutsideRepo(path.join(repoRoot, "cad"))).rejects.toMatchObject({
      cause: "CORPUS_ROOT_INSIDE_REPO",
    });
  });

  it("refuses the repo root itself", async () => {
    await expect(assertOutsideRepo(repoRoot)).rejects.toMatchObject({
      cause: "CORPUS_ROOT_INSIDE_REPO",
    });
  });

  it("refuses a corpus that CONTAINS the repo", async () => {
    await expect(assertOutsideRepo(path.dirname(repoRoot))).rejects.toMatchObject({
      cause: "REPO_INSIDE_CORPUS_ROOT",
    });
  });

  it("refuses a symlink that points into the repo", async () => {
    const dir = await scratch();
    const link = path.join(dir, "corpus");
    await symlink(path.join(repoRoot, "cad"), link, "dir");
    // The realpath is what decides: a link is exactly how a path lands inside
    // the tree while looking like it does not.
    await expect(assertOutsideRepo(link)).rejects.toMatchObject({
      cause: "CORPUS_ROOT_INSIDE_REPO",
    });
  });

  it("admits a directory outside the repo", async () => {
    const dir = await scratch();
    await expect(assertOutsideRepo(dir)).resolves.toBe(await realish(dir));
  });

  it("refuses when the repo root cannot be located at all", async () => {
    const dir = await scratch();
    // A tree with no marker pair above it: containment is unprovable, so the
    // lane refuses rather than assume it is outside.
    await expect(findRepoRoot(dir)).rejects.toMatchObject({
      cause: "REPO_ROOT_UNLOCATABLE",
    });
  });

  it("containedBy is reflexive and directional", () => {
    expect(containedBy("/a/b", "/a/b")).toBe(true);
    expect(containedBy("/a/b", "/a/b/c")).toBe(true);
    expect(containedBy("/a/b", "/a/bc")).toBe(false);
    expect(containedBy("/a/b/c", "/a/b")).toBe(false);
  });
});

describe("resolving the corpus root", () => {
  it("refuses when the env var is unset or blank", async () => {
    await expect(resolveCorpusRoot({})).rejects.toMatchObject({ cause: "CORPUS_ROOT_UNSET" });
    await expect(resolveCorpusRoot({ [CORPUS_ENV]: "   " })).rejects.toMatchObject({
      cause: "CORPUS_ROOT_UNSET",
    });
  });

  it("refuses a path that does not exist — never an empty corpus", async () => {
    const missing = path.join(await scratch(), "no-such-corpus");
    await expect(resolveCorpusRoot({ [CORPUS_ENV]: missing })).rejects.toMatchObject({
      cause: "CORPUS_ROOT_MISSING",
    });
  });

  it("refuses a file where a directory is named", async () => {
    const file = path.join(await scratch(), "sheet.dxf");
    await writeFile(file, "not a directory", "utf-8");
    await expect(resolveCorpusRoot({ [CORPUS_ENV]: file })).rejects.toMatchObject({
      cause: "CORPUS_ROOT_NOT_A_DIRECTORY",
    });
  });

  it("refuses a corpus inside the repo through the env var", async () => {
    await expect(
      resolveCorpusRoot({ [CORPUS_ENV]: path.join(repoRoot, "cad/tests/fixtures") }),
    ).rejects.toBeInstanceOf(LaneRefusal);
  });

  it("admits a directory outside the repo", async () => {
    const dir = await scratch();
    await expect(resolveCorpusRoot({ [CORPUS_ENV]: dir })).resolves.toBe(await realish(dir));
  });
});

describe("the census", () => {
  it("refuses to run against a root inside the repo", async () => {
    await expect(census(path.join(repoRoot, "cad"))).rejects.toMatchObject({
      cause: "CORPUS_ROOT_INSIDE_REPO",
    });
  });

  it("refuses to write its artifacts into the tree", async () => {
    const dir = await scratch();
    await writeFile(path.join(dir, "sheet.dxf"), "x", "utf-8");
    await expect(
      census(dir, { workDir: path.join(repoRoot, ".corpus-work"), ingest: stubIngest(graph) }),
    ).rejects.toMatchObject({ cause: "CORPUS_ROOT_INSIDE_REPO" });
  });

  it("reports every stage of a DXF, and writes the artifact outside the tree", async () => {
    const dir = await scratch();
    await writeFile(path.join(dir, "sheet.dxf"), "a drawing the stub reads", "utf-8");
    const report = await census(dir, {
      ingest: stubIngest(graph),
      now: () => new Date("2026-08-13T00:00:00Z"),
    });

    expect(report.totals.measured).toBe(1);
    expect(report.totals.originals).toBe(graph.counters.original);
    const [outcome] = report.outcomes;
    if (outcome?.status !== "measured") throw new Error("expected a measured outcome");
    expect(outcome.file).toBe("sheet.dxf");
    expect(outcome.sha256).toBe(graph.source.sha256);
    // The three stages the pipeline owns today all answered — the report's job
    // is to say which of them a real drawing breaks.
    expect(outcome.views.ok && outcome.views.value.countableViews).toBeGreaterThan(0);
    expect(outcome.views.ok && outcome.views.value.handlesByType["layout_plan"]).toBeGreaterThan(0);
    expect(outcome.grid.ok && outcome.grid.value.backbones).toBeGreaterThan(0);
    expect(outcome.placement.ok && outcome.placement.value.instances).toBeGreaterThan(0);
    expect(report.totals.viewsByType["layout_plan"]).toBeGreaterThan(0);
    expect(Object.keys(report.totals.dispositionsByCode).length).toBeGreaterThan(0);

    // The only bytes this lane writes live beside the corpus, never in the tree.
    const artifacts = await readdirNames(path.join(dir, WORK_DIRNAME));
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatch(/^[0-9a-f]{16}\.entitygraph\.json$/);
  });

  it("names a refusal for every file it does not read", async () => {
    const dir = await scratch();
    await writeFile(path.join(dir, "plan.dwg"), "", "utf-8");
    await writeFile(path.join(dir, "sheet.pdf"), "", "utf-8");
    await writeFile(path.join(dir, "boq.xlsx"), "", "utf-8");
    await writeFile(path.join(dir, "notes.txt"), "", "utf-8");
    await mkdir(path.join(dir, "sub"), { recursive: true });
    await symlink(path.join(dir, "plan.dwg"), path.join(dir, "sub", "link.dxf"));

    const report = await census(dir, { ingest: stubIngest(graph) });

    expect(report.totals.measured).toBe(0);
    expect(report.totals.refusalsByCause).toEqual({
      FORMAT_NOT_IMPLEMENTED: 2,
      NOT_A_DRAWING: 1,
      SYMLINK_NOT_FOLLOWED: 1,
      UNRECOGNISED_EXTENSION: 1,
    });
    // Every refusal carries a reason — silence is the only condemned state.
    for (const outcome of report.outcomes) {
      if (outcome.status !== "refused") throw new Error("expected refusals only");
      expect(outcome.message.length).toBeGreaterThan(0);
    }
    // The workbook is not corpus: it is a yardstick, and the lane says so
    // rather than reading it (quantity-contract.md §5).
    const boq = report.outcomes.find((o) => o.file === "boq.xlsx");
    expect(boq?.status === "refused" && boq.message).toContain("yardstick");
  });

  it("turns an extractor refusal into a row, never a crashed run", async () => {
    const dir = await scratch();
    await writeFile(path.join(dir, "broken.dxf"), "", "utf-8");
    const report = await census(dir, {
      ingest: stubIngest(new Error("cad ingest failed: malformed geometry")),
    });
    expect(report.totals.refusalsByCause).toEqual({ EXTRACTOR_REFUSED: 1 });
    expect(report.outcomes[0]?.status).toBe("refused");
  });

  it("renders a report that says it is neither a gate nor a fixture", async () => {
    const dir = await scratch();
    await writeFile(path.join(dir, "sheet.dxf"), "", "utf-8");
    const text = renderReport(await census(dir, { ingest: stubIngest(graph) }));
    expect(text).toContain("not a gate");
    expect(text).toContain("may be committed");
    expect(text).toContain("Placement dispositions by code");
  });
});

describe("the lane never gates", () => {
  /**
   * `pnpm verify`'s exit code is the contract (ADR-0007) and CI runs the
   * provisioner's drill — neither may ever depend on a corpus that exists on
   * exactly one machine. Read the files rather than trust the intent.
   */
  it("appears in no verify stage and no CI workflow", async () => {
    const verify = await readFile(path.join(repoRoot, "scripts/verify.mjs"), "utf-8");
    expect(verify).not.toContain("corpus");
    const ci = await readFile(path.join(repoRoot, ".github/workflows/ci.yml"), "utf-8");
    expect(ci).not.toContain("corpus");
    const parity = await readFile(path.join(repoRoot, "scripts/parity.sh"), "utf-8");
    expect(parity).not.toContain("corpus");
  });

  it("is reachable as `pnpm corpus`, and only that", async () => {
    const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.corpus).toBe("tsx src/server/corpus-main.ts");
    const invokers = Object.entries(pkg.scripts).filter(
      ([name, cmd]) => name !== "corpus" && cmd.includes("corpus"),
    );
    expect(invokers).toEqual([]);
  });
});

async function realish(p: string): Promise<string> {
  const { realpath } = await import("node:fs/promises");
  return realpath(p);
}

async function readdirNames(dir: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(dir)).sort();
}
