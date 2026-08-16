import { desc } from "drizzle-orm";
import { forTenant, schema, type TenantCtx } from "./db";

/** The project list, through the seam (ADR-0004): the tenant's own rows, newest first. */
export async function listProjects(ctx: TenantCtx, input: { readonly limit: number }) {
  return forTenant(ctx, (tx) =>
    tx
      .select({ id: schema.projects.id, name: schema.projects.name, createdAt: schema.projects.createdAt })
      .from(schema.projects)
      .orderBy(desc(schema.projects.createdAt))
      .limit(input.limit),
  );
}
