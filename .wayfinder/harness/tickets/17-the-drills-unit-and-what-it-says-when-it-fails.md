# The drill's unit, and what it says when it fails

wayfinder:grilling
Status: closed
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

## Resolution

**The unit is the change, the speech names whose migration it is, and question 3 dissolved
rather than being answered.** All three were one fault: the drill was asking a *retrospective*
question, and everything downstream — the dead skip, the false red, the held CI step, the
trigger someone would have had to remember — was a consequence of the unit being wrong.

**1. A run is about what this tree adds over `origin/main`.** The baseline is
`merge-base(HEAD, origin/main)`; `applying` is head's migration files minus that tree's. One
rule, no flag, and it serves both callers the old one split between — because `head` is read
from the working tree, a session that has just written a migration and not committed it is
covered by the same line that covers a branch which committed two migration groups across two
commits (which the old rule *under*-measured, replaying only the newest). The unit is now
exactly what ADR-0010's landing act introduces: the set of migrations that will meet main's
rows in one merge.

The old rule — parent of the commit that added the repo's newest migration — could not be
right for a committed tree in either direction. It is never empty, so the `nothing to replay`
skip written for CI's most common case (ticket 13) could not fire on it; today that reads as
red on every commit, and after 0012 lands it would read as green on every commit forever,
re-proving a migration nobody in that run touched. The interactive caller's special case
(lines 108-129) is **deleted**, not kept alongside: it was the merge-base answer in the one
case where the two agree.

Consequences, both intended and both worth stating plainly:

- **The drill is green and meaningful at head, today** — `nothing to replay — this tree adds
  no migration over origin/main (3560eb16)`, exit 0 in **2.4s**. This is not the rejected
  `REPLAY_BASELINE` pin: nothing is pinned and no finding is suppressed, because a tree that
  adds no migration has nothing for a migration to meet. **0010 is not amnestied** — its
  finding stands in ticket 10, and the drill still reproduces it verbatim on demand
  (`REPLAY_BASELINE=44fb092c`, evidence below).
- **The push-to-main canary always skips**, because there HEAD *is* the base ref. That question
  was answered on the PR run; asking it again after the merge is precisely the forever-green
  this replaces.
- **A migration pushed straight to `main` is never replayed.** Named, not papered over: it is
  guarded by `.githooks/pre-push` refusing `main` (ticket 16) and by the branch protection the
  map still lists as the one outstanding administrative act.

**2. A red names the file, the database's own sentence, and whose migration it is** — in two
places, split by who knows what. `db:migrate` says what the *database* said: `FAILED applying
<file>` with error / detail / hint / relation / column / constraint / code, plus the state line
(rolled back, not in `__migrations`, re-running resumes here). That replaces an uncaught
rejection whose V8 stack ran through `postgres/src/connection.js`, and it is a fix to
`db:migrate` for every caller, not to the drill. `db:replay` then says what it *means*, under
`--- what this red is ---`, in four classes:

- **working tree** — yours; the drill doing its whole job; repair it here (a DEFAULT, a
  backfill, NOT NULL in a later step) before it lands and becomes permanent;
- **committed on this branch** — added by `<sha> "<subject>" — <author>`, not yet on the base
  ref, so still this branch's to repair; amend or supersede while both are still available;
- **landed** — never edited (ADR-0002), not yours, and *not a real question*, so the finding is
  that the baseline is not where you think it is;
- **cannot tell** — the ref could not be refreshed, so the drill names neither.

Which file failed is **measured, not parsed**: the ledger is written inside each migration's
own transaction, so the first file of the run missing from `__migrations` is the one that
rolled back. Provenance is `git log --diff-filter=A` for the file plus an ancestry test against
the base ref. **Not amnesty in any class** — the exit code never moves, and the closing lines
say so.

**The fourth class was forced by the proof, not designed.** With a base ref that could not be
refreshed, the first cut classified landed `0010` as *committed on this branch, still yours to
repair* — the exact false accusation ticket 09 deleted, manufactured by this ticket's own cure.
The ancestry test is sound in one direction only: a tracking ref lags, so ancestry proves
landed while absence proves nothing. Hence a fetch of the base ref before deriving the baseline
(best-effort, 20s cap, **never fatal**), a `NOTE` in the header when it fails, and "I cannot
tell you whose this is, fetch and run again" instead of a guess. This was not hypothetical: on
the container that closed this ticket `origin/main` sat **13 commits stale** on arrival, which
under the merge-base rule alone would have replayed 0010 and 0011 and blamed this branch.
A ref that resolves to nothing at all **refuses, exit 2** — no fallback to the old rule, because
a baseline nobody chose is the silent default this repo bans.

**3. The CI step is wired now; no trigger mechanism was built.** The debt was never the two
lines of YAML — it was that the step was meaningless on a PR, which is question 1. With the
unit fixed the drill is green from birth, so `- run: pnpm db:replay` goes into
`.github/workflows/ci.yml` unconditionally, the skip in the script (no path filter, so the
workflow still holds no project knowledge), and the held comment is deleted. A guard that goes
red when the debt becomes payable was put and **rejected as machinery for a debt this ticket
discharges** — the best version of that mechanism is the one that never needs to exist.
`fetch-depth: 0` gains a second reason and its comment says so: without full history there is
no `origin/main` to resolve, and the drill refuses rather than guessing.

### Evidence — this container, 2026-08-12, `linux x64 · node v24.19.0 · postgres via native`

All four provenance classes and both refusals exercised against a real database, at `3560eb1`
plus this diff:

| run | result |
| --- | --- |
| `pnpm db:replay` at head | `nothing to replay … over origin/main (3560eb16)` — **exit 0, 2.4s** |
| uncommitted `0012` with 0010's shape | `db:migrate: FAILED applying 0012…` (23502, relation, column) then **working-tree** speech — exit 1 |
| same file committed on the branch | **branch** speech, naming `7d6d2f3f` and its author — exit 1 |
| `REPLAY_BASELINE=44fb092c` | ticket 10's transcript exactly — 92 rows, 0010 aborts — now **landed** speech — exit 1 |
| unrefreshable base ref, 0010 in range | header `NOTE could not fetch …`, **cannot-tell** speech — exit 1 |
| `REPLAY_BASE_REF=origin/nope` | refusal naming the fetch and both overrides — **exit 2** |

`pnpm verify` green in **28.2s**; `provision.sh` green on arrival, `parity: ok in 64s`.

### The wired step, proven on a hosted runner

The one assumption a session cannot check locally is whether `origin/main` exists on the runner
after `actions/checkout` — the whole rule rests on it, and a wrong answer is exit 2 on every CI
run. Dispatched at `2a9d0e6` (run
[31643422509](https://github.com/vextrus/vextrus/actions/runs/31643422509), `workflow_dispatch`
on this branch, which takes the same path a PR run does):

```
parity: ok in 43s — checkup | verify | test:db | dev (:3210) all pass
provision: ok — checkup | verify | test:db | dev (:3210) all proven, not claimed
##[group]Run pnpm db:replay
db:replay: nothing to replay — this tree adds no migration over origin/main (3560eb16)
```

**Job success, 72s total, the drill's step 1s of it.** `fetch-depth: 0` does leave `origin/main`
resolvable, the in-script fetch succeeds on a runner (no `NOTE` line), and the skip is reached
through the mechanism rather than by assertion. `ci` is now green *with* the step it was born
holding.
