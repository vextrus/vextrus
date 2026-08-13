import { createHash } from "node:crypto";
import { mkdir, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { EntityGraph } from "@/core/entitygraph";
import {
  georeferenceGrid,
  mayYieldInstances,
  partitionViews,
  placeInstances,
  runCadIngest,
  type GridBackbone,
  type ViewPartition,
  type ViewPlacement,
} from "@/modules/takeoff";

/**
 * The private corpus lane (.wayfinder/takeoff ticket 08). A real drawing set
 * hardens the extractor **without a single byte entering this repo**.
 *
 * `CLAUDE.md` is unqualified: competitor and client drawings are "never in this
 * repo". This lane does not soften that — it makes softening unnecessary. It
 * reads a corpus from a directory named by `VEXTRUS_PRIVATE_CORPUS`, runs the
 * pipeline over it, and emits a *report*: counts, counters, refusals, view
 * partition outcomes. What crosses back into the tree is the **defect class**,
 * reproduced synthetically in the torture corpus — never a fixture, never a
 * drawing, never a filename.
 *
 * Three properties are mechanical, not prose:
 *
 * 1. **It refuses if the corpus resolves inside the repo** — and refuses just
 *    as hard if it cannot *locate* the repo to compare against. Unprovable
 *    containment is a refusal, in the shape `src/__tests__/boundaries.spec.ts`
 *    established: a guard that stops firing must go red, never quiet.
 * 2. **It writes nothing into the tree.** Every path it writes — the per-file
 *    artifact, the report — passes the same containment guard.
 * 3. **It never gates.** It is in no `pnpm verify` stage and no CI job
 *    (`corpus.spec.ts` proves both by reading those files). Per-drawing
 *    refusals are the *content* of the report, not a failure of the run: the
 *    lane exits non-zero only when the lane itself could not run.
 *
 * These sessions run in Linux cloud containers that cannot reach the CEO's
 * `V:\`, so the lane is **local-machine-only by construction** — which is the
 * feature, not the limitation. No cloud container ever holds those files.
 *
 * Everything below the guard is pure reporting over the existing pipeline
 * stages; the lane owns no measurement of its own and originates no quantity.
 */

// ── The guard ───────────────────────────────────────────────────────────────

/** Why the *lane* refused to run. Distinct from a per-drawing refusal: these
 *  end the run, and every one of them is a fail-closed answer to "can I prove
 *  this is outside the tree?". */
export const laneRefusalCauses = [
  "CORPUS_ROOT_UNSET",
  "CORPUS_ROOT_MISSING",
  "CORPUS_ROOT_NOT_A_DIRECTORY",
  "CORPUS_ROOT_INSIDE_REPO",
  "REPO_INSIDE_CORPUS_ROOT",
  "REPO_ROOT_UNLOCATABLE",
] as const;
export type LaneRefusalCause = (typeof laneRefusalCauses)[number];

export class LaneRefusal extends Error {
  readonly cause: LaneRefusalCause;
  constructor(cause: LaneRefusalCause, message: string) {
    super(message);
    this.name = "LaneRefusal";
    this.cause = cause;
  }
}

/** The env var naming the corpus. One name, read in one place. */
export const CORPUS_ENV = "VEXTRUS_PRIVATE_CORPUS";

/** A repo root is a directory carrying BOTH markers. Two, because either alone
 *  is a plausible thing to find in a corpus directory, and a false negative
 *  here is the failure that matters. */
const REPO_MARKERS = ["CLAUDE.md", "package.json"] as const;

async function isRepoRoot(dir: string): Promise<boolean> {
  const found = await Promise.all(
    REPO_MARKERS.map((m) =>
      realpath(path.join(dir, m)).then(
        () => true,
        () => false,
      ),
    ),
  );
  return found.every(Boolean);
}

/**
 * Walk up from `from` to the repo root. Never guesses: a tree with no marker
 * pair above it yields the named refusal, because a lane that cannot say where
 * the repo is cannot say a path is outside it.
 */
export async function findRepoRoot(from = import.meta.dirname): Promise<string> {
  let dir = await realpath(from).catch(() => path.resolve(from));
  for (;;) {
    if (await isRepoRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new LaneRefusal(
        "REPO_ROOT_UNLOCATABLE",
        `no directory at or above ${from} carries ${REPO_MARKERS.join(" + ")}, so this lane ` +
          `cannot prove a path lies outside the repo. It refuses rather than assume.`,
      );
    }
    dir = parent;
  }
}

/** Case-fold on the platforms whose paths are case-insensitive; `V:\Repos` and
 *  `v:\repos` are one directory on the machine this lane runs on. */
const fold = (p: string): string => (path.sep === "\\" ? p.toLowerCase() : p);

/** True when `inner` is `outer` or sits beneath it. Both must already be
 *  realpath-resolved — a symlink is exactly how a path lands inside the tree
 *  while looking like it does not. */
export function containedBy(outer: string, inner: string): boolean {
  const rel = path.relative(fold(outer), fold(inner));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Resolve `target` through symlinks as far as it exists, then re-attach the
 * segments that do not exist yet. A path is guarded **before** anything is
 * created at it — a guard that fires after `mkdir` has already written the
 * directory into the tree has failed at its one job.
 */
async function resolveEvenIfAbsent(target: string): Promise<string> {
  let existing = path.resolve(target);
  const rest: string[] = [];
  for (;;) {
    const real = await realpath(existing).catch(() => null);
    if (real !== null) return path.join(real, ...rest.reverse());
    const parent = path.dirname(existing);
    if (parent === existing) return path.resolve(target);
    rest.push(path.basename(existing));
    existing = parent;
  }
}

/**
 * Refuse unless `target` resolves outside the repo — whether or not it exists
 * yet. Overlap in *either* direction refuses: a corpus that contains the repo
 * would walk our own tree as if it were drawings.
 */
export async function assertOutsideRepo(target: string, repo?: string): Promise<string> {
  const root = repo ?? (await findRepoRoot());
  const resolved = await resolveEvenIfAbsent(target);
  if (containedBy(root, resolved)) {
    throw new LaneRefusal(
      "CORPUS_ROOT_INSIDE_REPO",
      `${resolved} resolves inside the repo at ${root}. Competitor and client data never enter ` +
        `this repo (CLAUDE.md); this lane exists so that rule never has to bend.`,
    );
  }
  if (containedBy(resolved, root)) {
    throw new LaneRefusal(
      "REPO_INSIDE_CORPUS_ROOT",
      `the repo at ${root} sits inside ${resolved}, so this lane would read its own tree as ` +
        `corpus. Name a directory that does not contain the repo.`,
    );
  }
  return resolved;
}

/**
 * The corpus root, or a named refusal. The *only* reader of `CORPUS_ENV`.
 * A path that does not exist refuses by name rather than reporting an empty
 * corpus: zero drawings and no corpus are different facts, and reporting the
 * second as the first is the silence the governing sentence condemns.
 */
export async function resolveCorpusRoot(
  env: Record<string, string | undefined> = process.env,
  repo?: string,
): Promise<string> {
  const raw = env[CORPUS_ENV]?.trim();
  if (raw === undefined || raw === "") {
    throw new LaneRefusal(
      "CORPUS_ROOT_UNSET",
      `${CORPUS_ENV} is unset. Point it at the corpus directory — which must live outside the ` +
        `repo tree, on a local machine (no cloud container ever holds those files).`,
    );
  }
  const root = await assertOutsideRepo(raw, repo);
  if ((await stat(root).catch(() => null)) === null) {
    throw new LaneRefusal(
      "CORPUS_ROOT_MISSING",
      `${CORPUS_ENV} names ${raw}, which does not exist on this machine. A corpus that is not ` +
        `there is not an empty corpus — this lane runs on the machine that holds the drawings.`,
    );
  }
  if ((await readdir(root, { withFileTypes: true }).catch(() => null)) === null) {
    throw new LaneRefusal(
      "CORPUS_ROOT_NOT_A_DIRECTORY",
      `${CORPUS_ENV} names ${root}, which is not a readable directory.`,
    );
  }
  return root;
}

// ── The census ──────────────────────────────────────────────────────────────

/** Why one file yielded no measurement. A refusal always carries a reason. */
export const drawingRefusalCauses = [
  "FORMAT_NOT_IMPLEMENTED",
  "NOT_A_DRAWING",
  "EXTRACTOR_REFUSED",
  "SYMLINK_NOT_FOLLOWED",
  "UNRECOGNISED_EXTENSION",
] as const;
export type DrawingRefusalCause = (typeof drawingRefusalCauses)[number];

/** A stage either summarised, or said why it could not. A throw from a stage is
 *  the single most valuable thing a real corpus produces, so it is captured and
 *  reported rather than allowed to end the run. */
export type Stage<T> = { ok: true; value: T } | { ok: false; message: string };

export type ViewSummary = {
  originalCount: number;
  byType: Record<string, number>;
  countableViews: number;
  /** Original handles owned per view type — the orphan bucket's row is the
   *  honest-absence number, read from the data rather than named here (the view
   *  law's single decision site, `view-law.spec.ts`). */
  handlesByType: Record<string, number>;
  reasonsByCode: Record<string, number>;
};

export type GridSummary = {
  backbones: number;
  withSpacing: number;
  deferralsByCause: Record<string, number>;
};

export type PlacementSummary = {
  instances: number;
  dispositionsByCode: Record<string, number>;
  deferrals: number;
};

export type DrawingOutcome =
  | {
      file: string;
      status: "measured";
      sha256: string;
      units: { insunits: number | null; detected: string | null; unmapped: boolean };
      counters: {
        original: number;
        derived: number;
        explodeTruncated: boolean;
        lostByType: Record<string, number>;
        unsupportedByType: Record<string, number>;
      };
      originalsByType: Record<string, number>;
      views: Stage<ViewSummary>;
      grid: Stage<GridSummary>;
      placement: Stage<PlacementSummary>;
    }
  | { file: string; status: "refused"; cause: DrawingRefusalCause; message: string };

export type CorpusReport = {
  /** Absolute, and printed only on the machine that holds the corpus. */
  root: string;
  generatedAt: string;
  candidates: number;
  outcomes: DrawingOutcome[];
  totals: {
    measured: number;
    refused: number;
    originals: number;
    derived: number;
    truncatedDrawings: number;
    lostByType: Record<string, number>;
    unsupportedByType: Record<string, number>;
    refusalsByCause: Record<string, number>;
    viewsByType: Record<string, number>;
    viewReasonsByCode: Record<string, number>;
    gridDeferralsByCause: Record<string, number>;
    dispositionsByCode: Record<string, number>;
    stageFailures: Record<string, number>;
  };
};

/** The extractor reads DXF today. DWG and PDF are their own tickets, and until
 *  they land a file of that format is a *named* refusal — never a skipped line,
 *  never counted as zero entities. */
const EXTRACTABLE = new Set([".dxf"]);
const AWAITING_A_LANE = new Map([
  [".dwg", "DWG"],
  [".pdf", "PDF"],
]);
const WORKBOOKS = new Set([".xlsx", ".xlsm", ".xls", ".csv"]);

/** Where the lane parks per-file artifacts: inside the corpus, never the tree.
 *  Dot-prefixed so a re-run skips it as its own input. */
export const WORK_DIRNAME = ".vextrus-lane";

type Candidate = { abs: string; rel: string } | { rel: string; symlink: true };

async function walk(root: string, dir = root, out: Candidate[] = []): Promise<Candidate[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs);
    // Not followed, and said so: a link is exactly how a path leaves the
    // corpus without looking like it (§ the guard above).
    if (entry.isSymbolicLink()) {
      out.push({ rel, symlink: true });
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) continue;
      await walk(root, abs, out);
      continue;
    }
    if (entry.isFile()) out.push({ abs, rel });
  }
  return out;
}

