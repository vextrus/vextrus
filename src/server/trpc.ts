import { initTRPC } from "@trpc/server";

/**
 * tRPC root. Procedures stay thin: they authenticate, mint the tenant context,
 * and call module functions (ADR-0003). Domain logic never lives here.
 */
const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
