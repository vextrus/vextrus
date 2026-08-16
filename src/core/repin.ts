import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  catalogueDigestInForce,
  insertCampaignGeneration,
  projectRuleSetEdition,
  type Campaign,
} from "./campaigns";
import { forTenant, schema, type TenantCtx, type Tx } from "./db";
import { REPIN_CONSEQUENCES, type RepinConsequence } from "./enums";
import { drawingSetRevisionDigest, type DrawingSetMember } from "./identity";
import { compareCanonical } from "./order";

/**
 * The authored re-pin (identity.md §9): *a campaign advances only by an authored re-pin — one act
 * naming the outgoing and incoming set revision keys and the member changes between them*, with
 * its consequences stated **at the act, before it commits**.
 *
 * This file is the statement: what moved, what it costs, and the content address of that answer.
 * It is pure, because the statement a QS is shown and the statement the act is checked against
 * must be the same computation — a re-pin cannot be performed blind (§9), and "blind" includes a
 * surface that renders one set of consequences while the writer commits another. The seam half
 * (reading the campaign, superseding it, opening its successor) is in campaigns.ts.
 */

/** Both of a campaign's snapshots and its pinned set, on one side of the re-pin or the other. */
export type RepinKeys = {
  readonly setDigest: string;
  readonly ruleSetEditionId: string;
  readonly catalogueDigest: string;
};

/** One drawing whose cited revision moved between the two manifests. */
export type ReRevvedMember = {
  readonly drawingId: string;
  readonly outgoingRevisionId: string;
  readonly incomingRevisionId: string;
};

/**
 * The member changes, in the three shapes §9 distinguishes: adding, removing and re-revving a
 * member each yield a new set revision, but they do not cost the same thing — an addition widens
 * the scope register's denominator, while a removal or a re-rev moves cited evidence.
 */
export type ManifestChanges = {
  readonly added: readonly DrawingSetMember[];
  readonly removed: readonly DrawingSetMember[];
  readonly reRevved: readonly ReRevvedMember[];
};

/**
 * The statement itself — everything the act row records and everything a reviewer needs to
 * reconstruct exactly what moved, plus the digest that binds them together.
 */
export type RepinStatement = {
  readonly campaignId: string;
  readonly outgoing: RepinKeys;
  readonly incoming: RepinKeys;
  readonly changes: ManifestChanges;
  readonly consequences: readonly RepinConsequence[];
  /** The content address of everything above: what the caller must carry back to the act. */
  readonly digest: string;
};

/** Both sides of the diff, as the consequence predicates read them. */
export type RepinSides = {
  readonly campaignId: string;
  readonly outgoing: RepinKeys;
  readonly outgoingMembers: readonly DrawingSetMember[];
  /**
   * Whether a signature stands on the outgoing campaign (identity.md §8: *diverged and signed
   * voids whole*). Passed in rather than inferred: this module states the consequence, and the
   * campaign's state is what the seam reads it from.
   */
  readonly outgoingSigned: boolean;
  readonly incoming: RepinKeys;
  readonly incomingMembers: readonly DrawingSetMember[];
};

/** The manifest as a lookup — one revision per drawing is the manifest's primary key (§9). */
function byDrawing(members: readonly DrawingSetMember[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const m of members) {
    if (index.has(m.drawingId)) throw new Error(`DRAWING_SET_DUPLICATE_DRAWING: ${m.drawingId}`);
    index.set(m.drawingId, m.drawingRevisionId);
  }
  return index;
}

/**
 * What moved between two manifests, canonically sorted. Keyed on the **drawing**, never on the
 * pair: a member re-sheeted between revisions keeps its identity and its ordinal (§9's pairing
 * clause), so treating a re-rev as a removal plus an addition would retire an ordinal for no
 * physical reason — and would report a widened denominator where none widened.
 */
export function manifestChangesOf(
  outgoingMembers: readonly DrawingSetMember[],
  incomingMembers: readonly DrawingSetMember[],
): ManifestChanges {
  const before = byDrawing(outgoingMembers);
  const after = byDrawing(incomingMembers);
  const added: DrawingSetMember[] = [];
  const removed: DrawingSetMember[] = [];
  const reRevved: ReRevvedMember[] = [];
  for (const [drawingId, incomingRevisionId] of after) {
    const outgoingRevisionId = before.get(drawingId);
    if (outgoingRevisionId === undefined) added.push({ drawingId, drawingRevisionId: incomingRevisionId });
    else if (outgoingRevisionId !== incomingRevisionId) reRevved.push({ drawingId, outgoingRevisionId, incomingRevisionId });
  }
  for (const [drawingId, drawingRevisionId] of before) {
    if (!after.has(drawingId)) removed.push({ drawingId, drawingRevisionId });
  }
  const byId = (x: { readonly drawingId: string }, y: { readonly drawingId: string }) =>
    compareCanonical(x.drawingId, y.drawingId);
  return { added: added.sort(byId), removed: removed.sort(byId), reRevved: reRevved.sort(byId) };
}

