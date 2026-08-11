# Auth and the tenant context

wayfinder:task
Status: open
Blocked by:

## Objective

better-auth (email/password + organizations) wired into the app; a tRPC authed procedure that
mints `TenantCtx` (`src/core/db.ts`) from the session's active organization; a minimal
login/register page. A B2C signup creates a single-member tenant — one model, no special cases
(ADR-0004).

## Guardrails

- Extend better-auth; never hand-roll session/password machinery.
- better-auth's tables land via our migration lane (`pnpm db:generate` against its schema
  additions), not its own migrator — one schema writer (ADR-0002).
- `mintTenantCtx` call sites remain: auth middleware + tests, nothing else.
- No roles/permissions matrix yet — `role` on membership is a string; authorization design is
  a future ticket with a named need.

## Exit criteria

- [ ] Sign up → tenant + membership created; log in → tRPC `me` query returns user + tenant.
- [ ] An authed procedure runs a query through `forTenant` and returns tenant-scoped data.
- [ ] `pnpm test:db` covers: session → ctx → scoped read; no session → UNAUTHORIZED.
- [ ] `pnpm verify` green; verify time recorded in the resolution.
