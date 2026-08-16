import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { getAuth } from "@/server/auth";
import { createCaller } from "@/server/router";
import { createContext } from "@/server/trpc";

/**
 * The first request path (issue #66; ADR-0003, ADR-0004), live: a request without a session gets
 * no TenantCtx and runs no query; a sign-up mints the user's personal tenant; the session's active
 * tenant becomes the TenantCtx; `projects.list` sees exactly that tenant's rows through RLS; and
 * the auth role is a constrained role — it can touch its seven tables and no register table.
 */
const stamp = crypto.randomUUID();
const email = `qs-${stamp}@dbspec.local`;
let userId: string | undefined;
let tenantId: string | undefined;
let otherTenantId: string | undefined;

afterAll(async () => {
  await runAsSystem("request-path dbspec teardown", async (tx) => {
    for (const id of [tenantId, otherTenantId]) {
      if (!id) continue;
      await tx.delete(schema.projects).where(eq(schema.projects.tenantId, id));
      await tx.delete(schema.memberships).where(eq(schema.memberships.tenantId, id));
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, id));
    }
    if (userId) await tx.delete(schema.users).where(eq(schema.users.id, userId)); // sessions/accounts cascade
  });
});

function messagesOf(err: unknown): string {
  const messages: string[] = [];
  for (let e = err; e instanceof Error; e = e.cause) messages.push(e.message);
  return messages.join(" | ");
}

describe("the request path", () => {
  it("a request without a session gets no TenantCtx and no query", async () => {
    const ctx = await createContext(new Headers());
    expect(ctx).toEqual({ userId: null, tenant: null });
    let refused: unknown;
    try {
      await createCaller(ctx).projects.list();
    } catch (err) {
      refused = err;
    }
    expect(refused).toMatchObject({ code: "UNAUTHORIZED", message: "NO_TENANT_CONTEXT" });
  });

  it("sign-up creates the user's personal tenant, the session names it, and the caller lists only its projects", async () => {
    const { headers: setCookies } = await getAuth().api.signUpEmail({
      body: { name: "QS One", email, password: "correct horse battery staple" },
      returnHeaders: true,
    });
    // The user, the personal tenant, the membership — better-auth's own tables, our rows.
    const [user] = await runAsSystem("read user", (tx) => tx.select().from(schema.users).where(eq(schema.users.email, email)));
    if (!user) throw new Error("expected the user");
    userId = user.id;
    const memberships = await runAsSystem("read memberships", (tx) =>
      tx.select().from(schema.memberships).where(eq(schema.memberships.userId, user.id)),
    );
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("owner");
    tenantId = memberships[0]?.tenantId;
    if (!tenantId) throw new Error("expected a personal tenant");
    const [tenant] = await runAsSystem("read tenant", (tx) => tx.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId!)));
    expect(tenant?.slug).toBe(`personal-${user.id}`);

    // The session cookie the sign-up set is what a browser would send back.
    const cookie = setCookies
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    expect(cookie).toMatch(/session_token=/);
    const ctx = await createContext(new Headers({ cookie }));
    expect(ctx.userId).toBe(user.id);
    expect(ctx.tenant?.tenantId).toBe(tenantId);

    // Two projects in two tenants; the caller sees exactly the session's tenant's.
    const [other] = await runAsSystem("another tenant", async (tx) => {
      const [t] = await tx.insert(schema.tenants).values({ name: "other", slug: `other-${stamp}` }).returning();
      if (!t) throw new Error("setup failed");
      await tx.insert(schema.projects).values({ tenantId: t.id, name: "not yours" });
      return [t];
    });
    otherTenantId = other?.id;
    await forTenant(mintTenantCtx(tenantId), (tx) => tx.insert(schema.projects).values({ tenantId: tenantId!, name: "Bashundhara Tower A" }));
    const listed = await createCaller(ctx).projects.list({ limit: 10 });
    expect(listed.map((p) => p.name)).toEqual(["Bashundhara Tower A"]);
    // A later sign-in mints the same tenant from the session hook, not from the sign-up path.
    const { headers: signInCookies } = await getAuth().api.signInEmail({
      body: { email, password: "correct horse battery staple" },
      returnHeaders: true,
    });
    const again = await createContext(
      new Headers({ cookie: signInCookies.getSetCookie().map((c) => c.split(";")[0]).join("; ") }),
    );
    expect(again.tenant?.tenantId).toBe(tenantId);
    // Zod on the input.
    let refused: unknown;
    try {
      await createCaller(ctx).projects.list({ limit: 0 });
    } catch (err) {
      refused = err;
    }
    expect(refused).toMatchObject({ code: "BAD_REQUEST" });
  });

  it("the auth role is constrained: its own tables, never the register", async () => {
    const url = process.env.AUTH_DATABASE_URL;
    if (!url) throw new Error("AUTH_DATABASE_URL is not set (see .env.example)");
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    try {
      const own = await sql`select count(*)::int as n from users`;
      expect(own[0]?.n).toBeGreaterThan(0);
      for (const table of ["projects", "register_objects", "acts", "model_calls", "ingests"]) {
        let refused: unknown;
        try {
          await sql.unsafe(`select 1 from ${table} limit 1`);
        } catch (err) {
          refused = err;
        }
        expect(messagesOf(refused), table).toMatch(/permission denied/i);
      }
      const roles = await sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
      expect(roles[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    } finally {
      await sql.end();
    }
  });
});
