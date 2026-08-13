#!/usr/bin/env node
/**
 * `pnpm reland` — bring open PRs forward onto main, so nobody has to be awake to do it.
 *
 * The problem it exists for, measured on the first parallel wave (2026-08-13,
 * docs/specs/cloud-campaign.md §1): `main` requires the `parity` check with `strict: true`, so
 * the instant PR n merges, PRs n+1..9 are out of date and cannot merge. Every session had
 * already run `pnpm land` and EXITED. There was no non-author party able to bring a PR forward,
 * so nine merges took 72 minutes of a human clicking, and the only way to go faster was to argue
 * sessions out of their own instructions.
 *
 * A merge queue would remove the whole problem. It is not available here: `merge_queue` rulesets
 * are rejected on this repository (422, "Invalid rule 'merge_queue'") because GitHub restricts
 * merge queues to organization-owned repositories and `vextrus/vextrus` is user-owned. Verified
 * 2026-08-13 by probe, alongside a plain ruleset that was accepted and deleted — so this is
 * merge_queue specifically, not rulesets. Until the repo moves to an org, this script is the
 * mechanism.
 *
 * It uses GitHub's own update-branch endpoint rather than a local checkout: the merge happens on
 * GitHub, against the head GitHub resolved, and it MERGES (never rebases), which is ADR-0010's
 * rule. No checkout means no working tree to corrupt and no second writer.
 *
 * What it will not do:
 *   - resolve a conflict. A conflicted PR is reported and left exactly as it is. Resolving one
 *     here would make this a second doer, and ADR-0010 names the failure mode: resolving by
 *     discarding the other branch's work.
 *   - merge a PR. Landing is a non-author act, and so is this — but this is not landing.
 *
 * Usage:  node scripts/reland.mjs [--dry-run] [--pr N]
 * exit 0  nothing to do, or every update accepted
 * exit 1  gh missing or not authenticated
 * exit 2  at least one PR needs a human or a session (conflict, or an update GitHub refused)
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * The whole policy, pure: what to do about one PR, from the state GitHub reports.
 *
 * `mergeStateStatus` values GitHub emits: BEHIND, BLOCKED, CLEAN, DIRTY, DRAFT, HAS_HOOKS,
 * UNKNOWN, UNSTABLE.
 */
export function classify(pr) {
  if (pr.isDraft) return { action: "skip", reason: "draft" };
  switch (pr.mergeStateStatus) {
    case "BEHIND":
      // The case this exists for: mergeable, but not on top of main's tip.
      return { action: "update", reason: "behind main" };
    case "DIRTY":
      return {
        action: "conflict",
        reason: "conflicts with main — a session must resolve it on the branch; this script never does",
      };
    case "UNKNOWN":
      // GitHub computes mergeability lazily. Not a fault, and not something to act on blind.
      return { action: "skip", reason: "GitHub has not computed mergeability yet — re-run" };
    case "BLOCKED":
      // Up to date; a required check is pending, failing, or a review is missing. Updating the
      // branch would restart CI for no reason and hide the real reason it is blocked.
      return { action: "skip", reason: "up to date, blocked on a check or review" };
    case "UNSTABLE":
      return { action: "skip", reason: "up to date, a non-required check is failing" };
    case "CLEAN":
      return { action: "skip", reason: "up to date and mergeable" };
    default:
      return { action: "skip", reason: `unhandled state ${pr.mergeStateStatus}` };
  }
}

/** Report shape, pure — so the summary is testable without a network. */
export function summarize(results) {
  const counts = { updated: 0, conflict: 0, skipped: 0, failed: 0 };
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  return counts;
}

// ---- CLI ----------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const only = args.indexOf("--pr") >= 0 ? Number(args[args.indexOf("--pr") + 1]) : null;

  const gh = (ghArgs) => {
    const r = spawnSync("gh", ghArgs, { encoding: "utf8" });
    return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
  };

  const who = gh(["auth", "status"]);
  if (!who.ok) {
    console.error("reland: the gh CLI is missing or not authenticated.");
    console.error("reland: install it and run `gh auth login` — this script talks to GitHub, not to a checkout.");
    process.exit(1);
  }

  const list = gh([
    "pr", "list", "--state", "open", "--limit", "50",
    "--json", "number,title,headRefName,headRefOid,mergeStateStatus,isDraft",
  ]);
  if (!list.ok) {
    console.error(`reland: could not list pull requests — ${list.err || list.out}`);
    process.exit(1);
  }

  let prs = JSON.parse(list.out || "[]");
  if (only !== null) prs = prs.filter((p) => p.number === only);
  if (prs.length === 0) {
    console.log("reland: no open pull requests.");
    process.exit(0);
  }

  const results = [];
  for (const pr of prs) {
    const { action, reason } = classify(pr);
    const label = `#${pr.number} ${pr.headRefName}`;

    if (action === "skip") {
      console.log(`  ${label}: ${reason}`);
      results.push({ pr: pr.number, outcome: "skipped" });
      continue;
    }
    if (action === "conflict") {
      console.error(`  ${label}: CONFLICT — ${reason}`);
      results.push({ pr: pr.number, outcome: "conflict" });
      continue;
    }
    if (dryRun) {
      console.log(`  ${label}: would update (${reason})`);
      results.push({ pr: pr.number, outcome: "skipped" });
      continue;
    }

    // expected_head_sha is optimistic concurrency: if the branch moved since the listing — a
    // session still working on it, or a concurrent reland — GitHub refuses rather than merging
    // into a head we never looked at.
    const upd = gh([
      "api", "-X", "PUT", `repos/{owner}/{repo}/pulls/${pr.number}/update-branch`,
      "-f", `expected_head_sha=${pr.headRefOid}`,
    ]);
    if (upd.ok) {
      console.log(`  ${label}: updated onto main — CI re-runs on the new head`);
      results.push({ pr: pr.number, outcome: "updated" });
    } else {
      console.error(`  ${label}: update refused by GitHub — ${upd.err || upd.out}`);
      results.push({ pr: pr.number, outcome: "failed" });
    }
  }

  const counts = summarize(results);
  console.log(
    `\nreland: ${counts.updated} updated, ${counts.conflict} conflicted, ` +
      `${counts.failed} refused, ${counts.skipped} left alone.`,
  );
  if (counts.conflict > 0) {
    console.error("reland: a conflicted PR needs a session on its branch — this script never resolves one.");
  }
  process.exit(counts.conflict + counts.failed > 0 ? 2 : 0);
}
