import { z } from "zod";
import { listProjects } from "@/core/projects";
import { createCallerFactory, router, tenantProcedure } from "./trpc";

/** The app router (ADR-0003): per-area routers composed once; Zod on every input. */
export const appRouter = router({
  projects: router({
    list: tenantProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).default({ limit: 50 }))
      .query(({ ctx, input }) => listProjects(ctx.tenant, input)),
  }),
});
export type AppRouter = typeof appRouter;

/** Server-side caller: a server component hands it the context it built from the request's headers. */
export const createCaller = createCallerFactory(appRouter);
