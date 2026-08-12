import { TRPCError } from "@trpc/server";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/core/auth";
import { runAsSystem, schema } from "@/core/db";
import { createCaller } from "@/server/router";

/**
 * Ticket 01 exit criteria against a live Postgres (`pnpm test:db`):
 * signup → tenant + membership; session → TenantCtx → scoped read;
 * no session → UNAUTHORIZED. Requires compose up + migrate.
 */

const email = `signup-${crypto.randomUUID()}@auth-dbspec.local`;
const password = "auth-dbspec-password";
let sessionCookie: string;
let tenantId: string;

afterAll(async () => {
  await runAsSystem("auth dbspec teardown", async (tx) => {
    const created = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(like(schema.users.email, "%@auth-dbspec.local"));
    const userIds = created.map((u) => u.id);
    if (userIds.length === 0) return;
    const owned = await tx
      .select({ tenantId: schema.memberships.tenantId })
      .from(schema.memberships)
      .where(inArray(schema.memberships.userId, userIds));
    await tx
      .delete(schema.memberships)
      .where(inArray(schema.memberships.userId, userIds));
    // sessions/accounts cascade with their user
    await tx.delete(schema.users).where(inArray(schema.users.id, userIds));
    const tenantIds = owned.map((m) => m.tenantId);
    if (tenantIds.length > 0) {
      await tx
        .delete(schema.tenants)
        .where(inArray(schema.tenants.id, tenantIds));
    }
  });
});

describe("auth and the tenant context", () => {
  it("signup creates a single-member tenant", async () => {
    const res = await auth.api.signUpEmail({
      body: { email, password, name: "Dbspec Signup" },
      asResponse: true,
    });
    expect(res.status).toBe(200);
    sessionCookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    expect(sessionCookie).toContain("session_token");

    await runAsSystem("auth dbspec assertions", async (tx) => {
      const [user] = await tx
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email));
      expect(user).toBeDefined();
      if (!user) throw new Error("unreachable");
      const members = await tx
        .select()
        .from(schema.memberships)
        .where(eq(schema.memberships.userId, user.id));
      expect(members).toHaveLength(1);
      expect(members[0]?.role).toBe("owner");
      tenantId = members[0]?.tenantId ?? "";
      const [tenant] = await tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId));
      expect(tenant?.name).toBe("Dbspec Signup");
    });
  });

  it("session → TenantCtx → tenant-scoped read through forTenant", async () => {
    const caller = createCaller({
      headers: new Headers({ cookie: sessionCookie }),
    });
    const me = await caller.me();
    expect(me.user.email).toBe(email);
    expect(me.tenant.id).toBe(tenantId);
    expect(me.role).toBe("owner");
  });

  it("log in → session opens on the user's tenant (session-create hook)", async () => {
    const res = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    expect(res.status).toBe(200);
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const caller = createCaller({ headers: new Headers({ cookie }) });
    const me = await caller.me();
    expect(me.user.email).toBe(email);
    expect(me.tenant.id).toBe(tenantId);
  });

  it("no session → UNAUTHORIZED with a named reason", async () => {
    const caller = createCaller({ headers: new Headers() });
    const refusal = await caller.me().catch((err: unknown) => err);
    expect(refusal).toBeInstanceOf(TRPCError);
    expect((refusal as TRPCError).code).toBe("UNAUTHORIZED");
    expect((refusal as TRPCError).message).toBe("no session");
  });
});
