CREATE TABLE "bears" (
	"element_type" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "bears_pk" PRIMARY KEY("element_type","kind"),
	CONSTRAINT "bears_element_type_check" CHECK ("element_type" in ('PILE', 'PILE_CAP', 'FOOTING', 'GRADE_BEAM', 'COLUMN', 'SHEAR_WALL', 'BEAM', 'SLAB', 'STAIR', 'WALL'))
);
--> statement-breakpoint
CREATE TABLE "work_item_catalogue" (
	"kind" text PRIMARY KEY NOT NULL,
	"description_en" text NOT NULL,
	"description_en_natively_reviewed" boolean NOT NULL,
	"description_bn" text NOT NULL,
	"description_bn_natively_reviewed" boolean NOT NULL,
	"dimension" text NOT NULL,
	"unit" text NOT NULL,
	"document_precision" integer NOT NULL,
	CONSTRAINT "work_item_catalogue_kind_check" CHECK ("kind" in ('RCC_CONCRETE', 'FORMWORK', 'REINFORCEMENT')),
	CONSTRAINT "work_item_catalogue_dimension_check" CHECK ("dimension" in ('LENGTH', 'AREA', 'VOLUME', 'MASS', 'COUNT')),
	CONSTRAINT "work_item_catalogue_unit_check" CHECK ("unit" in ('m', 'm²', 'm³', 'kg', 'nr')),
	CONSTRAINT "work_item_catalogue_document_precision_check" CHECK ("document_precision" in (2, 3)),
	CONSTRAINT "work_item_catalogue_dimension_unit_check" CHECK (("dimension", "unit") in (('LENGTH', 'm'), ('AREA', 'm²'), ('VOLUME', 'm³'), ('MASS', 'kg'), ('COUNT', 'nr')))
);
--> statement-breakpoint
ALTER TABLE "bears" ADD CONSTRAINT "bears_kind_work_item_catalogue_kind_fk" FOREIGN KEY ("kind") REFERENCES "public"."work_item_catalogue"("kind") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
-- The seed rows, rendered from src/core/work-items.ts and src/core/kinds.ts and guarded verbatim
-- by db/__tests__/catalogue-seed.spec.ts (measurement-rules.md §4: the const is the declaration
-- site, the table is its emission). The block re-seeds — delete, then insert — so the migration
-- that supersedes this one is the same paste, never a hand-computed diff.
DELETE FROM "bears";--> statement-breakpoint
DELETE FROM "work_item_catalogue";--> statement-breakpoint
INSERT INTO "work_item_catalogue" ("kind", "description_en", "description_en_natively_reviewed", "description_bn", "description_bn_natively_reviewed", "dimension", "unit", "document_precision") VALUES
	('FORMWORK', 'Formwork (shuttering), measured as contact area', false, 'শাটারিং, সংস্পর্শ ক্ষেত্রফল হিসেবে পরিমাপকৃত', false, 'AREA', 'm²', 2),
	('RCC_CONCRETE', 'Reinforced cement concrete, measured on the gross concrete section', false, 'আরসিসি কংক্রিট, সম্পূর্ণ কংক্রিট সেকশনে পরিমাপকৃত', false, 'VOLUME', 'm³', 3),
	('REINFORCEMENT', 'Steel reinforcement, measured by mass', false, 'রিইনফোর্সমেন্ট রড, ভর হিসেবে পরিমাপকৃত', false, 'MASS', 'kg', 2);--> statement-breakpoint
INSERT INTO "bears" ("element_type", "kind") VALUES
	('COLUMN', 'FORMWORK'),
	('COLUMN', 'RCC_CONCRETE'),
	('COLUMN', 'REINFORCEMENT');--> statement-breakpoint
-- Grants (ADR-0004), appended by hand: drizzle-kit does not emit them. These are the schema's
-- first platform-owned reference tables: no tenant column, no RLS policy, nothing tenant-scoped
-- about them. **The read-only grant is the whole of their protection** — SELECT and nothing else,
-- so no request path can widen a coverage denominator at runtime. The vocabulary changes by
-- migration or not at all.
GRANT SELECT ON "work_item_catalogue" TO vextrus_app;--> statement-breakpoint
GRANT SELECT ON "bears" TO vextrus_app;
