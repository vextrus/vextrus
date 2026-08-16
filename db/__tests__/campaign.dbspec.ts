import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openCampaign, pinCampaign } from "@/core/campaigns";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { drawingSetRevisionDigest } from "@/core/identity";
import { CATALOGUE_DIGEST } from "@/core/kinds";
import { createProject } from "@/core/projects";
import { mintTenantRuleSetTemplate } from "@/core/rule-set-editions";

/**
 * The campaign through the seam (identity.md §7, §8 and its amendment of 2026-08-16, §9), live
 * against Postgres via `pnpm test:db`: a campaign cannot exist without a set revision to cite, it
 * snapshots both the rule-set edition and the catalogue digest in force at creation and can edit
 * neither afterwards, one project carries one current campaign, and the pin act commits with the
 * row or neither lands.
 */

/** One tenant per project pair, so the cross-tenant cases have somewhere to point. */
let tenantA: string;
let tenantB: string;
let userA: string;
let userB: string;
let projectA: string;
/** A second project of tenant A — the "another project's set revision" case. */
let otherProjectA: string;
let projectB: string;
let membersA: { drawingId: string; drawingRevisionId: string }[];
let membersOther: { drawingId: string; drawingRevisionId: string }[];
let membersB: { drawingId: string; drawingRevisionId: string }[];

async function newTenant(label: string): Promise<{ tenantId: string; userId: string }> {
  return runAsSystem("campaign dbspec setup", async (tx) => {
    const [t] = await tx
      .insert(schema.tenants)
      .values({ name: `dbspec campaign ${label}`, slug: `dbspec-camp-${label}-${crypto.randomUUID()}` })
      .returning();
    if (!t) throw new Error("setup failed: tenant");
    const [u] = await tx
      .insert(schema.users)
      .values({ email: `camp-${t.id}@dbspec.local`, name: "QS" })
      .returning();
    if (!u) throw new Error("setup failed: user");
    await tx.insert(schema.memberships).values({ tenantId: t.id, userId: u.id, role: "owner" });
    return { tenantId: t.id, userId: u.id };
  });
}

/** A drawing and one revision of it — the smallest lawful manifest for a project. */
async function newSetMembers(tenantId: string, projectId: string, title: string) {
  return forTenant(mintTenantCtx(tenantId), async (tx) => {
    const [d] = await tx.insert(schema.drawings).values({ tenantId, projectId, title }).returning();
    if (!d) throw new Error("setup failed: drawing");
    const [r] = await tx
      .insert(schema.drawingRevisions)
      .values({ tenantId, projectId, drawingId: d.id, label: "R1" })
      .returning();
    if (!r) throw new Error("setup failed: revision");
    return [{ drawingId: d.id, drawingRevisionId: r.id }];
  });
}

beforeAll(async () => {
  ({ tenantId: tenantA, userId: userA } = await newTenant("a"));
  ({ tenantId: tenantB, userId: userB } = await newTenant("b"));
  await mintTenantRuleSetTemplate(mintTenantCtx(tenantA));
  await mintTenantRuleSetTemplate(mintTenantCtx(tenantB));
  projectA = (await createProject(mintTenantCtx(tenantA), { name: "Gulshan Tower" })).id;
  otherProjectA = (await createProject(mintTenantCtx(tenantA), { name: "Uttara Block C" })).id;
  projectB = (await createProject(mintTenantCtx(tenantB), { name: "another tenant" })).id;
  membersA = await newSetMembers(tenantA, projectA, "S-01 column layout");
  membersOther = await newSetMembers(tenantA, otherProjectA, "S-01 other project");
  membersB = await newSetMembers(tenantB, projectB, "S-01 other tenant");
});

