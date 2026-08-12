# A migration meets rows

wayfinder:task
Status: closed
Claimed by:
Blocked by: 09-the-gate-runs-cold.md

## Objective

Run a migration against a database that already has rows in it, in a container, and decide
whether the drill becomes a standing habit invoked whenever a migration lands.

## What forced it

Every migration this repo has ever run has run against **nothing**. `provision.sh` applies all 11
in order to an empty database; `pnpm test:db` builds its own fixtures on an already-migrated
schema; `db-drift` compares the on-disk set against the `__migrations` ledger and never touches a
row. There is no path anywhere — local, cloud, or CI — on which migration N meets data written
before it.

[What a disposable machine makes possible](07-what-a-disposable-machine-makes-possible.md) ranked
this highest on severity of anything on that map. A migration that silently drops, mangles, or
re-keys register rows breaks **identity stability across drawing revisions**, which is the
architectural invariant — and it breaks it quietly, as a wrong quantity rather than a red build.
The governing sentence applies directly: a partial faulty estimate is worse than none.

It is a container capability because the guardrail forbids doing this to `localhost:5544` on the
precious machine, and because a discarded database costs nothing.

## The question

The form ruled in, cheapest that produces the fact — **replay with rows**:

1. Migrate to N−1.
2. Run `pnpm test:db` to populate — 46 tests, fixtures that already exist and are already
   maintained.
3. Apply migration N.
4. Run `pnpm test:db` again.

Rejected on the record: **a seed corpus** built for this purpose — it needs its own owner, it goes
stale silently, and a stale seed produces a false green. Revisit only if replay-with-rows proves
too thin to catch anything. Also rejected: a **drop-and-rebuild recovery drill**, which is the
cold path ticket 09 already runs, against a dev database with nothing in it worth recovering.

What the ruling must settle beyond running it once:

- Whether step 2's fixtures actually write to the tables a migration would touch — if `test:db`
  populates only a corner of the schema, the drill is theatre and the resolution must say so.
- What "passes" means. Re-running `test:db` proves the schema still satisfies its tests; it does
  **not** prove rows written before the migration survived it. Whether the drill needs a row
  count or a checksum across the migration, or whether the tests are enough.
- Whether this is a script (`pnpm db:replay`, invocable by name) or a documented sequence. Ticket
  07's citability rule says a result is only quotable if the command that produced it is a
  versioned script — so if the drill is ever to be cited, it is a script.
- The trigger. The invoker is event-shaped: a migration lands, the author runs it. Whether that
  is written into `CLAUDE.md`, into the migration workflow, or left to the CI decision the map
  has not made.

## Exit criteria

- [x] The drill run in a container, against the most recent migration, result in `## Resolution`.
- [x] A verdict on whether `test:db`'s fixtures touch enough of the schema for the drill to mean
      anything — stated as a fact about which tables get rows, not as an impression.
- [x] If it is worth keeping: landed as a named script, and the trigger written where the author
      of the next migration will see it.
- [x] If it is not worth keeping: said plainly, with what would have to change to make it worth
      keeping.
- [x] `pnpm verify` green.

## Guardrails

- Never against `localhost:5544` on the Windows machine. Container only.
- `pnpm db:migrate` stays the only schema writer (ADR-0002). The drill invokes it; it does not
  reimplement stepping.
- No fixture may be edited to make the drill pass.
- Do not build a seed corpus inside this ticket. It was put and rejected; reopening it is a new
  decision, not an implementation detail.

## Resolution

**Kept, as `pnpm db:replay` (`scripts/db-replay.mjs`) — and its first honest run found a
migration in this repo that cannot be applied to a database with rows in it.**

Raw captures: [10-replay-proof.md](10-replay-proof.md).

### The drill as this ticket specified it does not work, and the reasons are facts

Three measurements, in the order they arrived, each one killing a step of the specified form:

1. **`test:db` leaves nothing behind.** It writes 133 rows across 15 of the 17 non-ledger
   tables — `invitations` and `verifications` are the two it never touches — and every
   fixture's `afterAll` deletes its own tenant, so the count on all 18 public tables
   immediately afterwards is zero. Step 2 of the specified drill ("run `test:db` to populate")
   populates nothing; step 3 would have met an empty database for the twelfth time. This
   answers the ticket's first question with a better verdict than it expected: the fixtures
   touch *plenty* of the schema, and then take it all away again.
2. **The head suite cannot run at N−1.** Run against `0010`, `revision-delta.dbspec` fails on
   a duplicate key — because `0011` is the migration that widens exactly that unique
   constraint. A suite is a contract on the schema it shipped with, and the migration under
   test is often the one it needs.
