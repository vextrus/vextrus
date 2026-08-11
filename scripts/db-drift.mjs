#!/usr/bin/env node
/**
 * Drift detector (ADR-0002): compares db/migrations on disk against the
 * __migrations ledger in the database. Exit 0 clean, 1 drift, 2 unreachable.
 * `--json` for machine-readable output. Dev-DB rot presenting as a build
 * fault cost the legacy repo sessions; this makes it a one-command diagnosis.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../.env"));
} catch {
  /* CI provides env */
}

const json = process.argv.includes("--json");
const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error("MIGRATE_DATABASE_URL is not set");
  process.exit(2);
}

const onDisk = readdirSync(path.resolve(import.meta.dirname, "../db/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = postgres(url, { max: 1, connect_timeout: 5 });
let inDb = [];
try {
  const ledgerExists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '__migrations'`;
  if (ledgerExists.length > 0) {
    inDb = (await sql`SELECT name FROM __migrations ORDER BY name`).map(
      (r) => r.name,
    );
  }
} catch (err) {
  console.error(`db unreachable: ${err.message}`);
  process.exit(2);
} finally {
  await sql.end();
}

const unapplied = onDisk.filter((f) => !inDb.includes(f));
const unknown = inDb.filter((f) => !onDisk.includes(f));
const clean = unapplied.length === 0 && unknown.length === 0;

if (json) {
  console.log(JSON.stringify({ clean, unapplied, unknown }));
} else if (clean) {
  console.log(`db in sync (${inDb.length} migrations)`);
} else {
  if (unapplied.length)
    console.log(`UNAPPLIED (run pnpm db:migrate):\n  ${unapplied.join("\n  ")}`);
  if (unknown.length)
    console.log(
      `UNKNOWN in db ledger (not on disk — wrong branch or deleted migration):\n  ${unknown.join("\n  ")}`,
    );
}
process.exit(clean ? 0 : 1);
