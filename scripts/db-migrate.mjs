#!/usr/bin/env node
/**
 * The ONLY schema writer (ADR-0002). Ensures the app role exists, then applies
 * db/migrations in order as the owner role. Every environment — dev included —
 * gets its schema exactly this way; there is no push lane.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../.env"));
} catch {
  // no .env — rely on the environment (CI)
}

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error("MIGRATE_DATABASE_URL is not set (see .env.example)");
  process.exit(2);
}

const appRolePassword =
  process.env.APP_DB_PASSWORD ?? "vextrus_app_dev_password";
const authRolePassword =
  process.env.AUTH_DB_PASSWORD ?? "vextrus_auth_dev_password";

const sql = postgres(url, { max: 1, onnotice: () => {} });
const migrationsDir = path.resolve(import.meta.dirname, "../db/migrations");

try {
  // Roles first: migrations GRANT to them. Dev passwords by default; prod sets
  // APP_DB_PASSWORD / AUTH_DB_PASSWORD (and may rotate with ALTER ROLE).
  // vextrus_auth is the auth lane (src/core/auth.ts): constrained like the app
  // role, but with explicit policies on the membership tables — better-auth
  // resolves sessions/organizations across tenants by design, and must never
  // run as owner on a request path.
  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus_app') THEN
        CREATE ROLE vextrus_app LOGIN NOBYPASSRLS PASSWORD '${appRolePassword}';
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus_auth') THEN
        CREATE ROLE vextrus_auth LOGIN NOBYPASSRLS PASSWORD '${authRolePassword}';
      END IF;
    END $$;
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS __migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await sql`SELECT name FROM __migrations`).map((r) => r.name),
  );
  let files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // MIGRATE_THROUGH stops the lane at a named migration, inclusive. It exists
  // for scripts/db-replay.mjs, which must stand the database up at N-1 before
  // it can let migration N meet rows. It is a stop point, not a second writer:
  // the ordering, the ledger and the transaction below are unchanged.
  const through = process.env.MIGRATE_THROUGH;
  if (through) {
    const stop = files.indexOf(through);
    if (stop === -1) {
      console.error(`MIGRATE_THROUGH=${through} is not a migration file`);
      process.exit(2);
    }
    files = files.slice(0, stop + 1);
  }

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(path.join(migrationsDir, file), "utf-8");
    await sql.begin(async (tx) => {
      // drizzle-kit emits `--> statement-breakpoint` between statements
      for (const statement of body.split("--> statement-breakpoint")) {
        if (statement.trim()) await tx.unsafe(statement);
      }
      await tx`INSERT INTO __migrations (name) VALUES (${file})`;
    });
    console.log(`applied ${file}`);
    ran += 1;
  }
  console.log(ran === 0 ? "up to date" : `db:migrate: ${ran} applied`);

  // constrained roles must be able to see the schema at all
  await sql.unsafe(
    `GRANT USAGE ON SCHEMA public TO vextrus_app, vextrus_auth;`,
  );
} finally {
  await sql.end();
}
