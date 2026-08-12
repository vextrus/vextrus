#!/usr/bin/env node
/**
 * `pnpm checkup` — what the workspace reports about itself.
 *
 * Named `checkup` and not `doctor` because `pnpm doctor` is a pnpm built-in
 * that shadows a package script of that name and wins, printing nothing and
 * exiting 0 — indistinguishable from a check that ran and found everything
 * fine. The bare command has to work, so the name had to move (docs/TRAPS.md).
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
 * sensitive to daemons (ADR-0007, fail-closed); checkup is about the machine.
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
/**
 * A line that *describes* rather than judges (ticket 07, folded into 08). A
 * container result is only citable if it carries what varied — which Postgres
 * path was taken, whether a Docker daemon existed, when the run happened — and
 * none of those is a fitness question: Postgres from apt and Postgres from
 * compose are both fit. Structurally incapable of gating, because the verdict
 * counts BROKEN only. That is ticket 03's ruling kept intact, not bent.
 */
const INFO = "info";

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
/** The server's own account of itself, for the fingerprint line at the end. */
let pgOrigin = null;

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

        // The equivalence set. provision.sh puts Postgres on 5544 two ways —
        // compose when a Docker daemon answers, a native cluster when it does
        // not — and the cloud has taken the native branch on every image
        // measured so far while a dev machine takes compose on every session.
        // Both survive; this is what makes them the same database as far as
        // anything above them can tell (.wayfinder/harness ticket 05).
        //
        // Declared here and nowhere else: a second statement of the profile is
        // a second thing to disagree with.
        //
        // Gating, because a mismatch means the two machines genuinely differ,
        // which is the one condition the two-path arrangement exists to avoid.
        //
        // Its own try: by here the connection is proven, so a failure in this
        // query is a query fault and must not be reported as the outer catch's
        // "connect failed", which would send a session hunting credentials.
        try {
          const [shape] = await sql`
            SELECT split_part(current_setting('server_version'), '.', 1)::int AS major,
                   current_setting('server_encoding') AS encoding,
                   d.datcollate AS collate,
                   d.datctype   AS ctype,
                   (SELECT coalesce(string_agg(extname, ', ' ORDER BY extname), '')
                      FROM pg_extension
                     WHERE extname <> 'plpgsql') AS extra_extensions,
                   -- Descriptive, not asserted: the packager's blurb names who
                   -- built this server, and the data directory is where it
                   -- actually lives. Both go to the fingerprint, neither is
                   -- compared against anything.
                   version() AS origin,
                   current_setting('data_directory', true) AS data_dir
              FROM pg_database d
             WHERE d.datname = current_database()`;
          // `PostgreSQL 16.13 (Ubuntu 16.13-0ubuntu…) on x86_64…` -> the
          // parenthesised build, which is the part that differs between paths.
          pgOrigin = {
            build: shape.origin?.match(/\(([^)]+)\)/)?.[1] ?? shape.origin?.split(" on ")[0] ?? null,
            dataDir: shape.data_dir ?? null,
          };

          // Major only. The patch comes from whatever apt or the image ships
          // and is not ours to pin; the major is what migrations are written
          // for.
          const WANT_MAJOR = 16;
          // C.UTF-8 on both paths, not en_US.utf8: byte order is stable across
          // libc upgrades, where glibc's en_US collation changed at 2.28 and
          // silently corrupted text indexes in the wild. A register whose law
          // is deterministic identity must not sort by whichever libc the image
          // happened to carry. Pinned at creation — compose.yaml's
          // POSTGRES_INITDB_ARGS, and the native path's CREATE DATABASE ...
          // TEMPLATE template0.
          const WANT_LOCALE = "C.UTF-8";
          const WANT_ENCODING = "UTF8";

          const wrong = [];
          if (shape.major !== WANT_MAJOR) wrong.push(`major ${shape.major}, want ${WANT_MAJOR}`);
          if (shape.encoding !== WANT_ENCODING)
            wrong.push(`encoding ${shape.encoding}, want ${WANT_ENCODING}`);
          if (shape.collate !== WANT_LOCALE || shape.ctype !== WANT_LOCALE)
            wrong.push(`locale ${shape.collate}/${shape.ctype}, want ${WANT_LOCALE}`);
          // Nothing in db/migrations issues CREATE EXTENSION. An extension that
          // appeared on one path and not the other is a divergence whether or
          // not anything uses it yet, so the assertion is that the set is empty.
          if (shape.extra_extensions)
            wrong.push(`unexpected extensions: ${shape.extra_extensions}`);

          report(
            wrong.length === 0 ? OK : BROKEN,
            "pg profile",
            wrong.length === 0
              ? `PostgreSQL ${shape.major} · ${shape.encoding} · ${shape.collate} · no extensions` +
                " — compose and native agree"
              : `${wrong.join(" · ")} — this machine's Postgres differs from the other path's`,
          );
        } catch (err) {
          report(BROKEN, "pg profile", `could not read the profile: ${err.message}`);
        }
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

