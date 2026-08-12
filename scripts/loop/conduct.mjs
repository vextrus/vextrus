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
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

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
log({ event: "start", runId, ticketDir, arc, maxTickets, caps: { MAX_TURNS, WALL_CLOCK_MS } });

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

    log({ event: "spawn", ticket });
    const t0 = Date.now();
    const worker = spawnSync(
      `claude -p --output-format json --max-turns ${MAX_TURNS} --permission-mode bypassPermissions`,
      {
        cwd: root,
        shell: true,
        input: prompt,
        encoding: "utf8",
        timeout: WALL_CLOCK_MS,
        maxBuffer: 64 * 1024 * 1024,
        // TRAPS: nested headless sessions inherit a permission scrub without this.
        env: { ...process.env, CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "0" },
      },
    );
    let meta = {};
    try {
      const parsed = JSON.parse(worker.stdout);
      meta = { turns: parsed.num_turns, costUsd: parsed.total_cost_usd, workerResult: parsed.subtype ?? parsed.type };
    } catch {
      meta = { workerResult: worker.status === null ? "wall-clock-kill" : `exit ${worker.status}` };
    }
    meta.wallMs = Date.now() - t0;

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
process.exit(halted ? 2 : 0);
