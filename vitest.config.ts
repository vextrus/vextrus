import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // *.dbspec.ts (live-Postgres tests) run via `pnpm test:db`, never in verify:
    // a stack-dependent test in the verify lane is a named legacy trap.
    include: ["src/**/*.spec.{ts,tsx}", "db/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
