import { and, eq } from "drizzle-orm";
import { forTenant, schema, type TenantCtx, type Tx } from "./db";
import { type CampaignState } from "./enums";
import { drawingSetRevisionDigest, type DrawingSetMember } from "./identity";

/**
 * Opening a campaign (identity.md §8 and its amendment of 2026-08-16, §9): a QS pins a
 * drawing-set revision and the campaign snapshots the rule-set edition the project has in force.
 * The pin is a human act (§7), so the act row and the campaign row commit in one transaction or
 * neither. Everything here goes through the seam (ADR-0004).
 */

/** What a campaign carries once opened: the pin, the snapshot, and the state it opens in. */
export type Campaign = {
  readonly id: string;
  readonly projectId: string;
  readonly setDigest: string;
  readonly ruleSetEditionId: string;
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
 * The campaign, its pin and its pin act, in the caller's transaction — exported at this
 * granularity because the surface that opens a campaign may have its own writes to land in the
 * same commit (§7: act row and state change commit together or neither).
 *
 * The snapshot is read here, never passed in: a campaign carrying a rule-set edition its project
 * does not pin would be a citation of a fiction. A project the caller's tenant cannot see refuses
 * by name — no invented edition, no bare insert that RLS would have to catch.
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
  const [project] = await tx
    .select({ ruleSetEditionId: schema.projects.ruleSetEditionId })
    .from(schema.projects)
    .where(and(eq(schema.projects.tenantId, args.tenantId), eq(schema.projects.id, args.projectId)));
  if (!project) throw new Error(`CAMPAIGN_PROJECT_MISSING: ${args.projectId}`);
  const setDigest = await pinDrawingSetRevision(tx, {
    tenantId: args.tenantId,
    projectId: args.projectId,
    members: args.members,
  });
  const [campaign] = await tx
    .insert(schema.campaigns)
    .values({
      tenantId: args.tenantId,
      projectId: args.projectId,
      setDigest,
      ruleSetEditionId: project.ruleSetEditionId,
    })
    .returning({
      id: schema.campaigns.id,
      projectId: schema.campaigns.projectId,
      setDigest: schema.campaigns.setDigest,
      ruleSetEditionId: schema.campaigns.ruleSetEditionId,
      state: schema.campaigns.state,
      createdAt: schema.campaigns.createdAt,
    });
  if (!campaign) throw new Error("CAMPAIGN_NOT_WRITTEN");
  // The act names its actor, its timestamp (the column's default) and what it pinned.
  await tx.insert(schema.acts).values({
    tenantId: args.tenantId,
    projectId: args.projectId,
    actorUserId: args.actorUserId,
    type: "PIN_DRAWING_SET",
    subjectKind: "campaigns",
    subjectIds: [campaign.id],
    detail: { setDigest, ruleSetEditionId: project.ruleSetEditionId },
  });
  return campaign;
}

/**
 * Opening a campaign on its own transaction. A second live campaign on the project is a unique
 * violation from `campaigns_project_live_uq`, refused at the door: one project, one lineage.
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
