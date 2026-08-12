#!/usr/bin/env node
/**
 * `pnpm doctor` — what the workspace reports about itself.
 *
 * Pointed two directions on purpose. A *suspicious* session reads the output:
 * every line prints whatever its state, because the reason this command exists
 * is that a confused session has nowhere cheap to look. The provisioner reads
 * the exit code: 0 means this machine is fit for work, where fit is defined as
 * `provision.sh`'s own claim — `pnpm verify`, `pnpm test:db` and `pnpm dev`
 * can all run right now. A line can be loudly marked and still exit 0.
 *
 * Doctor reports; it never repairs. Repair is `scripts/provision.sh`, which is
 * idempotent by design.
 *
 * It is NOT a verify stage. Verify is the tree's contract and must not become
 * sensitive to daemons (ADR-0007, fail-closed); doctor is about the machine.
 *
 * Every line traces to an entry in docs/TRAPS.md that actually bit. A line no
 * one needed is a line that will go stale, so the trap is cited beside it.
 *
 * There is no third exit state. "cannot tell" is a per-line judgment: each
 * probe declares whether failing to measure is itself a fault, which is what
 * keeps the exit code a boolean the provisioner can trust.
 */
import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const root = path.resolve(import.meta.dirname, "..");

try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  /* a machine with no .env is a finding, not a crash — reported below */
}

/**
 * The budget. Doctor's premise is that it is cheap enough to run on a hunch,
 * so no probe may wait unbounded: on a local socket everything answers in tens
 * of milliseconds, and 2s only ever elapses when something is genuinely wrong.
 * In that case the timeout *is* the finding.
 */
const PROBE_MS = 2000;

const startedAt = Date.now();

const OK = "ok";
const NOTE = "note";
const BROKEN = "BROKEN";

const lines = [];
function report(mark, label, detail) {
  lines.push({ mark, label, detail });
}

// ── probes ──────────────────────────────────────────────────────────────────

/** A subprocess that cannot outlive the budget. Never throws. */
function run(cmd, args, ms = PROBE_MS) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: ms,
    shell: process.platform === "win32",
  });
  return {
    ok: r.status === 0,
    timedOut: r.error?.code === "ETIMEDOUT",
    status: r.status,
    // psql-style output carries \r on Windows and silently breaks anything
    // built from it (docs/TRAPS.md) — strip at the seam, once.
    out: `${r.stdout ?? ""}`.replace(/\r/g, "").trim(),
    err: `${r.stderr ?? ""}`.replace(/\r/g, "").trim(),
  };
}

/** TCP reachability, per address family. Resolves to null on timeout/refusal. */
function probeTcp(host, port, ms = PROBE_MS) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(ms);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(null));
    socket.once("error", () => done(false));
  });
}

/**
 * Who holds a port. Best-effort and never gating: the platform may simply
 * decline to say, and no build has ever failed because of that. It exists
 * because the dev-server trap's cure is "kill the port PID".
 */
function portOwner(port) {
  if (process.platform === "win32") {
    const r = run("netstat", ["-ano", "-p", "tcp"]);
    const line = r.out.split("\n").find((l) => /LISTENING/.test(l) && l.includes(`:${port} `));
    const pid = line?.trim().split(/\s+/).pop();
    return pid ? `pid ${pid}` : null;
  }
  const r = run("ss", ["-ltnpH", `sport = :${port}`]);
  const pid = r.out.match(/pid=(\d+)/)?.[1];
  return pid ? `pid ${pid}` : null;
}

// ── database ────────────────────────────────────────────────────────────────

/**
 * The three URLs are three *roles* against one database (ADR-0004), not three
 * databases. Disagreement is a configuration fault that would otherwise
 * present as drift-that-isn't, so it is checked before any connection.
 */
const DB_URLS = {
  vextrus: process.env.MIGRATE_DATABASE_URL,
  vextrus_app: process.env.DATABASE_URL,
  vextrus_auth: process.env.AUTH_DATABASE_URL,
};

function target(url) {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
}

let dbReachable = false;

const missing = Object.entries(DB_URLS)
  .filter(([, url]) => !url)
  .map(([role]) => role);

