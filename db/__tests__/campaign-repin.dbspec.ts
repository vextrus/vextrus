import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openCampaign } from "@/core/campaigns";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { campaignFreshness } from "@/core/freshness";
import { drawingSetRevisionDigest, type DrawingSetMember } from "@/core/identity";
import { createProject } from "@/core/projects";
import { campaignRepinStatement, repinCampaign } from "@/core/repin";
import { forkProjectRuleSetEdition, mintTenantRuleSetTemplate } from "@/core/rule-set-editions";

/**
 * The authored re-pin, live (identity.md §9, §8's amendment of 2026-08-16, §7). What only a live
 * seam can prove: the outgoing generation and its successor and the act land in one commit or
 * none; the statement a caller was shown is recomputed and refused when it no longer addresses
 * what the act would do; a signature voids whole rather than in part; the superseded snapshot is
 * still there to read; and no path but this act moves a pin, because the grant says so.
 *
 * One project per case, so nothing here depends on the order the cases ran in.
 */

let tenantId: string;
let userId: string;
const ctx = () => mintTenantCtx(tenantId);

beforeAll(async () => {
  ({ tenantId, userId } = await runAsSystem("campaign repin dbspec setup", async (tx) => {
    const [t] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec repin", slug: `dbspec-repin-${crypto.randomUUID()}` })
      .returning();
    if (!t) throw new Error("setup failed: tenant");
    const [u] = await tx
      .insert(schema.users)
      .values({ email: `repin-${t.id}@dbspec.local`, name: "QS" })
      .returning();
    if (!u) throw new Error("setup failed: user");
    await tx.insert(schema.memberships).values({ tenantId: t.id, userId: u.id, role: "owner" });
    return { tenantId: t.id, userId: u.id };
  }));
  await mintTenantRuleSetTemplate(ctx());
});

afterAll(async () => {
  await runAsSystem("campaign repin dbspec teardown", async (tx) => {
    for (const table of [
      schema.acts,
      schema.campaigns,
      schema.drawingSetRevisionMembers,
      schema.drawingSetRevisions,
      schema.drawingRevisions,
      schema.drawings,
      schema.projects,
      schema.ruleSetEditionParameters,
      schema.ruleSetEditionMethods,
      schema.ruleSetEditions,
      schema.memberships,
    ]) {
      await tx.delete(table).where(eq(table.tenantId, tenantId));
    }
    await tx.delete(schema.users).where(inArray(schema.users.id, [userId]));
    await tx.delete(schema.tenants).where(inArray(schema.tenants.id, [tenantId]));
  });
});

function messagesOf(err: unknown): string {
  const messages: string[] = [];
  for (let e = err; e instanceof Error; e = e.cause) messages.push(e.message);
  return messages.join(" | ");
}
async function refusal(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return messagesOf(err);
  }
  return "";
}

/** One drawing and one revision of it, as a manifest member of `projectId`. */
async function newMember(projectId: string, title: string): Promise<DrawingSetMember> {
  return forTenant(ctx(), async (tx) => {
    const [d] = await tx.insert(schema.drawings).values({ tenantId, projectId, title }).returning();
    if (!d) throw new Error("setup failed: drawing");
    const [r] = await tx
      .insert(schema.drawingRevisions)
      .values({ tenantId, projectId, drawingId: d.id, label: "R1" })
      .returning();
    if (!r) throw new Error("setup failed: revision");
    return { drawingId: d.id, drawingRevisionId: r.id };
  });
}

/** A project with one campaign open on a one-member manifest, and a second sheet to add to it. */
async function newCase(name: string) {
  const projectId = (await createProject(ctx(), { name })).id;
  const first = await newMember(projectId, `${name} S-01`);
  const second = await newMember(projectId, `${name} S-02`);
  const campaign = await openCampaign(ctx(), { projectId, actorUserId: userId, members: [first] });
  return { projectId, first, second, campaignId: campaign.id };
}

const campaignRow = (id: string) =>
  forTenant(ctx(), async (tx) => {
    const [row] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
    if (!row) throw new Error(`expected campaign ${id}`);
    return row;
  });

const campaignsOfProject = (projectId: string) =>
  forTenant(ctx(), (tx) => tx.select().from(schema.campaigns).where(eq(schema.campaigns.projectId, projectId)));

