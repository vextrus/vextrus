CREATE TABLE "ingests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_revision_id" uuid NOT NULL,
	"upload_filename" text NOT NULL,
	"upload_ref" text NOT NULL,
	"upload_sha256" text NOT NULL,
	"artifact_ref" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"extractor_version" text NOT NULL,
	"extractor_parameters" jsonb NOT NULL,
	"extractor_parameter_hash" text NOT NULL,
	"insunits" integer,
	"unit_detected" text,
	"insunits_unmapped" boolean NOT NULL,
	"original" integer NOT NULL,
	"derived" integer NOT NULL,
	"explode_truncated" boolean NOT NULL,
	"lost_by_type" jsonb NOT NULL,
	"unsupported_by_type" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingests_id_project_uq" UNIQUE("id","project_id"),
	CONSTRAINT "ingests_unit_detected_check" CHECK ("unit_detected" in ('unitless', 'inch', 'foot', 'mm', 'cm', 'm')),
	CONSTRAINT "ingests_upload_sha256_check" CHECK ("upload_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ingests_artifact_sha256_check" CHECK ("artifact_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ingests_extractor_parameter_hash_check" CHECK ("extractor_parameter_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ingests_counters_check" CHECK ("original" >= 0 and "derived" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ingests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingests" ADD CONSTRAINT "ingests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingests" ADD CONSTRAINT "ingests_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingests" ADD CONSTRAINT "ingests_revision_project_fk" FOREIGN KEY ("drawing_revision_id","project_id") REFERENCES "public"."drawing_revisions"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingests_revision_idx" ON "ingests" USING btree ("drawing_revision_id");--> statement-breakpoint
CREATE POLICY "ingests_tenant_isolation" ON "ingests" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
-- Grants (ADR-0004), appended by hand. An ingest record is immutable: the artifact freezes at
-- ingest (cad-ingestion.md §2); a re-ingest is a new row. Append-only for the app role.
GRANT SELECT, INSERT ON "ingests" TO vextrus_app;
