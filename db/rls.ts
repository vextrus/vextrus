/**
 * RLS emission helper (ADR-0004). Used inside hand-written custom migrations
 * so schema and its security land in the same history, in the same lane.
 *
 * ENABLE (not FORCE): the owner/migration role bypasses policies — that is
 * the system lane. The app role (`vextrus_app`, NOBYPASSRLS, non-owner) is
 * always subject to them.
 *
 * The policy is scoped TO vextrus_app: other constrained roles (the auth
 * lane's vextrus_auth) get their own explicit policies where needed, instead
 * of relying on the planner folding `tenant-qual OR true` — a GUC-unset
 * current_setting() error inside that OR would be a runtime surprise.
 */
export function tenantRlsSql(table: string): string {
  return `
ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";
CREATE POLICY "${table}_tenant_isolation" ON "${table}" TO vextrus_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO vextrus_app;
`.trim();
}
