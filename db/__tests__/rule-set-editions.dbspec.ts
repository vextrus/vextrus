import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { createProject } from "@/core/projects";
import { SEED_RULE_SET, SEED_RULE_SET_ID, ruleSetEditionKey } from "@/core/rule-set";
import { forkProjectRuleSetEdition, mintTenantRuleSetTemplate } from "@/core/rule-set-editions";

/**
 * The rule-set edition through the seam (identity.md §8, amended 2026-08-16; ADR-0004), live
 * against Postgres via `pnpm test:db`: the seed materialises only as a fork, an edition is
 * immutable because the grant says so, a project is unrepresentable without one, and no edition
 * is visible across a tenant boundary.
 */
let tenantA: string;
let tenantB: string;
/** A tenant that never had its template minted — the refusal case. */
let tenantC: string;

async function newTenant(label: string): Promise<string> {
  const [t] = await runAsSystem("rule-set dbspec setup", (tx) =>
    tx
      .insert(schema.tenants)
      .values({ name: `dbspec rules ${label}`, slug: `dbspec-rules-${label}-${crypto.randomUUID()}` })
      .returning(),
  );
  if (!t) throw new Error("setup failed");
  return t.id;
}

const editionsOf = (tenantId: string) =>
  forTenant(mintTenantCtx(tenantId), (tx) => tx.select().from(schema.ruleSetEditions));

function messagesOf(err: unknown): string {
  const messages: string[] = [];
  for (let e = err; e instanceof Error; e = e.cause) messages.push(e.message);
  return messages.join(" | ");
}
async function refusalOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return messagesOf(err);
  }
  throw new Error("expected a refusal, got none");
}

beforeAll(async () => {
  tenantA = await newTenant("a");
  tenantB = await newTenant("b");
  tenantC = await newTenant("c");
  // Tenant creation mints the template (src/server/auth.ts does this on the real path).
  await mintTenantRuleSetTemplate(mintTenantCtx(tenantA));
  await mintTenantRuleSetTemplate(mintTenantCtx(tenantB));
});

afterAll(async () => {
  await runAsSystem("rule-set dbspec teardown", async (tx) => {
    for (const id of [tenantA, tenantB, tenantC]) {
      for (const table of [
        schema.projects,
        schema.ruleSetEditionParameters,
        schema.ruleSetEditionMethods,
        schema.ruleSetEditions,
      ]) {
        await tx.delete(table).where(eq(table.tenantId, id));
      }
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, id));
    }
  });
});

describe("the fork chain (identity.md §8)", () => {
  it("mints one template edition per tenant, from the seed constant — no seed row anywhere", async () => {
    const editions = await editionsOf(tenantA);
    expect(editions).toHaveLength(1);
    expect(editions[0]).toMatchObject({
      scope: "TEMPLATE",
      forkedFromSeed: SEED_RULE_SET_ID,
      forkedFromEditionId: null,
      key: ruleSetEditionKey(SEED_RULE_SET),
    });
    // The seed's values are rows only because the fork wrote them.
    const parameters = await forTenant(mintTenantCtx(tenantA), (tx) =>
      tx.select().from(schema.ruleSetEditionParameters),
    );
    expect(Object.fromEntries(parameters.map((p) => [p.key, p.value]))).toEqual(
      Object.fromEntries(SEED_RULE_SET.parameters.map((p) => [p.key, p.value])),
    );
  });

  it("forks a project edition and writes the project row in one transaction", async () => {
    const project = await createProject(mintTenantCtx(tenantA), { name: "Bashundhara Tower A" });
    const editions = await editionsOf(tenantA);
    const template = editions.find((e) => e.scope === "TEMPLATE");
    const fork = editions.find((e) => e.id === project.ruleSetEditionId);
    expect(fork).toMatchObject({ scope: "PROJECT", forkedFromEditionId: template?.id, forkedFromSeed: null });
    // A project edition's lineage reaches the seed: fork → template → IS1200_IN @ 2026.08.
    expect(template?.forkedFromSeed).toBe(SEED_RULE_SET_ID);
    // Forked unchanged, so the content address is inherited — nothing moved, nothing stale.
    expect(fork?.key).toBe(template?.key);
    const values = await forTenant(mintTenantCtx(tenantA), (tx) =>
      tx
        .select()
        .from(schema.ruleSetEditionParameters)
        .where(eq(schema.ruleSetEditionParameters.editionId, project.ruleSetEditionId)),
    );
    expect(values).toHaveLength(SEED_RULE_SET.parameters.length);
  });

  it("rolls the fork back with the caller's transaction — the pair lands, or neither does", async () => {
    const before = (await editionsOf(tenantA)).length;
    const refused = await refusalOf(() =>
      forTenant(mintTenantCtx(tenantA), async (tx) => {
        await forkProjectRuleSetEdition(tx, tenantA);
        throw new Error("the project row failed");
      }),
    );
    expect(refused).toMatch(/the project row failed/);
    expect(await editionsOf(tenantA)).toHaveLength(before);
  });

  it("refuses a project for a tenant with no template, by name, leaving nothing behind", async () => {
    expect(await refusalOf(() => createProject(mintTenantCtx(tenantC), { name: "unminted" }))).toMatch(
      /RULE_SET_TEMPLATE_MISSING/,
    );
    expect(await editionsOf(tenantC)).toHaveLength(0);
    const projects = await forTenant(mintTenantCtx(tenantC), (tx) => tx.select().from(schema.projects));
    expect(projects).toHaveLength(0);
  });

  it("refuses a second template for one tenant — the rule set in force is one stored fact", async () => {
    expect(await refusalOf(() => mintTenantRuleSetTemplate(mintTenantCtx(tenantB)))).toMatch(/unique|duplicate key/i);
  });
});

