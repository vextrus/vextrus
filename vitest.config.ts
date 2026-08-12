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
    // some machines' first run it is not survivable: a spec that crosses an
    // external toolchain pays to materialize it once, and image files are
    // fetched on first read — 68MB of never-touched image files read in 1.53s,
    // then 0.26s on re-read with the page cache dropped before both.
    //
    // Three containers went red against the 5s default, each taking `pnpm
    // verify` with it — cad.spec at 5006ms and 5008ms against ~1s warm,
    // boundaries.spec at 9.2s against ~1s warm — and `verify` answered by
    // reporting that the tree's contract does not hold on this machine, a false
    // accusation naming no repair.
    //
    // Provenance, because it is not all one machine: those figures and the 68MB
    // probe are in ticket 09's Resolution, measured on a snapshot-restored
    // container and on the third of five. The archived capture beside it
    // (09-cold-proof.md) is a DIFFERENT and milder container — one that
    // provisioned itself from empty — and it reproduced none of them, topping
    // out at 2315ms for a whole file. Read together they say the cost is
    // machine-dependent and unpredictable, which is the argument FOR a generous
    // net rather than against it: nothing in this lane measures speed.
    //
    // 60s is ~6x the worst red yet observed (9.2s), and a hang still fails the
    // run inside a minute.
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
