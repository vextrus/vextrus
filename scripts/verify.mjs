#!/usr/bin/env node
/**
 * The verification contract (ADR-0007): every stage in order, fail-fast, no caching anywhere.
 * The exit code is the whole contract; only this command's output is evidence.
 *
 * Stages that need a live service (Postgres) are deliberately NOT here — `pnpm test:db` runs on
 * demand — so green never depends on a daemon. `next build` is here (cold, own distDir): it
 * needs no daemon and no env — every module that reads env does so lazily, at request time.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// Stage zero, free by construction: the interpreter running this file must satisfy engines.
// pnpm only warns on an unsupported engine, and a machine below the pin is not the machine
// this contract was measured on.
{
  const want = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).engines?.node ?? "";
  const min = Number(want.match(/^>=\s*(\d+)/)?.[1]);
  const running = Number(process.versions.node.split(".")[0]);
  if (Number.isFinite(min) && running < min) {
    console.error(`verify: running Node v${process.versions.node}, but engines wants "${want}" — not the machine this contract was measured on.`);
    process.exit(1);
  }
}

const cad = path.join(root, "cad");
// The build stage is cold and lands in its own distDir (ADR-0007): no cache can lie, and a
// running `next dev` keeps its `.next`. A route can throw during prerender since the first request
// path landed (issue #66), so `next build` is part of the contract.
const buildDir = ".next-verify";
// The schema-drift probe (ADR-0002, issue #78): drizzle-kit generate against a scratch `out`
// seeded with a copy of db/migrations/meta. No database, nothing written to the tree; a schema
// edit that no migration carries produces a .sql file there, and that is the failure — printed,
// with the remedy. drizzle-kit resolves --out relative to cwd, so the path is given relative.
const drift = { dir: "" };
const driftStage = {
  name: "db:schema-drift",
  get cmd() {
    return `pnpm exec drizzle-kit generate --dialect postgresql --schema './db/schema/*.ts' --out ${path.relative(root, drift.dir)}`;
  },
  cwd: root,
  stdio: "pipe",
  before: () => {
    drift.dir = mkdtempSync(path.join(tmpdir(), "vextrus-schema-drift-"));
    cpSync(path.join(root, "db/migrations/meta"), path.join(drift.dir, "meta"), { recursive: true });
  },
  after: () => {
    const generated = readdirSync(drift.dir).filter((f) => f.endsWith(".sql"));
    const sql = generated.map((f) => readFileSync(path.join(drift.dir, f), "utf8")).join("\n");
    rmSync(drift.dir, { recursive: true, force: true });
    if (generated.length === 0) return null;
    return `db/schema/*.ts and db/migrations disagree — a migration is missing for:\n\n${sql}\nRun \`pnpm db:generate --name <slug>\`, review the SQL, commit it (never edit a landed migration).`;
  },
};
// The route validator Next generates (page/layout/route-handler signatures) is checked by tsc
// only if the generated types exist — never on a clean tree. `next typegen` writes them into the
// verify distDir first (issue #91), so `typecheck` covers them on every machine and the build stage
// need not check them a second time (next.config.ts sets ignoreBuildErrors under this env only).
const buildEnv = { VEXTRUS_NEXT_DIST_DIR: buildDir, NEXT_TELEMETRY_DISABLED: "1" };
const stages = [
  { name: "typegen", cmd: "pnpm exec next typegen", cwd: root, env: buildEnv, stdio: "pipe" },
  { name: "typecheck", cmd: "pnpm exec tsc --noEmit", cwd: root },
  { name: "lint", cmd: "pnpm exec eslint .", cwd: root },
  { name: "test", cmd: "pnpm exec vitest run", cwd: root },
  driftStage,
  { name: "cad:ruff", cmd: "uv run ruff check .", cwd: cad },
  { name: "cad:test", cmd: "uv run pytest -q", cwd: cad },
  {
    name: "build",
    cmd: "pnpm exec next build",
    cwd: root,
    env: buildEnv,
    before: () => rmSync(path.join(root, buildDir), { recursive: true, force: true }),
  },
];

const t0 = Date.now();
for (const stage of stages) {
  const started = Date.now();
  stage.before?.();
  const result = spawnSync(stage.cmd, { cwd: stage.cwd, stdio: stage.stdio ?? "inherit", encoding: "utf8", shell: true, env: { ...process.env, ...stage.env } });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  // `after` runs on every exit so a stage's scratch is always removed; the process fault wins.
  const checked = stage.after?.() ?? null;
  const fault = result.status !== 0 ? `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() : checked;
  if (fault !== null) {
    if (fault) console.error(fault);
    console.error(`\nverify: ${stage.name} FAILED in ${secs}s`);
    console.error(`verify: if this looks like an environment fault, run pnpm checkup`);
    process.exit(result.status || 1);
  }
  console.log(`verify: ${stage.name} ok (${secs}s)`);
}
console.log(`\nverify: green in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
