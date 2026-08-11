-- Tenancy RLS (ADR-0004). Emitted with db/rls.ts::tenantRlsSql — every future
-- tenant-owned table gets the same block in its own migration.
-- ENABLE (not FORCE): the owner role is the system lane; vextrus_app
-- (LOGIN NOBYPASSRLS, created by scripts/db-migrate.mjs) is always subject.

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "memberships_tenant_isolation" ON "memberships";
--> statement-breakpoint
CREATE POLICY "memberships_tenant_isolation" ON "memberships"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "memberships" TO vextrus_app;
--> statement-breakpoint
-- tenants/users are not tenant-scoped rows; the app role may read them
-- (membership resolution) but may not write them outside the system lane.
GRANT SELECT ON "tenants" TO vextrus_app;
--> statement-breakpoint
GRANT SELECT ON "users" TO vextrus_app;
