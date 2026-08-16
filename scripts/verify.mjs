#!/usr/bin/env node
/**
 * The verification contract (ADR-0007): every stage in order, fail-fast, no caching anywhere.
 * The exit code is the whole contract; only this command's output is evidence.
 *
 * Stages that need a live service (Postgres) are deliberately NOT here — `pnpm test:db` runs on
 * demand — so green never depends on a daemon.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
const stages = [
  { name: "typecheck", cmd: "pnpm exec tsc --noEmit", cwd: root },
  { name: "lint", cmd: "pnpm exec eslint .", cwd: root },
  { name: "test", cmd: "pnpm exec vitest run", cwd: root },
  { name: "cad:ruff", cmd: "uv run ruff check .", cwd: cad },
  { name: "cad:test", cmd: "uv run pytest -q", cwd: cad },
];

const t0 = Date.now();
for (const stage of stages) {
  const started = Date.now();
  const result = spawnSync(stage.cmd, { cwd: stage.cwd, stdio: "inherit", shell: true, env: process.env });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`\nverify: ${stage.name} FAILED in ${secs}s`);
    console.error(`verify: if this looks like an environment fault, run pnpm checkup`);
    process.exit(result.status ?? 1);
  }
  console.log(`verify: ${stage.name} ok (${secs}s)`);
}
console.log(`\nverify: green in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
