#!/usr/bin/env node
/**
 * The ONLY schema writer (ADR-0002). Ensures the app role exists, then applies db/migrations in
 * order as the owner role, each file in one transaction, recorded in the __migrations ledger.
 * Every environment — dev included — gets its schema exactly this way; there is no push lane.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../.env"));
} catch {
  // no .env — rely on the environment
}

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error("MIGRATE_DATABASE_URL is not set (see .env.example)");
  process.exit(2);
}
const appRolePassword = process.env.APP_DB_PASSWORD ?? "vextrus_app_dev_password";

const sql = postgres(url, { max: 1, onnotice: () => {} });
const migrationsDir = path.resolve(import.meta.dirname, "../db/migrations");
let failure = null;

try {
  // The app role first: migrations GRANT to it. LOGIN NOBYPASSRLS, non-owner — always subject
  // to the policies (ADR-0004). Needs CREATEROLE on the owner: on a fresh cluster,
  // `sudo -u postgres psql -p 5544 -c 'ALTER ROLE vextrus CREATEROLE'` once.
  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus_app') THEN
        CREATE ROLE vextrus_app LOGIN NOBYPASSRLS PASSWORD '${appRolePassword}';
      END IF;
    END $$;
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS __migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set((await sql`SELECT name FROM __migrations`).map((r) => r.name));
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(path.join(migrationsDir, file), "utf-8");
    try {
      await sql.begin(async (tx) => {
        // drizzle-kit emits `--> statement-breakpoint` between statements
        for (const statement of body.split("--> statement-breakpoint")) {
          if (statement.trim()) await tx.unsafe(statement);
        }
        await tx`INSERT INTO __migrations (name) VALUES (${file})`;
      });
    } catch (err) {
      failure = { file, err };
      break;
    }
    console.log(`applied ${file}`);
    ran += 1;
  }
  if (!failure) console.log(ran === 0 ? "db:migrate: up to date" : `db:migrate: ${ran} applied`);
} finally {
  await sql.end();
}

if (failure) {
  const { file, err } = failure;
  console.error(`\ndb:migrate: FAILED applying ${file}`);
  for (const [label, value] of [
    ["error", err.message],
    ["detail", err.detail],
    ["hint", err.hint],
    ["code", err.code],
  ]) {
    if (value) console.error(`  ${label.padEnd(8)} ${value}`);
  }
  console.error(
    `  state    rolled back — ${file} is not in __migrations, the schema is as it stood before it,\n` +
      `           and re-running resumes here.`,
  );
  process.exit(1);
}
