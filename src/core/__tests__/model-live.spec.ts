import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mintTenantCtx } from "../db";
import {
  callModel,
  fixtureTransport,
  liveTransport,
  recordFixture,
  requestHash,
  type ModelCallRecord,
  type ModelRequest,
} from "../model";

/**
 * The live transport and the fixture recorder (ADR-0006), without a network or a key: the SDK's
 * fetch is replaced with a canned Messages API reply, so the real request shape, reply parsing,
 * refusal handling and fixture recording are exercised, and what the recorder writes is proven
 * to be exactly what `fixtureTransport` replays — byte for byte, and equal to a committed fixture.
 */
const fixtures = path.resolve(import.meta.dirname, "fixtures/model");
const req: ModelRequest = {
  model: "claude-sonnet-5",
  system: "Classify the view caption. Cite the caption's source key.",
  input: "TYPICAL FLOOR PLAN (R1)",
};
const committedReply = { text: JSON.stringify({ payload: { viewClass: "layout-plan" }, sources: ["DXF_HANDLE:E6"] }), usage: { inputTokens: 120, outputTokens: 18 } };

type FetchLike = NonNullable<Parameters<typeof liveTransport>[0]["fetch"]>;
function cannedFetch(status: number, body: unknown, seen: { url?: string; init?: RequestInit }[] = []): FetchLike {
  return (async (url: unknown, init?: unknown) => {
    seen.push({ url: String(url), init: init as RequestInit });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as FetchLike;
}
const message = (overrides: Record<string, unknown> = {}) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5",
  content: [{ type: "text", text: committedReply.text }],
  stop_reason: "end_turn",
  stop_sequence: null,
  stop_details: null,
  usage: { input_tokens: 120, output_tokens: 18, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  ...overrides,
});

describe("the fixture recorder", () => {
  it("writes exactly the bytes a committed fixture holds, keyed by the request hash", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "vextrus-fixtures-"));
    const file = recordFixture(dir, req, committedReply);
    expect(path.basename(file)).toBe(`${requestHash(req)}.json`);
    expect(readFileSync(file)).toEqual(readFileSync(path.join(fixtures, path.basename(file))));
    // Re-recording is idempotent, and the replay is what was recorded.
    expect(readFileSync(recordFixture(dir, req, committedReply))).toEqual(readFileSync(file));
  });
});

describe("the live transport", () => {
  it("sends the pinned model the caller's prompt plus the proposal instruction, returns text + usage, and records the fixture", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "vextrus-fixtures-"));
    const seen: { url?: string; init?: RequestInit }[] = [];
    const transport = liveTransport({ apiKey: "sk-test", fetch: cannedFetch(200, message(), seen), recordFixturesDir: dir });
    expect(transport.kind).toBe("live");
    const reply = await transport.complete(req);
    expect(reply).toEqual(committedReply);
    // The request the SDK sent.
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toMatch(/\/v1\/messages$/);
    const headers = new Headers(seen[0]?.init?.headers as HeadersInit);
    expect(headers.get("x-api-key")).toBe("sk-test");
    const body = JSON.parse(String(seen[0]?.init?.body)) as {
      model: string;
      max_tokens: number;
      system: { type: string; text: string }[];
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.system[0]?.text).toBe(req.system);
    expect(body.system[1]?.text).toContain('"sources"');
    expect(body.messages).toEqual([{ role: "user", content: req.input }]);
    // The fixture it recorded replays byte-identically through the fixture transport.
    const replayed = await fixtureTransport(dir).complete(req);
    expect(replayed).toEqual(reply);
    expect(readFileSync(path.join(dir, `${requestHash(req)}.json`))).toEqual(readFileSync(path.join(fixtures, `${requestHash(req)}.json`)));
  });

  it("does not record when no directory is set", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "vextrus-fixtures-"));
    const prior = process.env.VEXTRUS_RECORD_FIXTURES;
    delete process.env.VEXTRUS_RECORD_FIXTURES;
    try {
      const transport = liveTransport({ apiKey: "sk-test", fetch: cannedFetch(200, message()) });
      expect(await transport.complete(req)).toEqual(committedReply);
      expect((await fixtureTransport(dir).complete(req)) as { error?: string }).toMatchObject({ error: expect.stringMatching(/^FIXTURE_MISSING/) });
    } finally {
      if (prior !== undefined) process.env.VEXTRUS_RECORD_FIXTURES = prior;
    }
  });

  it("names a refusal and an API error instead of throwing; callModel records MODEL_REFUSED and TRANSPORT_FAILED by cause", async () => {
    const refused = liveTransport({ apiKey: "sk-test", fetch: cannedFetch(200, message({ content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: null } })) });
    expect(await refused.complete(req)).toEqual({ error: "REFUSAL:cyber" });
    const bad = liveTransport({
      apiKey: "sk-test",
      fetch: cannedFetch(400, { type: "error", error: { type: "invalid_request_error", message: "max_tokens too large" } }),
    });
    const err = await bad.complete(req);
    expect(err).toMatchObject({ error: expect.stringMatching(/^API_ERROR:400:/) });
    const records: ModelCallRecord[] = [];
    const out = await callModel(
      { ctx: mintTenantCtx("00000000-0000-0000-0000-00000000000a"), model: "claude-sonnet-5", purpose: "t", system: req.system, input: req.input, payload: z.object({ viewClass: z.string() }), resolve: () => true },
      { transport: refused, record: async (r) => void records.push(r) },
    );
    expect(out).toMatchObject({ ok: false, cause: "MODEL_REFUSED", detail: "REFUSAL:cyber" });
    expect(records[0]).toMatchObject({ transport: "live", outcome: "MODEL_REFUSED", usage: null });
    const failed = await callModel(
      { ctx: mintTenantCtx("00000000-0000-0000-0000-00000000000a"), model: "claude-sonnet-5", purpose: "t", system: req.system, input: req.input, payload: z.object({ viewClass: z.string() }), resolve: () => true },
      { transport: bad, record: async (r) => void records.push(r) },
    );
    expect(failed).toMatchObject({ ok: false, cause: "TRANSPORT_FAILED", detail: expect.stringMatching(/^API_ERROR:400:/) });
    expect(records[1]).toMatchObject({ transport: "live", outcome: "TRANSPORT_FAILED", usage: null });
  });
});
