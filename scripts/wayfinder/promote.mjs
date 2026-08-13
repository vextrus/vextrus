#!/usr/bin/env node
/**
 * promote.mjs — the ticket-number allocator (.wayfinder/TRACKER.md).
 *
 * A session that discovers new work mints it into `<effort>/inbox/<slug>.md`, slug only, no
 * number. This promotes an inbox into `<effort>/tickets/NN-<slug>.md`.
 *
 * Why there is an allocator at all, measured on the first parallel wave (2026-08-13,
 * docs/specs/cloud-campaign.md §1): on `claude/raster-to-geometry` a session created
 * `23-the-effective-resolution-gate.md` and `24-the-dimension-annotation-lane.md`; on
 * `claude/vector-pdf-entity-graph` a different session created `23-the-lane-fidelity-declaration.md`
 * and `24-who-decomposes-a-pdf-page.md`. Two 23s and two 24s. Because the filenames differ, git
 * saw four unrelated additions and merged them WITHOUT A CONFLICT — the collision was invisible to
 * every mechanism in the repo, and a `Blocked by:` line naming `23-...md` would have resolved to
 * the other branch's ticket while `frontier.mjs` answered confidently and wrongly. That is a
 * fail-OPEN defect in a repo whose governing sentence forbids exactly that.
 *
 * Slugs fix it by making the collision visible: two sessions minting the same slug write the same
 * path, and git conflicts. Numbers are then allocated once, by a single writer that can see every
 * existing number — which is this script, run on `main`.
 *
 * It refuses rather than repairs, and every refusal names its repair. It reports ALL refusals, not
 * the first: a session fixing one at a time across a network round-trip is the cost this avoids.
 *
 * Node, not bash: PowerShell's bare `bash` resolves to WSL (docs/TRAPS.md, ADR-0008).
 *
 * Usage:  node scripts/wayfinder/promote.mjs <effort-dir> [--dry-run]
 * exit 0  promoted (or nothing to promote)
 * exit 1  bad input
 * exit 2  refused — reasons on stderr
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FIELD = {
  status: /^Status:[ \t]*(.*)$/m,
  claimed: /^Claimed by:[ \t]*(.*)$/m,
  blocked: /^Blocked by:[ \t]*(.*)$/m,
};
const NUMBERED = /^(\d+)-(.+)\.md$/;

/**
 * The whole ruling, as a pure function — no fs, no git, no clock. `inbox` is
 * `[{ name, text }]`, `existing` is the ticket directory's filenames.
 *
 * Returns `{ refusals: [string], moves: [{ from, to, text }] }`. A non-empty `refusals` means
 * nothing moves: a half-promoted inbox is a graph with dangling edges, which is the state this
 * script exists to prevent.
 */
