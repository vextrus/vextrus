# Schema drift presents as an application fault

**Summary:** an unapplied migration shows up as a 500 with an ORM stack trace, not as a schema
error. Run `pnpm db:drift` (or read `pnpm checkup`) before debugging the code.

**Observed:** legacy repo, many sessions; hand-applied SQL under the wrong role also created
tables the drift checker literally could not see.

**Fix:** `pnpm db:migrate` is the only schema writer — never hand-applied SQL, which creates
state the ledger does not know. `pnpm checkup` reports drift unprompted at session start, so
there is no first command to recall.
