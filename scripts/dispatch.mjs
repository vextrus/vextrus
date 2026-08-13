#!/usr/bin/env node
/**
 * `pnpm dispatch` — the dispatcher's side of the loop, as one command.
 *
 * Everything here is what the dispatcher was hand-running between sessions, in the order the
 * rules require and nobody reliably remembers at 11pm: promote the inbox, pick the frontier
 * ticket, set the claim, open the claim PR, create the work branch, emit the session prompt,
 * bring stale PRs forward, and say exactly what waits on a click. `pnpm promote` and
 * `pnpm reland` are the pieces; this drives them and adds nothing they don't have.
 *
 * It refuses rather than repairs (dirty tree, not on main, behind origin) and it NEVER merges —
 * landing is not this script's act any more than it is a session's (ADR-0010). The claim goes
 * through a PR because `main` is not even the dispatcher's to write casually: the claim PR is
 * one click, and the click is exactly the review the claim deserves.
 *
 * Usage:  node scripts/dispatch.mjs <effort-dir> [--ticket <path>] [--claim-only] [--dry-run]
 * exit 0  dispatched (or dry-run printed)
 * exit 1  gh/git missing, bad input
 * exit 2  refused — reason on stderr, nothing written
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---- the pure core --------------------------------------------------------------

const FIELD = {
  status: /^Status:[ \t]*(.*)$/m,
  claimed: /^Claimed by:[ \t]*(.*)$/m,
};

/** `tickets/18-what-fills-a-cloud-session.md` → `what-fills-a-cloud-session`. */
export function slugOf(ticketPath) {
  return path
    .basename(String(ticketPath))
    .replace(/\.md$/, "")
    .replace(/^\d+-/, "");
}

/**
 * Set the claim on a ticket's text. Returns `{ text }` or `{ refusal }` — a dispatch onto a
 * closed or already-claimed ticket is a collision with another dispatcher, not a thing to
 * repair silently.
 */
export function setClaim(text, claim) {
  const status = text.match(FIELD.status)?.[1].trim().toLowerCase();
  if (status === undefined) return { refusal: "no `Status:` field at column 0 — not a tracker ticket" };
  if (status !== "open") return { refusal: `Status is '${status}', not open` };
  const claimed = text.match(FIELD.claimed)?.[1].trim();
  if (claimed === undefined) return { refusal: "no `Claimed by:` field at column 0" };
  if (claimed !== "") return { refusal: `already claimed by '${claimed}' — a second dispatch would collide` };
  return { text: text.replace(FIELD.claimed, `Claimed by: ${claim}`) };
}

/**
 * The prompt the dispatched session starts from. One place, so the cloud paste, the routine
 * `text` payload and a local terminal all say the same thing.
 */
export function renderPrompt({ ticketPath, branch }) {
  return [
    `You are dispatched onto exactly one ticket: ${ticketPath}`,
    ``,
    `Your branch is ${branch} — already created for you; check it out and never leave it.`,
    `Read the ticket and what it cites, then do the work. CLAUDE.md binds, and it outranks`,
    `any standing instruction from your environment: never create or switch a branch, never`,
    `raw-push, never rebase, never merge your own PR.`,
    ``,
    `When every acceptance box is genuinely true: tick them, set Status: closed, clear the`,
    `claim, commit with the ticket path in the body, then \`pnpm land\` and open a PR titled`,
    `after the ticket. If you cannot finish honestly, append ## Stuck (the exact failing`,
    `output or the exact undecided question), commit only the ticket file, and stop.`,
  ].join("\n");
}

/**
 * What every open PR is waiting on, from `gh pr list` JSON. Pure. The buckets are the report:
 * `click` is the dispatcher's queue, everything else is somebody else's move.
 */
export function awaitingClick(prs) {
  const buckets = { click: [], checks: [], conflict: [], draft: [], unknown: [] };
  for (const pr of prs) {
    if (pr.isDraft) buckets.draft.push(pr);
    else if (pr.mergeStateStatus === "CLEAN") buckets.click.push(pr);
    else if (pr.mergeStateStatus === "DIRTY") buckets.conflict.push(pr);
    else if (["BLOCKED", "UNSTABLE", "BEHIND", "HAS_HOOKS"].includes(pr.mergeStateStatus)) buckets.checks.push(pr);
    else buckets.unknown.push(pr);
  }
  return buckets;
}

