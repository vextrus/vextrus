import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  forTenant,
  mintTenantCtx,
  runAsSystem,
  schema,
} from "@/core/db";

/**
 * The seam test (ADR-0004): proves tenant isolation with a live Postgres —
 * both the GUC-scoped read and the RLS refusal of a cross-tenant write.
 * Runs via `pnpm test:db` (never in verify). Requires compose up + migrate.
 */

let tenantA: string;
let tenantB: string;

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
    const [ua] = await tx
      .insert(schema.users)
      .values({ email: `a-${a.id}@dbspec.local`, name: "A" })
      .returning();
    const [ub] = await tx
      .insert(schema.users)
      .values({ email: `b-${b.id}@dbspec.local`, name: "B" })
      .returning();
    if (!ua || !ub) throw new Error("setup failed");
    await tx.insert(schema.memberships).values([
      { tenantId: a.id, userId: ua.id, role: "owner" },
      { tenantId: b.id, userId: ub.id, role: "owner" },
    ]);
  });
});

afterAll(async () => {
  await runAsSystem("tenancy dbspec teardown", async (tx) => {
    for (const id of [tenantA, tenantB]) {
      await tx
        .delete(schema.memberships)
        .where(eq(schema.memberships.tenantId, id));
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, id));
    }
    await tx.execute(
      `delete from users where email like '%@dbspec.local'` as never,
    );
  });
});

describe("the tenant seam", () => {
  it("scopes reads to the tenant in context", async () => {
    const rows = await forTenant(mintTenantCtx(tenantA), (tx) =>
      tx.select().from(schema.memberships),
    );
    expect(rows.length).toBe(1);
    expect(rows.every((r) => r.tenantId === tenantA)).toBe(true);
  });

  it("RLS refuses a cross-tenant write even inside the seam", async () => {
    let refused: unknown;
    try {
      await forTenant(mintTenantCtx(tenantA), async (tx) => {
        const [user] = await tx
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, `b-${tenantB}@dbspec.local`));
        if (!user) throw new Error("expected seeded user");
        // tenant A's context writing a tenant B row: WITH CHECK must refuse
        await tx.insert(schema.memberships).values({
          tenantId: tenantB,
          userId: user.id,
          role: "intruder",
        });
      });
    } catch (err) {
      refused = err;
    }
    expect(refused).toBeDefined();
    // drizzle wraps the driver error; the RLS message rides on the cause chain
    const messages: string[] = [];
    for (let e = refused; e instanceof Error; e = e.cause) {
      messages.push(e.message);
    }
    expect(messages.join(" | ")).toMatch(/row-level security/i);
  });

  it("sees nothing without a matching tenant", async () => {
    const rows = await forTenant(
      mintTenantCtx("00000000-0000-0000-0000-000000000000"),
      (tx) => tx.select().from(schema.memberships),
    );
    expect(rows).toHaveLength(0);
  });
});
