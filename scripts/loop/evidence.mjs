/**
 * evidence.mjs — where a run's log lives so it outlives the machine.
 *
 * `.loop/` is per-container scratch and dies with the container that wrote it — which is why
 * every cap in `docs/specs/cloud-campaign.md` cited a log nobody could produce, and why 6.2's
 * "distribution over ≥10 closes" was unsatisfiable by construction: closes 1–9 were gone before
 * close 10 happened (`.wayfinder/harness/inbox/the-loop-log-does-not-survive-the-container.md`).
 *
 * The ruling: the conductor's last act copies the run's `log.jsonl` into the effort's committed
 * log directory, `.wayfinder/<effort>/log/<run-id>.jsonl`, and commits that one file. File per
 * run, named by the run id — two machines, or twenty, never write the same path, so this does
 * not reintroduce the append-conflict class that §8.1 killed. The conductor writes it, never the
 * worker: a worker's row is a claim, a conductor's row is evidence (doer ≠ judge, ADR-0008).
 * `.loop/` itself stays untracked — the pre-push guard's scoping depends on that.
 */

/**
 * The committed destination for a run's log, derived from the ticket directory the campaign was
 * dispatched against. Pure. Returns a repo-relative POSIX path, or null when the ticket
 * directory is not under `.wayfinder/` (a scratch run has no effort to bank evidence in — the
 * caller skips the export and says so rather than inventing a home).
 */
export function effortLogFile(ticketDir, runId) {
  const parts = String(ticketDir)
    .replaceAll("\\", "/")
    .split("/")
    .filter((p) => p !== "" && p !== ".");
  const i = parts.indexOf(".wayfinder");
  if (i === -1 || parts.length < i + 2) return null;
  return [...parts.slice(i, i + 2), "log", `${runId}.jsonl`].join("/");
}
