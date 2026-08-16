import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env — rely on the environment
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/*.ts",
  out: "./db/migrations",
  dbCredentials: {
    // Migrations always run as the owner role, never the app role (ADR-0002).
    url: process.env.MIGRATE_DATABASE_URL ?? "",
  },
});