describe("the pin and the grant", () => {
  it("refuses a project with no edition — the column is NOT NULL, not a nullable fallback", async () => {
    const refused = await refusalOf(() =>
      forTenant(mintTenantCtx(tenantA), (tx) =>
        tx.execute(sql`insert into projects (tenant_id, name) values (${tenantA}::uuid, 'unpinned')`),
      ),
    );
    expect(refused).toMatch(/not-null|null value/i);
  });

  it("refuses a project citing another tenant's edition — the composite FK, not convention", async () => {
    const [foreign] = await editionsOf(tenantB);
    if (!foreign) throw new Error("expected B's template");
    const refused = await refusalOf(() =>
      forTenant(mintTenantCtx(tenantA), (tx) =>
        tx.insert(schema.projects).values({ tenantId: tenantA, name: "intruder", ruleSetEditionId: foreign.id }),
      ),
    );
    expect(refused).toMatch(/foreign key/i);
  });

  it("refuses every update of an edition and its values — the grant, not the application", async () => {
    const [edition] = await editionsOf(tenantA);
    if (!edition) throw new Error("expected an edition");
    expect(
      await refusalOf(() =>
        forTenant(mintTenantCtx(tenantA), (tx) =>
          tx.update(schema.ruleSetEditions).set({ key: "f".repeat(64) }).where(eq(schema.ruleSetEditions.id, edition.id)),
        ),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await refusalOf(() =>
        forTenant(mintTenantCtx(tenantA), (tx) =>
          tx
            .update(schema.ruleSetEditionParameters)
            .set({ value: "999" })
            .where(
              and(
                eq(schema.ruleSetEditionParameters.editionId, edition.id),
                eq(schema.ruleSetEditionParameters.key, "openingDeductionMinM2"),
              ),
            ),
        ),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await refusalOf(() =>
        forTenant(mintTenantCtx(tenantA), (tx) =>
          tx.update(schema.ruleSetEditionMethods).set({ version: 2 }).where(eq(schema.ruleSetEditionMethods.tenantId, tenantA)),
        ),
      ),
    ).toMatch(/permission denied/i);
  });

  /**
   * `numeric` accepts NaN and ±Infinity, and NaN sorts above every number — a threshold that
   * inverts the deduction rule it governs. The seam refuses one (src/core/rule-set.ts) and so
   * does the column, which is what a direct write meets. CHECK is evaluated before the primary
   * key, so an existing (edition, key) pair still reports the value.
   */
  it("refuses a non-finite parameter value at the column, not only at the seam", async () => {
    const [edition] = await editionsOf(tenantA);
    if (!edition) throw new Error("expected an edition");
    for (const value of ["NaN", "Infinity", "-Infinity"]) {
      const refused = await refusalOf(() =>
        forTenant(mintTenantCtx(tenantA), (tx) =>
          tx.insert(schema.ruleSetEditionParameters).values({
            editionId: edition.id,
            tenantId: tenantA,
            key: "openingDeductionMinM2",
            value,
          }),
        ),
      );
      expect(refused).toMatch(/rule_set_edition_parameters_value_finite_check/);
    }
  });

  it("shows a tenant no edition but its own", async () => {
    const [aEdition] = await editionsOf(tenantA);
    if (!aEdition) throw new Error("expected A's template");
    const seenByB = await forTenant(mintTenantCtx(tenantB), (tx) =>
      tx.select().from(schema.ruleSetEditions).where(eq(schema.ruleSetEditions.id, aEdition.id)),
    );
    expect(seenByB).toHaveLength(0);
    expect((await editionsOf(tenantB)).every((e) => e.tenantId === tenantB)).toBe(true);
    const paramsSeenByB = await forTenant(mintTenantCtx(tenantB), (tx) =>
      tx
        .select()
        .from(schema.ruleSetEditionParameters)
        .where(eq(schema.ruleSetEditionParameters.editionId, aEdition.id)),
    );
    expect(paramsSeenByB).toHaveLength(0);
  });
});
