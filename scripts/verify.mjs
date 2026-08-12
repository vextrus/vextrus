#!/usr/bin/env node
/**
 * The verification contract (ADR-0007). Runs every stage in order, fail-fast,
 * with no caching anywhere — the exit code is the whole contract.
 *
 * Stages that need a live service (Postgres, browser) are deliberately NOT
 * here: `pnpm test:db` and Playwright run on demand and in CI. `next build`
 * needs no daemon, so it is a stage (ADR-0007 amendment, 2026-08-12).
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// The build stage owns its own output directory: never `.next`, so a running
// `next dev` is untouched, and safe to delete so every build is cold.
const verifyDistDir = ".next-verify";

const stages = [
  { name: "typecheck", cmd: "pnpm", args: ["exec", "tsc", "--noEmit"], cwd: root },
  { name: "lint", cmd: "pnpm", args: ["exec", "eslint", "."], cwd: root },
  { name: "test", cmd: "pnpm", args: ["exec", "vitest", "run"], cwd: root },
];

const cadDir = path.join(root, "cad");
if (existsSync(path.join(cadDir, "pyproject.toml"))) {
  stages.push(
    { name: "cad:ruff", cmd: "uv", args: ["run", "ruff", "check", "."], cwd: cadDir },
    { name: "cad:test", cmd: "uv", args: ["run", "pytest", "-q"], cwd: cadDir },
  );
}

// Last: the only stage that compiles and prerenders the whole app, so the cheap
// stages report first. It catches what the others structurally cannot — a route
// that type-checks and tests green but throws during static generation.
stages.push({
  name: "build",
  cmd: "pnpm",
  args: ["exec", "next", "build"],
  cwd: root,
  env: { NEXT_DIST_DIR: verifyDistDir },
  before: () => rmSync(path.join(root, verifyDistDir), { recursive: true, force: true }),
});

const t0 = Date.now();
for (const stage of stages) {
  stage.before?.();
  const started = Date.now();
  // One command string (all args are static): avoids DEP0190 under the
  // Windows shell:true that .cmd shims require.
  const result = spawnSync([stage.cmd, ...stage.args].join(" "), {
    cwd: stage.cwd,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...stage.env },
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`\nverify: ${stage.name} FAILED in ${secs}s`);
    // The pointer, on the failure path only. Half of docs/TRAPS.md exists
    // because an environment fault presented as a build fault, and the stage
    // that reports it names nothing about the machine. Inert by construction:
    // no probe, no daemon, no stage, and nothing on the green path — verify's
    // contract is unchanged (ADR-0007).
    // `pnpm run doctor`, never `pnpm doctor`: the bare form hits pnpm's own
    // built-in doctor, which prints nothing and exits 0 (docs/TRAPS.md).
    console.error(`verify: if this looks like an environment fault, run pnpm run doctor`);
    process.exit(result.status ?? 1);
  }
  console.log(`verify: ${stage.name} ok (${secs}s)`);
}
console.log(`\nverify: green in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