const repinActsOfProject = (projectId: string) =>
  forTenant(ctx(), (tx) =>
    tx
      .select()
      .from(schema.acts)
      .where(and(eq(schema.acts.projectId, projectId), eq(schema.acts.type, "REPIN_DRAWING_SET"))),
  );

/** A `bears` row ships — the deploy that moves the catalogue digest under a campaign. */
const SHIPPED_PAIR = { elementType: "BEAM", kind: "RCC_CONCRETE" } as const;
async function withBearsRow<T>(fn: () => Promise<T>): Promise<T> {
  await runAsSystem("campaign repin dbspec: a bears row ships", (tx) => tx.insert(schema.bears).values(SHIPPED_PAIR));
  try {
    return await fn();
  } finally {
    await runAsSystem("campaign repin dbspec: the shipped bears row is withdrawn", (tx) =>
      tx
        .delete(schema.bears)
        .where(and(eq(schema.bears.elementType, SHIPPED_PAIR.elementType), eq(schema.bears.kind, SHIPPED_PAIR.kind))),
    );
  }
}

describe("the re-pin act (identity.md §9)", () => {
  it("advances the lineage and writes its act in one commit, keeping the superseded pin readable", async () => {
    const { projectId, first, second, campaignId } = await newCase("Gulshan repin");
    const outgoingBefore = await campaignRow(campaignId);

    const statement = await campaignRepinStatement(ctx(), { campaignId, members: [first, second] });
    expect(statement.consequences).toEqual(["DENOMINATOR_WIDENS"]);
    expect(statement.outgoing.setDigest).toBe(drawingSetRevisionDigest([first]));
    expect(statement.incoming.setDigest).toBe(drawingSetRevisionDigest([first, second]));
    expect(statement.changes).toEqual({ added: [second], removed: [], reRevved: [] });

    const { campaign: successor } = await repinCampaign(ctx(), {
      campaignId,
      members: [first, second],
      actorUserId: userId,
      acknowledged: statement.digest,
    });

    expect(successor).toMatchObject({
      projectId,
      setDigest: drawingSetRevisionDigest([first, second]),
      supersedesId: campaignId,
      state: "LIVE",
    });
    // The verdict returns to current: the successor snapshots what is in force, from one reader.
    expect(await campaignFreshness(ctx(), successor.id)).toEqual({ verdict: "CURRENT" });

    // The superseded generation is history, not a deletion — its own pin still reads back whole.
    const outgoingAfter = await campaignRow(campaignId);
    expect(outgoingAfter).toMatchObject({
      state: "SUPERSEDED",
      setDigest: outgoingBefore.setDigest,
      ruleSetEditionId: outgoingBefore.ruleSetEditionId,
      catalogueDigest: outgoingBefore.catalogueDigest,
      supersedesId: null,
    });

    const [act] = await repinActsOfProject(projectId);
    expect(act).toMatchObject({
      actorUserId: userId,
      subjectKind: "campaigns",
      subjectIds: [campaignId, successor.id],
      detail: {
        campaignId,
        outgoing: statement.outgoing,
        incoming: statement.incoming,
        consequences: ["DENOMINATOR_WIDENS"],
        digest: statement.digest,
      },
    });
    expect(act?.performedAt).toBeInstanceOf(Date);
  });

  it("names moved evidence when a member is re-revved, and keeps the drawing's identity", async () => {
    const { projectId, first, campaignId } = await newCase("Uttara re-rev");
    const [r2] = await forTenant(ctx(), (tx) =>
      tx
        .insert(schema.drawingRevisions)
        .values({ tenantId, projectId, drawingId: first.drawingId, label: "R2" })
        .returning(),
    );
    if (!r2) throw new Error("expected the second revision");
    const incoming = [{ drawingId: first.drawingId, drawingRevisionId: r2.id }];
    const statement = await campaignRepinStatement(ctx(), { campaignId, members: incoming });
    expect(statement.consequences).toEqual(["EVIDENCE_MOVED"]);
    expect(statement.changes).toEqual({
      added: [],
      removed: [],
      reRevved: [{ drawingId: first.drawingId, outgoingRevisionId: first.drawingRevisionId, incomingRevisionId: r2.id }],
    });
    const { campaign } = await repinCampaign(ctx(), {
      campaignId,
      members: incoming,
      actorUserId: userId,
      acknowledged: statement.digest,
    });
    expect(campaign.setDigest).toBe(drawingSetRevisionDigest(incoming));
  });
});