/**
 * Consequence → whether this re-pin carries it. Total over the closed vocabulary, so a fourth
 * consequence added to the enum fails `typecheck` here rather than silently going unstated — the
 * same construction the freshness diff uses over the pin vocabulary, for the same reason: an
 * unstated consequence is a re-pin performed blind, which §9 forbids.
 */
const CARRIES = {
  CATALOGUE_MOVES: (d) => d.outgoing.catalogueDigest !== d.incoming.catalogueDigest,
  DENOMINATOR_WIDENS: (d) => d.changes.added.length > 0,
  EVIDENCE_MOVED: (d) => d.changes.removed.length > 0 || d.changes.reRevved.length > 0,
  RULE_SET_EDITION_MOVES: (d) => d.outgoing.ruleSetEditionId !== d.incoming.ruleSetEditionId,
  SIGNATURE_VOIDS_WHOLE: (d) => d.outgoingSigned,
} as const satisfies Record<RepinConsequence, (d: RepinSides & { changes: ManifestChanges }) => boolean>;

/**
 * The one consequence that is not a reason to re-pin. A signature voids because *something else*
 * moved; on its own it is §9's named defect — *re-pinning an unchanged set would void a signature
 * that nothing invalidated* — so it is excluded from the test for whether anything moved at all.
 */
const NOT_A_MOVE: RepinConsequence = "SIGNATURE_VOIDS_WHOLE";

/** The lines the statement is hashed over — one fact per line, every group canonically ordered. */
function statementLines(s: Omit<RepinStatement, "digest">): readonly string[] {
  return [
    `campaign:${s.campaignId}`,
    ...(["outgoing", "incoming"] as const).flatMap((side) => [
      `${side}.set:${s[side].setDigest}`,
      `${side}.ruleSetEdition:${s[side].ruleSetEditionId}`,
      `${side}.catalogue:${s[side].catalogueDigest}`,
    ]),
    ...s.changes.added.map((m) => `added:${m.drawingId}:${m.drawingRevisionId}`),
    ...s.changes.removed.map((m) => `removed:${m.drawingId}:${m.drawingRevisionId}`),
    ...s.changes.reRevved.map((m) => `reRevved:${m.drawingId}:${m.outgoingRevisionId}:${m.incomingRevisionId}`),
    ...s.consequences.map((c) => `consequence:${c}`),
  ];
}

/**
 * The content address of a statement. The construction is the set revision key's and the catalogue
 * digest's (identity.ts, kinds.ts): SHA-256 over canonically ordered lines. It is a **key, not a
 * checksum** — the act is refused unless the caller carries this exact value back, so anything a
 * QS was shown that the act would change must be inside it.
 */
export function repinStatementDigest(statement: Omit<RepinStatement, "digest">): string {
  return createHash("sha256").update(statementLines(statement).join("\n")).digest("hex");
}

/**
 * The statement, computed. Refuses `REPIN_NOTHING_MOVED` when the incoming set revision and both
 * snapshots are the outgoing ones: the set revision is content-addressed, so an unchanged pin *is*
 * the same key, and superseding a campaign for it would void a signature that nothing invalidated
 * (§9) and mint a lineage generation naming no change.
 */
export function repinStatementOf(sides: RepinSides): RepinStatement {
  const changes = manifestChangesOf(sides.outgoingMembers, sides.incomingMembers);
  const diff = { ...sides, changes };
  const consequences = REPIN_CONSEQUENCES.filter((c) => CARRIES[c](diff));
  if (!consequences.some((c) => c !== NOT_A_MOVE)) {
    throw new Error(`REPIN_NOTHING_MOVED: ${sides.campaignId} already pins ${sides.incoming.setDigest}`);
  }
  const stated = {
    campaignId: sides.campaignId,
    outgoing: sides.outgoing,
    incoming: sides.incoming,
    changes,
    consequences,
  };
  return { ...stated, digest: repinStatementDigest(stated) };
}

/**
 * The outgoing side, read live: the campaign's own row, its manifest, and whether a signature
 * stands on it. A campaign the caller's tenant cannot see refuses by name rather than reporting an
 * empty diff, and a **superseded** campaign refuses too — history is read, never re-pinned, and
 * its successor is the generation that advances (§9).
 */
async function outgoingSide(tx: Tx, tenantId: string, campaignId: string) {
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
  if (campaign.state === "SUPERSEDED") {
    throw new Error(`REPIN_CAMPAIGN_NOT_CURRENT: ${campaignId} is history`);
  }
  const members = await tx
    .select({
      drawingId: schema.drawingSetRevisionMembers.drawingId,
      drawingRevisionId: schema.drawingSetRevisionMembers.drawingRevisionId,
    })
    .from(schema.drawingSetRevisionMembers)
    .where(
      and(
        eq(schema.drawingSetRevisionMembers.tenantId, tenantId),
        eq(schema.drawingSetRevisionMembers.setDigest, campaign.setDigest),
      ),
    );
  return { campaign, members };
}

