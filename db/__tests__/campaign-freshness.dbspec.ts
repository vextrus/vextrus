import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openCampaign } from "@/core/campaigns";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { campaignFreshness } from "@/core/freshness";
import { createProject } from "@/core/projects";
import { forkProjectRuleSetEdition, mintTenantRuleSetTemplate } from "@/core/rule-set-editions";

/**
 * The freshness diff, live (identity.md §8 as amended 2026-08-16). Four things this proves that
 * the pure verdict cannot: the campaign really carries both snapshots after a commit; each pin
 * moves the verdict **independently**, one by a project re-pin and one by the catalogue's `bears`
 * relation changing under it; and a stale campaign still takes measurement writes — asserted here
 * rather than assumed, because "stale blocks signing and nothing else" is the whole claim.
 */

let tenantId: string;
let userId: string;
let projectId: string;
let campaignId: string;
let members: { drawingId: string; drawingRevisionId: string }[];

const ctx = () => mintTenantCtx(tenantId);

beforeAll(async () => {
  ({ tenantId, userId } = await runAsSystem("campaign freshness dbspec setup", async (tx) => {
    const [t] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec freshness", slug: `dbspec-fresh-${crypto.randomUUID()}` })
      .returning();
    if (!t) throw new Error("setup failed: tenant");
    const [u] = await tx
      .insert(schema.users)
      .values({ email: `fresh-${t.id}@dbspec.local`, name: "QS" })
      .returning();
    if (!u) throw new Error("setup failed: user");
    await tx.insert(schema.memberships).values({ tenantId: t.id, userId: u.id, role: "owner" });
    return { tenantId: t.id, userId: u.id };
  }));
  await mintTenantRuleSetTemplate(ctx());
  projectId = (await createProject(ctx(), { name: "Bashundhara Block K" })).id;
  members = await forTenant(ctx(), async (tx) => {
    const [d] = await tx.insert(schema.drawings).values({ tenantId, projectId, title: "S-01" }).returning();
    if (!d) throw new Error("setup failed: drawing");
    const [r] = await tx
      .insert(schema.drawingRevisions)
      .values({ tenantId, projectId, drawingId: d.id, label: "R1" })
      .returning();
    if (!r) throw new Error("setup failed: revision");
    return [{ drawingId: d.id, drawingRevisionId: r.id }];
  });
  campaignId = (await openCampaign(ctx(), { projectId, actorUserId: userId, members })).id;
});

afterAll(async () => {
  await runAsSystem("campaign freshness dbspec teardown", async (tx) => {
    for (const table of [
      schema.acts,
      schema.campaigns,
      schema.registerObjects,
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

/**
 * A kind the catalogue already carries, borne by a class that did not bear it: the smallest
 * lawful move of the relation, and the one the digest exists for — it widens the residue
 * denominator (quantity-contract.md §2.2) while every catalogue description holds still. Written
 * with the owner role because the app role has SELECT and nothing else on a platform-owned table:
 * this is the shipped-a-`bears`-row deploy, standing in for a migration.
 */
async function withBearsRow<T>(fn: () => Promise<T>): Promise<T> {
  await runAsSystem("campaign freshness dbspec: a bears row ships", (tx) =>
    tx.insert(schema.bears).values({ elementType: "BEAM", kind: "RCC_CONCRETE" }),
  );
  try {
    return await fn();
  } finally {
    await runAsSystem("campaign freshness dbspec: the shipped bears row is withdrawn", (tx) =>
      tx.delete(schema.bears).where(eq(schema.bears.elementType, "BEAM")),
    );
  }
}

describe("the freshness diff (identity.md §8)", () => {
  it("returns current before anything moves — both pins agree with what is in force", async () => {
    expect(await campaignFreshness(ctx(), campaignId)).toEqual({ verdict: "CURRENT" });
  });

  it("returns stale after the catalogue's bears relation changes, naming that pin alone", async () => {
    await withBearsRow(async () => {
      expect(await campaignFreshness(ctx(), campaignId)).toEqual({
        verdict: "STALE",
        reason: "PIN_STALE",
        moved: ["CATALOGUE"],
      });
    });
    // Withdrawn, the verdict is current again: the diff is computed, never remembered.
    expect(await campaignFreshness(ctx(), campaignId)).toEqual({ verdict: "CURRENT" });
  });

  it("returns stale after the project's rule-set edition advances, naming that pin alone", async () => {
    // The project re-pins to a fresh edition — the authoring surface lands later; what matters
    // here is that the campaign's snapshot did not follow it.
    const advanced = await forTenant(ctx(), async (tx) => {
      const fork = await forkProjectRuleSetEdition(tx, tenantId);
      await tx.update(schema.projects).set({ ruleSetEditionId: fork.id }).where(eq(schema.projects.id, projectId));
      return fork.id;
    });
    const [campaign] = await forTenant(ctx(), (tx) =>
      tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)),
    );
    expect(campaign?.ruleSetEditionId).not.toBe(advanced);
    expect(await campaignFreshness(ctx(), campaignId)).toEqual({
      verdict: "STALE",
      reason: "PIN_STALE",
      moved: ["RULE_SET_EDITION"],
    });
  });

  it("names both pins when both moved", async () => {
    await withBearsRow(async () => {
      expect(await campaignFreshness(ctx(), campaignId)).toEqual({
        verdict: "STALE",
        reason: "PIN_STALE",
        moved: ["CATALOGUE", "RULE_SET_EDITION"],
      });
    });
  });

  it("keeps the measurement path open on a stale campaign — stale blocks signing and nothing else", async () => {
    // The campaign is stale from the case above: its rule-set snapshot no longer matches.
    expect(await campaignFreshness(ctx(), campaignId)).toMatchObject({ verdict: "STALE" });
    await forTenant(ctx(), (tx) =>
      tx.insert(schema.registerObjects).values({
        tenantId,
        projectId,
        discipline: "STRUCTURAL",
        elementType: "COLUMN",
        mark: "C1",
        ordinal: 1,
        levelBasis: "UNRESOLVED",
      }),
    );
    expect(
      await forTenant(ctx(), (tx) =>
        tx.select().from(schema.registerObjects).where(eq(schema.registerObjects.projectId, projectId)),
      ),
    ).toHaveLength(1);
    // A new drawing revision — ingest's evidence side — lands on a stale campaign too.
    await forTenant(ctx(), (tx) =>
      tx.insert(schema.drawingRevisions).values({
        tenantId,
        projectId,
        drawingId: members[0]?.drawingId ?? "",
        label: "R2",
      }),
    );
    expect(await campaignFreshness(ctx(), campaignId)).toMatchObject({ verdict: "STALE" });
  });

  it("refuses a campaign the tenant cannot see, by name — no verdict on an invisible row", async () => {
    await expect(campaignFreshness(mintTenantCtx(crypto.randomUUID()), campaignId)).rejects.toThrow(
      /CAMPAIGN_MISSING/,
    );
  });
});
