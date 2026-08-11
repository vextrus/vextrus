/**
 * RLS emission helper (ADR-0004). Used inside hand-written custom migrations
 * so schema and its security land in the same history, in the same lane.
 *
 * ENABLE (not FORCE): the owner/migration role bypasses policies — that is
 * the system lane. The app role (`vextrus_app`, NOBYPASSRLS, non-owner) is
 * always subject to them.
 */
export function tenantRlsSql(table: string): string {
  return `
ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";
CREATE POLICY "${table}_tenant_isolation" ON "${table}"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO vextrus_app;
`.trim();
}
