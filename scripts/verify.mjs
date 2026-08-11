#!/usr/bin/env node
/**
 * The verification contract (ADR-0007). Runs every stage in order, fail-fast,
 * with no caching anywhere — the exit code is the whole contract.
 *
 * Stages that need a live service (Postgres, browser) are deliberately NOT
 * here: `pnpm test:db` and Playwright run on demand and in CI.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

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

const t0 = Date.now();
for (const stage of stages) {
  const started = Date.now();
  // One command string (all args are static): avoids DEP0190 under the
  // Windows shell:true that .cmd shims require.
  const result = spawnSync([stage.cmd, ...stage.args].join(" "), {
    cwd: stage.cwd,
    stdio: "inherit",
    shell: true,
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`\nverify: ${stage.name} FAILED in ${secs}s`);
    process.exit(result.status ?? 1);
  }
  console.log(`verify: ${stage.name} ok (${secs}s)`);
}
console.log(`\nverify: green in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
