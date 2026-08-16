# better-auth creates the sign-up session before `databaseHooks.user.create.after` runs

**Summary:** on `signUpEmail`, better-auth 1.6.29 inserts the session (and runs
`databaseHooks.session.create.before`) *before* it runs `databaseHooks.user.create.after`. Anything
the user-after hook creates — here the user's personal tenant — is invisible to the session hook
on the sign-up path, so the session's active organization stays null.

**Observed:** 2026-08-16, issue #66. Timestamps in the two hooks: session hook at +0 ms with no
membership found, user-after hook started at +7 ms and finished at +17 ms. Cost: one failing
seam test and a debug cycle.

**How it presents:** the sign-up response is a 200 with a token; the user, tenant and owner
membership all exist; `getSession` returns a session whose `activeOrganizationId` is undefined,
so the request path mints no TenantCtx and the first page says NO_TENANT_CONTEXT.

**Fix (in `src/server/auth.ts`):** the user-after hook, after `createOrganization`, sets the new
organization active on the user's sessions through `context.context.adapter.updateMany({ model:
"session", … })`; the session-before hook still serves later sign-ins. Do not move tenant creation
into `user.create.before` — the DB-generated user id does not exist yet there.
