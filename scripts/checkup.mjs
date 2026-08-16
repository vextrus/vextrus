#!/usr/bin/env node
/**
 * `pnpm checkup` — what the machine reports about itself. It reports; it never repairs.
 *
 * Not a verify stage: verify is the tree's contract and must not become sensitive to daemons
 * (ADR-0007). Every line here traces to a fault that presented as a build fault and cost a
 * session (docs/lessons/). Exit 0 = fit for `pnpm verify`, `pnpm test:db` and `pnpm dev`;
 * exit 1 = at least one BROKEN line. `--hook` prints one summary line for the SessionStart hook.
 *
 * Named `checkup`, not `doctor`: `pnpm doctor` is a pnpm built-in that shadows a package script
 * of that name and wins, printing nothing and exiting 0.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import postgres from "postgres";

const root = path.resolve(import.meta.dirname, "..");
const hook = process.argv.includes("--hook");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  /* reported below */
}

const lines = [];
const report = (mark, label, detail) => lines.push({ mark, label, detail });
const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 5000, cwd });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
};

// node — engines is the pin, verify enforces it, this says it before verify does.
{
  const want = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const min = Number(want.engines?.node?.match(/(\d+)/)?.[1]);
  const running = Number(process.versions.node.split(".")[0]);
  report(running >= min ? "ok" : "BROKEN", "node", `v${process.versions.node} (engines ${want.engines?.node})`);
  const pnpm = run("pnpm", ["--version"]);
  const pinned = want.packageManager?.split("@")[1];
  report(pnpm.ok && pnpm.out === pinned ? "ok" : "BROKEN", "pnpm", pnpm.ok ? `${pnpm.out} (pinned ${pinned})` : "not found");
}

// NODE_ENV — set in the environment, it makes `next build` prerender with React's dev bundles.
report(process.env.NODE_ENV ? "BROKEN" : "ok", "NODE_ENV", process.env.NODE_ENV ? `set to ${process.env.NODE_ENV} — unset it` : "unset");

// uv + the cad venv — verify's ruff/pytest stages need both.
{
  const uv = run("uv", ["--version"]);
  report(uv.ok ? "ok" : "BROKEN", "uv", uv.ok ? uv.out : "not found — https://docs.astral.sh/uv/");
  const venv = existsSync(path.join(root, "cad", ".venv"));
  report(venv ? "ok" : "note", "cad/.venv", venv ? "present" : "absent — first `pnpm verify` runs `uv run`, which creates it");
}

// .env — the seam and the migration lane read it.
report(existsSync(path.join(root, ".env")) ? "ok" : "BROKEN", ".env", existsSync(path.join(root, ".env")) ? "present" : "missing — cp .env.example .env");

// Postgres: reachable as owner, app role exists, ledger in sync with db/migrations.
{
  const url = process.env.MIGRATE_DATABASE_URL;
  if (!url) {
    report("BROKEN", "postgres", "MIGRATE_DATABASE_URL unset");
  } else {
    const sql = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
    try {
      const [{ version }] = await sql`select version()`;
      const [{ encoding }] = await sql`select pg_encoding_to_char(encoding) as encoding from pg_database where datname = current_database()`;
      report("ok", "postgres", `${version.split(",")[0]} · ${new URL(url).host} · ${encoding}`);
      const roles = await sql`select rolname from pg_roles where rolname in ('vextrus_app')`;
      report(roles.length === 1 ? "ok" : "note", "app role", roles.length === 1 ? "vextrus_app present" : "vextrus_app absent — pnpm db:migrate creates it");
      const drift = run("node", ["scripts/db-drift.mjs", "--json"]);
      const d = drift.ok ? { clean: true } : JSON.parse(drift.out.split("\n").at(-1) || "{}");
      report(
        d.clean ? "ok" : "BROKEN",
        "migrations",
        d.clean ? "ledger in sync" : `drift — unapplied ${d.unapplied?.length ?? "?"}, unknown ${d.unknown?.length ?? "?"} — pnpm db:migrate`,
      );
    } catch (err) {
      report("BROKEN", "postgres", `${err.message} — native cluster on 5544, no Docker (ADR-0002)`);
    } finally {
      await sql.end();
    }
  }
}

// Port 3210 must be BINDABLE, not merely unlistened: a probe that only connects called a
// reserved port free once (docs/lessons/).
await new Promise((resolve) => {
  const srv = net.createServer();
  srv.once("error", (err) => {
    report("note", "port 3210", `cannot bind (${err.code}) — pnpm dev will fail; kill the listener or free the port`);
    resolve();
  });
  srv.listen(3210, "0.0.0.0", () => srv.close(() => (report("ok", "port 3210", "bindable"), resolve())));
});

const broken = lines.filter((l) => l.mark === "BROKEN");
if (hook) {
  console.log(
    broken.length === 0
      ? `checkup: machine fit (${lines.length} checks ok) — pnpm checkup for detail`
      : `checkup: ${broken.length} BROKEN — ${broken.map((l) => `${l.label}: ${l.detail}`).join("; ")}`,
  );
} else {
  for (const l of lines) console.log(`[${l.mark}] ${l.label.padEnd(12)} ${l.detail}`);
  console.log(broken.length === 0 ? "\ncheckup: fit for work" : `\ncheckup: ${broken.length} BROKEN`);
}
process.exit(broken.length === 0 ? 0 : 1);
