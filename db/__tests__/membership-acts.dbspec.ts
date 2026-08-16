import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { createProject } from "@/core/projects";
import { getAuth, MEMBER_HAS_ACTS } from "@/server/auth";

/**
 * identity.md §7 meets the auth surface (issue #77): a membership whose user has acts in the
 * tenant cannot be deleted — `acts_actor_membership_fk` — and both routes that delete one
 * (`remove-member`, `leave`) refuse by name before the DELETE, not with a driver error after it.
 * Once the acts are gone the same removal succeeds. Runs via `pnpm test:db`.
 */
const stamp = crypto.randomUUID();
const ownerEmail = `owner-${stamp}@dbspec.local`;
const memberEmail = `member-${stamp}@dbspec.local`;
let ownerCookie = "";
let memberCookie = "";
let ownerId: string | undefined;
let memberId: string | undefined;
let tenantId: string | undefined;
let memberPersonalTenantId: string | undefined;

function cookieOf(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function refusalOf(fn: () => Promise<unknown>): Promise<{ status: string | undefined; code: string | undefined; message: string | undefined } | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    const e = err as { status?: string; body?: { code?: string; message?: string }; message?: string };
    return { status: e.status, code: e.body?.code, message: e.body?.message ?? e.message };
  }
}

beforeAll(async () => {
  const auth = getAuth();
  const owner = await auth.api.signUpEmail({ body: { name: "Owner", email: ownerEmail, password: "correct horse battery staple" }, returnHeaders: true });
  const member = await auth.api.signUpEmail({ body: { name: "Member", email: memberEmail, password: "correct horse battery staple" }, returnHeaders: true });
  ownerCookie = cookieOf(owner.headers);
  memberCookie = cookieOf(member.headers);
  await runAsSystem("membership-acts dbspec setup", async (tx) => {
    const [o] = await tx.select().from(schema.users).where(eq(schema.users.email, ownerEmail));
    const [m] = await tx.select().from(schema.users).where(eq(schema.users.email, memberEmail));
    if (!o || !m) throw new Error("setup failed: users");
    ownerId = o.id;
    memberId = m.id;
    const [ownerMembership] = await tx.select().from(schema.memberships).where(eq(schema.memberships.userId, o.id));
    const [memberMembership] = await tx.select().from(schema.memberships).where(eq(schema.memberships.userId, m.id));
    if (!ownerMembership || !memberMembership) throw new Error("setup failed: personal tenants");
    tenantId = ownerMembership.tenantId;
    memberPersonalTenantId = memberMembership.tenantId;
    // The member joins the owner's tenant; a project exists for the act to be scoped to.
    await tx.insert(schema.memberships).values({ tenantId, userId: m.id, role: "member" });
  });
  const tenant = tenantId;
  const actor = memberId;
  if (!tenant || !actor) throw new Error("setup failed: tenant");
  // Sign-up minted the tenant's template edition; the project forks it (identity.md §8).
  const project = (await createProject(mintTenantCtx(tenant), { name: "acts guard" })).id;
  await runAsSystem("membership-acts dbspec act", async (tx) => {
    // One act by the member: from now on, their membership is cited by the log.
    await tx.insert(schema.acts).values({
      tenantId: tenant,
      projectId: project,
      actorUserId: actor,
      type: "CONFIRM_DISCIPLINE",
      subjectKind: "drawing",
      subjectIds: [crypto.randomUUID()],
    });
  });
});

afterAll(async () => {
  await runAsSystem("membership-acts dbspec teardown", async (tx) => {
    for (const id of [tenantId, memberPersonalTenantId]) {
      if (!id) continue;
      await tx.delete(schema.acts).where(eq(schema.acts.tenantId, id));
      await tx.delete(schema.projects).where(eq(schema.projects.tenantId, id));
      await tx.delete(schema.ruleSetEditionParameters).where(eq(schema.ruleSetEditionParameters.tenantId, id));
      await tx.delete(schema.ruleSetEditionMethods).where(eq(schema.ruleSetEditionMethods.tenantId, id));
      await tx.delete(schema.ruleSetEditions).where(eq(schema.ruleSetEditions.tenantId, id));
      await tx.delete(schema.memberships).where(eq(schema.memberships.tenantId, id));
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, id));
    }
    for (const id of [ownerId, memberId]) if (id) await tx.delete(schema.users).where(eq(schema.users.id, id));
  });
});

describe("a membership with acts", () => {
  it("cannot be removed by the owner — refused by name before the DELETE, not by the FK after it", async () => {
    if (!tenantId) throw new Error("setup failed");
    const refused = await refusalOf(() =>
      getAuth().api.removeMember({ body: { memberIdOrEmail: memberEmail, organizationId: tenantId! }, headers: new Headers({ cookie: ownerCookie }) }),
    );
    expect(refused).toMatchObject({ status: "CONFLICT", code: MEMBER_HAS_ACTS });
    expect(refused?.message).not.toMatch(/foreign key|violates/i);
    const still = await runAsSystem("read membership", (tx) =>
      tx.select().from(schema.memberships).where(and(eq(schema.memberships.tenantId, tenantId!), eq(schema.memberships.userId, memberId!))),
    );
    expect(still).toHaveLength(1);
  });

  it("cannot be left by the member — the same named refusal on /organization/leave", async () => {
    if (!tenantId) throw new Error("setup failed");
    const refused = await refusalOf(() =>
      getAuth().api.leaveOrganization({ body: { organizationId: tenantId! }, headers: new Headers({ cookie: memberCookie }) }),
    );
    expect(refused).toMatchObject({ status: "CONFLICT", code: MEMBER_HAS_ACTS });
  });

  it("is removable once its acts are gone — the guard is the act log, nothing else", async () => {
    if (!tenantId || !memberId) throw new Error("setup failed");
    await runAsSystem("retire the member's acts (test only; the log is append-only in production)", (tx) =>
      tx.delete(schema.acts).where(and(eq(schema.acts.tenantId, tenantId!), eq(schema.acts.actorUserId, memberId!))),
    );
    const removed = await getAuth().api.removeMember({
      body: { memberIdOrEmail: memberEmail, organizationId: tenantId },
      headers: new Headers({ cookie: ownerCookie }),
    });
    expect(removed?.member?.userId).toBe(memberId);
    const gone = await runAsSystem("read membership", (tx) =>
      tx.select().from(schema.memberships).where(and(eq(schema.memberships.tenantId, tenantId!), eq(schema.memberships.userId, memberId!))),
    );
    expect(gone).toHaveLength(0);
  });
});