const tally = (into: Record<string, number>, key: string, by = 1): void => {
  into[key] = (into[key] ?? 0) + by;
};

function sortedTally(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function stageOf<T>(run: () => T): Stage<T> {
  try {
    return { ok: true, value: run() };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

function summariseViews(partition: ViewPartition): ViewSummary {
  const byType: Record<string, number> = {};
  const reasonsByCode: Record<string, number> = {};
  const handlesByType: Record<string, number> = {};
  let countableViews = 0;
  for (const view of partition.views) {
    tally(byType, view.type);
    tally(handlesByType, view.type, view.handles.length);
    // The countability decision has exactly one site (cad-ingestion.md §7,
    // `view-law.spec.ts`) — the report reads it, it never re-states it.
    if (mayYieldInstances(view.type)) countableViews += 1;
    for (const reason of view.reasons) tally(reasonsByCode, reason.code);
  }
  return {
    originalCount: partition.originalCount,
    byType: sortedTally(byType),
    countableViews,
    handlesByType: sortedTally(handlesByType),
    reasonsByCode: sortedTally(reasonsByCode),
  };
}

function summariseGrid(backbones: GridBackbone[]): GridSummary {
  const deferralsByCause: Record<string, number> = {};
  let withSpacing = 0;
  for (const backbone of backbones) {
    if (backbone.minSpacing !== null) withSpacing += 1;
    if (backbone.deferral !== null) tally(deferralsByCause, backbone.deferral.cause);
  }
  return { backbones: backbones.length, withSpacing, deferralsByCause: sortedTally(deferralsByCause) };
}

function summarisePlacement(placements: ViewPlacement[]): PlacementSummary {
  const dispositionsByCode: Record<string, number> = {};
  let instances = 0;
  let deferrals = 0;
  for (const placement of placements) {
    instances += placement.instances.length;
    if (placement.deferral !== null) deferrals += 1;
    for (const d of placement.dispositions) tally(dispositionsByCode, d.code);
  }
  return { instances, dispositionsByCode: sortedTally(dispositionsByCode), deferrals };
}

function measure(file: string, graph: EntityGraph): DrawingOutcome {
  const originalsByType: Record<string, number> = {};
  for (const e of graph.entities) if (e.src === null) tally(originalsByType, e.t);

  const views = stageOf(() => partitionViews(graph));
  const grid = views.ok
    ? stageOf(() => georeferenceGrid(graph, views.value))
    : ({ ok: false, message: "not attempted: the view partition failed" } as Stage<GridBackbone[]>);
  const placement =
    views.ok && grid.ok
      ? stageOf(() => placeInstances(graph, views.value, grid.value))
      : ({ ok: false, message: "not attempted: an upstream stage failed" } as Stage<ViewPlacement[]>);

  return {
    file,
    status: "measured",
    sha256: graph.source.sha256,
    units: {
      insunits: graph.units.insunits,
      detected: graph.units.detected,
      unmapped: graph.units.insunits_unmapped,
    },
    counters: {
      original: graph.counters.original,
      derived: graph.counters.derived,
      explodeTruncated: graph.counters.explode_truncated,
      lostByType: graph.counters.lost_by_type,
      unsupportedByType: graph.counters.unsupported_by_type,
    },
    originalsByType: sortedTally(originalsByType),
    views: views.ok ? { ok: true, value: summariseViews(views.value) } : views,
    grid: grid.ok ? { ok: true, value: summariseGrid(grid.value) } : grid,
    placement: placement.ok ? { ok: true, value: summarisePlacement(placement.value) } : placement,
  };
}

/** The extractor seam, injectable so the lane's own tests exercise the whole
 *  report path with no subprocess (and so `pnpm verify` never runs `uv`). */
export type Ingest = (drawingPath: string, outPath: string) => Promise<EntityGraph>;

export type CensusOptions = {
  ingest?: Ingest;
  now?: () => Date;
  /** Where per-file artifacts land. Defaults inside the corpus; guarded either
   *  way, so an override cannot aim it at the tree. */
  workDir?: string;
};

/**
 * Run the pipeline over every candidate under `root` and report. Never throws
 * for a drawing: a file that refuses is a *row*, which is the whole point —
 * the corpus is here to tell us what real drawings do to us.
 */
export async function census(root: string, opts: CensusOptions = {}): Promise<CorpusReport> {
  const repo = await findRepoRoot();
  await assertOutsideRepo(root, repo);
  const ingest = opts.ingest ?? runCadIngest;
  const workDir = await assertOutsideRepo(opts.workDir ?? path.join(root, WORK_DIRNAME), repo);
  await mkdir(workDir, { recursive: true });

  const outcomes: DrawingOutcome[] = [];
  for (const candidate of await walk(root)) {
    if ("symlink" in candidate) {
      outcomes.push({
        file: candidate.rel,
        status: "refused",
        cause: "SYMLINK_NOT_FOLLOWED",
        message: "a symlink's target cannot be proven to sit outside the repo, so it is not read",
      });
      continue;
    }
    const ext = path.extname(candidate.rel).toLowerCase();
    const awaiting = AWAITING_A_LANE.get(ext);
    if (awaiting !== undefined) {
      outcomes.push({
        file: candidate.rel,
        status: "refused",
        cause: "FORMAT_NOT_IMPLEMENTED",
        message: `${awaiting} ingestion is not implemented — the extractor reads DXF. Converted to DXF, this file becomes corpus.`,
      });
      continue;
    }
    if (WORKBOOKS.has(ext)) {
      outcomes.push({
        file: candidate.rel,
        status: "refused",
        cause: "NOT_A_DRAWING",
        message:
          "a workbook is not corpus. A BOQ is a yardstick and belongs to the validation ledger " +
          "(quantity-contract.md §5), which this lane deliberately cannot touch — an input may " +
          "never be derived from the figure the gate it feeds compares against.",
      });
      continue;
    }
    if (!EXTRACTABLE.has(ext)) {
      outcomes.push({
        file: candidate.rel,
        status: "refused",
        cause: "UNRECOGNISED_EXTENSION",
        message: `no lane reads '${ext || "(no extension)"}'`,
      });
      continue;
    }
    // The artifact name is a hash of the relative path: stable across runs, and
    // it never reproduces the corpus's own directory names on disk.
    const stem = createHash("sha256").update(candidate.rel).digest("hex").slice(0, 16);
    const outPath = path.join(workDir, `${stem}.entitygraph.json`);
    try {
      outcomes.push(measure(candidate.rel, await ingest(candidate.abs, outPath)));
    } catch (err) {
      outcomes.push({
        file: candidate.rel,
        status: "refused",
        cause: "EXTRACTOR_REFUSED",
        message: (err as Error).message,
      });
    }
  }

  return {
    root,
    generatedAt: (opts.now?.() ?? new Date()).toISOString(),
    candidates: outcomes.length,
    outcomes,
    totals: totalsOf(outcomes),
  };
}

function totalsOf(outcomes: DrawingOutcome[]): CorpusReport["totals"] {
  const t = {
    measured: 0,
    refused: 0,
    originals: 0,
    derived: 0,
    truncatedDrawings: 0,
    lostByType: {} as Record<string, number>,
    unsupportedByType: {} as Record<string, number>,
    refusalsByCause: {} as Record<string, number>,
    viewsByType: {} as Record<string, number>,
    viewReasonsByCode: {} as Record<string, number>,
    gridDeferralsByCause: {} as Record<string, number>,
    dispositionsByCode: {} as Record<string, number>,
    stageFailures: {} as Record<string, number>,
  };
  for (const outcome of outcomes) {
    if (outcome.status === "refused") {
      t.refused += 1;
      tally(t.refusalsByCause, outcome.cause);
      continue;
    }
    t.measured += 1;
    t.originals += outcome.counters.original;
    t.derived += outcome.counters.derived;
    if (outcome.counters.explodeTruncated) t.truncatedDrawings += 1;
    for (const [k, n] of Object.entries(outcome.counters.lostByType)) tally(t.lostByType, k, n);
    for (const [k, n] of Object.entries(outcome.counters.unsupportedByType)) {
      tally(t.unsupportedByType, k, n);
    }
    if (outcome.views.ok) {
      for (const [k, n] of Object.entries(outcome.views.value.byType)) tally(t.viewsByType, k, n);
      for (const [k, n] of Object.entries(outcome.views.value.reasonsByCode)) {
        tally(t.viewReasonsByCode, k, n);
      }
    } else tally(t.stageFailures, "views");
    if (outcome.grid.ok) {
      for (const [k, n] of Object.entries(outcome.grid.value.deferralsByCause)) {
        tally(t.gridDeferralsByCause, k, n);
      }
    } else tally(t.stageFailures, "grid");
    if (outcome.placement.ok) {
      for (const [k, n] of Object.entries(outcome.placement.value.dispositionsByCode)) {
        tally(t.dispositionsByCode, k, n);
      }
    } else tally(t.stageFailures, "placement");
  }
  return {
    ...t,
    lostByType: sortedTally(t.lostByType),
    unsupportedByType: sortedTally(t.unsupportedByType),
    refusalsByCause: sortedTally(t.refusalsByCause),
    viewsByType: sortedTally(t.viewsByType),
    viewReasonsByCode: sortedTally(t.viewReasonsByCode),
    gridDeferralsByCause: sortedTally(t.gridDeferralsByCause),
    dispositionsByCode: sortedTally(t.dispositionsByCode),
    stageFailures: sortedTally(t.stageFailures),
  };
}

// ── The report ──────────────────────────────────────────────────────────────

const table = (counts: Record<string, number>): string => {
  const rows = Object.entries(counts);
  if (rows.length === 0) return "  (none)\n";
  return rows.map(([k, n]) => `  ${k}: ${n}`).join("\n") + "\n";
};

/**
 * Markdown, for a human. Deliberately not a fixture and not a gate input: it
 * carries counts and reason codes, and the *lesson* it teaches is reproduced
 * synthetically before any of it reaches the tree.
 */
export function renderReport(report: CorpusReport): string {
  const t = report.totals;
  const out: string[] = [
    `# Private corpus census`,
    ``,
    `Corpus: ${report.root}`,
    `Generated: ${report.generatedAt}`,
    `Candidates: ${report.candidates} — measured ${t.measured}, refused ${t.refused}`,
    ``,
    `> This report is not a gate and never becomes a fixture. Nothing here may be committed;`,
    `> what crosses back into the repo is the defect *class*, rebuilt synthetically.`,
    ``,
    `## Totals`,
    ``,
    `Original entities: ${t.originals} · derived: ${t.derived} · drawings whose explode truncated: ${t.truncatedDrawings}`,
    ``,
    `Unsupported by type (the extractor's honest vocabulary gap):`,
    table(t.unsupportedByType),
    `Lost by type (a cap that tripped):`,
    table(t.lostByType),
    `Refusals by cause:`,
    table(t.refusalsByCause),
    `Views by type:`,
    table(t.viewsByType),
    `View reasons by code:`,
    table(t.viewReasonsByCode),
    `Grid deferrals by cause:`,
    table(t.gridDeferralsByCause),
    `Placement dispositions by code:`,
    table(t.dispositionsByCode),
    `Stage failures (a stage that threw on a real drawing — the highest-value row here):`,
    table(t.stageFailures),
    `## Per drawing`,
    ``,
  ];
  for (const o of report.outcomes) {
    if (o.status === "refused") {
      out.push(`### ${o.file} — REFUSED (${o.cause})`, ``, o.message, ``);
      continue;
    }
    const units = o.units.unmapped
      ? `$INSUNITS ${o.units.insunits} UNMAPPED`
      : `${o.units.detected ?? "no $INSUNITS"}`;
    out.push(
      `### ${o.file}`,
      ``,
      `sha256 ${o.sha256}`,
      `units: ${units}`,
      `originals ${o.counters.original} · derived ${o.counters.derived} · truncated ${o.counters.explodeTruncated}`,
      ``,
      `Originals by type:`,
      table(o.originalsByType),
    );
    if (o.counters.unsupportedByType && Object.keys(o.counters.unsupportedByType).length > 0) {
      out.push(`Unsupported by type:`, table(o.counters.unsupportedByType));
    }
    out.push(
      o.views.ok
        ? `Views: ${Object.values(o.views.value.byType).reduce((a, b) => a + b, 0)} over ${o.views.value.originalCount} originals · countable ${o.views.value.countableViews}\n` +
            table(o.views.value.byType) +
            `Originals owned per view type:\n` +
            table(o.views.value.handlesByType)
        : `Views: STAGE FAILED — ${o.views.message}\n`,
      o.grid.ok
        ? `Grid: ${o.grid.value.backbones} backbones, ${o.grid.value.withSpacing} with a spacing\n` +
            table(o.grid.value.deferralsByCause)
        : `Grid: STAGE FAILED — ${o.grid.message}\n`,
      o.placement.ok
        ? `Placement: ${o.placement.value.instances} instances, ${o.placement.value.deferrals} deferred views\n` +
            table(o.placement.value.dispositionsByCode)
        : `Placement: STAGE FAILED — ${o.placement.message}\n`,
    );
  }
  return out.join("\n");
}
