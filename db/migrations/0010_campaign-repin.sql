-- The authored re-pin (identity.md §9, §8's amendment of 2026-08-16): the only way a campaign's
-- pins advance. Every snapshot on `campaigns` is insert-only by grant (0008, 0009) and stays that
-- way, so a re-pin is not an UPDATE of a pin — it supersedes the outgoing generation and inserts
-- its successor, linked by `supersedes_id`. The outgoing snapshot therefore remains readable as
-- history, like a superseded placement, and no privilege to rewrite a citation is ever handed out.
ALTER TABLE "campaigns" ADD COLUMN "supersedes_id" uuid;--> statement-breakpoint
-- The lineage's pair target: a successor cites a generation of its **own** project, of its own
-- tenant. Without the project in the key, a lineage could cross projects and both ends would claim
-- first registration for one ordinal.
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_id_project_tenant_uq" UNIQUE("id","project_id","tenant_id");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_supersedes_project_fk" FOREIGN KEY ("supersedes_id","project_id","tenant_id") REFERENCES "public"."campaigns"("id","project_id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A campaign advances, it never forks (§9): one successor per generation. NULLs are distinct in a
-- Postgres unique constraint, so this leaves every lineage head free while binding every chain.
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_supersedes_uq" UNIQUE("supersedes_id");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_supersedes_not_self_check" CHECK ("supersedes_id" is distinct from "id");--> statement-breakpoint

-- SIGNED enters the campaign's state vocabulary. §8 states the fact at campaign granularity —
-- *one edition, two consequences: unsigned → stale (freshness gate); signed → voids whole* — and
-- the re-pin act has to read it, because §9 forbids a re-pin under a signature from being either
-- silently blocked or silently applied. The signature's own row (credential, verdict, boundary)
-- belongs to the signature arc; this is the slot, not the act.
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_state_check";--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_state_check" CHECK ("state" in ('LIVE', 'SIGNED', 'SUPERSEDED'));--> statement-breakpoint

-- One **current** campaign per project, where current now means LIVE or SIGNED: a signed campaign
-- still holds its project's one lineage slot, and 0008's `state = 'LIVE'` predicate would have let
-- a second lineage open the moment the first was signed. The predicate is stated negatively so a
-- state added to the vocabulary later occupies the slot until somebody says otherwise — it refuses
-- a second lineage rather than quietly admitting one.
DROP INDEX "campaigns_project_live_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_project_current_uq" ON "campaigns" USING btree ("project_id") WHERE "state" <> 'SUPERSEDED';--> statement-breakpoint

-- The act log's closed enum gains the re-pin (identity.md §7, §9).
ALTER TABLE "acts" DROP CONSTRAINT "acts_type_check";--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_type_check" CHECK ("type" in ('CONFIRM_DISCIPLINE', 'RENAME_MARK', 'REPUDIATE', 'PIN_DRAWING_SET', 'REPIN_DRAWING_SET'));--> statement-breakpoint

-- The state transition, superseding 0008's one-way trigger (which knew only two states and would
-- have admitted SIGNED → LIVE, un-signing a campaign with no act naming it). Three lawful moves:
-- LIVE → SIGNED (the signature arc), LIVE → SUPERSEDED and SIGNED → SUPERSEDED (the re-pin, which
-- **is** the voiding of a signature — §8 voids whole, never in part). Everything else refuses by
-- closed name, from the database, because the column-level UPDATE grant on `state` is
-- bidirectional and the application remembering the direction is not a mechanism.
CREATE OR REPLACE FUNCTION campaigns_state_is_one_way() RETURNS trigger AS $$
BEGIN
  IF NEW."state" = OLD."state" THEN
    RETURN NEW;
  END IF;
  IF OLD."state" = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'CAMPAIGN_STATE_NOT_REVERSIBLE: a superseded campaign is history'
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD."state" = 'SIGNED' AND NEW."state" <> 'SUPERSEDED' THEN
    RAISE EXCEPTION 'CAMPAIGN_SIGNATURE_NOT_REVOCABLE: a signature is voided by a re-pin, never cleared'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
ALTER FUNCTION campaigns_state_is_one_way() RENAME TO campaigns_state_transition;--> statement-breakpoint
DROP TRIGGER "campaigns_state_is_one_way" ON "campaigns";--> statement-breakpoint
CREATE TRIGGER campaigns_state_transition BEFORE UPDATE ON "campaigns"
  FOR EACH ROW EXECUTE FUNCTION campaigns_state_transition();
--> statement-breakpoint
-- Grants (ADR-0004): none, and that is the point again. `campaigns` carries no table-wide UPDATE
-- and one column-level UPDATE (`state`, from 0008); a column-level grant does not extend to a
-- column added after it, so `supersedes_id` is insert-only from the moment it exists. A lineage
-- link cannot be re-pointed after the fact, which is what makes the chain history rather than a
-- mutable parent pointer.
