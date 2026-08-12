#!/usr/bin/env node
/**
 * `pnpm land` — a session's last act (ADR-0010), as one command.
 *
 *     git fetch origin main -> merge -> pnpm verify -> git push
 *
 * The rule was already written down and already correct; what it lacked was a
 * mechanism. Six remembered steps in a fixed order, at the end of a long
 * session, with three ways to be subtly wrong — rebase instead of merge (which
 * invalidates the verify that justified the commits), verify before the merge
 * instead of after (which proves the wrong tree), push a red tree (which hands
 * the next session a broken `main` to merge) — is a rule that will be followed
 * most of the time. Most of the time is what the harness effort exists to end.
 *
 * It refuses rather than repairs, and every refusal names its own repair: a
 * dirty tree, a conflicted merge and a red verify are all a session's work to
 * finish, and doing any of them here would be this script deciding what the
 * session meant.
 *
 * Node, not bash: this also runs from a Windows workstation, where a bare
 * `bash` from PowerShell resolves to WSL (docs/TRAPS.md, ADR-0008).
 *
 * It does not open, comment on, or merge the PR. The click is the human's and
 * it is the gate (ADR-0010).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const git = (...args) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}`.trim(), err: `${r.stderr ?? ""}`.trim() };
};

function refuse(what, repair) {
  console.error(`\nland: refused — ${what}`);
  console.error(`land: ${repair}`);
  process.exit(1);
}

/**
 * Network calls retry with backoff. A cloud container reaches GitHub through a
 * proxy it does not own, and a blipped fetch is not a reason to make a session
 * re-derive this whole sequence by hand.
 */
async function withRetries(label, fn) {
  const waits = [2000, 4000, 8000, 16000];
  for (let attempt = 0; ; attempt++) {
    const r = fn();
    if (r.ok) return r;
    if (attempt >= waits.length) {
      refuse(`${label} failed after ${waits.length + 1} attempts.`, r.err || r.out || "no output");
    }
    console.error(`land: ${label} failed, retrying in ${waits[attempt] / 1000}s — ${r.err || r.out}`);
    await new Promise((resolve) => setTimeout(resolve, waits[attempt]));
  }
}

// --- where we are ------------------------------------------------------------

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (!branch.ok) refuse("this is not a git checkout.", "run it from the repo.");
if (branch.out === "main" || branch.out === "HEAD") {
  refuse(
    `you are on '${branch.out}', which a session never works on (ADR-0010).`,
    "the dispatcher creates the branch; stop and report rather than creating one.",
  );
}

const dirty = git("status", "--porcelain");
if (dirty.out) {
  console.error(dirty.out);
  refuse(
    "the working tree has uncommitted changes.",
    "commit them first — landing an unverified tree is the thing this command exists to prevent.",
  );
}

// --- fetch and merge ---------------------------------------------------------

console.log(`land: on ${branch.out}, fetching origin main`);
await withRetries("git fetch origin main", () => git("fetch", "origin", "main"));

const behind = git("rev-list", "--count", "HEAD..origin/main");
if (behind.out === "0") {
  console.log("land: already contains origin/main — nothing to merge");
} else {
  console.log(`land: merging origin/main (${behind.out} commit(s) ahead of this branch)`);
  // Merge, never rebase: a rebase rewrites the commits whose verify is the
  // evidence for landing them (ADR-0010).
  const merge = git("merge", "--no-edit", "origin/main");
  if (!merge.ok) {
    console.error(merge.out || merge.err);
    refuse(
      "the merge left conflicts.",
      "resolve them, commit, and run pnpm land again — or `git merge --abort` to back out. " +
        "Resolving a conflict by discarding the other branch's work is the failure mode here.",
    );
  }
  console.log(merge.out);
}

// --- verify, on the tree that will land --------------------------------------

console.log("\nland: pnpm verify on the merged tree — the only tree whose result means anything\n");
const verify = spawnSync("pnpm verify", { cwd: root, shell: true, stdio: "inherit" });
if (verify.status !== 0) {
  refuse(
    "verify is red on the merged tree.",
    "fix it and run pnpm land again. A merged-red is exactly what this step exists to catch, " +
      "and it is not a reason to push anyway.",
  );
}

// --- push --------------------------------------------------------------------

console.log(`\nland: pushing ${branch.out}`);
await withRetries("git push", () => git("push", "-u", "origin", branch.out));

const head = git("rev-parse", "HEAD");
console.log(`\nland: pushed ${branch.out} at ${head.out}`);
console.log("land: CI runs the whole gate on this head; you never merge the PR — the click is the human's.");
