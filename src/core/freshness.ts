import { catalogueDigestInForce, projectRuleSetEdition, readCampaign } from "./campaigns";
import { forTenant, type TenantCtx, type Tx } from "./db";
import {
  CAMPAIGN_PINS,
  type CampaignFreshnessRefusal,
  type CampaignFreshnessVerdict,
  type CampaignPin,
} from "./enums";
import { compareCanonical } from "./order";

/**
 * The freshness diff (identity.md §8, amended 2026-08-16: *a campaign snapshots what it cites;
 * staleness is a diff, never a flag*). A campaign carries two snapshots taken at creation; this
 * module compares them against what is in force now and returns a closed verdict. Nothing is
 * stored: a stale column is one forgotten write from lying, and the write nobody remembers is the
 * one after a deploy ships a kind — precisely the case the pin exists to catch.
 *
 * The verdict blocks **signing** and nothing else. Measuring, ingest and registration run on a
 * stale campaign untouched: an unfinished measurement is unfinished, while a bill signed against a
 * denominator that moved is a partial faulty estimate, which is the harmful one. The gate that
 * refuses `PIN_STALE` lands with the signature arc — there is no signature to gate yet.
 */

/** The two snapshots, on one side of the diff or the other. */
export type CampaignPins = {
  readonly ruleSetEditionId: string;
  readonly catalogueDigest: string;
};

/**
 * The verdict. `STALE` names both *which* pins moved and the closed code the signature act will
 * refuse with — a refusal states what it refused, never that it refused.
 */
export type CampaignFreshness =
  | { readonly verdict: Extract<CampaignFreshnessVerdict, "CURRENT"> }
  | {
      readonly verdict: Extract<CampaignFreshnessVerdict, "STALE">;
      readonly reason: CampaignFreshnessRefusal;
      readonly moved: readonly CampaignPin[];
    };

/**
 * Pin → the value it addresses. Total over the closed pin vocabulary, so a third snapshot added to
 * a campaign fails `typecheck` here rather than silently going undiffed — the failure mode a diff
 * written as two hand-rolled `if`s has, and the reason this is a map and not two comparisons.
 */
const PIN_VALUE = {
  CATALOGUE: (pins: CampaignPins) => pins.catalogueDigest,
  RULE_SET_EDITION: (pins: CampaignPins) => pins.ruleSetEditionId,
} as const satisfies Record<CampaignPin, (pins: CampaignPins) => string>;

/**
 * The diff itself, pure: what the campaign pinned against what is in force. Each pin is compared
 * independently and every mover is named, because "stale" without a cause is the prose reason code
 * CLAUDE.md bans wearing an enum's clothes — the re-pin act that clears this states the outgoing
 * and incoming keys, and it reads them from here.
 */
export function campaignFreshnessOf(pinned: CampaignPins, inForce: CampaignPins): CampaignFreshness {
  const moved = CAMPAIGN_PINS.filter((pin) => PIN_VALUE[pin](pinned) !== PIN_VALUE[pin](inForce)).sort(compareCanonical);
  if (moved.length === 0) return { verdict: "CURRENT" };
  return { verdict: "STALE", reason: "PIN_STALE", moved };
}

/**
 * What is in force for a project right now: the rule-set edition the project pins (a project re-pin
 * moves it) and the digest of the catalogue as deployed (a shipped kind or `bears` row moves it).
 * Both read in the caller's transaction, so the two halves of a verdict are one consistent read.
 *
 * Exported because the re-pin act snapshots exactly what this returns (repin.ts): if the two ever
 * read "in force" differently, a re-pin would leave behind the staleness it was authored to clear.
 */
export async function pinsInForce(tx: Tx, tenantId: string, projectId: string): Promise<CampaignPins> {
  return {
    ruleSetEditionId: await projectRuleSetEdition(tx, tenantId, projectId),
    catalogueDigest: await catalogueDigestInForce(tx),
  };
}

/**
 * The verdict for one campaign, through the seam. A campaign the caller's tenant cannot see is
 * refused by name by the campaign reader it shares with the re-pin act: an invisible campaign has
 * no verdict, and `CURRENT` on a row nobody could read is a silent default.
 */
export async function campaignFreshness(ctx: TenantCtx, campaignId: string): Promise<CampaignFreshness> {
  return forTenant(ctx, async (tx) => {
    const campaign = await readCampaign(tx, ctx.tenantId, campaignId);
    return campaignFreshnessOf(campaign, await pinsInForce(tx, ctx.tenantId, campaign.projectId));
  });
}
