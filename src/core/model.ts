import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { TenantCtx } from "./db";
import type { EntityGraph } from "./entitygraph";

/**
 * The model seam (ADR-0006). Every model call in the product passes through `callModel`, the
 * way every query passes through `forTenant`: nothing else may import the model SDK
 * (eslint.config.js). The seam pins the model by id, attributes the call to a tenant, records
 * it in the call ledger, replays from fixtures inside `pnpm verify`, and returns a **proposal**
 * — a payload plus the source keys it cites, resolved by code before anyone sees it — never a
 * conclusion and never a quantity. AI proposes; code resolves; a human disposes.
 */

/** The models this product may call, by exact id. Adding one is a diff here, never a string at a call site. */
export const MODEL_IDS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"] as const;
export type ModelId = (typeof MODEL_IDS)[number];

/** cad-ingestion.md §2: one opaque `scheme:key` token, closed scheme vocabulary, hex or base32 keys. */
export const SOURCE_SCHEMES = ["DXF_HANDLE", "PDF_OBJECT", "RASTER_TRACE"] as const;
export type SourceScheme = (typeof SOURCE_SCHEMES)[number];
export type SourceKey = `${SourceScheme}:${string}`;
const SOURCE_KEY = /^(DXF_HANDLE|PDF_OBJECT|RASTER_TRACE):[0-9A-Za-z]+$/;
export const sourceKeySchema = z.custom<SourceKey>(
  (v) => typeof v === "string" && SOURCE_KEY.test(v),
  "a source key is `<scheme>:<key>` with a closed scheme (cad-ingestion.md §2)",
);

/** Every original entity of an EntityGraph, as source keys. An unprefixed handle reads as DXF_HANDLE. */
export function sourceKeysOf(graph: EntityGraph): ReadonlySet<SourceKey> {
  const keys = new Set<SourceKey>();
  for (const e of graph.entities) {
    if (e.src === null && e.h) keys.add(`DXF_HANDLE:${e.h}`);
  }
  return keys;
}

/**
 * What a model is allowed to return: a payload the caller's schema shapes, plus at least one
 * cited source key. `sources` is a non-empty tuple type, so an unsourced proposal does not
 * typecheck; the schema below refuses it at runtime, before the resolver ever runs.
 */
export type Proposal<T> = {
  readonly payload: T;
  readonly sources: readonly [SourceKey, ...SourceKey[]];
  readonly model: ModelId;
  readonly callId: string;
};

export function proposalSchema<T>(payload: z.ZodType<T>) {
  // A tuple with a rest, not `.array().nonempty()`: the inferred type is `[SourceKey, ...SourceKey[]]`,
  // so the non-emptiness is in the type, not only in the parse.
  return z.object({ payload, sources: z.tuple([sourceKeySchema]).rest(sourceKeySchema) });
}

/** One taxonomy for the seam's refusals; stable identifiers, never prose (formulas.md §6). */
export const REFUSAL_CAUSES = [
  "UNSOURCED",
  "SOURCE_UNRESOLVED",
  "MALFORMED",
  "FIXTURE_MISSING",
  "TRANSPORT_FAILED",
] as const;
export type RefusalCause = (typeof REFUSAL_CAUSES)[number];
export type Refusal = { readonly ok: false; readonly cause: RefusalCause; readonly detail: string; readonly callId: string };
export type Proposed<T> = { readonly ok: true; readonly proposal: Proposal<T> } | Refusal;

export type ModelRequest = { readonly model: ModelId; readonly system: string; readonly input: string };
export type ModelUsage = { readonly inputTokens: number; readonly outputTokens: number };
export type ModelReply = { readonly text: string; readonly usage: ModelUsage } | { readonly error: string };

/** A transport completes a request. `fixture` replays recorded replies; `live` is the SDK, landing with the first model ticket. */
export type ModelTransport = {
  readonly kind: "live" | "fixture";
  complete(req: ModelRequest): Promise<ModelReply>;
};

