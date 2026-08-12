import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@/core/auth";
import { mintTenantCtx } from "@/core/db";

/**
 * tRPC root. Procedures stay thin: they authenticate, mint the tenant context,
 * and call module functions (ADR-0003). Domain logic never lives here.
 */

export type Context = {
  headers: Headers;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * The auth middleware — with tests, the only legal `mintTenantCtx` call site.
 * Session → active tenant → TenantCtx; every refusal names its reason.
 */
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: ctx.headers });
  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "no session" });
  }
  let tenantId = session.session.activeOrganizationId;
  if (!tenantId) {
    // A signup session predates its personal tenant: better-auth defers
    // user.create.after past session creation, so the session-create hook
    // (src/core/auth.ts) found no membership yet. Heal once through the org
    // plugin; thereafter the session row carries the active tenant.
    const orgs = await auth.api.listOrganizations({ headers: ctx.headers });
    const first = orgs[0];
    if (!first) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "user has no tenant membership",
      });
    }
    await auth.api.setActiveOrganization({
      headers: ctx.headers,
      body: { organizationId: first.id },
    });
    tenantId = first.id;
  }
  return next({
    ctx: { ...ctx, user: session.user, tenant: mintTenantCtx(tenantId) },
  });
});
