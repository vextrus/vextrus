import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // *.dbspec.ts (live-Postgres tests) run via `pnpm test:db`, never in verify:
    // a stack-dependent test in the verify lane is a named legacy trap.
    include: ["src/**/*.spec.{ts,tsx}", "db/**/*.spec.ts"],
    // A net against a hung test, not an assertion about speed — no test here
    // measures latency, and the ones that do state their own bound.
    //
    // vitest's default is 5s, which is a latency assertion nobody wrote, and on
    // a container's first run it is not survivable: the specs that cross an
    // external toolchain pay to materialize it once, and the image's files are
    // fetched on first read (harness ticket 09 — 68MB of never-touched image
    // files read in 1.53s, then 0.26s on re-read with the page cache dropped
    // both times). Measured against that 5s default: cad.spec 5006ms cold
    // against 1.06s warm, boundaries.spec 9.2s against 713ms. Both went red on
    // the parity gate, and `pnpm verify` answered by reporting that the tree's
    // contract does not hold on this machine — a false accusation naming no
    // repair, which is the failure this whole effort exists to end.
    //
    // 60s is ~6x the worst first-touch cost yet measured, and a hang still
    // fails the run in a minute.
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
