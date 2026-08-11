# ADR-0002 — Postgres 16 + Drizzle; one schema source, one migration lane

**Date:** 2026-08-12 · **Status:** accepted (founding)

## Context

The legacy schema had three writers: Prisma migrations (slot templates), `db:push` (dev), and a
hand-edited generated GraphQL SDL — plus 46 loose RLS SQL files applied outside migration
history. Dev DB drift presented as build faults; hand-applies under the wrong role created
tables the drift checker literally could not see; the generated Prisma client added a
rebuild-and-restart trap after every schema change; `Prisma.DbNull` vs JS `null` broke queries
silently. One Prisma client over 343 models was also the de-facto (absent) module boundary.
The 2026 field has converged on Drizzle for agent-built products: schema as TS source, types
inferred with no generate step, SQL visible to the typechecker.

## Decision

- Postgres 16 (compose-managed, port 5544 — off the legacy repo's 5432). Drizzle ORM; schema
  lives in `db/schema/*.ts`, one file per module, composed once.
- drizzle-kit generates SQL migrations; `pnpm db:migrate` is the **only** schema writer for
  every environment, dev included. No push lane. Landed migrations are never edited —
  superseded by new ones. A drift detector with machine-readable output ships from day one.
- RLS policies and audit triggers are emitted into the same migrations by a repo helper —
  schema and its security move together, in history.
- Domain enums are TS consts in `src/core/enums.ts`; columns store text with CHECK constraints
  derived from the same const. One declaration site (the legacy had one enum value hand-written
  in 19 places).
- Money and quantities are `numeric` columns, handled through decimal.js at the seam — floats
  are banned. JSON columns get typed accessors that make the JS-null/SQL-NULL confusion
  unrepresentable.

## Consequences

- Types flow from source: a merge can never leave stale generated types, and there is no client
  artifact to rebuild or restart.
- Migration discipline is stricter than the legacy's dev loop (no push convenience); this is
  deliberate — the convenience lane was the drift generator.
- Drizzle is younger than Prisma; if it fails us the schema files are plain SQL-shaped TS and
  the migration history is plain SQL — the exit cost is bounded.
