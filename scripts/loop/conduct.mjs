#!/usr/bin/env node
/**
 * conduct.mjs — the loop conductor (docs/specs/loop.md, ADR-0008).
 *
 * Autonomy comes from gates, not trust: a worker session's claim of "done" counts for
 * nothing. The conductor independently re-runs verify, inspects the ticket, and inspects the
 * tree — out of process, where a gate cannot time out mid-turn and cannot be argued with.
 *
 * Node, not bash, on purpose: PowerShell's bare `bash` resolves to WSL (docs/TRAPS.md).
 *
 * Usage:
 *   node scripts/loop/conduct.mjs <ticket-dir> [--arc <name>] [--max-tickets N] [--dry-run]
 *
 * State: .loop/<run-id>/log.jsonl — one line per iteration, evidence not narrative.
 * Caps are PROVISIONAL (marked below) until re-derived from this repo's own first measured
 * campaign: derive --max-turns from ~2x the honest-close p95, never from a hunch.
 */
import { execSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import { effortLogFile } from "./evidence.mjs";
import { CONTEXT_LINE, overLine, parseWorkerOutput } from "./usage.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const ticketDir = args.find((a) => !a.startsWith("--"));
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const dryRun = args.includes("--dry-run");
const arc = flag("--arc", path.basename(ticketDir ?? ""));
const maxTickets = Number(flag("--max-tickets", "50"));

// PROVISIONAL caps — re-derive from the first campaign's log (see header).
const MAX_TURNS = 150;
const WALL_CLOCK_MS = 30 * 60 * 1000;

// The worker's allow surface, declared on the spawn line rather than inherited from
// `.claude/settings.json` — deliberately, twice over. (1) An untrusted workspace ignores the
// project allow list entirely (measured on a cloud container at 6c6e001; a fresh container is
// always untrusted, and there is no documented way to pre-accept trust). (2) `bypassPermissions`
// is refused outright under uid 0, and since CLI ~2.1.229 it is *silently downgraded to default
// mode* on any machine where CLAUDE_CODE_SUBPROCESS_ENV_SCRUB is set — the CLI's own warning
// says "Declare allowedTools explicitly", and this is that. dontAsk + explicit allows is
// fail-closed: everything here auto-approves, everything else lands in the result's
// permission_denials as evidence instead of hanging a prompt nobody will answer.
const WORKER_TOOLS = "Bash Edit Write Read Glob Grep Skill Task TodoWrite";

if (!ticketDir || !existsSync(path.resolve(root, ticketDir))) {
  console.error("usage: node scripts/loop/conduct.mjs <ticket-dir> [--arc <name>] [--max-tickets N] [--dry-run]");
  process.exit(1);
}

const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runDir = path.join(root, ".loop", runId);
const activeMarker = path.join(root, ".loop", "ACTIVE");
const log = (entry) => {
  appendFileSync(path.join(runDir, "log.jsonl"), JSON.stringify({ t: new Date().toISOString(), ...entry }) + "\n");
  console.log(`[conduct] ${entry.event}${entry.ticket ? ` ${entry.ticket}` : ""}${entry.detail ? ` — ${entry.detail}` : ""}`);
};

const sh = (cmd, opts = {}) => execSync(cmd, { cwd: root, encoding: "utf8", ...opts }).trim();
const trySh = (cmd) => {
  try {
    return { ok: true, out: sh(cmd) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() };
  }
};

function portAnswers(port) {
  return new Promise((resolveP) => {
    const sock = net.connect({ port, host: "127.0.0.1", timeout: 1500 });
    sock.on("connect", () => (sock.destroy(), resolveP(true)));
    sock.on("error", () => resolveP(false));
    sock.on("timeout", () => (sock.destroy(), resolveP(false)));
  });
}

function verify() {
  const r = spawnSync("pnpm verify", { cwd: root, shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { ok: r.status === 0, out: `${r.stdout}\n${r.stderr}`.slice(-4000) };
}

const TEST_FILE = /\.(spec|dbspec|test)\.(ts|tsx|mjs)$|^cad\/tests\//;

// ---- preflight ----------------------------------------------------------------
mkdirSync(runDir, { recursive: true });

// The machine before the tree (ticket 12). A campaign assumes a known start state and a cloud
// container has two: one created empty provisions itself at boot, one restored from a snapshot
// inherits a dead database and a Node below the pin and runs nothing. Both fail baseline verify,
// but verify answers "this tree's contract does not hold here" and names no repair, which is the
// false accusation ticket 09 spent a container diagnosing. checkup costs ~1.3s and names
// scripts/provision.sh. It also subsumes the :3210 probe below, which stays as the second reading
// for the local case where a session left its own dev server running.
{
  // node directly, not `pnpm checkup`: the wrapper adds an ELIFECYCLE line that reads like a
  // second fault, and on a machine below the pin an `Unsupported engine` warning on top of it.
  const r = spawnSync(process.execPath, ["scripts/checkup.mjs"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    console.error(`${r.stdout ?? ""}${r.stderr ?? ""}`.trimEnd());
    console.error("conduct: this machine is not fit for work — the loop only ever starts from a fit machine.");
    process.exit(1);
  }
}
// The conductor's whole job is spawning nested `claude`, and on Linux that inherits
// `.claude/settings.json`'s CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1, which is bubblewrap. Without the
// binary every worker dies in 0.6s with empty stdout and a page of minified CLI source — measured
// on a cloud container at 6c6e001. Read as a worker fault that is a machine fault, it would halt a
// campaign on the first ticket and blame the ticket. Refuse here, by name, before anything spawns:
// a refusal always carries a reason (CLAUDE.md). Linux only — the scrub is a no-op elsewhere.
if (process.platform === "linux" && spawnSync("bwrap", ["--version"], { encoding: "utf8" }).status !== 0) {
  console.error("conduct: bubblewrap is missing, so every worker would abort at startup under");
  console.error("conduct: CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1 (docs/TRAPS.md). Run scripts/provision.sh.");
  process.exit(1);
}
if (existsSync(activeMarker)) {
  console.error(`conduct: another run is active (${activeMarker}). Remove it only if you are sure it is stale.`);
  process.exit(1);
}
if (sh("git status --porcelain") !== "") {
  console.error("conduct: working tree is dirty — the loop needs a sole, clean writer. Commit or stash first.");
  process.exit(1);
}
if (await portAnswers(3210)) {
  console.error("conduct: something answers on :3210 — a dev server is a second writer (docs/TRAPS.md). Stop it first.");
  process.exit(1);
}
sh("git config core.hooksPath .githooks"); // pre-push guard refuses pushes while ACTIVE exists
writeFileSync(activeMarker, runId);

const baseline = verify();
if (!baseline.ok) {
  rmSync(activeMarker);
  console.error("conduct: baseline pnpm verify is red — the loop only ever starts from green.");
  process.exit(1);
}
log({
  event: "start",
  runId,
  ticketDir,
  arc,
  maxTickets,
  caps: { MAX_TURNS, WALL_CLOCK_MS, CONTEXT_LINE },
  // A number with no environment is not a measurement (CLAUDE.md). Every row below inherits
  // this line's machine and commit when the log is read later, on a machine that no longer is.
  machine: `${process.platform} ${process.arch} · node ${process.version} · ${sh("git rev-parse --short HEAD")}`,
});

// ---- the loop -----------------------------------------------------------------
const promptTemplate = readFileSync(path.join(import.meta.dirname, "PROMPT.md"), "utf8");
let advanced = 0;
let halted = null;

try {
  for (let i = 0; i < maxTickets; i++) {
    const fr = trySh(`node scripts/loop/frontier.mjs ${JSON.stringify(ticketDir)}`);
    if (!fr.ok) {
      log({ event: fr.out.includes("complete") ? "complete" : "stalled", detail: fr.out.split("\n")[0] });
      break;
    }
    const ticket = fr.out;
    const ticketAbs = path.resolve(root, ticket);
    const startHead = sh("git rev-parse HEAD");

    if (dryRun) {
      log({ event: "dry-run", ticket });
      break;
    }

    const prompt = promptTemplate
      .replaceAll("{TICKET_PATH}", ticket)
      .replaceAll("{RUN_ID}", runId)
      .replaceAll("{ARC}", arc);

    // Each worker gets its own session id. A nested `claude` inherits CLAUDE_CODE_SESSION_ID and
    // appends its records to the *parent's* transcript file, where they read as a context
    // collapse that never happened (docs/TRAPS.md). --session-id is the documented flag for
    // exactly this; it also gives the log a handle to correlate a row with a transcript.
    const workerSession = randomUUID();
    log({ event: "spawn", ticket, workerSession });
    const t0 = Date.now();
    // stream-json, not json: the result object's `usage` is cumulative across the session and its
    // `iterations` array is partial, so neither is a context size (scripts/loop/usage.mjs measures
    // this). The stream carries one usage per message, which is the only way to see the peak — and
    // the peak is what the boundary review's flag pile is made of.
    // The worker's surface is scripts/loop/worker-settings.json: no web, no browser, no
    // planning skills — a worker executes one decided ticket and cannot wander (item 4,
    // docs/specs/execution.md). --disallowedTools is the same denial on the flag path, so the
    // restriction does not depend on how a given CLI version layers --settings.
    // dontAsk + WORKER_TOOLS, never bypassPermissions — see the WORKER_TOOLS comment for the two
    // measured reasons. If a needed tool is missing from the surface, the evidence is a named
    // entry in permissionDenials on the log row, not a silent stall.
    const worker = spawnSync(
      `claude -p --output-format stream-json --verbose --max-turns ${MAX_TURNS} --permission-mode dontAsk` +
        ` --allowedTools ${WORKER_TOOLS} --session-id ${workerSession}` +
        ` --settings scripts/loop/worker-settings.json --disallowedTools WebSearch WebFetch`,
      {
        cwd: root,
        shell: true,
        input: prompt,
        encoding: "utf8",
        timeout: WALL_CLOCK_MS,
        maxBuffer: 64 * 1024 * 1024,
        // No CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=0 here any more. It was the workaround for a
        // missing bubblewrap on the cloud image, and it bought a spawn by silently dropping the
        // subprocess isolation `.claude/settings.json` deliberately turns on — invisibly, on
        // every worker, forever. The dependency is provisioned instead (scripts/provision.sh,
        // `pnpm checkup`'s bubblewrap line), so the scrub is inherited and works. The preflight
        // above refuses by name when it cannot.
        env: process.env,
      },
    );
    const parsed = parseWorkerOutput(worker.stdout);

    // A worker that produced NO stdout never became a session at all — bubblewrap missing, a
    // permission-mode refusal, a CLI that is not on PATH. That is a machine fault, not a ticket
    // fault, and it is the least diagnosable failure the loop has: parseWorkerOutput returns
    // all-nulls and the run reads like a worker that did nothing. Refuse by name, with the
    // CLI's own stderr as the evidence, and never blame the ticket (docs/TRAPS.md).
    if (!worker.stdout?.trim()) {
      const stderrTail = (worker.stderr ?? "").trim().split("\n").slice(-15).join("\n");
      halted = { ticket, spawnFail: true };
      writeFileSync(path.join(runDir, "HALT.md"), [
        `# Loop halted — the worker for ${ticket} never started`,
        ``,
        `No stdout arrived, so this is a spawn fault on this machine, not a fault in the ticket.`,
        `Known causes, each with its trap entry (docs/TRAPS.md): bubblewrap missing under`,
        `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1; a permission-mode refusal; \`claude\` not on PATH.`,
        ``,
        `## the CLI's stderr (last lines)`,
        ``,
        "```",
        stderrTail || "(empty)",
        "```",
      ].join("\n"));
      log({ event: "spawn-fail", ticket, workerSession, exit: worker.status, wallMs: Date.now() - t0 });
      break;
    }

    const meta = {
      turns: parsed.turns,
      costUsd: parsed.costUsd,
      workerResult: parsed.workerResult ?? (worker.status === null ? "wall-clock-kill" : `exit ${worker.status}`),
      // The instrumentation the flag pile is made of. ctxPeak is null when the worker reported no
      // per-message usage — null, not zero, so "unmeasured" never reads as "well under the line".
      ctxPeak: parsed.ctxPeak,
      ctxWindow: parsed.ctxWindow,
      ctxCalls: parsed.ctxSeries.length,
      overContextLine: overLine(parsed.ctxPeak),
      // Named refusals under the dontAsk surface. A denial that mattered shows up twice: here,
      // and as the gate the worker consequently failed — this is the "which tool was missing"
      // half of that evidence. null means the result record never arrived.
      permissionDenials: parsed.permissionDenials,
      wallMs: Date.now() - t0,
    };

    // ---- gates: the conductor believes evidence, not claims -------------------
    const ticketText = readFileSync(ticketAbs, "utf8");
    const gates = {};

    const v = verify();
    gates.C1_verify = v.ok;

    const closed = /^Status:[ \t]*closed[ \t]*$/m.test(ticketText);
    const boxesUnticked = (ticketText.match(/^\s*- \[ \]/gm) ?? []).length;
    const claimCleared = /^Claimed by:[ \t]*$/m.test(ticketText);
    gates.C2_ticket = closed && boxesUnticked === 0 && claimCleared;

    const treeClean = sh("git status --porcelain") === "";
    const headMoved = sh("git rev-parse HEAD") !== startHead;
    const headCites = headMoved && sh("git log -1 --format=%B").includes(path.basename(ticket));
    gates.C3_tree = treeClean && headMoved && headCites;

    const testDamage = headMoved
      ? sh(`git diff --name-only --diff-filter=DR ${startHead}..HEAD`).split("\n").filter((f) => TEST_FILE.test(f))
      : [];
    gates.C4_tests = testDamage.length === 0;

    const stuck = /^## Stuck/m.test(ticketText);
    const handoff = /^## Handoff/m.test(ticketText);
    const pass = gates.C1_verify && gates.C2_ticket && gates.C3_tree && gates.C4_tests;

    log({ event: pass ? "advance" : stuck ? "stuck" : handoff ? "handoff" : "gate-fail", ticket, gates, ...meta, testDamage });

    if (pass) {
      advanced += 1;
      continue;
    }
    // No silent retries and no cleanup-by-conductor: state stays on disk as evidence.
    halted = { ticket, gates, stuck, handoff, verifyTail: v.ok ? undefined : v.out };
    writeFileSync(path.join(runDir, "HALT.md"), [
      `# Loop halted — ${ticket}`,
      ``,
      `Gates: ${JSON.stringify(gates)}`,
      stuck ? `Worker left a ## Stuck note — read the ticket; resolving it is human graph-work.` : "",
      handoff ? `Worker left a ## Handoff note — a fresh session can resume from it.` : "",
      v.ok ? "" : `\n## verify tail\n\n\`\`\`\n${v.out}\n\`\`\``,
      `\nThe tree is exactly as the worker left it. Read the evidence before touching anything.`,
    ].join("\n"));
    break;
  }
} finally {
  rmSync(activeMarker, { force: true });
}

log({ event: "end", advanced, halted: halted?.ticket ?? null });

// ---- evidence outlives the machine ---------------------------------------------
// `.loop/` dies with its container; the caps this log exists to re-derive need rows that
// accumulate across machines. The conductor's true last act copies the run's log into the
// effort's committed history and commits that single file — file per run, so no two machines
// ever collide (scripts/loop/evidence.mjs has the ruling). Explicit path, worker mess untouched:
// `git commit -- <path>` commits only this file, so a halted tree stays exactly as evidence.
{
  const rel = effortLogFile(ticketDir, runId);
  const src = path.join(runDir, "log.jsonl");
  if (rel === null) {
    console.log("[conduct] run evidence not banked — ticket dir is outside .wayfinder/ (scratch run)");
  } else if (existsSync(src)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    copyFileSync(src, path.join(root, rel));
    const msg = `loop(${runId}): run evidence — ${advanced} advanced${halted ? `, halted at ${halted.ticket}` : ""}`;
    const add = trySh(`git add -- ${JSON.stringify(rel)}`);
    const commit = add.ok ? trySh(`git commit -m ${JSON.stringify(msg)} -- ${JSON.stringify(rel)}`) : add;
    if (commit.ok) {
      console.log(`[conduct] run evidence committed: ${rel}`);
    } else {
      // The file is in the tree either way; a failed commit is loud, never fatal — the run's
      // exit code belongs to the campaign, not to this bookkeeping.
      console.error(`[conduct] run evidence written to ${rel} but NOT committed — ${commit.out.split("\n")[0]}`);
    }
  }
}

process.exit(halted ? 2 : 0);
