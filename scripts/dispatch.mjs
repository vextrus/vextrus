#!/usr/bin/env node
/**
 * `pnpm dispatch` — claim a wayfinder ticket on `main`, and nothing else.
 *
 * The first version of this tool also created work branches, emitted a session prompt, ran
 * promote and reland. Measured cost of the prompt, 2026-08-14: five cloud sessions received a
 * do-the-work prompt instead of the `/wayfinder` skill, executed decision tickets as if they
 * were build tickets, and the whole batch had to be reverted (#46). The prompt was the derail:
 * a wayfinder session's instructions are the *skill's* to give, not this script's. So this
 * version does the one thing a session cannot do for itself (ADR-0010: claims live on `main`,
 * where a session's branch is invisible) and stays out of the session's way entirely.
 *
 * The flow: pick → claim → claim PR → you click → you start the cloud session and type
 * `/wayfinder`, then the ticket path. The skill does the rest; no prompt from here.
 *
 * It refuses rather than repairs, and it never merges — the claim PR is your click.
 *
 * Usage:  node scripts/dispatch.mjs <effort-dir> [--ticket <path>] [--dry-run]
 * exit 0  claim PR opened (or dry-run printed)
 * exit 1  gh/git missing, bad input
 * exit 2  refused — reason on stderr, nothing written
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---- the pure core --------------------------------------------------------------

const FIELD = {
  status: /^Status:[ \t]*(.*)$/m,
  claimed: /^Claimed by:[ \t]*(.*)$/m,
};

/** `tickets/18-what-fills-a-cloud-session.md` → `what-fills-a-cloud-session`. */
export function slugOf(ticketPath) {
  return String(ticketPath)
    .replaceAll("\\", "/")
    .split("/")
    .pop()
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

// ---- CLI ------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const ticketArg = args.indexOf("--ticket") >= 0 ? args[args.indexOf("--ticket") + 1] : null;
  const effort = args.find((a) => !a.startsWith("--") && a !== ticketArg);

  if (!effort || !existsSync(path.resolve(root, effort, "tickets"))) {
    console.error("usage: node scripts/dispatch.mjs <effort-dir> [--ticket <path>] [--dry-run]");
    process.exit(1);
  }

  const sh = (cmd) => {
    const r = spawnSync(cmd, { cwd: root, shell: true, encoding: "utf8" });
    return { ok: r.status === 0, out: `${r.stdout ?? ""}`.trim(), err: `${r.stderr ?? ""}`.trim() };
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

  // -- preflight: a claim is only true at main's tip --
  if (!sh("gh auth status").ok) refuse("the gh CLI is missing or not authenticated.", "gh auth login first.");
  if (sh("git rev-parse --abbrev-ref HEAD").out !== "main") {
    refuse("not on main.", "a claim is read from main's tip, so it is only ever written there.");
  }
  if (sh("git status --porcelain").out !== "") refuse("the working tree is dirty.", "commit or stash first.");
  act("fetch", "git fetch origin main");
  if (sh("git rev-list --count HEAD..origin/main").out !== "0") {
    refuse("main is behind origin/main.", "git pull --ff-only, then re-run.");
  }

  // Informational only: promotion is its own act (`pnpm promote`), not smuggled into dispatch.
  const inboxDir = path.resolve(root, effort, "inbox");
  const inboxCount = existsSync(inboxDir)
    ? readdirSync(inboxDir).filter((n) => n.endsWith(".md") && n !== "README.md").length
    : 0;
  if (inboxCount > 0) console.log(`dispatch: note — ${inboxCount} inbox ticket(s) await \`pnpm promote\`.`);

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

  // -- claim: written into the ticket, landed through a PR you click --
  const claim = `dispatched ${new Date().toISOString().slice(0, 10)}`;
  const claimed = setClaim(readFileSync(ticketAbs, "utf8"), claim);
  if (claimed.refusal) refuse(`cannot claim ${ticket}: ${claimed.refusal}`, "pick another ticket or clear the state on main first.");
  console.log(`\ndispatch: ${ticket} → Claimed by: ${claim}`);
  if (!dryRun) writeFileSync(ticketAbs, claimed.text);

  const claimBranch = `dispatch/claim-${slugOf(ticket)}`;
  const ticketRel = path.relative(root, ticketAbs).replaceAll("\\", "/");
  act("claim branch", `git switch -c ${claimBranch}`);
  act("commit claim", `git commit -m ${JSON.stringify(`dispatch: claim ${path.basename(ticket)}`)} -- ${JSON.stringify(ticketRel)}`);
  act("push claim", `git push -u origin ${claimBranch}`);
  const pr = act(
    "claim PR",
    `gh pr create --head ${claimBranch} --title ${JSON.stringify(`dispatch: claim ${path.basename(ticket)}`)} ` +
      `--body ${JSON.stringify(`Claims ${ticket}. Claim PRs land first so every machine's frontier sees the claim.`)}`,
  );
  act("back to main", "git switch main");

  console.log(`\ndispatch: done.${pr.out ? ` Claim PR: ${pr.out.split("\n").pop()}` : ""}`);
  console.log(`dispatch: after it lands, start the session and type /wayfinder, then give it the ticket path:`);
  console.log(`  ${ticket}`);
  console.log(`dispatch: no other prompt — the skill gives the session its instructions, not this script.`);
}
