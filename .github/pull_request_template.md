<!--
The dispatcher reads this and then clicks merge (ADR-0010). It is the evidence,
not a summary: what was ruled, what forced it, what was put and rejected.
Delete a heading that has nothing true to put under it — an empty section is
worse than an absent one.
-->

## What landed

<!-- The ruling in a sentence or two, and the ticket it closes:
     `.wayfinder/<effort>/tickets/NN-<slug>.md`. -->

## What forced it

<!-- The measurement, with the machine and commit it was taken on
     (`pnpm checkup`'s environment line carries both). A number with no
     environment is not a measurement. -->

## Put and rejected

<!-- The alternative that was considered and why it lost. A ruling with no
     rejected alternative was not a decision. -->

## Evidence

- `pnpm verify`: <!-- green in Ns, on the merged tree (pnpm land) -->
- `pnpm test:db` / `pnpm db:replay`: <!-- if the change touches the schema, migrations or fixtures -->
- CI: the `ci` check on this head runs the whole gate — checkup, verify, test:db, dev boot.

## Left open

<!-- Debt, fog, anything a later session would be misled by if it went unsaid.
     "Nothing" is a valid answer and worth writing. -->
