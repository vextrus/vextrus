ALTER TABLE "register_object_sightings" ADD COLUMN "semantic" text NOT NULL;--> statement-breakpoint
COMMENT ON COLUMN "register_object_sightings"."semantic" IS
  'identity.md §5: the row''s order-normalized semantic (canonical JSON of its content including its cited evidence handles) — the invalidator, never the key. Unchanged carries filed dispositions forward across a revision; changed re-presents the row.';
