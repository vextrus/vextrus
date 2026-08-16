import { sql } from "drizzle-orm";
import { pgPolicy, pgRole } from "drizzle-orm/pg-core";

/**
 * The RLS helper (ADR-0004). A tenant-owned table declares `.enableRLS()` and lists
 * `tenantIsolation("<table>")` among its extras; drizzle-kit then emits ENABLE ROW LEVEL SECURITY
 * and the policy into the same migration as the table, so schema and its security move together
 * in one lane. GRANTs are appended to the migration by hand (drizzle does not emit them) — see
 * db/migrations/0000_*.sql for the shape.
 *
 * ENABLE (not FORCE): the owner/migration role bypasses policies — that is the system lane. The
 * app role (`vextrus_app`, LOGIN NOBYPASSRLS, non-owner, created by scripts/db-migrate.mjs) is
 * always subject to them.
 */
export const appRole = pgRole("vextrus_app").existing();

export function tenantIsolation(table: string) {
  return pgPolicy(`${table}_tenant_isolation`, {
    for: "all",
    to: appRole,
    using: sql`tenant_id = current_setting('app.tenant_id')::uuid`,
    withCheck: sql`tenant_id = current_setting('app.tenant_id')::uuid`,
  });
}

/**
 * The auth role (ADR-0004; issue #66): better-auth connects as `vextrus_auth` — LOGIN,
 * NOBYPASSRLS, non-owner, created by scripts/db-migrate.mjs — never as the owner on a request
 * path. It manages users, sessions, accounts, verifications, tenants (organizations),
 * memberships (members) and invitations, and nothing else: its GRANTs name exactly those tables.
 * Sign-in precedes tenancy, so on the tenant-owned membership tables it gets an explicit, named
 * policy rather than the tenant GUC policy — what it may touch is written down, not implied.
 */
export const authRole = pgRole("vextrus_auth").existing();

export function authAccess(table: string) {
  return pgPolicy(`${table}_auth_access`, {
    for: "all",
    to: authRole,
    using: sql`true`,
    withCheck: sql`true`,
  });
}
