#!/usr/bin/env node
/**
 * db:replay — let a migration meet rows.
 *
 * Every migration this repo has ever run has run against nothing: provision.sh
 * applies the whole set to an empty database, and `pnpm test:db` builds its
 * fixtures on an already-migrated schema. A migration that drops, mangles or
 * re-keys register rows breaks identity stability *quietly* — a wrong quantity,
 * not a red build. This is the drill that makes it loud.
 *
 * The unit is the *change*: the migrations this tree adds over `origin/main`,
 * which is exactly the set that will meet main's rows in one landing (ADR-0010).
 * Not the migration file — migrations land in ticket-sized groups (twelve across
 * six commits, schema and RLS always paired), so there is no tree in this history
 * where the second migration of a pair was head, and the fixtures that match
 * migration N-1 do not exist. And not the repo's newest migration, which was the
 * first rule here: that asks a *retrospective* question no committed tree can
 * answer honestly. It is never empty, so it re-proves the last landed group on
 * every commit forever — a green that says nothing about the commit it ran on,
 * and, while 0010 stands unrepaired, a red that accuses every commit of a fault
 * it did not cause (ticket 17).
 *
 * So the baseline is `git merge-base HEAD origin/main`: last landed schema,
 * populated by last landed code. A session that has just written a migration and
 * not committed it is served by the same rule — `head` is read from the working
 * tree — as is a branch that has committed two migration groups across two
 * commits, which the old rule under-measured.
 *
 *   1. Take `merge-base(HEAD, origin/main)` as the baseline. Stand up a scratch
 *      database at the baseline's migration set.
 *   2. Check the baseline tree out into a worktree and run *its* `pnpm test:db`
 *      against that database. Its fixtures match its schema, so they pass.
 *   3. Restore the rows those fixtures deleted on their way out (see below).
 *   4. Snapshot every table: row count and a content checksum.
 *   5. Apply the migrations this commit adds — against rows written before them.
 *   6. Snapshot again, print the delta.
 *   7. Check for drift: the database this produced is the schema the tree says.
 *
 * Step 3 is the load-bearing one. The dbspec fixtures each delete their own
 * tenant in `afterAll` — they share a dev database and have to — so at the end
 * of a `test:db` run the database holds exactly zero rows, and a drill that
 * simply ran the tests and then migrated would meet an empty database a second
 * time. So the drill archives every deleted row with an AFTER DELETE trigger
 * and puts them back. No fixture is edited and no test's behaviour changes: the
 * deletes still happen, they are just also recorded. A dbspec added tomorrow is
 * captured by the same trigger, which is why this is not a seed corpus — there
 * is nothing here to keep in step with the schema.
 *
 * The exit code is mechanical: the populate pass went red, a migration erred, or
 * the result drifted from the tree.
 * The row delta is *output*, not a verdict — a migration is allowed to change
 * rows, and only its author knows whether this change is the one they intended.
 * Same division of labour as `pnpm checkup`.
 *
 * Nothing precious is touched: the drill creates its own database (default
 * `vextrus_replay`), drops it on the next run, and refuses to run against the
 * database named in .env.
 *
 * Usage:  pnpm db:replay                 # baseline = merge-base with origin/main
 *         REPLAY_BASE_REF=<ref> pnpm db:replay
 *         REPLAY_BASELINE=<commit-ish> pnpm db:replay
 */
import { readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import postgres from "postgres";

const repoRoot = path.resolve(import.meta.dirname, "..");
try {
  process.loadEnvFile(path.join(repoRoot, ".env"));
} catch {
  // no .env — rely on the environment
}

const REPLAY_DB = process.env.REPLAY_DB_NAME ?? "vextrus_replay";
const worktreeDir = path.join(repoRoot, ".data", "replay-worktree");

const ownerUrl = process.env.MIGRATE_DATABASE_URL;
if (!ownerUrl) {
  console.error("MIGRATE_DATABASE_URL is not set (see .env.example)");
  process.exit(2);
}

const devDb = new URL(ownerUrl).pathname.slice(1);
if (devDb === REPLAY_DB) {
  console.error(
    `db:replay: refusing — REPLAY_DB_NAME is the database in .env (${devDb})`,
  );
  process.exit(2);
}

function withDatabase(rawUrl, database) {
  const u = new URL(rawUrl);
  u.pathname = `/${database}`;
  return u.toString();
}

function gitTry(...args) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf-8",
    timeout: 20_000,
  });
}

