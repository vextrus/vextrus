# Auth and the tenant context

wayfinder:task
Status: closed
Blocked by:
Claimed by: claude session 2026-08-12 (01-auth-and-tenant-context)

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

- [x] Sign up → tenant + membership created; log in → tRPC `me` query returns user + tenant.
- [x] An authed procedure runs a query through `forTenant` and returns tenant-scoped data.
- [x] `pnpm test:db` covers: session → ctx → scoped read; no session → UNAUTHORIZED.
- [x] `pnpm verify` green; verify time recorded in the resolution.

## Resolution

better-auth 1.6.27, organization plugin mapped straight onto the spine — organization→`tenants`,
member→`memberships` (`organizationId`→`tenantId`), session's `activeOrganizationId`→
`sessions.active_tenant_id` — so a B2C signup and a B2B organization are one model; a
user-create databaseHook makes the single-member tenant (role `owner`). Tables landed via our
lane: migration 0002 (generated; tenants.slug reaches NOT NULL by backfill so non-empty DBs
migrate) and 0003 (custom: auth-lane grants + invitations RLS).

Auth runs as a third role, `vextrus_auth` (LOGIN NOBYPASSRLS, explicit `USING (true)` policies
on memberships/invitations) — session/org resolution is cross-tenant by design. The alternative
put and rejected: the owner connection for better-auth, which would have made the system lane a
request path. Isolation policies are now scoped `TO vextrus_app` (0003 supersedes 0001's
PUBLIC-scoped policy; `db/rls.ts` updated) instead of betting on the planner folding
`tenant-qual OR true` for other constrained roles.

Measured trap: better-auth queues `user.create.after` past session creation
(`db/with-hooks.mjs` `queueAfterTransactionHook`), so a signup session's create-hook finds no
membership — observed live as `active_tenant_id NULL` beside an existing membership row.
Ruling: the session-create hook covers sign-ins; the tRPC auth middleware heals a tenantless
session once via `listOrganizations` + `setActiveOrganization`. Rejected alternative:
`autoSignIn: false`, which degrades signup to two round trips and leaves other tenantless
sessions unhandled.

`mintTenantCtx` call sites: `src/server/trpc.ts` (the auth middleware) + tests, nothing else.
`pnpm test:db` 7/7 (signup→tenant+membership; session→ctx→scoped read through `forTenant`;
sign-in lane; no session→UNAUTHORIZED "no session"); HTTP smoke against the dev server: signup
→ authenticated home renders user + tenant + role, signed-out home refuses to /login.
**`pnpm verify` green in 4.6s** (tsc 2.1 · eslint 1.0 · vitest 1.3 · ruff 0.1 · pytest 0.2).
