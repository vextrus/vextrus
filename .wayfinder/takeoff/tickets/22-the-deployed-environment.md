# The deployed environment

wayfinder:task
Status: open
Blocked by: 11-the-entity-index.md
Claimed by:

## Objective

Destination bar 3: a practising QS used the system **alone, from their own office, on a real
URL**. Charting ruled scope precisely — real URL, real auth, real tenancy, invite-only. **No
billing, no signup funnel, no SLA, no multi-region, no on-call**: those are surfaces for
customers who do not exist yet, and building them pre-first-customer is legacy fault F8 in
miniature (635 routes before one customer).

## What must be decided and provisioned

1. **Object storage for artifacts.** This is `takeoff-core`'s parked fog — *"a named need once a
   second process needs the tree"* — and deployment is that named need. The filesystem root was
   ticket 04's stated interim and it does not survive two processes on two machines.
2. **GPU compute.** Ticket 07's raster lane and ticket 17's self-hosted specialist both need it.
   Rule managed-inference versus our own GPU, with the cost stated.
3. **Migration on deploy.** `pnpm db:migrate` is the only schema writer (ADR-0002). Rule how it
   runs against a live database, and note that `pnpm db:replay` exists precisely because a
   migration meeting **rows written before it** is a distinct failure class.
4. **Secrets and backups.** The register is the system of record; losing it loses the product.
5. **Tenancy under real concurrent use.** ADR-0004's typed seam plus RLS backstop has been
   proven by `test:db`, never by two humans at once.
6. **Where it runs.** Bangladesh-first has latency and, potentially, data-residency
   consequences worth stating before the region is picked.

## Guardrails

- Nothing here weakens the tenant seam. A deployment convenience that bypasses
  `db.forTenant(ctx)` is a cross-tenant breach even when RLS saves us (`CLAUDE.md`).
- **No live customer may be claimed** while this runs (`CLAUDE.md` commercial guardrail). An
  invited QS on a trial is not a customer, and no marketing surface says otherwise.
- `scripts/provision.sh` and `pnpm checkup` are the local story; this is the remote one. Keep
  them from drifting into two different truths.