export function plan(inbox, existing) {
  const refusals = [];
  const files = [...inbox].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const f of files) {
    if (NUMBERED.test(f.name)) {
      refusals.push(
        `${f.name}: already carries a number. An inbox ticket is slug-only — the number is this ` +
          `script's to allocate, because a session cannot see the other branches' numbers. ` +
          `Rename it to its slug.`,
      );
    }
    if (!FIELD.status.test(f.text)) {
      refusals.push(`${f.name}: no \`Status:\` field at column 0. Add the tracker header (.wayfinder/TRACKER.md).`);
    }
    const claimed = f.text.match(FIELD.claimed)?.[1].trim();
    if (claimed === undefined) {
      refusals.push(`${f.name}: no \`Claimed by:\` field at column 0. Add the tracker header (.wayfinder/TRACKER.md).`);
    } else if (claimed !== "") {
      refusals.push(
        `${f.name}: claimed by ${claimed} while still in the inbox. A ticket is claimed at ` +
          `dispatch, after it has a number (ADR-0010). Clear the claim.`,
      );
    }
  }

  // Allocation: filename order, from one past the highest number already in tickets/. Highest
  // rather than count, so a gap left by a deleted ticket is never re-issued — a re-issued number
  // would make an old `Blocked by:` reference resolve to a different ticket, silently.
  const highest = existing.reduce((max, name) => {
    const n = Number(name.match(NUMBERED)?.[1]);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const width = Math.max(2, String(highest + files.length).length);

  const promoted = new Map(); // slug (with and without .md) -> new filename
  const moves = [];
  files.forEach((f, i) => {
    const slug = f.name.replace(/\.md$/, "");
    const to = `${String(highest + i + 1).padStart(width, "0")}-${slug}.md`;
    if (existing.includes(to)) {
      refusals.push(`${f.name}: would become ${to}, which already exists. Re-run after fetching main.`);
    }
    promoted.set(f.name, to);
    promoted.set(slug, to);
    moves.push({ from: f.name, to, text: f.text });
  });

  // `Blocked by:` rewriting. A session minting two related tickets writes the edge by slug,
  // because the number does not exist yet; leaving it unrewritten is the dangling edge that makes
  // frontier.mjs fail closed forever on a ticket nobody can unblock.
  for (const move of moves) {
    const line = move.text.match(FIELD.blocked)?.[1] ?? "";
    const targets = line.split(/[,\s]+/).filter(Boolean);
    if (targets.length === 0) continue;

    const rewritten = targets.map((t) => {
      if (promoted.has(t)) return promoted.get(t);
      if (existing.includes(t)) return t;
      refusals.push(
        `${move.from}: \`Blocked by:\` names ${t}, which is neither an existing ticket nor another ` +
          `inbox ticket in this promotion. Name a real blocker or clear the line — a blocker that ` +
          `cannot be read counts as blocking, so frontier.mjs would stall on this forever.`,
      );
      return t;
    });
    move.text = move.text.replace(FIELD.blocked, `Blocked by: ${rewritten.join(", ")}`);
  }

  return { refusals, moves: refusals.length > 0 ? [] : moves };
}

// ---- CLI ----------------------------------------------------------------------
// Skipped when imported, so the spec can exercise `plan` without a checkout.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const effort = args.find((a) => !a.startsWith("--"));

  if (!effort) {
    console.error("usage: node scripts/wayfinder/promote.mjs <effort-dir> [--dry-run]");
    process.exit(1);
  }
  const effortDir = path.resolve(effort);
  const inboxDir = path.join(effortDir, "inbox");
  const ticketsDir = path.join(effortDir, "tickets");

  if (!existsSync(ticketsDir)) {
    console.error(`promote: ${effort} has no tickets/ directory — is that an effort?`);
    process.exit(1);
  }
  if (!existsSync(inboxDir)) {
    console.log(`promote: ${effort} has no inbox/ — nothing to promote.`);
    process.exit(0);
  }

  const inbox = readdirSync(inboxDir)
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .map((name) => ({ name, text: readFileSync(path.join(inboxDir, name), "utf8") }));

  if (inbox.length === 0) {
    console.log(`promote: ${effort}/inbox is empty — nothing to promote.`);
    process.exit(0);
  }

  const existing = readdirSync(ticketsDir).filter((n) => n.endsWith(".md"));
  const { refusals, moves } = plan(inbox, existing);

  if (refusals.length > 0) {
    console.error(`promote: refused — ${refusals.length} problem(s), and nothing was moved.\n`);
    for (const r of refusals) console.error(`  - ${r}`);
    console.error(`\npromote: a half-promoted inbox is a graph with dangling edges. Fix all of the above and re-run.`);
    process.exit(2);
  }

  for (const m of moves) console.log(`  ${m.from}  ->  tickets/${m.to}`);
  if (dryRun) {
    console.log(`\npromote: --dry-run, nothing written.`);
    process.exit(0);
  }

  for (const m of moves) {
    const from = path.join(inboxDir, m.from);
    const to = path.join(ticketsDir, m.to);
    // git mv, so the ticket's history follows it out of the inbox. Fall back to a plain write
    // when the file is not tracked yet (freshly minted and never committed), which is the
    // common case and not a fault.
    // git mv, so the ticket's history follows it out of the inbox. A freshly minted ticket that
    // was never committed is untracked, git mv refuses it, and that is not a fault — move it
    // plainly. Either way the rewritten text is what lands.
    if (spawnSync("git", ["mv", from, to], { encoding: "utf8" }).status !== 0) {
      rmSync(from, { force: true });
    }
    writeFileSync(to, m.text);
  }
  console.log(`\npromote: ${moves.length} ticket(s) promoted. Review the rewritten \`Blocked by:\` lines, then commit.`);
}
