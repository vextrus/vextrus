#!/usr/bin/env node
/**
 * frontier.mjs — the tracker's frontier query (.wayfinder/TRACKER.md), executable.
 *
 * A ticket is on the frontier when its tracker fields say: `Status: open`, `Claimed by:` empty,
 * and every file on its `Blocked by:` line has `Status: closed`. Tracker fields are plain lines
 * at column 0 — a bold `**Status:**` inside a body is a label, not the field, and is ignored.
 * Filename order breaks ties. A blocker that cannot be read or has no tracker status counts as
 * blocking: the query fails closed.
 *
 * Usage:  node scripts/loop/frontier.mjs <ticket-dir> [--list]
 * stdout: the next frontier ticket path (all of them with --list)
 * exit 0  frontier printed
 * exit 3  no open tickets — the directory is complete
 * exit 4  open tickets exist but none is frontier (all blocked or claimed); reasons on stderr
 * exit 1  bad input
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const list = args.includes("--list");
const dirArg = args.find((a) => !a.startsWith("--"));
if (!dirArg) {
  console.error("usage: node scripts/loop/frontier.mjs <ticket-dir> [--list]");
  process.exit(1);
}

const dir = resolve(dirArg);
let names;
try {
  names = readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .sort();
} catch (e) {
  console.error(`frontier: cannot read directory ${dir}: ${e.message}`);
  process.exit(1);
}

const FIELD = {
  status: /^Status:[ \t]*(.*)$/m,
  claimed: /^Claimed by:[ \t]*(.*)$/m,
  blocked: /^Blocked by:[ \t]*(.*)$/m,
};
const read = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};
const fieldOf = (text, re) => text?.match(re)?.[1].trim() ?? null;

const statusCache = new Map();
const statusOf = (path) => {
  if (!statusCache.has(path)) {
    statusCache.set(path, fieldOf(read(path), FIELD.status)?.toLowerCase() ?? null);
  }
  return statusCache.get(path);
};

const open = [];
for (const name of names) {
  const path = resolve(dir, name);
  const text = read(path);
  const status = fieldOf(text, FIELD.status)?.toLowerCase() ?? null;
  statusCache.set(path, status);
  if (status !== "open") continue;
  open.push({
    name,
    claimed: fieldOf(text, FIELD.claimed) ?? "",
    blockers: (fieldOf(text, FIELD.blocked) ?? "").split(/[,\s]+/).filter((t) => t.endsWith(".md")),
  });
}

if (open.length === 0) {
  console.error(`frontier: no open tickets in ${dirArg} — complete`);
  process.exit(3);
}

const frontier = [];
const stalled = [];
for (const t of open) {
  if (t.claimed !== "") {
    stalled.push(`${t.name}: claimed by ${t.claimed}`);
    continue;
  }
  const unmet = t.blockers.filter((b) => statusOf(resolve(dir, b)) !== "closed");
  if (unmet.length > 0) {
    stalled.push(`${t.name}: blocked by ${unmet.join(", ")}`);
    continue;
  }
  frontier.push(t);
}

if (frontier.length === 0) {
  console.error(`frontier: ${open.length} open ticket(s), none frontier — stalled`);
  for (const line of stalled) console.error(`  ${line}`);
  process.exit(4);
}

for (const t of list ? frontier : frontier.slice(0, 1)) {
  console.log(join(dirArg, t.name).replaceAll("\\", "/"));
}
