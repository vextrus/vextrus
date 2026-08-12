# ADR-0009 — The ingest queue is a plain Postgres table claimed with SKIP LOCKED

**Date:** 2026-08-12 · **Status:** accepted

## Context

Ticket 04 needed a durable queue between the upload request and the cad CLI subprocess: an
upload must return immediately, ingestion takes seconds, and a failure must land as evidence on
the drawing's screen-facing status rather than in a request that timed out.

The two candidates were **pg-boss** (a maintained Postgres job library: retries, scheduling,
dead-letter queues, its own `pgboss` schema and migrations) and a **plain table claimed with
`SELECT … FOR UPDATE SKIP LOCKED`**.

The scale is known and small: one worker process, jobs measured in seconds, a queue that is
empty most of the time. The load-bearing constraint is not throughput — it is that a job's
state and the row it describes stay in one transactional story.

## Decision

A plain `ingest_jobs` table, claimed in one statement:

```sql
update ingest_jobs set status='running', attempts=attempts+1, locked_at=now()
where id = (select id from ingest_jobs where <claimable> order by created_at
            for update skip locked limit 1)
returning …
```

- **One migration lane (ADR-0002).** pg-boss owns its own schema and runs its own migrations at
  boot — a second schema writer, which `pnpm db:migrate` exists to forbid. That alone decides it.
- **Enqueue commits with its subject.** The revision, its ingest and its job land in one
  `forTenant` transaction, so a drawing revision with no queued work is unrepresentable. A
  library queue with its own connection cannot join that transaction.
- **The queue is tenant-owned like everything else** — `tenant_id`, RLS, composite FKs pairing
  the job to its ingest *and* its project. A generic job table with a JSON payload would carry
  none of that; a tenant id inside an opaque payload is not a constraint.
- **Narrowed grants split the lanes**: the app role may `INSERT` (enqueue) and `SELECT` (the
  status screen) but never `UPDATE` — no request path can mark work done that no worker did.
  Claiming and finishing ride `runAsSystem` with a named reason.
- **Leases, not locks.** `locked_at` plus a 15-minute lease makes a killed worker's job
  reclaimable; `attempts` past a cap fails the job by name rather than cycling invisibly. A
  *run* that fails does not retry — a corrupt DXF is deterministic, and a silent retry loop
  around a permanent refusal is exactly the silence the governing sentence condemns.

## Consequences

- We give up pg-boss's cron scheduling, dead-letter queues and multi-queue routing. None is
  needed today; each is a table and a query away if it ever is.
- Polling costs one indexed query per second per worker. At this scale that is free; if it ever
  is not, `LISTEN/NOTIFY` on enqueue is an additive change to the same table.
- The claim statement is hand-written SQL rather than a typed drizzle query — `SKIP LOCKED` has
  no builder expression. It lives in exactly one function (`src/core/queue.ts`) with its
  columns aliased back to the schema's names.
