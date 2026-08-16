import { and, eq } from "drizzle-orm";
import { forTenant, schema, type TenantCtx, type Tx } from "./db";
import {
  SEED_RULE_SET,
  SEED_RULE_SET_ID,
  ruleSetEditionKey,
  type RuleSetContent,
  type RuleSetEditionScope,
  type RuleSetParameterKey,
  type RuleSetSeedId,
} from "./rule-set";

/**
 * The fork chain (identity.md §8, amended 2026-08-16): the seed ships as a constant, and the rows
 * are its forks — a tenant's template edition at tenant creation, a project edition at project
 * creation. Everything here goes through the seam (ADR-0004); an edition is immutable by grant,
 * so this module only ever inserts.
 */

/** What a pin points at: the row, and the content address it carries. */
export type RuleSetEditionRef = { readonly id: string; readonly key: string };

/** Where an edition came from — another edition, or the seed the constant names. Never neither. */
type ForkedFrom = { readonly editionId: string } | { readonly seed: RuleSetSeedId };

/**
 * One edition and its content, in the caller's transaction: the row, its parameter values and the
 * methods in force commit together or not at all. The key is computed here, never passed in —
 * a stored key that did not digest the stored content would be a pin pointing at a fiction.
 */
async function insertEdition(
  tx: Tx,
  args: {
    readonly tenantId: string;
    readonly scope: RuleSetEditionScope;
    readonly content: RuleSetContent;
    readonly forkedFrom: ForkedFrom;
  },
): Promise<RuleSetEditionRef> {
  const key = ruleSetEditionKey(args.content);
  const [edition] = await tx
    .insert(schema.ruleSetEditions)
    .values({
      tenantId: args.tenantId,
      key,
      scope: args.scope,
      forkedFromEditionId: "editionId" in args.forkedFrom ? args.forkedFrom.editionId : null,
      forkedFromSeed: "seed" in args.forkedFrom ? args.forkedFrom.seed : null,
    })
    .returning({ id: schema.ruleSetEditions.id });
  if (!edition) throw new Error("RULE_SET_EDITION_NOT_WRITTEN");
  if (args.content.parameters.length > 0) {
    await tx.insert(schema.ruleSetEditionParameters).values(
      args.content.parameters.map((p) => ({
        editionId: edition.id,
        tenantId: args.tenantId,
        key: p.key,
        value: p.value,
      })),
    );
  }
  if (args.content.methods.length > 0) {
    await tx.insert(schema.ruleSetEditionMethods).values(
      args.content.methods.map((m) => ({
        editionId: edition.id,
        tenantId: args.tenantId,
        ruleId: m.ruleId,
        version: m.version,
      })),
    );
  }
  return { id: edition.id, key };
}

/**
 * Creating a tenant mints that tenant's template edition from the seed — the first fork, and the
 * only thing that materialises the seed. One template per tenant: a second is a unique violation,
 * because "the rule set in force" is a stored fact, not a query result (§8).
 */
export async function mintTenantRuleSetTemplate(ctx: TenantCtx): Promise<RuleSetEditionRef> {
  return forTenant(ctx, (tx) =>
    insertEdition(tx, {
      tenantId: ctx.tenantId,
      scope: "TEMPLATE",
      content: SEED_RULE_SET,
      forkedFrom: { seed: SEED_RULE_SET_ID },
    }),
  );
}

/** An edition's content, read back for a fork: the values are what the next edition inherits. */
async function readContent(tx: Tx, tenantId: string, editionId: string): Promise<RuleSetContent> {
  const parameters = await tx
    .select({ key: schema.ruleSetEditionParameters.key, value: schema.ruleSetEditionParameters.value })
    .from(schema.ruleSetEditionParameters)
    .where(
      and(
        eq(schema.ruleSetEditionParameters.tenantId, tenantId),
        eq(schema.ruleSetEditionParameters.editionId, editionId),
      ),
    );
  const methods = await tx
    .select({ ruleId: schema.ruleSetEditionMethods.ruleId, version: schema.ruleSetEditionMethods.version })
    .from(schema.ruleSetEditionMethods)
    .where(
      and(eq(schema.ruleSetEditionMethods.tenantId, tenantId), eq(schema.ruleSetEditionMethods.editionId, editionId)),
    );
  return { parameters: parameters.map((p) => ({ key: p.key as RuleSetParameterKey, value: p.value })), methods };
}

/**
 * Creating a project forks the tenant's template into the project's own edition, in the caller's
 * transaction — the project row and its pin commit together or neither does. A tenant with no
 * template refuses by name rather than inventing one: minting the template is tenant creation's
 * act, and a project that pinned an edition nobody minted would be the nullable fallback §8 bars.
 */
export async function forkProjectRuleSetEdition(tx: Tx, tenantId: string): Promise<RuleSetEditionRef> {
  const [template] = await tx
    .select({ id: schema.ruleSetEditions.id, key: schema.ruleSetEditions.key })
    .from(schema.ruleSetEditions)
    .where(and(eq(schema.ruleSetEditions.tenantId, tenantId), eq(schema.ruleSetEditions.scope, "TEMPLATE")));
  if (!template) throw new Error("RULE_SET_TEMPLATE_MISSING: this tenant has no rule-set template edition");
  const content = await readContent(tx, tenantId, template.id);
  const fork = await insertEdition(tx, {
    tenantId,
    scope: "PROJECT",
    content,
    forkedFrom: { editionId: template.id },
  });
  // A fork copies content, so the key is inherited: a different one means the stored content and
  // the stored key disagree, which is a pin that cannot be trusted — refused, never carried.
  if (fork.key !== template.key) throw new Error("RULE_SET_EDITION_KEY_MISMATCH: the fork does not digest its source");
  return fork;
}
