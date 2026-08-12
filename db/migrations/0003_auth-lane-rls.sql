-- The auth lane (ADR-0004, ticket 01). better-auth runs as vextrus_auth:
-- LOGIN NOBYPASSRLS (created by scripts/db-migrate.mjs), granted exactly the
-- seven tables the auth machinery owns, with explicit USING(true) policies on
-- the RLS tables it must read across tenants (session/org resolution is
-- cross-tenant by design). It is never the owner role: request paths cannot
-- reach the system lane.

GRANT SELECT, INSERT, UPDATE, DELETE ON "users", "tenants", "memberships", "sessions", "accounts", "verifications", "invitations" TO vextrus_auth;
--> statement-breakpoint
-- Supersedes 0001's PUBLIC-scoped policy: isolation policies are scoped
-- TO vextrus_app so the auth lane's access is its own explicit policy, not a
-- planner-folded `tenant-qual OR true` (db/rls.ts documents this).
DROP POLICY "memberships_tenant_isolation" ON "memberships";
--> statement-breakpoint
CREATE POLICY "memberships_tenant_isolation" ON "memberships" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
CREATE POLICY "memberships_auth_lane" ON "memberships" TO vextrus_auth
  USING (true) WITH CHECK (true);
--> statement-breakpoint
-- invitations is tenant-owned: standard isolation block (db/rls.ts) + the
-- auth-lane policy (the org plugin resolves invitations by id/email).
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "invitations_tenant_isolation" ON "invitations";
--> statement-breakpoint
CREATE POLICY "invitations_tenant_isolation" ON "invitations" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "invitations" TO vextrus_app;
--> statement-breakpoint
CREATE POLICY "invitations_auth_lane" ON "invitations" TO vextrus_auth
  USING (true) WITH CHECK (true);