// Node. GATING as of ticket 08: the provisioner now shadows any older Node the
// image put ahead of ours, so a session below the pin means that shadow did not
// take — a machine that is not the one provisioning claimed to deliver. It was
// a note only while nothing could correct it (ticket 02 measured all three legs
// green on 22); a note nobody can act on is how the drift lasted a session.
//
// Below the pin is BROKEN. *Divergence* — other node binaries on PATH at other
// versions — stays a note: after shadowing they all resolve to ours, and a
// machine whose running Node is correct must not go red for what else is on
// disk (docs/TRAPS.md).
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
  } else if (!satisfied) {
    report(
      BROKEN,
      "node",
      `running v${running} but engines wants ${want}` +
        (others.length ? ` — ${others.join(", ")}` : "") +
        " · run scripts/provision.sh",
    );
  } else if (others.length === 0) {
    report(OK, "node", `v${running} (engines ${want})`);
  } else {
    report(NOTE, "node", `running v${running} — ${others.join(", ")}`);
  }
}

// pnpm: reported, gating on nothing. If `pnpm checkup` ran, pnpm exists, so
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
const dockerProbe = run("docker", ["info", "--format", "{{.ServerVersion}}"]);
{
  report(
    dockerProbe.ok ? OK : NOTE,
    "docker",
    dockerProbe.ok
      ? `daemon ${dockerProbe.out}`
      : dockerProbe.timedOut
        ? "binary present, daemon did not answer within budget"
        : "no daemon reachable — native-Postgres path",
  );
}

// ── the fingerprint ─────────────────────────────────────────────────────────

// What a container result must carry to be citable after the container is gone
// (ticket 07, folded into 08): which Postgres path ran, where that server came
// from, and when. `.data/` is gitignored and the machine is disposable, so a
// result quoted into a ticket is the only durable record — and a number without
// its environment is not a measurement.
//
// The path is *measured*, never inferred from the version blurb: it is decided
// by the same predicate `provision.sh` uses — does a daemon answer, and does
// compose actually hold a running postgres. A guess here would be the kind of
// silent default this repo bans.
{
  let path_;
  if (!dockerProbe.ok) {
    path_ = "native (no docker daemon)";
  } else {
    const ps = run("docker", ["compose", "ps", "--status", "running", "--format", "{{.Service}}"]);
    path_ = ps.ok && /(^|\n)postgres(\n|$)/.test(ps.out)
      ? "compose"
      : "native (daemon present, no compose postgres)";
  }

  report(
    INFO,
    "environment",
    [
      new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      `${process.platform} ${process.arch}`,
      `node ${process.version}`,
      dbReachable
        ? `postgres via ${path_}${pgOrigin?.build ? ` · ${pgOrigin.build}` : ""}` +
          `${pgOrigin?.dataDir ? ` · ${pgOrigin.dataDir}` : ""}`
        : `postgres unreachable · would be ${path_}`,
    ].join(" · "),
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
// process.exitCode rather than process.exit(): every probe has closed its
// connections by here, so falling off the end is enough, and it cannot truncate
// a buffered stdout the way exiting mid-flush can.
if (broken.length === 0) {
  console.log(`checkup: fit for work — verify, test:db and dev can all run (${elapsed}s)`);
  process.exitCode = 0;
} else {
  console.log(
    `checkup: NOT fit for work — ${broken.map((l) => l.label).join(", ")} (${elapsed}s)\n` +
      `         checkup reports; run scripts/provision.sh to repair.`,
  );
  process.exitCode = 1;
}