function git(...args) {
  const r = gitTry(...args);
  if (r.status !== 0) {
    console.error(`db:replay: git ${args.join(" ")} failed\n${r.stderr}`);
    process.exit(2);
  }
  return r.stdout.trim();
}

// --- what is being replayed, and over what -----------------------------------

const head = readdirSync(path.join(repoRoot, "db", "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const committed = git("ls-tree", "-r", "--name-only", "HEAD", "db/migrations/")
  .split("\n")
  .map((f) => path.basename(f.trim()))
  .filter((f) => f.endsWith(".sql"));

const BASE_REF = process.env.REPLAY_BASE_REF ?? "origin/main";

let baseRefSha = null;
let staleNote = null;
let baseline = process.env.REPLAY_BASELINE;
if (!baseline) {
  // Refresh the tracking ref before reading it. A stale one is not a smaller
  // question, it is a *wrong* one: it puts already-landed migrations back into
  // `applying`, and the drill then goes red at someone else for a migration
  // that has been on main for weeks. Measured 2026-08-12 on the container that
  // wrote this: `origin/main` sat 13 commits behind, which under this rule
  // would have replayed 0010 and 0011 all over again.
  //
  // Best effort, never fatal — an offline machine still gets a drill, it just
  // gets told what its baseline is as of, in the header and again in whatever
  // it goes red about. A stale ref never suppresses a finding (a lagging base
  // can only put *more* migrations into `applying`); what it does is invite
  // every red in the run to be read as this branch's fault.
  const remote = BASE_REF.includes("/") ? BASE_REF.split("/")[0] : null;
  if (remote && gitTry("remote").stdout?.split("\n").includes(remote)) {
    const fetched = gitTry(
      "fetch",
      "--quiet",
      remote,
      BASE_REF.slice(remote.length + 1),
    );
    if (fetched.status !== 0) {
      staleNote =
        `could not fetch ${BASE_REF} — using the tracking ref as it stands ` +
        `locally, last committed ${gitTry("log", "-1", "--format=%cs", BASE_REF).stdout?.trim() || "unknown"}`;
    }
  }

  const resolved = gitTry("rev-parse", "--verify", "--quiet", `${BASE_REF}^{commit}`);
  if (resolved.status !== 0) {
    console.error(
      `db:replay: ${BASE_REF} does not resolve to a commit here.\n` +
        `The drill's unit is what this tree adds over it, so there is no honest\n` +
        `baseline without it. Fetch it (git fetch origin main), or name the base\n` +
        `yourself with REPLAY_BASE_REF=<ref> / REPLAY_BASELINE=<commit-ish>.`,
    );
    process.exit(2);
  }
  baseRefSha = resolved.stdout.trim();

  const merged = gitTry("merge-base", "HEAD", baseRefSha);
  if (merged.status !== 0) {
    console.error(
      `db:replay: HEAD and ${BASE_REF} share no history — no baseline exists.`,
    );
    process.exit(2);
  }
  baseline = merged.stdout.trim();
}

const baselineSet = git("ls-tree", "-r", "--name-only", baseline, "db/migrations/")
  .split("\n")
  .map((f) => path.basename(f.trim()))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const baselineNewest = baselineSet.at(-1);
if (!baselineNewest) {
  console.error(`db:replay: ${baseline} has no migrations to replay from`);
  process.exit(2);
}
const applying = head.filter((f) => !baselineSet.includes(f));
if (applying.length === 0) {
  // Exit 0, not the refusal code the other preconditions use. CI calls this
  // blindly on every commit (ticket 13) and most commits add no migration, so
  // the skip has to live here — a path filter in the workflow would be project
  // knowledge in the one place this repo keeps free of it. It is a complete
  // answer rather than a refusal: 2 means "I cannot tell you", and this is
  // "there is nothing to tell". No finding is suppressed, because a tree that
  // adds no migration has nothing for a migration to meet.
  //
  // Under the first rule this branch was unreachable for any committed tree,
  // which is how ticket 17 found the unit was wrong: a skip written for CI's
  // most common case that could not fire on it.
  console.error(
    `db:replay: nothing to replay — this tree adds no migration over ` +
      `${BASE_REF} (${baseline.slice(0, 8)})`,
  );
  process.exit(0);
}

const childEnv = {
  ...process.env,
  DATABASE_URL: withDatabase(process.env.DATABASE_URL ?? ownerUrl, REPLAY_DB),
  MIGRATE_DATABASE_URL: withDatabase(ownerUrl, REPLAY_DB),
  AUTH_DATABASE_URL: withDatabase(
    process.env.AUTH_DATABASE_URL ?? ownerUrl,
    REPLAY_DB,
  ),
};

const started = Date.now();
const step = (msg) => console.log(`\ndb:replay: --- ${msg} ---`);

function run(label, command, args, opts = {}) {
  const r = spawnSync(command, args, {
    cwd: opts.cwd ?? repoRoot,
    stdio: "inherit",
    env: { ...childEnv, ...opts.env },
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    if (opts.allowFailure) return r.status;
    console.error(`\ndb:replay: FAILED at ${label} (exit ${r.status})`);
    process.exit(1);
  }
  return 0;
}

/**
 * Whose migration is this? The drill can answer mechanically — the commit that
 * added the file, tested for ancestry against the base ref — and until ticket 17
 * it answered with a V8 stack trace through postgres/src/connection.js instead.
 * A check that accuses you of something you did not do is worse than no check,
 * and the cure is speech, not a pass: the exit code does not move for any of
 * these three.
 */
function provenance(file) {
  if (!committed.includes(file)) {
    return { kind: "working-tree" };
  }
  const adding = gitTry(
    "log",
    "--diff-filter=A",
    "-1",
    "--format=%H%x00%s%x00%an",
    "HEAD",
    "--",
    `db/migrations/${file}`,
  );
  const [sha, subject, author] = (adding.stdout ?? "").trim().split("\0");
  if (!sha) return { kind: "committed" };
  const base =
    baseRefSha ??
    gitTry("rev-parse", "--verify", "--quiet", `${BASE_REF}^{commit}`).stdout?.trim();
  const landed =
    base && gitTry("merge-base", "--is-ancestor", sha, base).status === 0;
  // The ancestry test is sound in one direction only, and the direction matters:
  // a tracking ref only ever *lags* the branch it tracks, so ancestry proves
  // landed, while absence of ancestry proves nothing unless the ref is current.
  // Reading it as symmetric is how the first cut of this function told a session
  // to amend migration 0010 — the exact false accusation the speech exists to
  // delete — on a machine whose fetch had failed. Say "I cannot tell" instead.
  if (landed) return { kind: "landed", sha, subject, author };
  return { kind: staleNote ? "unsure" : "branch", sha, subject, author };
}

function speakTheRed(file, rows) {
  const say = (...lines) => console.error(lines.join("\n"));
  console.error("\ndb:replay: --- what this red is ---");
  if (!file) {
    say(
      `db:replay: db:migrate failed with every migration in this run recorded in`,
      `  __migrations. The fault is after the last statement of the last file —`,
      `  read db:migrate's own output above; the drill has nothing to add.`,
    );
    return;
  }
  const p = provenance(file);
  const met = `${file} failed against the ${rows} rows the baseline wrote before it.`;
  if (p.kind === "working-tree") {
    say(
      `db:replay: ${met}`,
      `  It is uncommitted, in your working tree — this one is yours, and this is`,
      `  the drill doing its whole job: the migration is fine against the empty`,
      `  database every other lane hands it, and wrong against rows. Repair it here,`,
      `  before it lands: a DEFAULT, a backfill, or NOT NULL set in a later step.`,
      `  Once it lands it is never edited (ADR-0002) and this becomes permanent.`,
    );
  } else if (p.kind === "landed") {
    say(
      `db:replay: ${met}`,
      `  It is LANDED — ${p.sha.slice(0, 8)} "${p.subject}", already on ${BASE_REF}.`,
      `  It is not yours and it is not repairable: a landed migration is superseded,`,
      `  never edited (ADR-0002). Nor is this run's question a real one — a landed`,
      `  migration has already met every database that exists.`,
      `  A landed file should not be in this run at all, so the baseline is not`,
      `  where you think it is:`,
      staleNote
        ? `    - ${staleNote}`
        : `    - REPLAY_BASELINE / REPLAY_BASE_REF is set to something older than the merge-base.`,
    );
  } else if (p.kind === "unsure") {
    say(
      `db:replay: ${met}`,
      `  It was added by ${p.sha?.slice(0, 8) ?? "an unknown commit"}` +
        (p.subject ? ` "${p.subject}"` : "") +
        (p.author ? ` — ${p.author}` : ""),
      `  and the drill cannot tell you whose it is, because it could not refresh`,
      `  the ref it measures against:`,
      `    - ${staleNote}`,
      `  Against a lagging ref, "not landed" is not a finding. Landed means never`,
      `  edited (ADR-0002) and not yours; unlanded means repair it before it lands.`,
      `  Opposite acts, so the drill names neither. Fetch ${BASE_REF} and run again.`,
    );
  } else {
    say(
      `db:replay: ${met}`,
      `  It was added by ${p.sha?.slice(0, 8) ?? "an unknown commit"}` +
        (p.subject ? ` "${p.subject}"` : "") +
        (p.author ? ` — ${p.author}` : ""),
      `  committed on this branch, not yet on ${BASE_REF}. So it is still this`,
      `  branch's to repair, and it must not land as it stands: nothing is landed`,
      `  until the merge, so amend it or supersede it within the branch. After the`,
      `  merge neither is available (ADR-0002).`,
    );
  }
  say(
    `  The exit code does not move for any of this. The drill is not asking you to`,
    `  agree with it — it is refusing to let the next migration meet rows quietly.`,
  );
}

/**
 * The child processes call process.loadEnvFile('.env') themselves. Node leaves
 * an already-set variable alone, which is why the overrides above survive — but
 * the drill writes to whatever database it ends up on, so this is checked
 * rather than assumed, in a child that resolves the URLs the way a dbspec does.
 */
function assertChildTargetsReplayDb(cwd) {
  const probe = `try { process.loadEnvFile(".env") } catch {}
    for (const k of ["DATABASE_URL", "MIGRATE_DATABASE_URL", "AUTH_DATABASE_URL"]) {
      const db = new URL(process.env[k]).pathname.slice(1);
      if (db !== ${JSON.stringify(REPLAY_DB)}) {
        console.error("db:replay: " + k + " resolves to '" + db + "', not the scratch database");
        process.exit(1);
      }
    }`;
  run("env guard", process.execPath, ["-e", probe], { cwd });
}

const maintenance = postgres(withDatabase(ownerUrl, "postgres"), {
  max: 1,
  onnotice: () => {},
});

let sql;
try {
  console.log(
    `db:replay: replaying ${applying.join(", ")} — what this tree adds over ${BASE_REF}\n` +
      `db:replay: over ${baseline.slice(0, 8)} — ${git("log", "-1", "--format=%s", baseline)}\n` +
      `db:replay: baseline schema through ${baselineNewest}` +
      (staleNote ? `\ndb:replay: NOTE ${staleNote}` : ""),
  );

  step(`scratch database ${REPLAY_DB}`);
  // Mirror the dev database's encoding and locale rather than restating them:
  // ticket 05 pinned C.UTF-8 across both Postgres paths, and a drill running
  // under a different collation would be measuring a different database.
  const [source] = await maintenance`
    SELECT pg_encoding_to_char(encoding) AS encoding, datcollate, datctype
      FROM pg_database WHERE datname = ${devDb}`;
  if (!source) {
    console.error(
      `db:replay: database ${devDb} not found — run scripts/provision.sh`,
    );
    process.exit(2);
  }
  await maintenance.unsafe(`DROP DATABASE IF EXISTS "${REPLAY_DB}" WITH (FORCE)`);
  await maintenance.unsafe(
    `CREATE DATABASE "${REPLAY_DB}" TEMPLATE template0 ENCODING '${source.encoding}' ` +
      `LC_COLLATE '${source.datcollate}' LC_CTYPE '${source.datctype}'`,
  );
  console.log(
    `db:replay: created ${REPLAY_DB} (${source.encoding}, ${source.datcollate})`,
  );

  assertChildTargetsReplayDb();

  step(`migrate through ${baselineNewest}`);
  // Head's migration files, not the baseline's: a landed migration is never
  // edited (ADR-0002), so the shared prefix is byte-identical and db:migrate
  // stays the single writer.
  run("db:migrate (baseline)", process.execPath, ["scripts/db-migrate.mjs"], {
    env: { MIGRATE_THROUGH: baselineNewest },
  });

  sql = postgres(childEnv.MIGRATE_DATABASE_URL, { max: 1, onnotice: () => {} });

  const tables = async () =>
    (
      await sql`SELECT tablename FROM pg_tables
                 WHERE schemaname = 'public' AND tablename <> '__migrations'
                 ORDER BY tablename`
    ).map((r) => r.tablename);

  step("archive deleted rows");
  await sql.unsafe(`
    CREATE SCHEMA replay_archive;
    CREATE TABLE replay_archive.rows (
      seq bigserial PRIMARY KEY,
      tbl text NOT NULL,
      data jsonb NOT NULL
    );
    CREATE FUNCTION replay_archive.capture() RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        INSERT INTO replay_archive.rows (tbl, data)
        VALUES (TG_TABLE_NAME, to_jsonb(OLD));
        RETURN NULL;
      END;
      $fn$;
  `);
  const baseTables = await tables();
  for (const t of baseTables) {
    await sql.unsafe(`
      CREATE TRIGGER zz_replay_capture AFTER DELETE ON public."${t}"
        FOR EACH ROW EXECUTE FUNCTION replay_archive.capture();
    `);
  }
  console.log(`db:replay: capturing deletes on ${baseTables.length} tables`);

  step(`populate — test:db at ${baseline.slice(0, 8)}`);
  rmSync(worktreeDir, { recursive: true, force: true });
  spawnSync("git", ["worktree", "prune"], { cwd: repoRoot });
  git("worktree", "add", "--detach", worktreeDir, baseline);
  try {
    run("pnpm install (baseline)", "pnpm", ["install", "--frozen-lockfile"], {
      cwd: worktreeDir,
    });
    assertChildTargetsReplayDb(worktreeDir);
    run("test:db (populate)", "pnpm", ["test:db"], { cwd: worktreeDir });
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", worktreeDir], {
      cwd: repoRoot,
    });
  }

  step("restore");
  for (const t of baseTables) {
    await sql.unsafe(`DROP TRIGGER zz_replay_capture ON public."${t}"`);
  }
  // Parents before children, so every foreign key is enforced for real on the
  // way back in — a restore that quietly disabled referential integrity would
  // hand the migration a set of rows no code could have written. Reverse
  // deletion order looks like it would do this and does not: an ON DELETE
  // CASCADE archives the parent before the children it takes with it.
  const edges = await sql`
    SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
     WHERE c.contype = 'f' AND n.nspname = 'public' AND c.conrelid <> c.confrelid`;
  const order = [];
  const pending = new Set(baseTables);
  while (pending.size > 0) {
    const ready = [...pending].filter(
      (t) =>
        !edges.some(
          (e) => e.child === t && pending.has(e.parent) && e.parent !== t,
        ),
    );
    if (ready.length === 0) {
      // A cycle of foreign keys has no valid insertion order at all; say so
      // rather than reaching for session_replication_role and pretending.
      console.error(
        `\ndb:replay: FAILED — foreign key cycle among ${[...pending].join(", ")}`,
      );
      process.exit(1);
    }
    for (const t of ready.sort()) {
      order.push(t);
      pending.delete(t);
    }
  }

  // The jsonb never leaves the server. Newest archived version of a row wins:
  // a row deleted, re-inserted and deleted again comes back as it last stood.
  let restored = 0;
  await sql.begin(async (tx) => {
    for (const t of order) {
      const r = await tx.unsafe(
        `INSERT INTO public."${t}"
           SELECT (jsonb_populate_record(NULL::public."${t}", data)).*
             FROM (SELECT data FROM replay_archive.rows
                    WHERE tbl = '${t}' ORDER BY seq DESC) s
           ON CONFLICT DO NOTHING`,
      );
      restored += r.count ?? 0;
    }
  });
  const [{ n: archivedCount }] = await sql`
    SELECT count(*)::int AS n FROM replay_archive.rows`;
  console.log(
    `db:replay: restored ${restored} of ${archivedCount} rows the fixtures deleted ` +
      "on exit (the rest are rows they deleted and wrote again)",
  );

  const snapshot = async () => {
    const out = new Map();
    for (const t of await tables()) {
      const [row] = await sql.unsafe(
        `SELECT count(*)::int AS n,
                md5(coalesce(string_agg(x, '' ORDER BY x), '')) AS sum
           FROM (SELECT t::text AS x FROM public."${t}" t) s`,
      );
      out.set(t, row);
    }
    return out;
  };

  const before = await snapshot();
  const rowsWaiting = [...before.values()].reduce((a, v) => a + v.n, 0);
  const populatedTables = [...before.values()].filter((v) => v.n > 0).length;
  if (rowsWaiting === 0) {
    console.error(
      "\ndb:replay: FAILED — the baseline database is empty; the drill would prove nothing",
    );
    process.exit(1);
  }
  console.log(
    `db:replay: ${rowsWaiting} rows across ${populatedTables} of ${before.size} ` +
      `tables await ${applying.join(", ")}`,
  );

  step(`apply ${applying.join(", ")}`);
  const applyStatus = run(
    "db:migrate (replayed)",
    process.execPath,
    ["scripts/db-migrate.mjs"],
    { allowFailure: true },
  );
  if (applyStatus !== 0) {
    // Which file died is measured, not parsed out of the child's text: the
    // ledger is written inside each migration's own transaction, so the first
    // file of this run missing from __migrations is the one that rolled back.
    const applied = new Set(
      (await sql`SELECT name FROM __migrations`).map((r) => r.name),
    );
    console.error(
      `\ndb:replay: FAILED at db:migrate (replayed) (exit ${applyStatus})`,
    );
    speakTheRed(
      applying.find((f) => !applied.has(f)),
      rowsWaiting,
    );
    process.exit(1);
  }

  const after = await snapshot();

  step("row delta across the migration");
  const names = [...new Set([...before.keys(), ...after.keys()])].sort();
  let moved = 0;
  for (const t of names) {
    const b = before.get(t);
    const a = after.get(t);
    const change = !a
      ? "table dropped"
      : !b
        ? "table added"
        : b.n !== a.n
          ? `${b.n} -> ${a.n} rows`
          : b.sum !== a.sum
            ? "same count, contents rewritten"
            : null;
    if (change) moved += 1;
    const mark = change ? "CHANGED" : b?.n > 0 ? "held" : "empty";
    console.log(
      `  ${mark.padEnd(8)} ${t.padEnd(28)} ${String(a?.n ?? "-").padStart(5)}` +
        (change ? `   ${change}` : ""),
    );
  }

  step("drift — the replayed schema is the tree's schema");
  // Not head's `pnpm test:db`. That was the obvious last step and it is the
  // wrong one: the drill's whole point is that the database still holds the
  // baseline's rows, and head's fixtures assume they own the tables — the first
  // run of it failed in tenancy.dbspec's cleanup (`delete from users where
  // email like '%@dbspec.local'`, which strands other suites' memberships),
  // measuring fixture isolation rather than the migration. Head's suite already
  // runs against a clean database in the parity gate. What is worth asserting
  // here is row-agnostic: the database this migration produced is the schema
  // the tree says it should be.
  run("db:drift", process.execPath, ["scripts/db-drift.mjs"]);

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `\ndb:replay: ${applying.length} migration(s) met ${rowsWaiting} rows, applied, ` +
      `and left no drift (${secs}s)`,
  );
  console.log(
    moved === 0
      ? "db:replay: every table came through the migration unchanged."
      : `db:replay: ${moved} table(s) changed across the migration — read the delta ` +
          "above and confirm every line is a change the migration meant to make.",
  );
} finally {
  await sql?.end();
  await maintenance.end();
}
