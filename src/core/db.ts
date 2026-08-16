import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
let authDb: Db | undefined;

function getAppDb(): Db {
  appDb ??= drizzle(postgres(requireEnv("DATABASE_URL"), { max: 10 }), { schema });
  return appDb;
}

function getSystemDb(): Db {
  systemDb ??= drizzle(postgres(requireEnv("MIGRATE_DATABASE_URL"), { max: 2 }), { schema });
  return systemDb;
}

function getAuthDb(): Db {
  authDb ??= drizzle(postgres(requireEnv("AUTH_DATABASE_URL"), { max: 5 }), { schema });
  return authDb;
}

/**
 * better-auth's model names → our tables (ADR-0004: organization → tenants, member →
 * memberships). One declaration: the auth instance uses these as `modelName`s and the adapter
 * below resolves them to table objects, so the two cannot drift.
 */
export const AUTH_MODELS = {
  user: "users",
  session: "sessions",
  account: "accounts",
  verification: "verifications",
  organization: "tenants",
  member: "memberships",
  invitation: "invitations",
} as const;

/**
 * The auth lane (issue #66): better-auth's database adapter over the `vextrus_auth` connection.
 * The handle stays inside this file — what leaves is better-auth's adapter, which reads and
 * writes only the seven tables the role is granted, under its own named RLS policies. Never the
 * owner on a request path.
 */
export function authAdapter() {
  return drizzleAdapter(getAuthDb(), {
    provider: "pg",
    schema: {
      [AUTH_MODELS.user]: schema.users,
      [AUTH_MODELS.session]: schema.sessions,
      [AUTH_MODELS.account]: schema.accounts,
      [AUTH_MODELS.verification]: schema.verifications,
      [AUTH_MODELS.organization]: schema.tenants,
      [AUTH_MODELS.member]: schema.memberships,
      [AUTH_MODELS.invitation]: schema.invitations,
    },
  });
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
