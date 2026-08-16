# ADR-0002 — Postgres 16 + Drizzle; one schema source, one migration lane, native cluster

**Date:** 2026-08-16 · **Status:** accepted (second founding; re-derives the 2026-08-12 decision)

## Context

Schema drift was the legacy repo's most expensive environment fault, and every instance traced
to having more than one schema writer (migrations, a push lane, hand-applied SQL). The first
founding chose one lane and shipped a drift detector on day one; that held. What did not hold
was the database's host: a Docker-published port goes through the Windows port proxy, and three
of this project's ports landed inside Windows reserved ranges in four days.

## Decision

- **Postgres 16 runs natively on port 5544**, `C.UTF-8`, `postgres://vextrus:vextrus@localhost:5544/vextrus`.
  No Docker, no compose file: a socket bound inside the VM cannot hit the port proxy.
- **Drizzle ORM; the schema is TypeScript** in `db/schema/*.ts` (one file per module, composed
  once). `drizzle-kit generate` emits SQL migrations; **`pnpm db:migrate` is the only schema
  writer** for every environment, dev included. No push lane. A landed migration is never
  edited — it is superseded by a new one. `pnpm db:drift` compares disk to the `__migrations`
  ledger and `pnpm checkup` reports it unprompted.
- **RLS is declared in the schema** (`.enableRLS()` + `db/schema/rls.ts::tenantIsolation`) so
  drizzle-kit emits it into the same migration as the table; GRANTs are appended to the migration
  by hand (drizzle does not emit them). Schema and its security move together, in history.
- **Domain enums are TS consts**; a column stores text with a CHECK derived from the same const
  (`enumCheck` in `db/schema/core.ts`). One declaration site.
- **Money and quantities are `numeric`**, handled through `decimal.js` at the seam. Floats are
  banned for both (CLAUDE.md).

## Consequences

- Types flow from source; a merge can never leave stale generated types.
- Migration discipline is stricter than a dev-convenience push loop; that loop was the drift generator.
- Drizzle is younger than Prisma; the exit cost is bounded — schema files are SQL-shaped TS and
  the migration history is plain SQL.
- The cluster is a machine precondition, not a repo artifact: `pnpm checkup` reports it, and
  `scripts/db-migrate.mjs` needs `CREATEROLE` on the owner once (`ALTER ROLE vextrus CREATEROLE`).
