import { initTRPC, TRPCError } from "@trpc/server";
import { mintTenantCtx, type TenantCtx } from "@/core/db";
import { getAuth } from "./auth";

/**
 * The tRPC root (issue #66; ADR-0003, ADR-0004): the context authenticates the request with
 * better-auth and mints the TenantCtx from the session's active tenant — the only production
 * call site of `mintTenantCtx` besides a job worker. Procedures are thin: they call a core or
 * module function with the ctx. No session, no TenantCtx, no query.
 */
export type Context = {
  readonly userId: string | null;
  readonly tenant: TenantCtx | null;
};

export async function createContext(headers: Headers): Promise<Context> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return { userId: null, tenant: null };
  const activeTenantId = session.session.activeOrganizationId;
  return { userId: session.user.id, tenant: activeTenantId ? mintTenantCtx(activeTenantId) : null };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

/** A procedure that runs only with a TenantCtx in hand; refuses by name otherwise. */
export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "NO_TENANT_CONTEXT" });
  return next({ ctx: { tenant: ctx.tenant, userId: ctx.userId } });
});
