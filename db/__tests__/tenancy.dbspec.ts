import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { createProject } from "@/core/projects";
import { mintTenantRuleSetTemplate } from "@/core/rule-set-editions";

/**
 * The seam test (ADR-0004): tenant isolation against a live Postgres — the GUC-scoped read,
 * the RLS refusal of a cross-tenant write, and the ledger's append-only grant. Runs via
 * `pnpm test:db` (never in verify). Requires Postgres on 5544 and `pnpm db:migrate`.
 */

let tenantA: string;
let tenantB: string;
let editionB: string;

beforeAll(async () => {
  await runAsSystem("tenancy dbspec setup", async (tx) => {
    const [a] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec Tenant A", slug: `dbspec-a-${crypto.randomUUID()}` })
      .returning();
    const [b] = await tx
      .insert(schema.tenants)
      .values({ name: "dbspec Tenant B", slug: `dbspec-b-${crypto.randomUUID()}` })
      .returning();
    if (!a || !b) throw new Error("setup failed");
    tenantA = a.id;
    tenantB = b.id;
    const [ua] = await tx.insert(schema.users).values({ email: `a-${a.id}@dbspec.local`, name: "A" }).returning();
    const [ub] = await tx.insert(schema.users).values({ email: `b-${b.id}@dbspec.local`, name: "B" }).returning();
    if (!ua || !ub) throw new Error("setup failed");
    await tx.insert(schema.memberships).values([
      { tenantId: a.id, userId: ua.id, role: "owner" },
      { tenantId: b.id, userId: ub.id, role: "owner" },
    ]);
  });
  // A tenant's template edition and a project's fork are minted through the seam, as the app
  // does it (identity.md §8): a project without an edition is unrepresentable.
  for (const [id, name] of [
    [tenantA, "A's project"],
    [tenantB, "B's project"],
  ] as const) {
    await mintTenantRuleSetTemplate(mintTenantCtx(id));
    const project = await createProject(mintTenantCtx(id), { name });
    if (id === tenantB) editionB = project.ruleSetEditionId;
  }
});

afterAll(async () => {
  await runAsSystem("tenancy dbspec teardown", async (tx) => {
    for (const id of [tenantA, tenantB]) {
      await tx.delete(schema.modelCalls).where(eq(schema.modelCalls.tenantId, id));
      await tx.delete(schema.projects).where(eq(schema.projects.tenantId, id));
      await tx.delete(schema.ruleSetEditionParameters).where(eq(schema.ruleSetEditionParameters.tenantId, id));
      await tx.delete(schema.ruleSetEditionMethods).where(eq(schema.ruleSetEditionMethods.tenantId, id));
      await tx.delete(schema.ruleSetEditions).where(eq(schema.ruleSetEditions.tenantId, id));
      await tx.delete(schema.memberships).where(eq(schema.memberships.tenantId, id));
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, id));
    }
    await tx.execute(`delete from users where email like '%@dbspec.local'` as never);
  });
});

function messagesOf(err: unknown): string {
  const messages: string[] = [];
  for (let e = err; e instanceof Error; e = e.cause) messages.push(e.message);
  return messages.join(" | ");
}

describe("the tenant seam", () => {
  it("scopes reads to the tenant in context", async () => {
    const rows = await forTenant(mintTenantCtx(tenantA), (tx) => tx.select().from(schema.projects));
    expect(rows.length).toBe(1);
    expect(rows[0]?.tenantId).toBe(tenantA);
  });

  it("RLS refuses a cross-tenant write even inside the seam", async () => {
    let refused: unknown;
    try {
      await forTenant(mintTenantCtx(tenantA), (tx) =>
        tx.insert(schema.projects).values({ tenantId: tenantB, name: "intruder", ruleSetEditionId: editionB }),
      );
    } catch (err) {
      refused = err;
    }
    expect(messagesOf(refused)).toMatch(/row-level security/i);
  });

  it("a composite FK refuses a child that cites another tenant's parent", async () => {
    const [bProject] = await runAsSystem("read B's project", (tx) =>
      tx.select().from(schema.projects).where(eq(schema.projects.tenantId, tenantB)),
    );
    if (!bProject) throw new Error("expected seeded project");
    let refused: unknown;
    try {
      await forTenant(mintTenantCtx(tenantA), (tx) =>
        tx.insert(schema.modelCalls).values({
          id: crypto.randomUUID(),
          tenantId: tenantA,
          projectId: bProject.id,
          model: "claude-sonnet-5",
          purpose: "dbspec",
          requestHash: "0".repeat(64),
          transport: "fixture",
          outcome: "PROPOSED",
        }),
      );
    } catch (err) {
      refused = err;
    }
    expect(messagesOf(refused)).toMatch(/foreign key/i);
  });

  it("the model call ledger is append-only for the app role", async () => {
    const id = crypto.randomUUID();
    await forTenant(mintTenantCtx(tenantA), (tx) =>
      tx.insert(schema.modelCalls).values({
        id,
        tenantId: tenantA,
        model: "claude-sonnet-5",
        purpose: "dbspec",
        requestHash: "0".repeat(64),
        transport: "fixture",
        outcome: "PROPOSED",
      }),
    );
    let refused: unknown;
    try {
      await forTenant(mintTenantCtx(tenantA), (tx) =>
        tx.update(schema.modelCalls).set({ outcome: "MALFORMED" }).where(eq(schema.modelCalls.id, id)),
      );
    } catch (err) {
      refused = err;
    }
    expect(messagesOf(refused)).toMatch(/permission denied/i);
  });

  it("sees nothing without a matching tenant", async () => {
    const rows = await forTenant(mintTenantCtx("00000000-0000-0000-0000-000000000000"), (tx) =>
      tx.select().from(schema.projects),
    );
    expect(rows).toHaveLength(0);
  });
});
