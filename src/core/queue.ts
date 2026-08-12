import { sql } from "drizzle-orm";
import { runAsSystem, schema, type Tx } from "./db";

/**
 * The ingest queue's seam (ADR-0009). A plain Postgres table claimed with
 * `FOR UPDATE SKIP LOCKED` — no broker, no second migration lane.
 *
 * Enqueue is a tenant write (it commits with the revision it describes);
 * claiming and finishing are cross-tenant by nature and run on the system lane
 * with a named reason. The worker never reads a bare db handle.
 */

export type IngestJob = typeof schema.ingestJobs.$inferSelect;

/**
 * How long a claimed job may stay `running` before another worker may reclaim
 * it. Longer than any sane ingestion (ADR-0001: generous timeouts), short
 * enough that a killed worker's queue drains without a human.
 */
export const CLAIM_LEASE_MS = 15 * 60_000;

/**
 * A job reclaimed this many times has been tried and never finished — a
 * crash-loop, not a slow drawing. It fails by name rather than cycling
 * invisibly.
 */
export const MAX_ATTEMPTS = 3;

export type IngestJobInput = {
  projectId: string;
  ingestId: string;
};

/** Tx-level: enqueue commits with the revision and ingest it describes. */
export async function insertIngestJob(
  tx: Tx,
  tenantId: string,
  input: IngestJobInput,
): Promise<IngestJob> {
  const [row] = await tx
    .insert(schema.ingestJobs)
    .values({ tenantId, ...input })
    .returning();
  if (!row) throw new Error(`ingest job insert for ${input.ingestId} returned no row`);
  return row;
}

/**
 * Claim the oldest claimable job, atomically, for this worker alone.
 *
 * One statement: the inner SELECT takes a row lock and skips rows other
 * workers hold, the outer UPDATE flips it to `running` and stamps the lease.
 * Claimable means queued, or running past a dead worker's expired lease.
 */
export async function claimIngestJob(
  leaseMs = CLAIM_LEASE_MS,
): Promise<IngestJob | undefined> {
  return runAsSystem("ingest worker: claim a queued job", async (tx) => {
    const claimed = await tx.execute<IngestJob>(sql`
      update ingest_jobs
      set status = 'running',
          attempts = attempts + 1,
          locked_at = now(),
          updated_at = now()
      where id = (
        select id from ingest_jobs
        where status = 'queued'
           or (status = 'running'
               and locked_at < now() - ${`${leaseMs} milliseconds`}::interval)
        order by created_at
        for update skip locked
        limit 1
      )
      returning id, tenant_id as "tenantId", project_id as "projectId",
                ingest_id as "ingestId", status, attempts,
                locked_at as "lockedAt", error,
                created_at as "createdAt", updated_at as "updatedAt"
    `);
    return claimed[0];
  });
}

/** A finished job is terminal; `failIngestJob` is the only path that names an error. */
export async function completeIngestJob(jobId: string): Promise<void> {
  await runAsSystem("ingest worker: mark job succeeded", async (tx) => {
    await tx.execute(sql`
      update ingest_jobs
      set status = 'succeeded', error = null, updated_at = now()
      where id = ${jobId}
    `);
  });
}

export async function failIngestJob(
  jobId: string,
  error: string,
): Promise<void> {
  if (!error.trim()) throw new Error("failIngestJob requires a named error");
  await runAsSystem("ingest worker: mark job failed", async (tx) => {
    await tx.execute(sql`
      update ingest_jobs
      set status = 'failed', error = ${error}, updated_at = now()
      where id = ${jobId}
    `);
  });
}