3. **There is no tree at N−1.** Twelve migrations across six commits: schema and RLS always
   land in the same ticket commit. No commit in this history has `0010` as its newest
   migration, and by this convention most future migrations will have no N−1 tree either.

### So the unit is the commit

What a landing migration actually meets is not "the schema one file back". It is **the previous
migration-bearing commit — last session's schema, holding rows written by last session's code**.
That is both faithful and cheap:

1. Baseline = HEAD when the newest migration is uncommitted (the author's case, which is the
   trigger), else the parent of the commit that added it.
2. Scratch database at the baseline's migration set, via `db:migrate MIGRATE_THROUGH=` — a stop
   point added to the one writer, not a second one. Head's files are used for the shared prefix,
   which is sound precisely because a landed migration is never edited.
3. **The baseline tree checked out into a worktree, running its own `pnpm test:db`.** Its
   fixtures match its schema, so they pass. `pnpm install --frozen-lockfile` there costs 2.5s
   against the shared store.
4. The rows those fixtures delete on the way out are put back.
5. The new migrations applied to them; before/after count and checksum per table.
6. `pnpm db:drift`.

### Getting the rows back without touching a fixture

An `AFTER DELETE` trigger on every table archives `to_jsonb(OLD)`; after the populate pass the
triggers come off and the rows go back through `jsonb_populate_record`. No fixture is edited and
no test's behaviour changes — the deletes still happen, they are merely also recorded — and a
dbspec written next month is captured by the same trigger. That is the answer to why this is not
the **seed corpus** the ticket rejected: there is nothing here to keep in step with the schema,
so there is nothing to go stale and produce a false green.

Reverse deletion order for the restore looked correct and is not: an `ON DELETE CASCADE`
archives the parent before the children it takes with it, and `sessions` came back before its
`users`. Replaced by a topological sort of the foreign-key graph, so **Postgres enforces every
key on the way back in** — a restore that reached for `session_replication_role = replica`
would hand the migration a set of rows no code could have written, and was rejected for that.

Also rejected, and worth naming because it was the cheap option: **populate at head and project
the rows back into the baseline schema** (jsonb drops the columns the new migration adds). It is
faster, needs no worktree, and is always green — because rows written by head code obey head
invariants. It could not have caught `0010`. That is the seed corpus's false-confidence failure
wearing a different hat.

### What "passes" means

The ticket asked whether re-running the suite is enough. It is not, and it is also not the right
last step: run after a replay, head's `test:db` had all 46 tests pass and then failed in
`tenancy.dbspec`'s cleanup, whose `delete from users where email like '%@dbspec.local'` strands
another suite's memberships. That measures fixture isolation, not the migration, and head's suite
already runs against a clean database in the parity gate. The last step is `pnpm db:drift`
instead — row-agnostic, and it asserts the thing that matters: the database this migration
produced is the schema the tree says it should be.

So the split is **checkup's** (ticket 03): the **exit code is mechanical** — the populate pass
went red, a migration erred, or the result drifted — and the **row delta is output**. A migration
is allowed to change rows; only its author knows whether this change is the one they meant.

### What it found

`0010_sighting-semantic.sql` is `ALTER TABLE "register_object_sightings" ADD COLUMN "semantic"
text NOT NULL` — no default, no backfill. Against the empty table it has met on every run this
repo has ever done, it applies. Against the 24 sightings the baseline's fixtures wrote, it aborts:
`column "semantic" of relation "register_object_sightings" contains null values`.

**Not repaired, deliberately.** A landed migration is never edited, and there is nothing to
supersede: the column is `NOT NULL` at head and that is correct. The defect is historical and
harmless — it can only bite a database sitting at `0009` *with sighting rows*, and no such
database exists (pre-first-customer; every dev database is built from empty). What has changed is
that the next one cannot land unnoticed. `pnpm db:replay` therefore exits 1 at today's head, for
a true reason, and goes green the moment anything else lands — the baseline moves to the commit
holding `0010`/`0011`, which the scratch database applies while empty.

### The trigger

`CLAUDE.md`'s feedback-loop block, under `pnpm verify`: *wrote a migration? run it once, before
you commit.* That is where a session looks, and pre-commit is where the answer is still cheap.
It is not a verify stage — it needs a database, a git worktree and ~40s, and verify's contract is
the tree, not the machine. It is not in the parity gate either: the gate proves the machine, and
this proves a change. CI would be the natural invoker; there is none
([ticket 13](13-ci-the-missing-trigger.md) owns that).

### Numbers

Full drill 13s on a clearing baseline, ~40s on the head baseline including the worktree install.
`pnpm verify` green in **39.2s**.
