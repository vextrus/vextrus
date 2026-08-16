CREATE TABLE "rule_set_edition_methods" (
	"edition_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "rule_set_edition_methods_pk" PRIMARY KEY("edition_id","rule_id"),
	CONSTRAINT "rule_set_edition_methods_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "rule_set_edition_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rule_set_edition_parameters" (
	"edition_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" numeric NOT NULL,
	CONSTRAINT "rule_set_edition_parameters_pk" PRIMARY KEY("edition_id","key"),
	CONSTRAINT "rule_set_edition_parameters_key_check" CHECK ("key" in ('openingDeductionMinM2', 'memberEndNoDeductMaxCm2', 'embeddedDuctNoDeductMaxCm2', 'finishOpeningDeductionMinM2', 'finishMinOutlineArea', 'finishMaxOutlineArea', 'scaleVerificationTolerance', 'scaleAnisotropyTolerance')),
	CONSTRAINT "rule_set_edition_parameters_value_finite_check" CHECK ("value" > '-Infinity'::numeric and "value" < 'Infinity'::numeric)
);
--> statement-breakpoint
ALTER TABLE "rule_set_edition_parameters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rule_set_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"scope" text NOT NULL,
	"forked_from_edition_id" uuid,
	"forked_from_seed" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_set_editions_id_tenant_uq" UNIQUE("id","tenant_id"),
	CONSTRAINT "rule_set_editions_scope_check" CHECK ("scope" in ('TEMPLATE', 'PROJECT')),
	CONSTRAINT "rule_set_editions_forked_from_seed_check" CHECK ("forked_from_seed" in ('IS1200_IN@2026.08')),
	CONSTRAINT "rule_set_editions_key_check" CHECK ("key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "rule_set_editions_lineage_check" CHECK (("forked_from_edition_id" is null) <> ("forked_from_seed" is null)),
	CONSTRAINT "rule_set_editions_project_lineage_check" CHECK (("scope" = 'PROJECT') = ("forked_from_edition_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "rule_set_editions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rule_set_edition_methods" ADD CONSTRAINT "rule_set_edition_methods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_edition_methods" ADD CONSTRAINT "rule_set_edition_methods_edition_tenant_fk" FOREIGN KEY ("edition_id","tenant_id") REFERENCES "public"."rule_set_editions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_edition_parameters" ADD CONSTRAINT "rule_set_edition_parameters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_edition_parameters" ADD CONSTRAINT "rule_set_edition_parameters_edition_tenant_fk" FOREIGN KEY ("edition_id","tenant_id") REFERENCES "public"."rule_set_editions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_editions" ADD CONSTRAINT "rule_set_editions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_editions" ADD CONSTRAINT "rule_set_editions_forked_from_tenant_fk" FOREIGN KEY ("forked_from_edition_id","tenant_id") REFERENCES "public"."rule_set_editions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rule_set_editions_tenant_idx" ON "rule_set_editions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_set_editions_tenant_template_uq" ON "rule_set_editions" USING btree ("tenant_id") WHERE "scope" = 'TEMPLATE';--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "pinned_book_edition";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "pinned_rule_set";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "pinned_multiplier_scheme";--> statement-breakpoint
CREATE POLICY "rule_set_edition_methods_tenant_isolation" ON "rule_set_edition_methods" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "rule_set_edition_parameters_tenant_isolation" ON "rule_set_edition_parameters" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "rule_set_editions_tenant_isolation" ON "rule_set_editions" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
-- Grants (ADR-0004), appended by hand: drizzle-kit does not emit them.
-- An edition is immutable (identity.md §8): authoring mints a new edition, and no code path can
-- update one because the grant does not permit it — the refusal is the database's, not the
-- application's. Its parameter values and the methods in force are the edition, so they carry the
-- same grant; a value that could be rewritten under a pin is the mutable rule set §8 forbids.
GRANT SELECT, INSERT ON "rule_set_editions" TO vextrus_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "rule_set_edition_parameters" TO vextrus_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "rule_set_edition_methods" TO vextrus_app;