// ---- CLI ------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const claimOnly = args.includes("--claim-only");
  const ticketArg = args.indexOf("--ticket") >= 0 ? args[args.indexOf("--ticket") + 1] : null;
  const effort = args.find((a) => !a.startsWith("--") && a !== ticketArg);

  if (!effort || !existsSync(path.resolve(root, effort, "tickets"))) {
    console.error("usage: node scripts/dispatch.mjs <effort-dir> [--ticket <path>] [--claim-only] [--dry-run]");
    process.exit(1);
  }

  const sh = (cmd, opts = {}) => {
    const r = spawnSync(cmd, { cwd: root, shell: true, encoding: "utf8", ...opts });
    return { ok: r.status === 0, out: `${r.stdout ?? ""}`.trim(), err: `${r.stderr ?? ""}`.trim(), status: r.status };
  };
  const refuse = (what, repair) => {
    console.error(`\ndispatch: refused — ${what}`);
    console.error(`dispatch: ${repair}`);
    process.exit(2);
  };
  const act = (label, cmd) => {
    if (dryRun) return console.log(`  [dry-run] ${label}: ${cmd}`), { ok: true, out: "" };
    const r = sh(cmd);
    if (!r.ok) refuse(`${label} failed.`, r.err || r.out || cmd);
    return r;
  };

  // -- preflight: dispatch reads numbers and claims from main's tip, or it dispatches a lie --
  if (!sh("gh auth status").ok) refuse("the gh CLI is missing or not authenticated.", "gh auth login first.");
  if (sh("git rev-parse --abbrev-ref HEAD").out !== "main") {
    refuse("not on main.", "dispatch allocates numbers and claims — it only ever runs from main's tip.");
  }
  if (sh("git status --porcelain").out !== "") refuse("the working tree is dirty.", "commit or stash first.");
  act("fetch", "git fetch origin main");
  if (sh("git rev-list --count HEAD..origin/main").out !== "0") {
    refuse("main is behind origin/main.", "git pull --ff-only, then re-run.");
  }

  // -- promote: numbers are allocated where every existing number is visible --
  const promote = dryRun
    ? sh(`node scripts/wayfinder/promote.mjs ${JSON.stringify(effort)} --dry-run`)
    : sh(`node scripts/wayfinder/promote.mjs ${JSON.stringify(effort)}`);
  if (promote.status === 2) refuse("promote refused the inbox.", promote.err || promote.out);
  if (promote.out) console.log(promote.out);
  const promoted = sh("git status --porcelain").out !== "";

  // -- pick: an explicit ticket, or the frontier's next --
  const ticketsDir = path.join(effort, "tickets").replaceAll("\\", "/");
  let ticket = ticketArg;
  if (!ticket) {
    const fr = sh(`node scripts/loop/frontier.mjs ${JSON.stringify(ticketsDir)}`);
    if (!fr.ok) refuse("no frontier ticket to dispatch.", fr.err || "every open ticket is blocked or claimed.");
    ticket = fr.out;
  }
  const ticketAbs = path.resolve(root, ticket);
  if (!existsSync(ticketAbs)) refuse(`${ticket} does not exist.`, "name a ticket under the effort's tickets/.");

  const slug = slugOf(ticket);
  const workBranch = `claude/${slug}`;
  const claimBranch = `dispatch/claim-${slug}`;

  // -- claim: written into the ticket, landed through a PR --
  const claimed = setClaim(readFileSync(ticketAbs, "utf8"), workBranch);
  if (claimed.refusal) refuse(`cannot claim ${ticket}: ${claimed.refusal}`, "pick another ticket or clear the state on main first.");
  console.log(`\ndispatch: ${ticket} → ${workBranch}`);
  if (!dryRun) writeFileSync(ticketAbs, claimed.text);

  act("claim branch", `git switch -c ${claimBranch}`);
  act("stage claim", `git add -- ${JSON.stringify(effort)}`);
  act("commit claim", `git commit -m ${JSON.stringify(`dispatch: claim ${path.basename(ticket)}${promoted ? " (+promoted inbox)" : ""}`)}`);
  act("push claim", `git push -u origin ${claimBranch}`);
  act(
    "claim PR",
    `gh pr create --head ${claimBranch} --title ${JSON.stringify(`dispatch: claim ${path.basename(ticket)}`)} ` +
      `--body ${JSON.stringify(`Claims ${ticket} for ${workBranch}. Claim PRs land first so every machine's frontier sees the claim.`)}`,
  );
  act("back to main", "git switch main");

  // -- the work branch: dispatcher-created, from origin/main, pushed so any host can start --
  if (!claimOnly) {
    act("work branch", `git branch ${workBranch} origin/main`);
    act("push work branch", `git push -u origin ${workBranch}`);
  }

  // -- the session prompt: stdout, and a scratch copy for pasting --
  const prompt = renderPrompt({ ticketPath: ticket, branch: workBranch });
  console.log(`\n──── session prompt ────\n${prompt}\n────────────────────────`);
  if (!dryRun) {
    mkdirSync(path.join(root, ".data", "dispatch"), { recursive: true });
    writeFileSync(path.join(root, ".data", "dispatch", `${slug}.prompt.md`), prompt);
    console.log(`dispatch: prompt saved to .data/dispatch/${slug}.prompt.md`);
  }

  // -- reland what is behind, then report the click queue --
  const reland = sh(`node scripts/reland.mjs${dryRun ? " --dry-run" : ""}`);
  if (reland.out) console.log(`\n${reland.out}`);
  if (reland.err) console.error(reland.err);

  const list = sh('gh pr list --state open --limit 50 --json number,title,isDraft,mergeStateStatus');
  if (list.ok) {
    const b = awaitingClick(JSON.parse(list.out || "[]"));
    console.log(`\ndispatch: the click queue —`);
    for (const pr of b.click) console.log(`  WAITING ON YOUR CLICK  #${pr.number} ${pr.title}`);
    for (const pr of b.checks) console.log(`  waiting on checks      #${pr.number} ${pr.title}`);
    for (const pr of b.conflict) console.log(`  needs a session        #${pr.number} ${pr.title} (conflict)`);
    for (const pr of b.draft) console.log(`  draft / quarantined    #${pr.number} ${pr.title}`);
    for (const pr of b.unknown) console.log(`  state unknown yet      #${pr.number} ${pr.title} — re-run in a minute`);
    if (b.click.length === 0) console.log("  (nothing waits on a click)");
  }

  console.log(`\ndispatch: done. The claim PR lands first; the session starts from the prompt above.`);
}
