import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CORPUS_ENV,
  LaneRefusal,
  assertOutsideRepo,
  census,
  renderReport,
  resolveCorpusRoot,
} from "./corpus";

/**
 * `pnpm corpus` — the private corpus lane's entry point (ticket 08).
 *
 *   VEXTRUS_PRIVATE_CORPUS=V:\repos\edison-dwg-boq pnpm corpus [--json] [-o <path>]
 *
 * A separate file from `corpus.ts` for the reason `worker-main.ts` is separate
 * from `worker.ts`: importing the lane (its tests, anything else) must never
 * read a drawing as a side effect.
 *
 * Exit codes are the honest ones: **0 when the census ran**, however many
 * drawings refused inside it — a refusal is the report's content, not the run's
 * failure — and **2 when the lane itself refused**, which is the guard firing.
 * Nothing in `pnpm verify` or CI invokes this; `__tests__/corpus.spec.ts` reads
 * both files and proves it.
 */

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const outFlag = argv.indexOf("-o");
const outArg = outFlag === -1 ? argv.indexOf("--out") : outFlag;
const outValue = outArg === -1 ? undefined : argv[outArg + 1];

if (outArg !== -1 && (outValue === undefined || outValue.startsWith("-"))) {
  console.error("corpus: -o/--out needs a path");
  process.exit(2);
}
const outPath: string | null = outValue ?? null;

try {
  const root = await resolveCorpusRoot();
  const report = await census(root);
  const body = asJson ? JSON.stringify(report, null, 2) + "\n" : renderReport(report);
  if (outPath === null) {
    process.stdout.write(body);
  } else {
    // The report names the corpus's own files, so it is corpus-derived and
    // obeys the same containment rule as the drawings themselves: the guard
    // runs on the *directory* it would be written into, because the file
    // itself need not exist yet.
    const dir = path.resolve(path.dirname(outPath));
    await assertOutsideRepo(dir);
    await writeFile(path.resolve(outPath), body, "utf-8");
    console.error(`corpus: report written to ${path.resolve(outPath)}`);
  }
  console.error(
    `corpus: ${report.totals.measured} measured, ${report.totals.refused} refused, ` +
      `${report.totals.originals} original entities. This report is not a gate; nothing in it ` +
      `may be committed.`,
  );
} catch (err) {
  if (err instanceof LaneRefusal) {
    console.error(`corpus: refused (${err.cause})\ncorpus: ${err.message}`);
    process.exit(2);
  }
  console.error(`corpus: ${(err as Error).stack ?? String(err)}`);
  console.error(
    `corpus: this is a lane defect, not a drawing's refusal — a drawing's refusal is a row in ` +
      `the report. Set ${CORPUS_ENV} and re-run once it is fixed.`,
  );
  process.exit(2);
}
