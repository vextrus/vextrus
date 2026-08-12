# Drawing upload and the ingest job

wayfinder:task
Status: closed
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
- Ticket 03's review found `completeIngest` silently drops the artifact's
  `counters.unsupported_by_type` (the `ingests` table predates the field and both sides'
  doc-comments claim the row mirrors the counters "verbatim"). Add the column by migration
  and carry the counter through — also two review findings on `src/core/register.ts` to fix
  while in there: complete/fail transitions guard by id only (a late `failIngest` can
  overwrite a succeeded row and NULL its evidence — add a status predicate), and
  `refused_sightings.ingest_id` is tenant-paired but not project-paired (same-tenant
  cross-project evidence citation passes; close it the composite-FK way).

## Exit criteria

- [x] End-to-end: upload fixture → job → artifact row + counters visible via tRPC.
- [x] A corrupt DXF produces a failed ingest with a named error, not a hang or a zero-entity
      "success".
- [x] `pnpm verify` green; queue decision recorded on the map.

## Resolution

**The queue is a plain `ingest_jobs` table claimed with `SELECT … FOR UPDATE SKIP LOCKED`**
(ADR-0009). pg-boss was put and rejected on one measurement that needs no benchmark: it owns
its own schema and migrates itself at boot — a second schema writer, which ADR-0002 exists to
forbid — and its connection cannot join the transaction that lands the revision, so "a revision
with no queued work" would become representable. The lane split is enforced by grant: the app
role may INSERT (enqueue, in the same `forTenant` transaction as the revision and ingest) and
SELECT (the status screen), never UPDATE; claiming, completing and failing ride `runAsSystem`
under a named reason.

The path: `drawings.uploadRevision` (tRPC) → source bytes stored content-addressed under
`VEXTRUS_STORAGE_ROOT/<tenant>/<project>/<drawing>/<sha256>.dxf`, then revision + ingest + job
in one transaction → `runOnce()` in `src/server/worker.ts` claims, mints the job's TenantCtx,
and calls the takeoff module → `uv run python -m vextrus_cad ingest` as a subprocess in a temp
dir → artifact parsed against the Zod contract, written to storage, counters written back
verbatim by `completeIngest`. `drawings.status` reads every revision with its ingest.

Loud by construction, each with a test:

- Every cad-side failure leaves by name — non-zero exit, timeout (our own timer: Windows does
  not report the killing signal), missing artifact, non-JSON, contract violation. A corrupt DXF
  ends `failed` with `cad ingest failed: the CLI exited 1: …`, no artifact, no counters.
- The stored source is re-hashed before extraction, and the artifact's `source.sha256` is
  checked against the revision's — the pipeline reading a different file than the revision
  landed is a named refusal, not a quiet substitution.
- `explode_truncated`, `lost_by_type`, `unsupported_by_type` and an unmapped `$INSUNITS` each
  surface as a warning string on a *succeeded* ingest's status (quantity-contract §2).
- A job reclaimed past its lease more times than the cap fails by name; a *run* that fails never
  auto-retries (a corrupt drawing is deterministic — a retry loop around a permanent refusal is
  the condemned silence).
- Artifact references are data: `resolveRef` refuses any that escapes the storage root.

Ticket 03's three routed findings, closed in migration 0006:

- `ingests.unsupported_by_type` lands as a column, is carried by `completeIngest`, and joins the
  `succeeded` CHECK — a success that drops the counter block is now unrepresentable. Rows that
  predate the column are demoted to a named failure by the migration rather than backfilled with
  an invented empty counter.
- `completeIngest` / `failIngest` / the new `startIngest` all carry a `status <> 'succeeded'`
  predicate: a succeeded ingest is terminal, so a late worker whose job was reclaimed cannot
  overwrite the row or NULL its evidence. The refusal names itself.
- `refused_sightings.ingest_id` is now project-paired (`refused_sightings_ingest_project_fk`).
  That required carrying `project_id` down the chain — `drawing_revisions` and `ingests` both
  gained it, each pinned to its parent by composite FK — so same-tenant cross-project evidence
  citation is refused by the database.

Code review (in-scope findings, all fixed with tests before landing):

- **The timeout could still hang.** `uv run` forks python as a grandchild that inherits the
  stderr pipe, so `close` need not fire after `uv` is killed — waiting for it was the very hang
  the timer exists to prevent. The timer now resolves the promise itself, and stdout is
  `ignore` (the artifact always arrives via `-o`, and an unread pipe blocks the CLI at 64KB).
- **One revision, many ingests.** A re-run is a new ingest, and the status join was
  one-to-many: a superseded failure could render as the revision's current state. `DISTINCT ON`
  the revision, newest ingest first.
- **A dead claim killed the worker.** `claimIngestJob` sat outside `runOnce`'s try and
  `runWorker` had no boundary — one reset connection would exit the process and stall the queue
  silently. Logged and retried on the next tick.
- **A bogus drawing id spent disk.** The source was written before anything checked the drawing
  belonged to the project; only the FK refused, after the bytes landed. The upload now takes a
  row lock on the drawing first — which also serialises concurrent uploads onto distinct seqs
  instead of racing to the same one and losing the loser to a raw constraint error.
- **The job could contradict the register**: a crash between a succeeded ingest and its
  bookkeeping left the reclaiming worker marking the job failed for work that succeeded. It now
  checks the ingest first and closes the job to match the evidence.
- **A relative storage root** resolved against each process's cwd, so the web server and the
  worker could disagree about where a reference lives — an ENOENT, or a hash mismatch reading
  like tampering, in place of a configuration error. Absolute only, refused by name.

Findings routed out: `src/core/auth.ts`'s non-transactional signup hook (a failed membership
insert strands the user with no repair path) is ticket 01's and already with the operator.

Proof: `pnpm verify` green in 6.3s (the cad subprocess seam is tested inside it — the pipeline
is already in that lane, so the boundary it is reached across belongs there too);
`pnpm test:db` 33 passed, including the full upload → job → worker → tRPC round trip on the
real CLI.
