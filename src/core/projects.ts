import { desc } from "drizzle-orm";
import { forTenant, schema, type TenantCtx } from "./db";
import { forkProjectRuleSetEdition } from "./rule-set-editions";

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

/**
 * Creating a project (identity.md §8, amended 2026-08-16): the project row and the rule-set
 * edition it forks from the tenant's template land in **one transaction, or neither** — so a
 * project never exists without naming the rules that will measure it, and campaign creation
 * carries no config refusal and spends no reason code.
 */
export async function createProject(ctx: TenantCtx, input: { readonly name: string }) {
  return forTenant(ctx, async (tx) => {
    const edition = await forkProjectRuleSetEdition(tx, ctx.tenantId);
    const [project] = await tx
      .insert(schema.projects)
      .values({ tenantId: ctx.tenantId, name: input.name, ruleSetEditionId: edition.id })
      .returning({
        id: schema.projects.id,
        name: schema.projects.name,
        ruleSetEditionId: schema.projects.ruleSetEditionId,
        createdAt: schema.projects.createdAt,
      });
    if (!project) throw new Error("PROJECT_NOT_WRITTEN");
    return project;
  });
}
