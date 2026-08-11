# Drawing upload and the ingest job

wayfinder:task
Status: open
Blocked by: 02-register-schema.md, 03-dxf-to-entitygraph.md

## Objective

Upload a DXF against a project → a `drawing_revisions` row → a Postgres-queued job → the
worker (`src/server/worker.ts`) invokes the cad CLI as a subprocess → artifact stored,
fidelity counters written to `ingests`, failures loud. Decide the queue shape (plain
SKIP LOCKED table vs pg-boss) inside this ticket and record the decision on the map.

## Guardrails

- The pipeline stays a subprocess — no resident Python service (ADR-0001).
- Artifact storage: filesystem path per revision for now (object storage is a future named
  need); the DB stores the reference + sha256, never the blob.
- Ingest failures and truncations surface on the drawing's screen-facing status — silence is
  the condemned state (`docs/domain/quantity-contract.md`).
- Worker runs under `runAsSystem` with a reason; per-tenant writes go through `forTenant`.

## Exit criteria

- [ ] End-to-end: upload fixture → job → artifact row + counters visible via tRPC.
- [ ] A corrupt DXF produces a failed ingest with a named error, not a hang or a zero-entity
      "success".
- [ ] `pnpm verify` green; queue decision recorded on the map.
