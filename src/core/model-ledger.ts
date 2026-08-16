import { forTenant, schema, type TenantCtx } from "./db";
import type { ModelCallRecorder } from "./model";

/**
 * The model call ledger's writer (ADR-0006): a `ModelCallRecorder` that inserts one `model_calls`
 * row per call — proposed or refused — through `forTenant`, so the row lands under the tenant's
 * RLS policy and the append-only grant (migration 0000). Attribution to a project is optional
 * and, when given, is a composite FK the database checks. Beside the human-only act log
 * (identity.md §7), never inside it.
 */
export function dbRecorder(ctx: TenantCtx, projectId?: string): ModelCallRecorder {
  return async (record) => {
    await forTenant(ctx, (tx) =>
      tx.insert(schema.modelCalls).values({
        id: record.callId,
        tenantId: ctx.tenantId,
        projectId: projectId ?? null,
        model: record.model,
        purpose: record.purpose,
        requestHash: record.requestHash,
        transport: record.transport,
        inputTokens: record.usage?.inputTokens ?? null,
        outputTokens: record.usage?.outputTokens ?? null,
        outcome: record.outcome,
      }),
    );
  };
}
