import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { forTenant, schema } from "@/core/db";
import {
  authedProcedure,
  createCallerFactory,
  publicProcedure,
  router,
} from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const })),

  me: authedProcedure.query(async ({ ctx }) => {
    // RLS scopes memberships to the active tenant; the user filter picks this
    // member's row within it.
    const [row] = await forTenant(ctx.tenant, (tx) =>
      tx
        .select({ tenant: schema.tenants, role: schema.memberships.role })
        .from(schema.memberships)
        .innerJoin(
          schema.tenants,
          eq(schema.memberships.tenantId, schema.tenants.id),
        )
        .where(eq(schema.memberships.userId, ctx.user.id)),
    );
    if (!row) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "no membership in the active tenant",
      });
    }
    return {
      user: { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name },
      tenant: {
        id: row.tenant.id,
        name: row.tenant.name,
        slug: row.tenant.slug,
      },
      role: row.role,
    };
  }),
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
