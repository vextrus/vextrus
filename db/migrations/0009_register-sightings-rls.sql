-- Register-sighting RLS (ADR-0004, ticket 07). The db/rls.ts block, with the
-- grant narrowed the same way the register itself is: a sighting is evidence
-- that a placement landed on the register (identity.md §3), so the app lane may
-- create and read one but never rewrite or delete one. An UPDATE here could
-- re-point a placement at a different identity — the double-count guard read
-- backwards — and a DELETE would make a second sighting of the same placement
-- look like a first.

ALTER TABLE "register_object_sightings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "register_object_sightings_tenant_isolation" ON "register_object_sightings";
--> statement-breakpoint
CREATE POLICY "register_object_sightings_tenant_isolation" ON "register_object_sightings" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON "register_object_sightings" TO vextrus_app;
