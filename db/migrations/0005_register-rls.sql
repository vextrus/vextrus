-- Register spine RLS (ADR-0004, ticket 02). Every tenant-owned table gets the
-- db/rls.ts block: ENABLE (not FORCE — the owner role is the system lane),
-- policy scoped TO vextrus_app, tenant GUC qual both ways. Three tables carry
-- deliberately narrowed grants; widening one is a future migration's explicit
-- act, never a default.

ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "projects_tenant_isolation" ON "projects";
--> statement-breakpoint
CREATE POLICY "projects_tenant_isolation" ON "projects" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "projects" TO vextrus_app;
--> statement-breakpoint
ALTER TABLE "levels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "levels_tenant_isolation" ON "levels";
--> statement-breakpoint
CREATE POLICY "levels_tenant_isolation" ON "levels" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "levels" TO vextrus_app;
--> statement-breakpoint
ALTER TABLE "drawings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "drawings_tenant_isolation" ON "drawings";
--> statement-breakpoint
CREATE POLICY "drawings_tenant_isolation" ON "drawings" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "drawings" TO vextrus_app;
--> statement-breakpoint
ALTER TABLE "drawing_revisions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "drawing_revisions_tenant_isolation" ON "drawing_revisions";
--> statement-breakpoint
CREATE POLICY "drawing_revisions_tenant_isolation" ON "drawing_revisions" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "drawing_revisions" TO vextrus_app;
--> statement-breakpoint
ALTER TABLE "ingests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "ingests_tenant_isolation" ON "ingests";
--> statement-breakpoint
CREATE POLICY "ingests_tenant_isolation" ON "ingests" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "ingests" TO vextrus_app;
--> statement-breakpoint
-- Identity freezes at first registration (identity.md §4): the app lane may
-- create and read register objects but never rewrite or delete one — an
-- UPDATE that moved an ordinal, or a DELETE, silently deletes quantity.
-- Enrichment columns that must be app-writable arrive with their own
-- migration and a column-scoped GRANT UPDATE.
ALTER TABLE "register_objects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "register_objects_tenant_isolation" ON "register_objects";
--> statement-breakpoint
CREATE POLICY "register_objects_tenant_isolation" ON "register_objects" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON "register_objects" TO vextrus_app;
--> statement-breakpoint
-- Refused sightings are evidence (identity.md §2): append-only on the app
-- lane, same shape as acts.
ALTER TABLE "refused_sightings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "refused_sightings_tenant_isolation" ON "refused_sightings";
--> statement-breakpoint
CREATE POLICY "refused_sightings_tenant_isolation" ON "refused_sightings" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON "refused_sightings" TO vextrus_app;
--> statement-breakpoint
-- The act log is append-only, human-only (identity.md §7): the app lane gets
-- SELECT and INSERT only, so no request path can rewrite history. The owner
-- role (system lane) retains full access for migrations.
ALTER TABLE "acts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "acts_tenant_isolation" ON "acts";
--> statement-breakpoint
CREATE POLICY "acts_tenant_isolation" ON "acts" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON "acts" TO vextrus_app;
