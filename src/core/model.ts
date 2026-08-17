import Anthropic from "@anthropic-ai/sdk";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { TenantCtx } from "./db";
import { SPACE_MODEL, type EntityGraph } from "./entitygraph";

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

/**
 * Every **model-space** original entity of an EntityGraph, as source keys. An unprefixed handle
 * reads as DXF_HANDLE.
 *
 * The space filter is what keeps EntityGraph v2 additive here (ADR-0009). v1 shipped model space
 * alone, so the citable atom was a model-space original by construction — cad-ingestion.md §3
 * ("extraction consumes original entities only") and §7 ("every model-space original entity")
 * both assume it. v2 ships paper-space entities too, and without this filter a sheet border or a
 * title-block note would resolve as citable evidence: `callModel` refuses a proposal whose source
 * keys do not resolve (ADR-0006), so an unfiltered set would make a proposal citing sheet
 * furniture *acceptable*. Reading the marker here restores exactly v1's set, it does not add a
 * stage.
 */
export function sourceKeysOf(graph: EntityGraph): ReadonlySet<SourceKey> {
  const keys = new Set<SourceKey>();
  for (const e of graph.entities) {
    if (e.src === null && e.space === SPACE_MODEL && e.h) keys.add(`DXF_HANDLE:${e.h}`);
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

/**
 * One taxonomy for the seam's refusals; stable identifiers, never prose (formulas.md §6).
 * MODEL_REFUSED is the model declining (`stop_reason: "refusal"`) — a normal, non-retryable
 * outcome; TRANSPORT_FAILED is everything the transport side remedies (a fault, a rate limit,
 * a truncated reply). Adding a cause is a diff here and a superseding migration on the ledger's
 * CHECK (ADR-0006).
 */
export const REFUSAL_CAUSES = [
  "UNSOURCED",
  "SOURCE_UNRESOLVED",
  "MALFORMED",
  "FIXTURE_MISSING",
  "TRANSPORT_FAILED",
  "MODEL_REFUSED",
] as const;
export type RefusalCause = (typeof REFUSAL_CAUSES)[number];
export type Refusal = { readonly ok: false; readonly cause: RefusalCause; readonly detail: string; readonly callId: string };
export type Proposed<T> = { readonly ok: true; readonly proposal: Proposal<T> } | Refusal;

export type ModelRequest = { readonly model: ModelId; readonly system: string; readonly input: string };
export type ModelUsage = { readonly inputTokens: number; readonly outputTokens: number };
export type ModelReply = { readonly text: string; readonly usage: ModelUsage } | { readonly error: string };

/** A transport completes a request. `fixture` replays recorded replies; `live` is the SDK (`liveTransport`). */
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

/**
 * A transport's `{ error }` string names its class in a prefix; this maps the prefix to the
 * ledger's cause. `FIXTURE_MISSING:` and `REFUSAL:` are the two the caller may act on
 * differently (record the fixture; do not retry); everything else is the transport's to remedy.
 */
export function causeOfTransportError(error: string): RefusalCause {
  if (error.startsWith("FIXTURE_MISSING")) return "FIXTURE_MISSING";
  if (error.startsWith("REFUSAL:")) return "MODEL_REFUSED";
  return "TRANSPORT_FAILED";
}

/** The request's content hash: what a fixture is keyed by, and what the ledger cites. */
export function requestHash(req: ModelRequest): string {
  const canonical = JSON.stringify({ model: req.model, system: req.system, input: req.input });
  return createHash("sha256").update(canonical).digest("hex");
}

/** The fixture file's shape: exactly what a transport returns on success, and what the recorder writes. */
const fixtureSchema = z.object({
  text: z.string(),
  usage: z.object({ inputTokens: z.number().int(), outputTokens: z.number().int() }),
});
type Fixture = z.infer<typeof fixtureSchema>;

/**
 * Write a reply as the fixture for its request — `<dir>/<requestHash>.json`, canonical bytes, so
 * a re-recording of the same reply is byte-identical and `fixtureTransport` replays exactly what
 * the live transport returned. The live transport calls this when VEXTRUS_RECORD_FIXTURES is set.
 */
export function recordFixture(dir: string, req: ModelRequest, reply: Fixture): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${requestHash(req)}.json`);
  writeFileSync(file, `${JSON.stringify({ text: reply.text, usage: reply.usage }, null, 2)}\n`);
  return file;
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
      const parsed = fixtureSchema.safeParse(JSON.parse(readFileSync(file, "utf-8")));
      return parsed.success ? parsed.data : { error: `FIXTURE_MISSING:${path.basename(file)} is malformed` };
    },
  };
}

/**
 * The seam's own instruction to the model, appended after the caller's system prompt: the reply
 * is the proposal envelope and nothing else. The caller's `system` and `input` are what the
 * request hash covers; this block is a constant of the transport, so a fixture recorded live
 * replays under the same hash.
 */
const PROPOSAL_INSTRUCTION =
  'Reply with exactly one JSON object and nothing else — no prose, no code fence: {"payload": <the answer in the shape the task describes>, "sources": ["<scheme>:<key>", ...]}. "sources" lists the source keys of the drawing entities your answer relies on, verbatim as they were given to you, and must not be empty.';

/** Non-streaming ceiling; a proposal is small, and the SDK's timeout scales with this. */
const LIVE_MAX_TOKENS = 16_000;

type AnthropicClientOptions = NonNullable<ConstructorParameters<typeof Anthropic>[0]>;

export type LiveTransportOptions = {
  readonly apiKey: string;
  /** Where to write `<requestHash>.json` after each reply; defaults to VEXTRUS_RECORD_FIXTURES, unset = never. */
  readonly recordFixturesDir?: string | undefined;
  /** Test seam: the SDK's fetch. Never set in the product. */
  readonly fetch?: AnthropicClientOptions["fetch"];
};

/**
 * The live transport (ADR-0006): the one place the SDK is called. Sends the pinned model the
 * caller's system prompt plus the seam's proposal instruction, returns the reply's text and
 * token usage, and — when recording — writes the fixture that `fixtureTransport` will replay.
 * Every failure is a named `{ error }`, never a throw: a refusal, a rate limit, a network fault
 * are normal outcomes the ledger records by cause — MODEL_REFUSED for the model's own refusal,
 * TRANSPORT_FAILED for the rest (`causeOfTransportError`). Verify never constructs this.
 */
export function liveTransport(options: LiveTransportOptions): ModelTransport {
  const client = new Anthropic({ apiKey: options.apiKey, ...(options.fetch ? { fetch: options.fetch } : {}) });
  const recordDir = options.recordFixturesDir ?? process.env.VEXTRUS_RECORD_FIXTURES;
  return {
    kind: "live",
    async complete(req) {
      let message: Anthropic.Message;
      try {
        message = await client.messages.create({
          model: req.model,
          max_tokens: LIVE_MAX_TOKENS,
          system: [
            { type: "text", text: req.system },
            { type: "text", text: PROPOSAL_INSTRUCTION },
          ],
          messages: [{ role: "user", content: req.input }],
        });
      } catch (err) {
        if (err instanceof Anthropic.APIError) return { error: `API_ERROR:${err.status ?? "connection"}:${err.message}` };
        return { error: `API_ERROR:unknown:${err instanceof Error ? err.message : String(err)}` };
      }
      if (message.stop_reason === "refusal") {
        return { error: `REFUSAL:${message.stop_details?.category ?? "unspecified"}` };
      }
      if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") {
        return { error: `TRUNCATED:${message.stop_reason}` };
      }
      const reply: Fixture = {
        text: message.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join(""),
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      };
      if (recordDir) recordFixture(recordDir, req, reply);
      return reply;
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
    return refuse(causeOfTransportError(reply.error), reply.error, null);
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
