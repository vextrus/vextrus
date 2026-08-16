import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../../db/schema/core";
import { requireEnv } from "./env";

/**
 * The tenant seam (ADR-0004). The raw db handle is deliberately NOT exported: the only query
 * paths are `forTenant` (app role, RLS-constrained, tenant GUC set) and `runAsSystem` (owner
 * role, named reason). Nothing else in the tree may import the driver or the schema
 * (eslint.config.js), so an unscoped query does not lint, and RLS refuses what slips past.
 */

declare const tenantCtxBrand: unique symbol;
export type TenantCtx = {
  readonly tenantId: string;
  readonly [tenantCtxBrand]: true;
};

/**
 * Mint a tenant context. Call sites: auth middleware, a job worker entering with a job's
 * tenant, and tests — minting one anywhere else is a review-blocking defect.
 */
export function mintTenantCtx(tenantId: string): TenantCtx {
  return { tenantId } as TenantCtx;
}

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let appDb: Db | undefined;
let systemDb: Db | undefined;

function getAppDb(): Db {
  appDb ??= drizzle(postgres(requireEnv("DATABASE_URL"), { max: 10 }), { schema });
  return appDb;
}

function getSystemDb(): Db {
  systemDb ??= drizzle(postgres(requireEnv("MIGRATE_DATABASE_URL"), { max: 2 }), { schema });
  return systemDb;
}

/** Run `fn` inside a transaction with the tenant GUC set; RLS backstops it. */
export async function forTenant<T>(ctx: TenantCtx, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getAppDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${ctx.tenantId}, true)`);
    return fn(tx);
  });
}

/**
 * The system lane: owner connection, bypasses RLS. Every call names its reason — seeds, cross-
 * tenant jobs, test setup. Never a request path.
 */
export async function runAsSystem<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!reason.trim()) throw new Error("runAsSystem requires a reason");
  return getSystemDb().transaction(async (tx) => fn(tx));
}

export { schema };
