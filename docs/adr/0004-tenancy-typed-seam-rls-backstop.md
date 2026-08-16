# ADR-0004 — Tenancy: a typed seam, with RLS as backstop

**Date:** 2026-08-16 · **Status:** accepted (second founding; re-derives the 2026-08-12 decision)

## Context

Tenant isolation is absolute. The legacy enforced it as runtime convention policed by prose:
violations were typecheck-invisible and their symptom was silence (empty result sets, no error).
The first founding made the unscoped query inexpressible and proved it live; that held.

## Decision

- Every tenant-owned table carries `tenant_id`. **The only query paths are
  `forTenant(ctx, fn)`** — app role `vextrus_app` (LOGIN, NOBYPASSRLS, non-owner), one
  transaction, `set_config('app.tenant_id', …)` — **and `runAsSystem(reason, fn)`** — owner role,
  named reason, never a request path. `TenantCtx` is a branded type only auth middleware, a job
  worker entering with a job's tenant, or a test may mint. No bare db handle is exported.
- **ESLint makes the seam mechanical**: nothing outside `src/core/db.ts` may import the driver
  (`postgres`, `drizzle-orm/postgres-js`) or `db/schema/**`; the fixture test proves the rule
  fires. A bare handle cannot be minted without a lint error.
- **RLS backstops the seam.** Every tenant-owned table declares `.enableRLS()` and the
  `tenantIsolation` policy (`USING`/`WITH CHECK` on the GUC) `TO vextrus_app`; the owner role is
  the system lane. **FK validation bypasses RLS**, so a child's parent reference is a composite FK
  carrying `tenant_id` against a `(parent id, tenant_id)` unique pair — the database refuses a
  child that cites another tenant's parent (`db/schema/core.ts`).
- The seam test (`db/__tests__/tenancy.dbspec.ts`, `pnpm test:db`) proves, live: the scoped
  read, the RLS refusal of a cross-tenant write, the composite-FK refusal, and the append-only
  grant on the model call ledger.
- Auth (better-auth: email/password + organizations) lands with the first auth ticket, extended
  never hand-rolled; a B2C user is a single-member tenant — one model, no special cases.

## Consequences

- The cross-tenant breach class moves from "prose rule policed in review" to "does not lint, and
  the database refuses it anyway."
- Every query pays one transaction + `set_config`; negligible at this scale, and one place to optimise.
- The seam is ~60 lines the repo owns; its test suite is deliberate breach attempts.
