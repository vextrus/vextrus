import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Live-Postgres tests (`pnpm test:db`). Kept out of `pnpm verify` on purpose:
 * a stack-dependent test in the verify lane is a named legacy trap.
 */
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, ".env"));
} catch {
  // no .env — rely on the environment (CI)
}
export default defineConfig({
  test: {
    environment: "node",
    include: ["db/**/*.dbspec.ts", "src/**/*.dbspec.ts"],
    fileParallelism: false,
    // Same net, same reason as vitest.config.ts: these cross Postgres and the
    // cad subprocess, and this lane runs inside the parity gate on machines
    // whose first read of any file is their most expensive one.
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