if (missing.length > 0) {
  report(BROKEN, "database", `connection strings not set for ${missing.join(", ")} (see .env.example)`);
} else {
  const targets = [...new Set(Object.values(DB_URLS).map(target))];
  if (targets.length > 1) {
    report(BROKEN, "database", `the three URLs point at different databases: ${targets.join(" vs ")}`);
  } else {
    // Which listener actually owns the port. A container proxy can hold
    // 0.0.0.0:5544 while another listener holds [::1]:5544 (docs/TRAPS.md),
    // so the families are probed separately rather than through one hostname.
    const u = new URL(DB_URLS.vextrus);
    const port = Number(u.port || 5432);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
    const families = isLocal
      ? { "127.0.0.1": await probeTcp("127.0.0.1", port), "::1": await probeTcp("::1", port) }
      : { [u.hostname]: await probeTcp(u.hostname, port) };
    const answering = Object.entries(families)
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    if (answering.length === 0) {
      // A stopped database is unfit: two of the provisioner's three legs
      // (`pnpm test:db`, `pnpm dev`) cannot run without it.
      report(BROKEN, "database", `nothing listening on ${u.hostname}:${port} — is it started?`);
    } else {
      dbReachable = true;
      const owner = isLocal ? portOwner(port) : null;
      const sql = postgres(DB_URLS.vextrus, { max: 1, connect_timeout: PROBE_MS / 1000 });
      try {
        const [row] = await sql`
          SELECT current_database() AS db,
                 current_user       AS role,
                 host(inet_server_addr()) AS addr,
                 inet_server_port() AS port,
                 -- split_part: server_version carries the packager's blurb
                 -- ("16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)"), and the number
                 -- is the part anyone reads.
                 split_part(current_setting('server_version'), ' ', 1) AS version`;
        report(
          OK,
          "database",
          `${row.db} on ${row.addr ?? u.hostname}:${row.port} · PostgreSQL ${row.version} · as ${row.role}` +
            `${answering.length > 1 ? ` · answering on ${answering.join(" and ")}` : ""}` +
            `${owner ? ` · ${owner}` : ""}`,
        );
      } catch (err) {
        // The socket answered but the session did not open: credentials or
        // grants, not a stopped server. Distinct finding, same verdict.
        report(BROKEN, "database", `listening on ${u.hostname}:${port} but connect failed: ${err.message}`);
      } finally {
        await sql.end();
      }
    }
  }

  // Roles. `pnpm test:db` is the RLS seam test and cannot pass without
  // vextrus_app, so a role that will not connect is unfit — not merely notable.
  if (dbReachable) {
    const failed = [];
    for (const [role, url] of Object.entries(DB_URLS)) {
      const sql = postgres(url, { max: 1, connect_timeout: PROBE_MS / 1000 });
      try {
        await sql`SELECT 1`;
      } catch (err) {
        failed.push(`${role} (${err.message})`);
      } finally {
        await sql.end();
      }
    }
    report(
      failed.length === 0 ? OK : BROKEN,
      "roles",
      failed.length === 0
        ? Object.keys(DB_URLS).join(", ")
        : `cannot connect as ${failed.join("; ")}`,
    );
  } else {
    report(NOTE, "roles", "skipped — database unreachable");
  }
}

// Drift. One implementation only: two that can disagree is a worse failure
// than the process spawn costs, and db-drift's 0/1/2 exit codes already carry
// the vocabulary this needs (docs/TRAPS.md — drift presents as an app fault).
if (dbReachable) {
  const r = run("node", [path.join(root, "scripts", "db-drift.mjs"), "--json"], PROBE_MS * 2);
  if (r.timedOut) {
    report(BROKEN, "drift", "db-drift did not answer within budget");
  } else if (r.status === 2) {
    report(BROKEN, "drift", `cannot tell — ${r.err || "database unreachable"}`);
  } else {
    try {
      const { clean, unapplied, unknown } = JSON.parse(r.out);
      report(
        clean ? OK : BROKEN,
        "drift",
        clean
          ? "schema in sync with db/migrations"
          : [
              unapplied.length ? `${unapplied.length} unapplied (run pnpm db:migrate)` : "",
              unknown.length ? `${unknown.length} in ledger but not on disk` : "",
            ]
              .filter(Boolean)
              .join(" · "),
      );
    } catch {
      report(BROKEN, "drift", `db-drift output unparseable: ${r.out || r.err}`);
    }
  }
} else {
  report(NOTE, "drift", "skipped — database unreachable");
}

// ── the web port ────────────────────────────────────────────────────────────

// A dev server is a second writer (docs/TRAPS.md). Notable, never gating: an
// occupied :3210 is normal when you meant to leave one running.
{
  const held = (await probeTcp("127.0.0.1", 3210)) === true || (await probeTcp("::1", 3210)) === true;
  const owner = held ? portOwner(3210) : null;
  report(
    held ? NOTE : OK,
    "port 3210",
    held ? `held${owner ? ` by ${owner}` : ""} — a dev server is a second writer` : "free",
  );
}

// ── toolchain ───────────────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

