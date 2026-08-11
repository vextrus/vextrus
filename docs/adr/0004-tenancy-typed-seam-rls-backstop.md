# ADR-0004 — Tenancy: a typed seam, with RLS as backstop

**Date:** 2026-08-12 · **Status:** accepted (founding)

## Context

Tenant isolation is absolute — a founding guardrail. The legacy enforced it at runtime: a
CLS-aware Prisma extension reading undocumented internals, an interceptor opening context, RLS
in 46 loose SQL files, and NEVER rules in prose. Violations were typecheck-invisible and
symptoms were silent (empty result sets, no error); a boundary review still found unscoped
updates late in the rebuild. The mechanism was sound in intent — belt and suspenders — but the
belt was convention.

## Decision

- Every tenant-owned table carries `tenant_id`. The only query path is
  `db.forTenant(ctx: TenantCtx)`, which opens a transaction and sets the tenant GUC. `TenantCtx`
  is a branded type only auth middleware (or `runAsSystem`, with its own audit) can mint — an
  unscoped query does not typecheck, because no bare db handle is exported.
- RLS policies (generated per tenant table into migrations, app role `NOBYPASSRLS`) backstop
  the seam: what the type system cannot see, the database refuses.
- Raw SQL is available only inside the seam's transaction, so it inherits the GUC.
- Auth is better-auth (email/password + organizations), extended rather than hand-rolled —
  agents extending a tested auth library beats agents building one. A B2C user is a
  single-member tenant; one model, no special cases.

## Consequences

- The cross-tenant breach class moves from "prose rule policed in review" to "does not compile,
  and the DB refuses it anyway."
- Every query pays one transaction + `set_config`; measured as negligible at legacy scale, and
  the seam is the single place to optimize if it ever matters.
- The seam is ~100 lines the repo owns, not a framework; its test suite (deliberate breach
  attempts) is part of `pnpm verify`.
