CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"set_digest" text NOT NULL,
	"rule_set_edition_id" uuid NOT NULL,
	"state" text DEFAULT 'LIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_id_tenant_uq" UNIQUE("id","tenant_id"),
	CONSTRAINT "campaigns_state_check" CHECK ("state" in ('LIVE', 'SUPERSEDED'))
);
--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acts" DROP CONSTRAINT "acts_type_check";--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_set_revision_project_fk" FOREIGN KEY ("set_digest","project_id","tenant_id") REFERENCES "public"."drawing_set_revisions"("digest","project_id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_rule_set_edition_tenant_fk" FOREIGN KEY ("rule_set_edition_id","tenant_id") REFERENCES "public"."rule_set_editions"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_project_idx" ON "campaigns" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_project_live_uq" ON "campaigns" USING btree ("project_id") WHERE "state" = 'LIVE';--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_type_check" CHECK ("type" in ('CONFIRM_DISCIPLINE', 'RENAME_MARK', 'REPUDIATE', 'PIN_DRAWING_SET'));--> statement-breakpoint
CREATE POLICY "campaigns_tenant_isolation" ON "campaigns" AS PERMISSIVE FOR ALL TO "vextrus_app" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);--> statement-breakpoint
-- Grants (ADR-0004), appended by hand: drizzle-kit does not emit them.
-- A campaign snapshots what it cites (identity.md §8, amended 2026-08-16), so its pin and its
-- snapshot are insert-only: the app role gets no table-wide UPDATE and no DELETE at all, and the
-- single column-level UPDATE is `state` — the slot a supersede moves. An update of "set_digest" or
-- "rule_set_edition_id" therefore raises insufficient privilege: the database refuses a rewritten
-- citation, rather than the application remembering not to write one.
GRANT SELECT, INSERT ON "campaigns" TO vextrus_app;--> statement-breakpoint
GRANT UPDATE ("state") ON "campaigns" TO vextrus_app;
