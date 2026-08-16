import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // *.dbspec.ts (live-Postgres tests) run via `pnpm test:db`, never in verify:
    // a stack-dependent test in the verify lane makes green depend on daemons (ADR-0007).
    include: ["src/**/*.spec.{ts,tsx}", "db/**/*.spec.ts"],
    // A net against a hung test, not a latency assertion: a first run on a cold machine pays
    // to materialise toolchains, and vitest's 5s default has failed verify for that alone.
    testTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
