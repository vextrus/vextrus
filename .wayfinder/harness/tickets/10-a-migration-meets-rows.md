# A migration meets rows

wayfinder:task
Status: open
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

- [ ] The drill run in a container, against the most recent migration, result in `## Resolution`.
- [ ] A verdict on whether `test:db`'s fixtures touch enough of the schema for the drill to mean
      anything — stated as a fact about which tables get rows, not as an impression.
- [ ] If it is worth keeping: landed as a named script, and the trigger written where the author
      of the next migration will see it.
- [ ] If it is not worth keeping: said plainly, with what would have to change to make it worth
      keeping.
- [ ] `pnpm verify` green.

## Guardrails

- Never against `localhost:5544` on the Windows machine. Container only.
- `pnpm db:migrate` stays the only schema writer (ADR-0002). The drill invokes it; it does not
  reimplement stepping.
- No fixture may be edited to make the drill pass.
- Do not build a seed corpus inside this ticket. It was put and rejected; reopening it is a new
  decision, not an implementation detail.
