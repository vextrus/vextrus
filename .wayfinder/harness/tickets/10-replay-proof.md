# 10 — Replay-with-rows captures

Raw evidence for [A migration meets rows](10-a-migration-meets-rows.md). Container:
cloud sandbox, native Postgres 16 (no docker daemon), node v24.19.0, at `ea17fb7` plus this
ticket's changes. `.data/` is gitignored, so anything not copied here dies with the container.

## 1. What `pnpm test:db` writes, and what it leaves

`pg_stat_reset()`, one `pnpm test:db` run (46 passed), then `pg_stat_user_tables`:

```
__migrations                 ins=     0     invitations                  ins=     0
accounts                     ins=     2     levels                       ins=     3
acts                         ins=     4     memberships                  ins=     7
drawing_revisions            ins=    13     projects                     ins=     7
drawings                     ins=     9     refused_sightings            ins=     3
ingest_jobs                  ins=     5     register_object_sightings    ins=    24
ingests                      ins=    13     register_objects             ins=    24
sessions                     ins=     3     tenants                      ins=     8
users                        ins=     8     verifications                ins=     0
```

15 of the 17 non-ledger tables receive rows. `invitations` and `verifications` never do.

Exact counts immediately afterwards — `SELECT count(*)` on all 18 public tables:

```
__migrations 12   accounts 0   acts 0   drawing_revisions 0   drawings 0   ingest_jobs 0
ingests 0   invitations 0   levels 0   memberships 0   projects 0   refused_sightings 0
register_object_sightings 0   register_objects 0   sessions 0   tenants 0   users 0
verifications 0
```

Every fixture's `afterAll` deletes its own tenant. The suite writes 133 rows and leaves none.

## 2. The head suite cannot run at N−1

First attempt at the drill exactly as the ticket specified it — migrate through
`0010_sighting-semantic.sql`, populate with head's `pnpm test:db`:

```
FAIL  db/__tests__/revision-delta.dbspec.ts
Caused by: PostgresError: duplicate key value violates unique constraint
  "register_object_sightings_placement_uq"
 Test Files  1 failed | 5 passed (6)
```

`0011_sighting-per-ingest.sql` is the migration that widens that constraint to include
`ingest_id`. The head suite requires the schema the migration under test produces.

## 3. There is no tree at N−1

```
0000, 0001  b24c16b   0006, 0007  f9f159b
0002, 0003  46d549c   0008, 0009  7c9596c
0004, 0005  5e190cd   0010, 0011  4e48871
```

Twelve migrations, six commits, schema and RLS always in the same commit.

## 4. The drill, default baseline — `pnpm db:replay`, EXIT=1

```
db:replay: replaying 0010_sighting-semantic.sql, 0011_sighting-per-ingest.sql
db:replay: over 44fb092c — arc(tickets): instance placement and the first identities
db:replay: baseline schema through 0009_register-sightings-rls.sql
db:replay: created vextrus_replay (UTF8, C.UTF-8)
db:migrate: 10 applied
db:replay: capturing deletes on 17 tables
db:replay: --- populate — test:db at 44fb092c ---
 Test Files  5 passed (5)
      Tests  38 passed (38)
db:replay: restored 92 of 92 rows the fixtures deleted on exit
db:replay: 92 rows across 15 of 17 tables await 0010_..., 0011_...
db:replay: --- apply 0010_sighting-semantic.sql, 0011_sighting-per-ingest.sql ---
PostgresError: column "semantic" of relation "register_object_sightings" contains null values
  code: '23502', routine: 'ATRewriteTable'
db:replay: FAILED at db:migrate (replayed) (exit 1)
```

The migration, in full:

```sql
ALTER TABLE "register_object_sightings" ADD COLUMN "semantic" text NOT NULL;
```

No default, no backfill. It applies to an empty table and aborts against 24 rows.

## 5. The drill, clearing baseline — `REPLAY_BASELINE=46d549c`, EXIT=0

Baseline `0000–0003`: the fixtures of that tree write tenants, users, memberships, sessions
and accounts, and no sightings — so `0010` meets an empty table and applies.

```
db:replay: restored 12 of 12 rows the fixtures deleted on exit
db:migrate: 8 applied

db:replay: --- row delta across the migration ---
  held     accounts                         1
  CHANGED  acts                             0   table added
  ...
  held     memberships                      3
  held     sessions                         2
  held     tenants                          3
  held     users                            3
  empty    verifications                    0

db:replay: --- drift — the replayed schema is the tree's schema ---
db in sync (12 migrations)

db:replay: 8 migration(s) met 12 rows, applied, and left no drift (13s)
```

Every row written before the migrations was still there after them, byte-identical by
checksum. This is the run that proves the drill's tail — restore, delta, drift.

## 6. Two mechanisms that looked right and were not

**Reverse deletion order for the restore.** Children are deleted before parents, so reversing
should work — except an `ON DELETE CASCADE` archives the parent *before* the children it takes
with it:

```
PostgresError: insert or update on table "sessions" violates foreign key constraint
  "sessions_user_id_users_id_fk"
  detail: 'Key (user_id)=(aa6f547d-...) is not present in table "users".'
```

Replaced by a topological sort of the foreign-key graph, so Postgres enforces every key on the
way back in.

**Head's `pnpm test:db` as the last step.** All 46 tests passed; the cleanup did not:

```
FAIL  db/__tests__/tenancy.dbspec.ts
  at: `delete from users where email like '%@dbspec.local'`
Caused by: PostgresError: update or delete on table "users" violates foreign key constraint
  "memberships_user_id_users_id_fk" on table "memberships"
 Tests  46 passed (46)   Test Files  1 failed | 5 passed (6)
```

That reach across suites is fine when the database is empty at the start and no other suite has
left a membership behind. After a replay it is not. Replaced by `pnpm db:drift`.

## 7. verify

```
verify: green in 39.2s
```
