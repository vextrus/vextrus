CREATE TABLE "register_object_sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"register_object_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"placement_key" text NOT NULL,
	"view_key" text NOT NULL,
	"handles" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "register_object_sightings_placement_uq" UNIQUE("project_id","drawing_id","placement_key")
);
--> statement-breakpoint
ALTER TABLE "register_object_sightings" ADD CONSTRAINT "register_object_sightings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_object_sightings" ADD CONSTRAINT "register_object_sightings_project_tenant_fk" FOREIGN KEY ("project_id","tenant_id") REFERENCES "public"."projects"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_object_sightings" ADD CONSTRAINT "register_object_sightings_object_project_fk" FOREIGN KEY ("register_object_id","project_id") REFERENCES "public"."register_objects"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_object_sightings" ADD CONSTRAINT "register_object_sightings_drawing_project_fk" FOREIGN KEY ("drawing_id","project_id") REFERENCES "public"."drawings"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_object_sightings" ADD CONSTRAINT "register_object_sightings_ingest_project_fk" FOREIGN KEY ("ingest_id","project_id") REFERENCES "public"."ingests"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "register_object_sightings_object_idx" ON "register_object_sightings" USING btree ("register_object_id");