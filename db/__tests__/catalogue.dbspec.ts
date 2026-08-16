import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import type { QuantityKind } from "@/core/enums";
import { BEARS_PAIRS } from "@/core/kinds";
import { compareCanonical } from "@/core/order";
import { WORK_ITEM_CATALOGUE } from "@/core/work-items";

/**
 * The platform-owned reference tables, live (measurement-rules.md §4 as amended 2026-08-16;
 * quantity-contract.md §2.2 and §6). Three things are proven here that no amount of inspection
 * proves: the app role can read both tables, it is refused every write on both — **the read-only
 * grant is the whole of their protection**, since neither table has an RLS policy to fall back
 * on — and the two axes of the coverage denominator agree with each other and with the consts.
 *
 * No tenant is created and none is needed: nothing here is tenant-scoped, which is itself an
 * assertion below.
 */

/** Any context reads the same rows — the tenant id is set and then makes no difference. */
const asTenant = <T>(fn: Parameters<typeof forTenant<T>>[1]) => forTenant(mintTenantCtx(crypto.randomUUID()), fn);

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

describe("the catalogue and bears as tables (measurement-rules.md §4)", () => {
  it("carries every catalogue row the const declares, keyed on the kind", async () => {
    const rows = await asTenant((tx) => tx.select().from(schema.workItemCatalogue));
    expect(
      Object.fromEntries(
        rows.map((r) => [
          r.kind,
          {
            description: {
              en: { text: r.descriptionEn, nativelyReviewed: r.descriptionEnNativelyReviewed },
              bn: { text: r.descriptionBn, nativelyReviewed: r.descriptionBnNativelyReviewed },
            },
            dimension: r.dimension,
            unit: r.unit,
            documentPrecision: r.documentPrecision,
          },
        ]),
      ),
    ).toEqual(WORK_ITEM_CATALOGUE);
    const pk = await runAsSystem("catalogue dbspec: the primary key", (tx) =>
      tx.execute(sql`
        select a.attname::text as column
        from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = 'work_item_catalogue'::regclass and i.indisprimary`),
    );
    expect([...pk].map((r) => r.column)).toEqual(["kind"]);
  });

  it("carries every bears pair the const declares", async () => {
    const rows = await asTenant((tx) => tx.select().from(schema.bears));
    const canonical = (pairs: readonly { elementType: string; kind: string }[]) =>
      pairs.map((p) => `${p.elementType}:${p.kind}`).sort(compareCanonical);
    expect(canonical(rows)).toEqual(canonical(BEARS_PAIRS));
  });

  it("closes the denominator both ways: every kind borne, every borne kind catalogued", async () => {
    const [catalogued, borne] = await asTenant(async (tx) => [
      (await tx.select().from(schema.workItemCatalogue)).map((r) => r.kind).sort(compareCanonical),
      [...new Set((await tx.select().from(schema.bears)).map((r) => r.kind))].sort(compareCanonical),
    ]);
    expect(borne).toEqual(catalogued);
    expect(catalogued).not.toHaveLength(0);
    // The catalogue side of the FK, live: a bears row for an uncatalogued kind is refused by the
    // database, not by the seed's good behaviour.
    expect(
      await refusalOf(() =>
        runAsSystem("catalogue dbspec: the foreign key", (tx) =>
          // The cast is the point: the column is typed to the closed enum, so an unknown kind is
          // unrepresentable in TS — this asserts the *database* refuses it too.
          tx.insert(schema.bears).values({ elementType: "COLUMN", kind: "NOT_A_KIND" as QuantityKind }),
        ),
      ),
    ).toMatch(/foreign key|check constraint/i);
  });

  it("refuses the app role every write on both tables — the grant, not the application", async () => {
    for (const table of ["work_item_catalogue", "bears"]) {
      expect(
        await refusalOf(() => asTenant((tx) => tx.execute(sql.raw(`insert into "${table}" default values`)))),
        `insert on ${table}`,
      ).toMatch(/permission denied/i);
      expect(
        await refusalOf(() => asTenant((tx) => tx.execute(sql.raw(`update "${table}" set "kind" = 'FORMWORK'`)))),
        `update on ${table}`,
      ).toMatch(/permission denied/i);
      expect(
        await refusalOf(() => asTenant((tx) => tx.execute(sql.raw(`delete from "${table}"`)))),
        `delete on ${table}`,
      ).toMatch(/permission denied/i);
    }
    // The rows the refusals were aimed at are all still there.
    expect(await asTenant((tx) => tx.select().from(schema.bears))).toHaveLength(BEARS_PAIRS.length);
  });

  it("is platform-owned: no tenant column, no RLS, no isolation policy", async () => {
    const state = await runAsSystem("catalogue dbspec: the tenancy shape", async (tx) => ({
      tenantColumns: [
        ...(await tx.execute(sql`
          select table_name::text as table
          from information_schema.columns
          where table_schema = 'public'
            and table_name in ('work_item_catalogue', 'bears')
            and column_name = 'tenant_id'`)),
      ],
      rls: [
        ...(await tx.execute(sql`
          select relname::text as table, relrowsecurity as enabled
          from pg_class
          where relname in ('work_item_catalogue', 'bears')`)),
      ],
      policies: [
        ...(await tx.execute(sql`
          select policyname::text as policy
          from pg_policies
          where schemaname = 'public' and tablename in ('work_item_catalogue', 'bears')`)),
      ],
    }));
    expect(state.tenantColumns).toEqual([]);
    expect(state.policies).toEqual([]);
    expect(state.rls.map((r) => r.enabled)).toEqual([false, false]);
    expect(state.rls).toHaveLength(2);
  });

  it("reads the same rows under any tenant context — the vocabulary is not tenant-scoped", async () => {
    const readAs = (tenantId: string) =>
      forTenant(mintTenantCtx(tenantId), (tx) => tx.select().from(schema.workItemCatalogue).orderBy(schema.workItemCatalogue.kind));
    expect(await readAs(crypto.randomUUID())).toEqual(await readAs(crypto.randomUUID()));
    // And the register's own tables still see nothing under a stranger's id — this ticket moved
    // no tenant-owned table's policy or grant.
    expect(
      await forTenant(mintTenantCtx(crypto.randomUUID()), (tx) =>
        tx.select().from(schema.projects).where(eq(schema.projects.name, "any")),
      ),
    ).toHaveLength(0);
  });
});
