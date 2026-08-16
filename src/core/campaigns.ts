import { and, eq } from "drizzle-orm";
import { forTenant, schema, type TenantCtx, type Tx } from "./db";
import { type CampaignState } from "./enums";
import { drawingSetRevisionDigest, type DrawingSetMember } from "./identity";
import { catalogueDigest, type BearsPair } from "./kinds";

/**
 * Opening a campaign (identity.md §8 and its amendment of 2026-08-16, §9): a QS pins a
 * drawing-set revision and the campaign snapshots **two** things in force — the rule-set edition
 * the project pins, and the catalogue digest. The pin is a human act (§7), so the act row and the
 * campaign row commit in one transaction or neither. Everything here goes through the seam
 * (ADR-0004).
 */

/** What a campaign carries once opened: the pin, both snapshots, and the state it opens in. */
export type Campaign = {
  readonly id: string;
  readonly projectId: string;
  readonly setDigest: string;
  readonly ruleSetEditionId: string;
  readonly catalogueDigest: string;
  /** The generation this one advanced from — null on the first campaign of a lineage (§9). */
  readonly supersedesId: string | null;
  readonly state: CampaignState;
  readonly createdAt: Date;
};

export type OpenCampaignInput = {
  readonly projectId: string;
  readonly actorUserId: string;
  /** The manifest — the citation list, one revision per drawing (§9). There is no second list. */
  readonly members: readonly DrawingSetMember[];
};

/**
 * The catalogue digest as it stands now — the value a campaign pins at creation and the value the
 * freshness diff compares that pin against, from one reader so the two cannot disagree about what
 * "the catalogue" means.
 *
 * It reads the **table**, not the const the table was seeded from (db/migrations/0007): the digest
 * must address what the certificate's denominator will actually be enumerated from
 * (quantity-contract.md §6), and the deployed rows are that. A const read instead would pin the
 * binary's opinion of the catalogue. `bears` is platform-owned, tenant-independent and read-only
 * to the app role, so this is a plain SELECT through the seam with no tenant predicate. An empty
 * relation refuses by closed code (`CATALOGUE_BEARS_EMPTY`): a denominator of nothing certifies
 * everything as measured.
 */
export async function catalogueDigestInForce(tx: Tx): Promise<string> {
  const pairs: readonly BearsPair[] = await tx
    .select({ elementType: schema.bears.elementType, kind: schema.bears.kind })
    .from(schema.bears);
  return catalogueDigest(pairs);
}

/**
 * The rule-set edition a project pins, read in the caller's transaction — the value a campaign
 * snapshots at creation and the value the freshness diff compares that snapshot against, again
 * from one reader. A project the caller's tenant cannot see refuses by name: no invented edition,
 * and no bare insert that RLS would have to catch.
 */
export async function projectRuleSetEdition(tx: Tx, tenantId: string, projectId: string): Promise<string> {
  const [project] = await tx
    .select({ ruleSetEditionId: schema.projects.ruleSetEditionId })
    .from(schema.projects)
    .where(and(eq(schema.projects.tenantId, tenantId), eq(schema.projects.id, projectId)));
  if (!project) throw new Error(`CAMPAIGN_PROJECT_MISSING: ${projectId}`);
  return project.ruleSetEditionId;
}

/**
 * The set revision the campaign will cite, materialised in the caller's transaction. It is
 * content-addressed, so an identical pinned set **is** the identical set revision: the insert
 * yields to what is already there rather than minting a second row, and the manifest follows the
 * same law. A digest already held by a different project is not silently adopted — the campaign's
 * composite FK refuses it.
 */
async function pinDrawingSetRevision(
  tx: Tx,
  args: { readonly tenantId: string; readonly projectId: string; readonly members: readonly DrawingSetMember[] },
): Promise<string> {
  const digest = drawingSetRevisionDigest(args.members);
  await tx
    .insert(schema.drawingSetRevisions)
    .values({ digest, tenantId: args.tenantId, projectId: args.projectId })
    .onConflictDoNothing();
  await tx
    .insert(schema.drawingSetRevisionMembers)
    .values(
      args.members.map((m) => ({
        setDigest: digest,
        tenantId: args.tenantId,
        projectId: args.projectId,
        drawingId: m.drawingId,
        drawingRevisionId: m.drawingRevisionId,
      })),
    )
    .onConflictDoNothing();
  return digest;
}

