CREATE TABLE "acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_ids" uuid[] NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acts_type_check" CHECK ("type" in ('CONFIRM_DISCIPLINE', 'RENAME_MARK', 'REPUDIATE')),
	CONSTRAINT "acts_subjects_check" CHECK (cardinality("subject_ids") >= 1)
);
--> statement-breakpoint
ALTER TABLE "acts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "drawing_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_revisions_id_drawing_uq" UNIQUE("id","drawing_id"),
	CONSTRAINT "drawing_revisions_id_project_uq" UNIQUE("id","project_id")
);
--> statement-breakpoint
ALTER TABLE "drawing_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "drawing_set_revision_members" (
	"set_digest" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"drawing_revision_id" uuid NOT NULL,
	CONSTRAINT "drawing_set_revision_members_pk" PRIMARY KEY("set_digest","drawing_id")
);
--> statement-breakpoint
ALTER TABLE "drawing_set_revision_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "drawing_set_revisions" (
	"digest" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_set_revisions_digest_project_tenant_uq" UNIQUE("digest","project_id","tenant_id"),
	CONSTRAINT "drawing_set_revisions_digest_check" CHECK ("digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "drawings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"discipline_proposed" text,
	"discipline_confirmed" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawings_id_project_uq" UNIQUE("id","project_id"),
	CONSTRAINT "drawings_id_tenant_uq" UNIQUE("id","tenant_id"),
	CONSTRAINT "drawings_discipline_proposed_check" CHECK ("discipline_proposed" in ('STRUCTURAL', 'ARCHITECTURAL', 'PLUMBING', 'ELECTRICAL')),
	CONSTRAINT "drawings_discipline_confirmed_check" CHECK ("discipline_confirmed" in ('STRUCTURAL', 'ARCHITECTURAL', 'PLUMBING', 'ELECTRICAL'))
);
--> statement-breakpoint
ALTER TABLE "drawings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"ordinal" integer NOT NULL,
	"height" numeric,
	"height_basis" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "levels_id_project_uq" UNIQUE("id","project_id"),
	CONSTRAINT "levels_height_basis_check" CHECK ("height_basis" in ('TRANSCRIBED', 'DERIVED', 'ENTERED')),
	CONSTRAINT "levels_height_with_basis_check" CHECK (("height" is null) = ("height_basis" is null))
);
--> statement-breakpoint
ALTER TABLE "levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "refused_sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"cause" text NOT NULL,
	"discipline" text NOT NULL,
	"level_id" uuid,
	"level_basis" text,
	"element_type" text NOT NULL,
	"mark" text NOT NULL,
	"ordinal" integer,
	"drawing_revision_id" uuid NOT NULL,
	"source_keys" text[] NOT NULL,
	"refused_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refused_sightings_cause_check" CHECK ("cause" in ('DUPLICATE_IDENTITY', 'REPUDIATED')),
	CONSTRAINT "refused_sightings_discipline_check" CHECK ("discipline" in ('STRUCTURAL', 'ARCHITECTURAL', 'PLUMBING', 'ELECTRICAL')),
	CONSTRAINT "refused_sightings_element_type_check" CHECK ("element_type" in ('PILE', 'PILE_CAP', 'FOOTING', 'GRADE_BEAM', 'COLUMN', 'SHEAR_WALL', 'BEAM', 'SLAB', 'STAIR', 'WALL')),
	CONSTRAINT "refused_sightings_level_basis_check" CHECK ("level_basis" in ('FOUNDATION', 'UNRESOLVED')),
	CONSTRAINT "refused_sightings_level_slot_check" CHECK (("level_id" is null) <> ("level_basis" is null)),
	CONSTRAINT "refused_sightings_ordinal_check" CHECK (("cause" = 'REPUDIATED') = ("ordinal" is not null)),
	CONSTRAINT "refused_sightings_source_keys_check" CHECK (cardinality("source_keys") >= 1)
);
--> statement-breakpoint
ALTER TABLE "refused_sightings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "register_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"discipline" text NOT NULL,
	"level_id" uuid,
	"level_basis" text,
	"element_type" text NOT NULL,
	"mark" text NOT NULL,
	"ordinal" integer NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "register_objects_identity_uq" UNIQUE NULLS NOT DISTINCT("project_id","discipline","level_id","level_basis","element_type","mark","ordinal"),
	CONSTRAINT "register_objects_id_project_uq" UNIQUE("id","project_id"),
	CONSTRAINT "register_objects_discipline_check" CHECK ("discipline" in ('STRUCTURAL', 'ARCHITECTURAL', 'PLUMBING', 'ELECTRICAL')),
	CONSTRAINT "register_objects_element_type_check" CHECK ("element_type" in ('PILE', 'PILE_CAP', 'FOOTING', 'GRADE_BEAM', 'COLUMN', 'SHEAR_WALL', 'BEAM', 'SLAB', 'STAIR', 'WALL')),
	CONSTRAINT "register_objects_level_basis_check" CHECK ("level_basis" in ('FOUNDATION', 'UNRESOLVED')),
	CONSTRAINT "register_objects_level_slot_check" CHECK (("level_id" is null) <> ("level_basis" is null)),
	CONSTRAINT "register_objects_ordinal_check" CHECK ("ordinal" >= 1)
);
--> statement-breakpoint
ALTER TABLE "register_objects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_actor_membership_fk" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "public"."memberships"("tenant_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_revisions" ADD CONSTRAINT "drawing_revisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_revisions" ADD CONSTRAINT "drawing_revisions_drawing_project_fk" FOREIGN KEY ("drawing_id","project_id") REFERENCES "public"."drawings"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_revisions" ADD CONSTRAINT "drawing_revisions_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_revision_members" ADD CONSTRAINT "drawing_set_revision_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_revision_members" ADD CONSTRAINT "drawing_set_revision_members_set_fk" FOREIGN KEY ("set_digest","project_id","tenant_id") REFERENCES "public"."drawing_set_revisions"("digest","project_id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_revision_members" ADD CONSTRAINT "drawing_set_revision_members_drawing_project_fk" FOREIGN KEY ("drawing_id","project_id") REFERENCES "public"."drawings"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_revision_members" ADD CONSTRAINT "drawing_set_revision_members_revision_drawing_fk" FOREIGN KEY ("drawing_revision_id","drawing_id") REFERENCES "public"."drawing_revisions"("id","drawing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" ADD CONSTRAINT "drawing_set_revisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" ADD CONSTRAINT "drawing_set_revisions_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refused_sightings" ADD CONSTRAINT "refused_sightings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refused_sightings" ADD CONSTRAINT "refused_sightings_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refused_sightings" ADD CONSTRAINT "refused_sightings_level_project_fk" FOREIGN KEY ("level_id","project_id") REFERENCES "public"."levels"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refused_sightings" ADD CONSTRAINT "refused_sightings_revision_project_fk" FOREIGN KEY ("drawing_revision_id","project_id") REFERENCES "public"."drawing_revisions"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_level_project_fk" FOREIGN KEY ("level_id","project_id") REFERENCES "public"."levels"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acts_project_idx" ON "acts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "drawing_revisions_drawing_idx" ON "drawing_revisions" USING btree ("drawing_id");--> statement-breakpoint
CREATE INDEX "drawings_project_idx" ON "drawings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "levels_project_idx" ON "levels" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "refused_sightings_project_idx" ON "refused_sightings" USING btree ("project_id");--> statement-breakpoint
CREATE POLICY "acts_tenant_isolation" ON "acts" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "drawing_revisions_tenant_isolation" ON "drawing_revisions" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "drawing_set_revision_members_tenant_isolation" ON "drawing_set_revision_members" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "drawing_set_revisions_tenant_isolation" ON "drawing_set_revisions" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "drawings_tenant_isolation" ON "drawings" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "levels_tenant_isolation" ON "levels" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "refused_sightings_tenant_isolation" ON "refused_sightings" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "register_objects_tenant_isolation" ON "register_objects" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
-- Grants (ADR-0004), appended by hand: drizzle-kit does not emit them.
-- levels / drawings / drawing_revisions: ordinary tenant-owned rows, full DML.
GRANT SELECT, INSERT, UPDATE, DELETE ON "levels" TO vextrus_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "drawings" TO vextrus_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "drawing_revisions" TO vextrus_app;--> statement-breakpoint
-- A drawing-set revision and its manifest are immutable (identity.md §9): advance, never drift.
GRANT SELECT, INSERT ON "drawing_set_revisions" TO vextrus_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "drawing_set_revision_members" TO vextrus_app;--> statement-breakpoint
-- The register object: the ordinal is frozen at first registration (identity.md §2), and so are
-- the other identity axes — only the mark (an authored rename) and the level slot (the one-hop
-- carry, §3) are updatable. DELETE exists because a repudiated object leaves the register (§7).
GRANT SELECT, INSERT, DELETE ON "register_objects" TO vextrus_app;--> statement-breakpoint
GRANT UPDATE ("mark", "level_id", "level_basis") ON "register_objects" TO vextrus_app;--> statement-breakpoint
-- Refused sightings are evidence and the act log is an audit trail: append-only, both.
GRANT SELECT, INSERT ON "refused_sightings" TO vextrus_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "acts" TO vextrus_app;