describe("a re-pin cannot be performed blind (identity.md §9)", () => {
  it("refuses a statement the caller never carried, and writes nothing", async () => {
    const { projectId, first, second, campaignId } = await newCase("Mirpur blind");
    const refused = await refusal(() =>
      repinCampaign(ctx(), {
        campaignId,
        members: [first, second],
        actorUserId: userId,
        acknowledged: "0".repeat(64),
      }),
    );
    expect(refused).toMatch(/REPIN_CONSEQUENCES_NOT_CARRIED/);
    expect((await campaignRow(campaignId)).state).toBe("LIVE");
    expect(await campaignsOfProject(projectId)).toHaveLength(1);
    expect(await repinActsOfProject(projectId)).toHaveLength(0);
  });

  it("refuses a statement the world outran — the consequences are recomputed at the act", async () => {
    const { projectId, first, second, campaignId } = await newCase("Banani outrun");
    const statement = await campaignRepinStatement(ctx(), { campaignId, members: [first, second] });
    expect(statement.consequences).toEqual(["DENOMINATOR_WIDENS"]);
    await withBearsRow(async () => {
      // The catalogue moved between the statement and the act: what the QS was shown no longer
      // states what this re-pin would do, so it refuses rather than committing the difference.
      const refused = await refusal(() =>
        repinCampaign(ctx(), {
          campaignId,
          members: [first, second],
          actorUserId: userId,
          acknowledged: statement.digest,
        }),
      );
      expect(refused).toMatch(/REPIN_CONSEQUENCES_NOT_CARRIED/);
      const restated = await campaignRepinStatement(ctx(), { campaignId, members: [first, second] });
      expect(restated.consequences).toEqual(["CATALOGUE_MOVES", "DENOMINATOR_WIDENS"]);
    });
    expect((await campaignRow(campaignId)).state).toBe("LIVE");
    expect(await campaignsOfProject(projectId)).toHaveLength(1);
  });

  it("refuses a re-pin that moves nothing — never a signature voided for nothing", async () => {
    const { first, campaignId } = await newCase("Dhanmondi still");
    expect(await refusal(() => campaignRepinStatement(ctx(), { campaignId, members: [first] }))).toMatch(
      /REPIN_NOTHING_MOVED/,
    );
  });

  it("refuses re-pinning history, and refuses a campaign the tenant cannot see", async () => {
    const { first, second, campaignId } = await newCase("Tejgaon history");
    const statement = await campaignRepinStatement(ctx(), { campaignId, members: [first, second] });
    await repinCampaign(ctx(), {
      campaignId,
      members: [first, second],
      actorUserId: userId,
      acknowledged: statement.digest,
    });
    expect(
      await refusal(() => campaignRepinStatement(ctx(), { campaignId, members: [first] })),
    ).toMatch(/REPIN_CAMPAIGN_NOT_CURRENT/);
    expect(
      await refusal(() =>
        campaignRepinStatement(mintTenantCtx(crypto.randomUUID()), { campaignId, members: [first, second] }),
      ),
    ).toMatch(/CAMPAIGN_MISSING/);
  });
});

describe("a re-pin under a signature (identity.md §8)", () => {
  /** The signature arc authors this transition; here it stands for a signed campaign. */
  const sign = (campaignId: string) =>
    forTenant(ctx(), (tx) =>
      tx.update(schema.campaigns).set({ state: "SIGNED" }).where(eq(schema.campaigns.id, campaignId)),
    );

  it("holds the project's one lineage slot while signed, and cannot be un-signed", async () => {
    const { projectId, first, campaignId } = await newCase("Baridhara signed");
    await sign(campaignId);
    expect(
      await refusal(() => openCampaign(ctx(), { projectId, actorUserId: userId, members: [first] })),
    ).toMatch(/campaigns_project_current_uq/);
    expect(
      await refusal(() =>
        forTenant(ctx(), (tx) =>
          tx.update(schema.campaigns).set({ state: "LIVE" }).where(eq(schema.campaigns.id, campaignId)),
        ),
      ),
    ).toMatch(/CAMPAIGN_SIGNATURE_NOT_REVOCABLE/);
  });

  it("voids whole: stated before the act, and applied by the supersede itself", async () => {
    const { projectId, first, second, campaignId } = await newCase("Motijheel void");
    await sign(campaignId);
    const statement = await campaignRepinStatement(ctx(), { campaignId, members: [first, second] });
    // Neither silently blocked nor silently applied: the void is named, and it is not alone —
    // §8 voids whole, so no partial consequence is on offer.
    expect(statement.consequences).toEqual(["DENOMINATOR_WIDENS", "SIGNATURE_VOIDS_WHOLE"]);

    const { campaign: successor } = await repinCampaign(ctx(), {
      campaignId,
      members: [first, second],
      actorUserId: userId,
      acknowledged: statement.digest,
    });
    expect((await campaignRow(campaignId)).state).toBe("SUPERSEDED");
    expect(successor.state).toBe("LIVE");
    const [act] = await repinActsOfProject(projectId);
    expect(act?.detail).toMatchObject({ consequences: ["DENOMINATOR_WIDENS", "SIGNATURE_VOIDS_WHOLE"] });
  });
});

