-- Ingest queue RLS (ADR-0004, ADR-0009). The db/rls.ts block, with a
-- deliberately narrowed grant: the app lane enqueues a job (in the same
-- transaction as the revision it describes) and reads its state for the
-- drawing's screen, but never moves a job's status. Claiming, completing and
-- failing are the worker's, on the system lane, under a named reason —
-- so no request path can mark work done that no worker did.

ALTER TABLE "ingest_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "ingest_jobs_tenant_isolation" ON "ingest_jobs";
--> statement-breakpoint
CREATE POLICY "ingest_jobs_tenant_isolation" ON "ingest_jobs" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON "ingest_jobs" TO vextrus_app;