afterAll(async () => {
  await runAsSystem("campaign dbspec teardown", async (tx) => {
    for (const id of [tenantA, tenantB]) {
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
        await tx.delete(table).where(eq(table.tenantId, id));
      }
    }
    await tx.delete(schema.users).where(inArray(schema.users.id, [userA, userB]));
    await tx.delete(schema.tenants).where(inArray(schema.tenants.id, [tenantA, tenantB]));
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
const ctxA = () => mintTenantCtx(tenantA);
const campaignsOf = (tenantId: string) =>
  forTenant(mintTenantCtx(tenantId), (tx) => tx.select().from(schema.campaigns));

/** The edition a project of tenant A pins — what a campaign of that project must snapshot. */
async function ruleSetEditionOf(projectId: string): Promise<string> {
  const [project] = await forTenant(ctxA(), (tx) =>
    tx.select().from(schema.projects).where(eq(schema.projects.id, projectId)),
  );
  if (!project) throw new Error("expected the project");
  return project.ruleSetEditionId;
}

describe("opening a campaign (identity.md §8, §9)", () => {
  it("cites the project, the set revision it pinned, and both snapshots in force", async () => {
    const campaign = await openCampaign(ctxA(), { projectId: projectA, actorUserId: userA, members: membersA });
    const digest = drawingSetRevisionDigest(membersA);
    expect(campaign).toMatchObject({ projectId: projectA, setDigest: digest, state: "LIVE" });
    const [project] = await forTenant(ctxA(), (tx) =>
      tx.select().from(schema.projects).where(eq(schema.projects.id, projectA)),
    );
    // The snapshots: what the project pinned at creation, and the catalogue as deployed.
    expect(campaign.ruleSetEditionId).toBe(project?.ruleSetEditionId);
    expect(campaign.catalogueDigest).toBe(CATALOGUE_DIGEST);
    // Pinning the set is pinning the scope: the manifest is the citation list.
    const manifest = await forTenant(ctxA(), (tx) =>
      tx
        .select()
        .from(schema.drawingSetRevisionMembers)
        .where(eq(schema.drawingSetRevisionMembers.setDigest, digest)),
    );
    expect(manifest.map((m) => m.drawingRevisionId)).toEqual(membersA.map((m) => m.drawingRevisionId));
  });

  it("writes the pin act with the campaign row — actor, timestamp, and what it pinned", async () => {
    const [campaign] = await campaignsOf(tenantA);
    if (!campaign) throw new Error("expected the campaign opened above");
    const acts = await forTenant(ctxA(), (tx) =>
      tx.select().from(schema.acts).where(eq(schema.acts.type, "PIN_DRAWING_SET")),
    );
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({
      projectId: projectA,
      actorUserId: userA,
      subjectKind: "campaigns",
      subjectIds: [campaign.id],
      detail: {
        setDigest: campaign.setDigest,
        ruleSetEditionId: campaign.ruleSetEditionId,
        catalogueDigest: campaign.catalogueDigest,
      },
    });
    expect(acts[0]?.performedAt).toBeInstanceOf(Date);
  });

  it("leaves neither row when the transaction fails after the act insert", async () => {
    const before = (await campaignsOf(tenantA)).length;
    const actsBefore = await forTenant(ctxA(), (tx) => tx.select().from(schema.acts));
    const refused = await refusal(() =>
      forTenant(ctxA(), async (tx) => {
        await pinCampaign(tx, { tenantId: tenantA, projectId: otherProjectA, actorUserId: userA, members: membersOther });
        throw new Error("the surface failed after the act");
      }),
    );
    expect(refused).toMatch(/the surface failed after the act/);
    expect(await campaignsOf(tenantA)).toHaveLength(before);
    expect(await forTenant(ctxA(), (tx) => tx.select().from(schema.acts))).toHaveLength(actsBefore.length);
  });
});

describe("the pin, the snapshot and the one current campaign", () => {
  it("refuses a campaign with no set revision — the column is NOT NULL, not a nullable pin", async () => {
    const [project] = await forTenant(ctxA(), (tx) =>
      tx.select().from(schema.projects).where(eq(schema.projects.id, projectA)),
    );
    const refused = await refusal(() =>
      forTenant(ctxA(), (tx) =>
        tx.execute(
          sql`insert into campaigns (tenant_id, project_id, rule_set_edition_id, catalogue_digest)
              values (${tenantA}::uuid, ${projectA}::uuid, ${project?.ruleSetEditionId}::uuid, ${CATALOGUE_DIGEST})`,
        ),
      ),
    );
    expect(refused).toMatch(/not-null|null value/i);
  });

  it("refuses a set revision belonging to another project — the composite FK, not convention", async () => {
    // The pin the *other* project would cite, offered to a project it is not the scope of.
    const foreignDigest = drawingSetRevisionDigest(membersA);
    const editionId = await ruleSetEditionOf(otherProjectA);
    const refused = await refusal(() =>
      forTenant(ctxA(), (tx) =>
        tx.insert(schema.campaigns).values({
          tenantId: tenantA,
          projectId: otherProjectA,
          setDigest: foreignDigest,
          ruleSetEditionId: editionId,
          catalogueDigest: CATALOGUE_DIGEST,
        }),
      ),
    );
    expect(refused).toMatch(/campaigns_set_revision_project_fk/);
  });

  it("refuses another tenant's rule-set edition and another tenant's project", async () => {
    const [foreignEdition] = await forTenant(mintTenantCtx(tenantB), (tx) => tx.select().from(schema.ruleSetEditions));
    if (!foreignEdition) throw new Error("expected B's edition");
    const digest = drawingSetRevisionDigest(membersOther);
    await forTenant(ctxA(), (tx) =>
      tx
        .insert(schema.drawingSetRevisions)
        .values({ digest, tenantId: tenantA, projectId: otherProjectA })
        .onConflictDoNothing(),
    );
    expect(
      await refusal(() =>
        forTenant(ctxA(), (tx) =>
          tx.insert(schema.campaigns).values({
            tenantId: tenantA,
            projectId: otherProjectA,
            setDigest: digest,
            ruleSetEditionId: foreignEdition.id,
            catalogueDigest: CATALOGUE_DIGEST,
          }),
        ),
      ),
    ).toMatch(/campaigns_rule_set_edition_tenant_fk/);
    // Another tenant's project is not visible through the seam at all, so it refuses by name.
    expect(
      await refusal(() =>
        openCampaign(ctxA(), { projectId: projectB, actorUserId: userA, members: membersB }),
      ),
    ).toMatch(/CAMPAIGN_PROJECT_MISSING/);
  });

  it("refuses every update of a snapshot column — the grant, not the application", async () => {
    const [campaign] = await campaignsOf(tenantA);
    if (!campaign) throw new Error("expected a campaign");
    const [foreignEdition] = await forTenant(ctxA(), (tx) =>
      tx.select().from(schema.ruleSetEditions).where(eq(schema.ruleSetEditions.scope, "TEMPLATE")),
    );
    if (!foreignEdition) throw new Error("expected the template edition");
    expect(
      await refusal(() =>
        forTenant(ctxA(), (tx) =>
          tx
            .update(schema.campaigns)
            .set({ ruleSetEditionId: foreignEdition.id })
            .where(eq(schema.campaigns.id, campaign.id)),
        ),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await refusal(() =>
        forTenant(ctxA(), (tx) =>
          tx
            .update(schema.campaigns)
            .set({ setDigest: "f".repeat(64) })
            .where(eq(schema.campaigns.id, campaign.id)),
        ),
      ),
    ).toMatch(/permission denied/i);
    // The catalogue snapshot needed no grant of its own: a column-level UPDATE grant does not
    // extend to a column added after it (0009), so the second pin is insert-only the same way.
    expect(
      await refusal(() =>
        forTenant(ctxA(), (tx) =>
          tx
            .update(schema.campaigns)
            .set({ catalogueDigest: "a".repeat(64) })
            .where(eq(schema.campaigns.id, campaign.id)),
        ),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await refusal(() =>
        forTenant(ctxA(), (tx) => tx.delete(schema.campaigns).where(eq(schema.campaigns.id, campaign.id))),
      ),
    ).toMatch(/permission denied/i);
  });

  it("refuses a second current campaign on one project, and lets a superseded one out of the way", async () => {
    const second = await refusal(() =>
      openCampaign(ctxA(), { projectId: projectA, actorUserId: userA, members: membersA }),
    );
    expect(second).toMatch(/campaigns_project_current_uq/);
    const [live] = await campaignsOf(tenantA);
    if (!live) throw new Error("expected the live campaign");
    // Superseding is a state move (the re-pin act authors it); the grant permits this column only.
    await forTenant(ctxA(), (tx) =>
      tx.update(schema.campaigns).set({ state: "SUPERSEDED" }).where(eq(schema.campaigns.id, live.id)),
    );
    const reopened = await openCampaign(ctxA(), { projectId: projectA, actorUserId: userA, members: membersA });
    expect(reopened.state).toBe("LIVE");
    // A superseded campaign stays readable — a superseded pin is history, not a deletion.
    const all = await campaignsOf(tenantA);
    expect(all.filter((c) => c.projectId === projectA).map((c) => c.state).sort()).toEqual(["LIVE", "SUPERSEDED"]);
  });

  it("refuses a superseded campaign returned to LIVE — a superseded pin is history", async () => {
    const superseded = (await campaignsOf(tenantA)).find((c) => c.state === "SUPERSEDED");
    if (!superseded) throw new Error("expected the superseded campaign");
    expect(
      await refusal(() =>
        forTenant(ctxA(), (tx) =>
          tx.update(schema.campaigns).set({ state: "LIVE" }).where(eq(schema.campaigns.id, superseded.id)),
        ),
      ),
    ).toMatch(/CAMPAIGN_STATE_NOT_REVERSIBLE/);
  });

  it("refuses a state outside the closed enum", async () => {
    // The live one: on a superseded row the one-way trigger fires first, and this case is the CHECK.
    const campaign = (await campaignsOf(tenantA)).find((c) => c.state === "LIVE");
    if (!campaign) throw new Error("expected the live campaign");
    expect(
      await refusal(() =>
        forTenant(ctxA(), (tx) =>
          tx
            .update(schema.campaigns)
            .set({ state: "ARCHIVED" as "LIVE" })
            .where(eq(schema.campaigns.id, campaign.id)),
        ),
      ),
    ).toMatch(/campaigns_state_check/);
  });

  it("shows a tenant no campaign but its own", async () => {
    await openCampaign(mintTenantCtx(tenantB), { projectId: projectB, actorUserId: userB, members: membersB });
    const seenByB = await campaignsOf(tenantB);
    expect(seenByB.every((c) => c.tenantId === tenantB)).toBe(true);
    const mine = await campaignsOf(tenantA);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((c) => c.tenantId === tenantA)).toBe(true);
    const [aCampaign] = mine;
    if (!aCampaign) throw new Error("expected A's campaign");
    const crossRead = await forTenant(mintTenantCtx(tenantB), (tx) =>
      tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, aCampaign.id)),
    );
    expect(crossRead).toHaveLength(0);
  });
});