describe("what a re-pin clears, and what it cannot leave behind", () => {
  it("returns a stale campaign to current, and the superseded generation keeps the old snapshot", async () => {
    const { projectId, first, campaignId } = await newCase("Purbachal stale");
    const advanced = await forTenant(ctx(), async (tx) => {
      const fork = await forkProjectRuleSetEdition(tx, tenantId);
      await tx.update(schema.projects).set({ ruleSetEditionId: fork.id }).where(eq(schema.projects.id, projectId));
      return fork.id;
    });
    expect(await campaignFreshness(ctx(), campaignId)).toEqual({
      verdict: "STALE",
      reason: "PIN_STALE",
      moved: ["RULE_SET_EDITION"],
    });
    const outgoingEdition = (await campaignRow(campaignId)).ruleSetEditionId;

    const statement = await campaignRepinStatement(ctx(), { campaignId, members: [first] });
    expect(statement.consequences).toEqual(["RULE_SET_EDITION_MOVES"]);
    const { campaign: successor } = await repinCampaign(ctx(), {
      campaignId,
      members: [first],
      actorUserId: userId,
      acknowledged: statement.digest,
    });
    expect(successor.ruleSetEditionId).toBe(advanced);
    expect(await campaignFreshness(ctx(), successor.id)).toEqual({ verdict: "CURRENT" });
    expect((await campaignRow(campaignId)).ruleSetEditionId).toBe(outgoingEdition);
  });

  it("leaves neither the supersede nor the successor when the act cannot be written", async () => {
    const { projectId, first, second, campaignId } = await newCase("Savar atomic");
    const statement = await campaignRepinStatement(ctx(), { campaignId, members: [first, second] });
    // An actor with no membership: the act's FK fires *after* the supersede and the successor
    // insert, which is exactly the window §7 says must not be able to half-commit.
    const refused = await refusal(() =>
      repinCampaign(ctx(), {
        campaignId,
        members: [first, second],
        actorUserId: crypto.randomUUID(),
        acknowledged: statement.digest,
      }),
    );
    expect(refused).toMatch(/acts_actor_membership_fk/);
    expect(await campaignsOfProject(projectId)).toHaveLength(1);
    expect((await campaignRow(campaignId)).state).toBe("LIVE");
    expect(await repinActsOfProject(projectId)).toHaveLength(0);
  });

  it("refuses every other path to a pin — the grant, not the application", async () => {
    const { first, second, campaignId } = await newCase("Keraniganj grant");
    const statement = await campaignRepinStatement(ctx(), { campaignId, members: [first, second] });
    const { campaign: successor } = await repinCampaign(ctx(), {
      campaignId,
      members: [first, second],
      actorUserId: userId,
      acknowledged: statement.digest,
    });
    for (const set of [
      { setDigest: drawingSetRevisionDigest([first]) },
      { catalogueDigest: "a".repeat(64) },
      { supersedesId: null },
    ]) {
      expect(
        await refusal(() =>
          forTenant(ctx(), (tx) =>
            tx.update(schema.campaigns).set(set).where(eq(schema.campaigns.id, successor.id)),
          ),
        ),
      ).toMatch(/permission denied/i);
    }
    // And a lineage cannot fork: a second successor of one generation is a unique violation.
    expect(
      await refusal(() =>
        forTenant(ctx(), (tx) =>
          tx.insert(schema.campaigns).values({
            tenantId,
            projectId: successor.projectId,
            setDigest: successor.setDigest,
            ruleSetEditionId: successor.ruleSetEditionId,
            catalogueDigest: successor.catalogueDigest,
            supersedesId: campaignId,
            state: "SUPERSEDED",
          }),
        ),
      ),
    ).toMatch(/campaigns_supersedes_uq/);
  });
});
