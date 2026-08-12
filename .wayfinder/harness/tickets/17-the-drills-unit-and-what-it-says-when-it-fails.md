# The drill's unit, and what it says when it fails

wayfinder:grilling
Status: open
Claimed by:
Blocked by:

## Objective

`pnpm db:replay` works — the drill stands a database at the baseline, populates it, restores the
rows the fixtures deleted, and refuses to lie about what a migration does to them. Two things
about it are still undecided, and one of them decides what "wire the CI step when 0012 lands"
should actually mean. Decide the drill's **unit** (what a run is about) and its **failure
speech** (what a red says to the session that ran it).

## What forced it

A real run at `f7cfa2d`, this container, 2026-08-12 — `linux x64 · node v24.19.0 · postgres via
native · C.UTF-8`. It is the first timed run of the drill recorded anywhere, and it moved three
premises this effort had been reasoning from:

```
db:replay: replaying 0010_sighting-semantic.sql, 0011_sighting-per-ingest.sql
db:replay: over 44fb092c — arc(tickets): instance placement and the first identities
db:replay: baseline schema through 0009_register-sightings-rls.sql
  ... migrate through 0009: 10 applied · pnpm install 7.2s · test:db 38 passed in 12.67s
db:replay: restored 92 of 92 rows the fixtures deleted on exit
db:replay: 92 rows across 15 of 17 tables await 0010…, 0011…

db:replay: --- apply 0010_sighting-semantic.sql, 0011_sighting-per-ingest.sql ---
node:internal/modules/run_main:107
    triggerUncaughtException(
PostgresError: column "semantic" of relation "register_object_sightings" contains null values
    ... code: '23502', table_name: 'register_object_sightings', routine: 'ATRewriteTable'
db:replay: FAILED at db:migrate (replayed) (exit 1)

real 0m23.847s
```

1. **It costs 23.8s, not minutes.** The expense objection to running it per-commit is dead: a
   warm store installs the baseline's packages in 7.2s and its suite runs in 12.7s. Whatever is
   decided here is decided on meaning, not on cost.
2. **The red is a Node crash dump.** The exit code is mechanical and the last line names the
   phase, but the diagnosis a session actually reads is an uncaught `PostgresError` with a
   V8 stack trace through `postgres/src/connection.js`. Nothing in it says *this is `0010`, it is
   landed, it is not yours to fix, and ticket 10 already ruled it unrepairable.*
3. **Everything else in the drill is sound and should not be re-litigated**: 92 of 92 rows
   restored across 15 of 17 tables, the baseline suite green at its own commit, the archive
   trigger doing exactly what ticket 10 designed it to do.

## The question

**1. What is a run *about* — the repo's newest migration, or this commit's?**

Baseline derivation (`scripts/db-replay.mjs:107-131`) takes the commit that added the newest
migration *file in the tree* and uses its parent. For committed state that makes `applying` the
newest migration group and **never empty** — so the `nothing to replay` skip at lines 142-155,
written for CI's benefit (ticket 13), cannot fire on the case it was written for. Today that
reads as "red on every commit"; after 0012 lands it reads as **green on every commit, forever,
re-proving 0012** — a check whose result says nothing about the commit it ran on. The
interactive caller (someone who has just written a migration and not committed it) is served
correctly by the current rule and must stay served; the question is whether CI's unit is the
push/PR **range** instead, and whether one script can hold both without a flag that lies.

**2. What should a red say when the failing migration is not the session's?**

The drill knows both facts it would need: which migration `db:migrate` died on, and whether that
file is uncommitted (this session's) or landed (everyone's). A red on a landed migration is a
different event from a red on the one you just wrote, and only one of them is your work.
**Not amnesty** — the exit code does not move, and `0010` stays unrepaired, because a landed
migration is never edited. This is ticket 09's rule applied to the drill: a check that accuses
you of something you did not do is worse than no check, and the cure is speech, not a pass.

**3. Should the CI step's trigger be a mechanism rather than a comment?**

`.github/workflows/ci.yml` holds the step in a comment naming its own condition: *the commit that
lands migration 0012*. Nothing fires when that condition arrives. The repo's standing preference
is to retire prose into mechanism — and a guard that goes red exactly when the debt becomes
payable is the shape that preference usually takes here. Weigh it against the obvious objection:
a guard that exists to remind someone of a two-line YAML edit may be more machinery than the
debt it guards.

## Already ruled out — do not re-open without new evidence

- **Editing `0010`.** A landed migration is superseded, never edited (CLAUDE.md, ADR-0002).
- **Pinning `REPLAY_BASELINE` past 0010** (ticket 13): rigging a check to pass.
- **Running head's `test:db` as the drill's last step** (ticket 10): it measured fixture
  isolation and failed on it; `db:drift` is the correct last step.
- **A seed corpus** (tickets 07, 10): the archive trigger exists precisely so there is nothing to
  keep in step with the schema.

## Adjacent, not this ticket

`tenancy.dbspec`'s cleanup reaches across every suite (`delete from users where email like
'%@dbspec.local'`), which is how the drill found it. It is the map's open item about test
isolation and belongs to whichever effort owns the test lane.