/**
 * One campaign row, read in the caller's transaction — the one reader every path that needs a
 * campaign's own citations goes through (the freshness diff, the re-pin's outgoing side). A
 * campaign the caller's tenant cannot see refuses by name rather than being reported as fresh, or
 * as having nothing to re-pin: `CURRENT` on a row nobody could read, and an empty diff on one, are
 * both the silent default the governing sentence condemns.
 */
export async function readCampaign(
  tx: Tx,
  tenantId: string,
  campaignId: string,
): Promise<{
  readonly id: string;
  readonly projectId: string;
  readonly setDigest: string;
  readonly ruleSetEditionId: string;
  readonly catalogueDigest: string;
  readonly state: CampaignState;
}> {
  const [campaign] = await tx
    .select({
      id: schema.campaigns.id,
      projectId: schema.campaigns.projectId,
      setDigest: schema.campaigns.setDigest,
      ruleSetEditionId: schema.campaigns.ruleSetEditionId,
      catalogueDigest: schema.campaigns.catalogueDigest,
      state: schema.campaigns.state,
    })
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.tenantId, tenantId), eq(schema.campaigns.id, campaignId)));
  if (!campaign) throw new Error(`CAMPAIGN_MISSING: ${campaignId}`);
  return campaign;
}

/**
 * One generation of a campaign: the pin, both snapshots, and the link to the generation it
 * advanced from. Separated from the act above it because a lineage has two authors — `pinCampaign`
 * opens it, `repinCampaign` (repin.ts) advances it — and both must mint a row exactly this way, in
 * particular reading both snapshots **here** rather than accepting them: a campaign carrying a
 * rule-set edition its project does not pin, or a catalogue digest nothing was hashed to produce,
 * would be a citation of a fiction. Both readers are the ones the freshness diff uses, so a verdict
 * can never be `STALE` on a campaign that changed nothing, and a re-pin's successor reads `CURRENT`.
 */
export async function insertCampaignGeneration(
  tx: Tx,
  args: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly members: readonly DrawingSetMember[];
    readonly supersedesId?: string;
  },
): Promise<Campaign> {
  const ruleSetEditionId = await projectRuleSetEdition(tx, args.tenantId, args.projectId);
  const setDigest = await pinDrawingSetRevision(tx, {
    tenantId: args.tenantId,
    projectId: args.projectId,
    members: args.members,
  });
  const catalogueSnapshot = await catalogueDigestInForce(tx);
  const [campaign] = await tx
    .insert(schema.campaigns)
    .values({
      tenantId: args.tenantId,
      projectId: args.projectId,
      setDigest,
      ruleSetEditionId,
      catalogueDigest: catalogueSnapshot,
      supersedesId: args.supersedesId,
    })
    .returning({
      id: schema.campaigns.id,
      projectId: schema.campaigns.projectId,
      setDigest: schema.campaigns.setDigest,
      ruleSetEditionId: schema.campaigns.ruleSetEditionId,
      catalogueDigest: schema.campaigns.catalogueDigest,
      supersedesId: schema.campaigns.supersedesId,
      state: schema.campaigns.state,
      createdAt: schema.campaigns.createdAt,
    });
  if (!campaign) throw new Error("CAMPAIGN_NOT_WRITTEN");
  return campaign;
}

/**
 * The campaign, its pin and its pin act, in the caller's transaction — exported at this
 * granularity because the surface that opens a campaign may have its own writes to land in the
 * same commit (§7: act row and state change commit together or neither).
 */
export async function pinCampaign(
  tx: Tx,
  args: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly actorUserId: string;
    readonly members: readonly DrawingSetMember[];
  },
): Promise<Campaign> {
  const campaign = await insertCampaignGeneration(tx, args);
  // The act names its actor, its timestamp (the column's default) and what it pinned.
  await tx.insert(schema.acts).values({
    tenantId: args.tenantId,
    projectId: args.projectId,
    actorUserId: args.actorUserId,
    type: "PIN_DRAWING_SET",
    subjectKind: "campaigns",
    subjectIds: [campaign.id],
    detail: {
      setDigest: campaign.setDigest,
      ruleSetEditionId: campaign.ruleSetEditionId,
      catalogueDigest: campaign.catalogueDigest,
    },
  });
  return campaign;
}

/**
 * Opening a campaign on its own transaction. A second current campaign on the project is a unique
 * violation from `campaigns_project_current_uq`, refused at the door: one project, one lineage.
 */
export async function openCampaign(ctx: TenantCtx, input: OpenCampaignInput): Promise<Campaign> {
  return forTenant(ctx, (tx) =>
    pinCampaign(tx, {
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      members: input.members,
    }),
  );
}
