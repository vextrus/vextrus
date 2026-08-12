import { mintTenantCtx } from "@/core/db";
import {
  MAX_ATTEMPTS,
  claimIngestJob,
  completeIngestJob,
  failIngestJob,
  type IngestJob,
} from "@/core/queue";
import { failIngest, getIngest } from "@/core/register";
import { runIngestJob } from "@/modules/takeoff";

/**
 * The ingest worker (ADR-0009): claim a job, run the cad CLI against it, write
 * the result, repeat. `pnpm worker` runs it; tests drive `runOnce` directly.
 *
 * Claiming is cross-tenant and rides the system lane with a named reason; every
 * write about a drawing rides `forTenant` under the job's own tenant. A job
 * that throws fails its ingest by name — the one thing a worker may never do
 * is finish quietly.
 */

const POLL_INTERVAL_MS = 1_000;

export type Outcome =
  | { result: "idle" }
  | { result: "succeeded"; jobId: string; ingestId: string }
  | { result: "failed"; jobId: string; ingestId: string; error: string };

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Claim and run at most one job. Returns what happened — a failed ingest is a
 * normal return, not a thrown error: the failure is recorded evidence.
 */
export async function runOnce(): Promise<Outcome> {
  const job = await claimIngestJob();
  if (!job) return { result: "idle" };
  const ctx = mintTenantCtx(job.tenantId);
  try {
    const already = await getIngest(ctx, job.ingestId);
    if (already?.status === "succeeded") {
      // the run finished but the bookkeeping did not (a crash between the two,
      // then a reclaim). The evidence stands; close the job to match it rather
      // than blaming the pipeline for a gap it did not cause.
      await completeIngestJob(job.id);
      return { result: "succeeded", jobId: job.id, ingestId: job.ingestId };
    }
    if (job.attempts > MAX_ATTEMPTS) {
      // reclaimed past the cap: the run itself never completes, so refuse it
      // by name rather than cycling through the queue forever
      throw new Error(
        `abandoned after ${job.attempts} attempts without finishing`,
      );
    }
    await runIngestJob(ctx, job);
    await completeIngestJob(job.id);
    return { result: "succeeded", jobId: job.id, ingestId: job.ingestId };
  } catch (err) {
    return recordFailure(job, describe(err));
  }
}

async function recordFailure(job: IngestJob, error: string): Promise<Outcome> {
  const ctx = mintTenantCtx(job.tenantId);
  try {
    await failIngest(ctx, { ingestId: job.ingestId, error });
  } catch (err) {
    // the ingest row would not take the failure (already succeeded, or gone):
    // the job still records it, so the failure is never lost entirely
    await failIngestJob(
      job.id,
      `${error} | and the ingest refused the failure: ${describe(err)}`,
    );
    return { result: "failed", jobId: job.id, ingestId: job.ingestId, error };
  }
  await failIngestJob(job.id, error);
  return { result: "failed", jobId: job.id, ingestId: job.ingestId, error };
}

/**
 * Poll until stopped. One process, one loop — concurrency is more workers.
 *
 * The loop body is guarded: claiming happens before `runOnce`'s own try, so a
 * transient database fault (a reset connection, a pool timeout) would
 * otherwise kill the process and stall the whole queue until a human noticed.
 * It is logged and retried on the next tick instead.
 */
export async function runWorker(
  signal?: AbortSignal,
  pollMs = POLL_INTERVAL_MS,
): Promise<void> {
  const idle = () => new Promise((resolve) => setTimeout(resolve, pollMs));
  while (!signal?.aborted) {
    let outcome: Outcome;
    try {
      outcome = await runOnce();
    } catch (err) {
      console.error(`ingest worker: could not take a job — ${describe(err)}`);
      await idle();
      continue;
    }
    if (outcome.result === "idle") {
      await idle();
      continue;
    }
    console.log(
      outcome.result === "succeeded"
        ? `ingest ${outcome.ingestId}: succeeded`
        : `ingest ${outcome.ingestId}: failed — ${outcome.error}`,
    );
  }
}