// uv is gating: verify.mjs adds the cad stages whenever cad/pyproject.toml
// exists and shells `uv run` unconditionally. No uv, no verify.
{
  const r = run("uv", ["--version"]);
  report(
    r.ok ? OK : BROKEN,
    "uv",
    r.ok ? r.out : "not found — verify's cad stages shell `uv run` and cannot start",
  );
}

// System Python is deliberately NOT reported: uv owns cad/'s interpreter and
// fetches its own, so the system version is a red herring on a healthy machine
// (provision.sh, and cad/pyproject.toml's requires-python >=3.13 vs a 3.11 host).

// Node. Notable, not broken: ticket 02 measured all three legs green on 22, so
// failing here would redden a machine that demonstrably works. The finding is
// the *divergence* — the image's Node can outrank the one you installed
// (docs/TRAPS.md); a bare version string hides exactly that. Ticket 08 owns
// the cure, and this line is promoted to gating once PATH ordering is fixed.
{
  const want = pkg.engines?.node ?? "";
  const min = Number(want.match(/^>=\s*(\d+)/)?.[1]);
  const running = process.versions.node;
  const satisfied = Number.isFinite(min) ? Number(running.split(".")[0]) >= min : null;

  const finder = process.platform === "win32" ? run("where", ["node"]) : run("which", ["-a", "node"]);
  const others = [];
  for (const p of new Set(finder.out.split("\n").map((s) => s.trim()).filter(Boolean))) {
    const v = run(p, ["-v"]);
    if (v.ok && v.out.replace(/^v/, "") !== running) others.push(`${p} is ${v.out}`);
  }

  if (satisfied === null) {
    report(NOTE, "node", `v${running} — cannot tell against engines "${want}"`);
  } else if (satisfied && others.length === 0) {
    report(OK, "node", `v${running} (engines ${want})`);
  } else {
    report(
      NOTE,
      "node",
      `running v${running}${satisfied ? "" : ` but engines wants ${want}`}` +
        (others.length ? ` — ${others.join(", ")}` : ""),
    );
  }
}

// pnpm: reported, gating on nothing. If `pnpm doctor` ran, pnpm exists, so
// absence is unreportable by construction, and a mismatch against
// packageManager has never bitten.
{
  const r = run("pnpm", ["--version"]);
  const pinned = (pkg.packageManager ?? "").replace(/^pnpm@/, "");
  const matches = r.ok && r.out === pinned;
  report(
    r.ok ? OK : NOTE,
    "pnpm",
    r.ok ? `${r.out}${matches ? "" : ` (packageManager pins ${pinned})`}` : "version unreadable",
  );
}

// NODE_ENV set to anything is a fault: Next sets it per command, and forcing
// it makes the production prerender load React's development bundles — a null
// dispatcher during `next build` (docs/TRAPS.md).
{
  const v = process.env.NODE_ENV;
  report(
    v ? BROKEN : OK,
    "NODE_ENV",
    v ? `set to "${v}" — unset it; it breaks next build` : "unset",
  );
}

// A Docker binary is not a Docker daemon (docs/TRAPS.md): `docker info` is the
// probe that tells the truth. Notable, never gating — the native-Postgres path
// is a supported branch, so no daemon is not the same as no database.
{
  const r = run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  report(
    r.ok ? OK : NOTE,
    "docker",
    r.ok
      ? `daemon ${r.out}`
      : r.timedOut
        ? "binary present, daemon did not answer within budget"
        : "no daemon reachable — native-Postgres path",
  );
}

// ── output ──────────────────────────────────────────────────────────────────

const width = Math.max(...lines.map((l) => l.label.length));
console.log("");
for (const { mark, label, detail } of lines) {
  console.log(`  ${`[${mark}]`.padEnd(8)} ${label.padEnd(width)}  ${detail}`);
}

const broken = lines.filter((l) => l.mark === BROKEN);
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log("");
// process.exitCode, never process.exit(): stdout is a pipe when pnpm runs the
// script rather than a TTY, and a pipe's writes are asynchronous — exiting
// immediately after the final console.log truncates the whole report. Observed
// exactly that: `node scripts/doctor.mjs` printed, `pnpm doctor` printed
// nothing. Setting the code and falling off the end lets stdout flush.
if (broken.length === 0) {
  console.log(`doctor: fit for work — verify, test:db and dev can all run (${elapsed}s)`);
  process.exitCode = 0;
} else {
  console.log(
    `doctor: NOT fit for work — ${broken.map((l) => l.label).join(", ")} (${elapsed}s)\n` +
      `        doctor reports; run scripts/provision.sh to repair.`,
  );
  process.exitCode = 1;
}
