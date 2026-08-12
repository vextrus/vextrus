import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { forTenant, schema } from "@/core/db";
import { disciplines } from "@/core/enums";
import {
  createDrawing,
  createProject,
  listDrawings,
  listProjects,
} from "@/core/register";
import { MAX_SOURCE_BYTES, drawingStatus, uploadRevision } from "@/modules/takeoff";
import {
  authedProcedure,
  createCallerFactory,
  publicProcedure,
  router,
} from "./trpc";

/** Derived from the module's own limit, so there is one threshold, not two. */
function base64LengthFor(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

const SOURCE_FILENAME = /\.dxf$/i;

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

  projects: router({
    create: authedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(({ ctx, input }) => createProject(ctx.tenant, input)),

    list: authedProcedure.query(({ ctx }) => listProjects(ctx.tenant)),
  }),

  drawings: router({
    create: authedProcedure
      .input(
        z.object({
          projectId: z.uuid(),
          title: z.string().min(1),
          disciplineProposed: z.enum(disciplines).optional(),
        }),
      )
      .mutation(({ ctx, input }) => createDrawing(ctx.tenant, input)),

    list: authedProcedure
      .input(z.object({ projectId: z.uuid() }))
      .query(({ ctx, input }) => listDrawings(ctx.tenant, input.projectId)),

    /**
     * The upload lands the source and queues the ingest; it never runs the
     * pipeline inline. The response is the queued state, and `status` is where
     * the answer arrives — including a failure.
     */
    uploadRevision: authedProcedure
      .input(
        z.object({
          projectId: z.uuid(),
          drawingId: z.uuid(),
          filename: z.string().regex(SOURCE_FILENAME, "a .dxf drawing"),
          // base64 in the request body while sources are fixtures-sized; a
          // real upload path is a future named need, bounded here meanwhile
          contentBase64: z.string().max(base64LengthFor(MAX_SOURCE_BYTES)),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { revision, ingest } = await uploadRevision(ctx.tenant, {
          projectId: input.projectId,
          drawingId: input.drawingId,
          filename: input.filename,
          bytes: Buffer.from(input.contentBase64, "base64"),
        });
        return {
          revisionId: revision.id,
          seq: revision.seq,
          ingestId: ingest.id,
          status: ingest.status,
        };
      }),

    /** Every revision with its ingest: status, counters, truncations, error. */
    status: authedProcedure
      .input(z.object({ drawingId: z.uuid() }))
      .query(({ ctx, input }) => drawingStatus(ctx.tenant, input.drawingId)),
  }),
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
