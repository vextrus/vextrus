-- The campaign's second snapshot (identity.md §8, amended 2026-08-16): the catalogue digest,
-- content-addressed over `bears`, pinned at creation so a kind or a `bears` row shipped later
-- cannot widen a coverage denominator underneath a bill somebody already signed.
--
-- NOT NULL with **no default**: a campaign opened before this column existed cited no catalogue,
-- and no value this migration could invent would be a citation — it would be the fallback the
-- clause bars, wearing a `NOT NULL`. The ALTER therefore refuses rather than backfilling a
-- fiction; a pre-pin campaign is superseded and reopened, which is an authored act with a name.
ALTER TABLE "campaigns" ADD COLUMN "catalogue_digest" text NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_catalogue_digest_check" CHECK ("catalogue_digest" ~ '^[0-9a-f]{64}$');

--> statement-breakpoint
-- Grants (ADR-0004): none needed, and that is the point. `campaigns` carries no table-wide UPDATE
-- and one column-level UPDATE (`state`, from 0008), and a column-level grant does not extend to a
-- column added later — so this snapshot is insert-only the moment it exists. An update of
-- "catalogue_digest" raises insufficient privilege with nothing further written here.
