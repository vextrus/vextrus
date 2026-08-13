#!/usr/bin/env node
/**
 * flags.mjs — the boundary review's flag pile, from a campaign's own log.
 *
 * `scripts/loop/REVIEW.md` opens with "First read: the flag pile" and a `{FLAGS}` placeholder.
 * Until now nothing produced it, so the review's mandatory first read was a blank space — and a
 * blank space cannot distinguish "no session crossed the line" from "nobody measured", which are
 * opposite facts (`docs/specs/loop.md`).
 *
 * Usage:  node scripts/loop/flags.mjs [.loop/<run-id> | .wayfinder/<effort>/log/<run-id>.jsonl]
 *         (defaults to the most recent run under .loop/)
 * exit 0  pile printed
 * exit 1  no run to read
 *
 * A committed run log (scripts/loop/evidence.mjs) reads identically to a live one — which is
 * the point: the boundary review works from evidence that outlived the machine.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { CONTEXT_LINE, flagPile } from "./usage.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));

let runDir;
if (arg && arg.endsWith(".jsonl")) {
  // A committed per-run log, addressed directly.
  runDir = null;
} else if (arg) {
  runDir = path.resolve(root, arg);
} else {
  const loopDir = path.join(root, ".loop");
  const runs = existsSync(loopDir)
    ? readdirSync(loopDir)
        .filter((n) => existsSync(path.join(loopDir, n, "log.jsonl")))
        .sort()
    : [];
  if (runs.length === 0) {
    console.error("flags: no run under .loop/ carries a log.jsonl — nothing to read.");
    process.exit(1);
  }
  runDir = path.join(loopDir, runs[runs.length - 1]);
}

const logPath = runDir === null ? path.resolve(root, arg) : path.join(runDir, "log.jsonl");
if (!existsSync(logPath)) {
  console.error(`flags: ${logPath} does not exist.`);
  process.exit(1);
}

const entries = readFileSync(logPath, "utf8")
  .split("\n")
  .filter((l) => l.trim() !== "")
  .map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

console.error(`flags: ${path.relative(root, runDir ?? logPath)}, context line ${CONTEXT_LINE.toLocaleString("en-IN")}\n`);
console.log(flagPile(entries));