/**
 * The statement for a proposed re-pin, computed in the caller's transaction. Both the surface that
 * shows a QS what a re-pin will cost and the act that commits it call **this** — one computation,
 * so what was rendered and what is written cannot disagree, which is what "a re-pin cannot be
 * performed blind" has to mean mechanically.
 */
export async function repinStatementIn(
  tx: Tx,
  args: { readonly tenantId: string; readonly campaignId: string; readonly members: readonly DrawingSetMember[] },
): Promise<{ readonly outgoing: { readonly id: string; readonly projectId: string }; readonly statement: RepinStatement }> {
  const { campaign, members } = await outgoingSide(tx, args.tenantId, args.campaignId);
  const statement = repinStatementOf({
    campaignId: campaign.id,
    outgoing: {
      setDigest: campaign.setDigest,
      ruleSetEditionId: campaign.ruleSetEditionId,
      catalogueDigest: campaign.catalogueDigest,
    },
    outgoingMembers: members,
    outgoingSigned: campaign.state === "SIGNED",
    incoming: {
      setDigest: drawingSetRevisionDigest(args.members),
      ruleSetEditionId: await projectRuleSetEdition(tx, args.tenantId, campaign.projectId),
      catalogueDigest: await catalogueDigestInForce(tx),
    },
    incomingMembers: args.members,
  });
  return { outgoing: { id: campaign.id, projectId: campaign.projectId }, statement };
}

/** What a re-pin needs: the campaign, the incoming manifest, the actor, and the statement carried back. */
export type RepinCampaignInput = {
  readonly campaignId: string;
  /** The incoming manifest — the whole citation list, not a delta (§9: there is no second list). */
  readonly members: readonly DrawingSetMember[];
  readonly actorUserId: string;
  /**
   * The digest of the statement the caller was shown. Recomputed inside the writing transaction
   * and refused unless it still matches, so a re-pin whose consequences the caller never saw — or
   * saw before the catalogue moved underneath it — refuses by name instead of committing.
   */
  readonly acknowledged: string;
};

/**
 * The re-pin, on its own transaction (identity.md §9, §7). One commit carries: the outgoing
 * generation to SUPERSEDED — which **is** the voiding of any signature on it, whole, never in
 * part — the successor generation with the incoming pin and both snapshots re-read in force, and
 * the act naming actor, timestamp, both sides' keys, the member changes and the consequences. A
 * failure anywhere leaves none of it, because the seam is one transaction and nothing here opens
 * a second.
 *
 * Nothing updates a snapshot column, and nothing can: the pins are insert-only by grant, so the
 * only way a campaign's citations advance is this function minting the next row of the lineage.
 */
export async function repinCampaign(
  ctx: TenantCtx,
  input: RepinCampaignInput,
): Promise<{ readonly campaign: Campaign; readonly statement: RepinStatement }> {
  return forTenant(ctx, async (tx) => {
    const { outgoing, statement } = await repinStatementIn(tx, {
      tenantId: ctx.tenantId,
      campaignId: input.campaignId,
      members: input.members,
    });
    if (input.acknowledged !== statement.digest) {
      throw new Error(`REPIN_CONSEQUENCES_NOT_CARRIED: ${statement.digest}`);
    }
    // Supersede first: the successor takes the project's one current slot, and taking it while the
    // outgoing generation still held it is `campaigns_project_current_uq`'s refusal.
    await tx
      .update(schema.campaigns)
      .set({ state: "SUPERSEDED" })
      .where(and(eq(schema.campaigns.tenantId, ctx.tenantId), eq(schema.campaigns.id, outgoing.id)));
    const successor = await insertCampaignGeneration(tx, {
      tenantId: ctx.tenantId,
      projectId: outgoing.projectId,
      members: input.members,
      supersedesId: outgoing.id,
    });
    // Two subjects, at the granularity performed (§7): what moved, and what it moved to.
    await tx.insert(schema.acts).values({
      tenantId: ctx.tenantId,
      projectId: outgoing.projectId,
      actorUserId: input.actorUserId,
      type: "REPIN_DRAWING_SET",
      subjectKind: "campaigns",
      subjectIds: [outgoing.id, successor.id],
      detail: statement,
    });
    return { campaign: successor, statement };
  });
}

/**
 * The statement on its own transaction — what a surface asks for before it asks a human anything.
 * Read-only: it computes consequences and commits none of them.
 */
export async function campaignRepinStatement(
  ctx: TenantCtx,
  args: { readonly campaignId: string; readonly members: readonly DrawingSetMember[] },
): Promise<RepinStatement> {
  return forTenant(ctx, async (tx) => {
    const { statement } = await repinStatementIn(tx, { tenantId: ctx.tenantId, ...args });
    return statement;
  });
}
