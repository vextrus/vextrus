import path from "node:path";
import { defineConfig } from "vitest/config";

/** Live-Postgres tests (`pnpm test:db`). Kept out of `pnpm verify` on purpose (ADR-0007). */
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, ".env"));
} catch {
  // no .env — rely on the environment
}
export default defineConfig({
  test: {
    environment: "node",
    include: ["db/**/*.dbspec.ts", "src/**/*.dbspec.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
