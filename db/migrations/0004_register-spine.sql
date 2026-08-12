CREATE TABLE "acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"act_type" text NOT NULL,
	"subjects" jsonb NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acts_act_type_ck" CHECK ("act_type" in ('LEVEL_AUTHORED', 'DISCIPLINE_CONFIRMED', 'MARK_RENAMED', 'DEFERRAL_FILED'))
);
--> statement-breakpoint
CREATE TABLE "drawing_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"source_filename" text NOT NULL,
	"source_ref" text NOT NULL,
	"source_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_revisions_id_tenant_uq" UNIQUE("id","tenant_id"),
	CONSTRAINT "drawing_revisions_drawing_seq_uq" UNIQUE("drawing_id","seq"),
	CONSTRAINT "drawing_revisions_seq_ck" CHECK ("seq" >= 1)
);
--> statement-breakpoint
CREATE TABLE "drawings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"discipline_proposed" text,
	"discipline" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawings_id_tenant_uq" UNIQUE("id","tenant_id"),
	CONSTRAINT "drawings_discipline_proposed_ck" CHECK ("discipline_proposed" in ('structural', 'architectural', 'plumbing', 'electrical')),
	CONSTRAINT "drawings_discipline_ck" CHECK ("discipline" in ('structural', 'architectural', 'plumbing', 'electrical'))
);
--> statement-breakpoint
CREATE TABLE "ingests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"drawing_revision_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"artifact_ref" text,
	"artifact_sha256" text,
	"entities_original" integer,
	"entities_derived" integer,
	"explode_truncated" boolean,
	"lost_by_type" jsonb,
	"insunits" integer,
	"unit_detected" text,
	"insunits_unmapped" boolean,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "ingests_id_tenant_uq" UNIQUE("id","tenant_id"),
	CONSTRAINT "ingests_status_ck" CHECK ("status" in ('pending', 'succeeded', 'failed')),
	CONSTRAINT "ingests_unit_detected_ck" CHECK ("unit_detected" in ('unitless', 'inch', 'foot', 'mm', 'cm', 'm')),
	CONSTRAINT "ingests_succeeded_ck" CHECK ("status" <> 'succeeded' or ("artifact_ref" is not null and "artifact_sha256" is not null and "entities_original" is not null and "entities_derived" is not null and "explode_truncated" is not null and "lost_by_type" is not null and "insunits_unmapped" is not null and "error" is null)),
	CONSTRAINT "ingests_failed_ck" CHECK ("status" <> 'failed' or "error" is not null)
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"ordinal" integer NOT NULL,
	"height_mm" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "levels_id_project_uq" UNIQUE("id","project_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"pinned_book_edition" text,
	"pinned_rule_set" text,
	"pinned_multiplier_scheme" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_id_tenant_uq" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "refused_sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"ingest_id" uuid,
	"register_object_id" uuid,
	"cause" text NOT NULL,
	"subject" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refused_sightings_cause_ck" CHECK ("cause" in ('DUPLICATE_IDENTITY', 'DISCIPLINE_NOT_AUTHORITATIVE', 'NOT_ESTABLISHED', 'NOT_IN_PROJECT_SCOPE', 'NOT_IN_THIS_BILL', 'INGESTION_TRUNCATED', 'ENTITY_TYPE_UNHANDLED'))
);
--> statement-breakpoint
CREATE TABLE "register_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"discipline" text NOT NULL,
	"level_id" uuid,
	"level_basis" text NOT NULL,
	"element_type" text NOT NULL,
	"mark" text NOT NULL,
	"ordinal" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "register_objects_identity_uq" UNIQUE NULLS NOT DISTINCT("project_id","discipline","level_id","level_basis","element_type","mark","ordinal"),
	CONSTRAINT "register_objects_id_project_uq" UNIQUE("id","project_id"),
	CONSTRAINT "register_objects_discipline_ck" CHECK ("discipline" in ('structural', 'architectural', 'plumbing', 'electrical')),
	CONSTRAINT "register_objects_element_type_ck" CHECK ("element_type" in ('pile', 'pile_cap', 'footing', 'tie_grade_beam', 'column', 'shear_wall', 'beam', 'slab', 'stair')),
	CONSTRAINT "register_objects_level_basis_ck" CHECK ("level_basis" in ('LEVEL', 'FOUNDATION', 'UNRESOLVED')),
	CONSTRAINT "register_objects_level_slot_ck" CHECK (("level_basis" = 'LEVEL') = ("level_id" is not null)),
	CONSTRAINT "register_objects_ordinal_ck" CHECK ("ordinal" >= 1)
);
--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_revisions" ADD CONSTRAINT "drawing_revisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_revisions" ADD CONSTRAINT "drawing_revisions_drawing_tenant_fk" FOREIGN KEY ("drawing_id","tenant_id") REFERENCES "public"."drawings"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingests" ADD CONSTRAINT "ingests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingests" ADD CONSTRAINT "ingests_revision_tenant_fk" FOREIGN KEY ("drawing_revision_id","tenant_id") REFERENCES "public"."drawing_revisions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refused_sightings" ADD CONSTRAINT "refused_sightings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refused_sightings" ADD CONSTRAINT "refused_sightings_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refused_sightings" ADD CONSTRAINT "refused_sightings_ingest_tenant_fk" FOREIGN KEY ("ingest_id","tenant_id") REFERENCES "public"."ingests"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refused_sightings" ADD CONSTRAINT "refused_sightings_object_project_fk" FOREIGN KEY ("register_object_id","project_id") REFERENCES "public"."register_objects"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_level_project_fk" FOREIGN KEY ("level_id","project_id") REFERENCES "public"."levels"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acts_project_idx" ON "acts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "drawing_revisions_drawing_idx" ON "drawing_revisions" USING btree ("drawing_id");--> statement-breakpoint
CREATE INDEX "drawings_project_idx" ON "drawings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ingests_revision_idx" ON "ingests" USING btree ("drawing_revision_id");--> statement-breakpoint
CREATE INDEX "levels_project_idx" ON "levels" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_tenant_idx" ON "projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "refused_sightings_project_idx" ON "refused_sightings" USING btree ("project_id");