/** What the ledger keeps for every call, proposed or refused. Cost attribution is per tenant. */
export type ModelCallRecord = {
  readonly callId: string;
  readonly tenantId: string;
  readonly model: ModelId;
  readonly purpose: string;
  readonly requestHash: string;
  readonly transport: ModelTransport["kind"];
  readonly usage: ModelUsage | null;
  readonly outcome: "PROPOSED" | RefusalCause;
};
export type ModelCallRecorder = (record: ModelCallRecord) => Promise<void>;

/** The request's content hash: what a fixture is keyed by, and what the ledger cites. */
export function requestHash(req: ModelRequest): string {
  const canonical = JSON.stringify({ model: req.model, system: req.system, input: req.input });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Replays recorded replies from `<dir>/<requestHash>.json` (`{ "text": ..., "usage": ... }`).
 * Deterministic by construction: same request, same bytes, same reply. A missing fixture is a
 * named refusal, never a live call — verify has no network.
 */
export function fixtureTransport(dir: string): ModelTransport {
  return {
    kind: "fixture",
    async complete(req) {
      const file = path.join(dir, `${requestHash(req)}.json`);
      if (!existsSync(file)) return { error: `FIXTURE_MISSING:${path.basename(file)}` };
      const parsed = z
        .object({ text: z.string(), usage: z.object({ inputTokens: z.number().int(), outputTokens: z.number().int() }) })
        .safeParse(JSON.parse(readFileSync(file, "utf-8")));
      return parsed.success ? parsed.data : { error: `FIXTURE_MISSING:${path.basename(file)} is malformed` };
    },
  };
}

export type ModelCall<T> = {
  /** Cost and the ledger row attribute to this tenant. */
  readonly ctx: TenantCtx;
  readonly model: ModelId;
  /** Names the call in the ledger, e.g. "view-caption-classify". */
  readonly purpose: string;
  readonly system: string;
  readonly input: string;
  /** Shapes the proposal's payload. It describes a proposal, never a register row. */
  readonly payload: z.ZodType<T>;
  /** Code resolves every cited key before the proposal is returned; an unresolvable key refuses the whole proposal. */
  readonly resolve: (key: SourceKey) => boolean;
};

/**
 * The one function every model call passes through. Returns a proposal or a refusal; it never
 * throws on model output, because a model's failure to cite is a normal outcome with a name.
 */
export async function callModel<T>(
  call: ModelCall<T>,
  deps: { readonly transport: ModelTransport; readonly record: ModelCallRecorder },
): Promise<Proposed<T>> {
  const callId = randomUUID();
  const req: ModelRequest = { model: call.model, system: call.system, input: call.input };
  const base = {
    callId,
    tenantId: call.ctx.tenantId,
    model: call.model,
    purpose: call.purpose,
    requestHash: requestHash(req),
    transport: deps.transport.kind,
  };
  const refuse = async (cause: RefusalCause, detail: string, usage: ModelUsage | null): Promise<Refusal> => {
    await deps.record({ ...base, usage, outcome: cause });
    return { ok: false, cause, detail, callId };
  };

  const reply = await deps.transport.complete(req);
  if ("error" in reply) {
    return refuse(reply.error.startsWith("FIXTURE_MISSING") ? "FIXTURE_MISSING" : "TRANSPORT_FAILED", reply.error, null);
  }

  let json: unknown;
  try {
    json = JSON.parse(reply.text);
  } catch {
    return refuse("MALFORMED", "reply is not JSON", reply.usage);
  }
  const parsed = proposalSchema(call.payload).safeParse(json);
  if (!parsed.success) {
    const unsourced = parsed.error.issues.some((i) => i.path[0] === "sources");
    return refuse(unsourced ? "UNSOURCED" : "MALFORMED", parsed.error.issues.map((i) => i.message).join("; "), reply.usage);
  }
  const unresolved = parsed.data.sources.filter((k) => !call.resolve(k));
  if (unresolved.length > 0) {
    return refuse("SOURCE_UNRESOLVED", unresolved.join(", "), reply.usage);
  }

  await deps.record({ ...base, usage: reply.usage, outcome: "PROPOSED" });
  return {
    ok: true,
    proposal: { payload: parsed.data.payload, sources: parsed.data.sources, model: call.model, callId },
  };
}
