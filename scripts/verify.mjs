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
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// Stage zero: the interpreter running this file must satisfy package.json's
// engines. pnpm only *warns* on an unsupported engine, which is how a cloud
// sandbox ran a whole session on Node 22 — green, and materially not the
// machine that was asked for (ticket 08). The pin is declared; this makes it
// true. Free by construction: no subprocess, no daemon, so ADR-0007's
// fail-closed rule is untouched.
{
  const want = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).engines?.node ?? "";
  const min = Number(want.match(/^>=\s*(\d+)/)?.[1]);
  const running = Number(process.versions.node.split(".")[0]);
  if (Number.isFinite(min) && running < min) {
    console.error(
      `verify: running Node v${process.versions.node} at ${process.execPath}, but engines wants "${want}".\n` +
        `verify: this is not a warning to route around — a machine below the pin is not the\n` +
        `verify: machine this contract was measured on. Run scripts/provision.sh.`,
    );
    process.exit(1);
  }
}

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

// The build's output directory is deleted before the FIRST stage, not only before the build:
// Next.js auto-includes `<dist>/types/**` in the tsconfig, so a stale `.next-verify` from
// before a revert makes `typecheck` fail on routes that no longer exist — a tree fault that
// is actually residue (measured 2026-08-14, first verify after #46 reverted a route).
rmSync(path.join(root, verifyDistDir), { recursive: true, force: true });

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
    console.error(`verify: if this looks like an environment fault, run pnpm checkup`);
    process.exit(result.status ?? 1);
  }
  console.log(`verify: ${stage.name} ok (${secs}s)`);
}
console.log(`\nverify: green in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
