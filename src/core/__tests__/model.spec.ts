import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { mintTenantCtx } from "../db";
import {
  callModel,
  fixtureTransport,
  REFUSAL_CAUSES,
  requestHash,
  sourceKeysOf,
  type ModelCallRecord,
  type ModelTransport,
} from "../model";
import { entityGraphSchema } from "../entitygraph";
import { readFileSync } from "node:fs";

/**
 * The seam's contract (ADR-0006): a model call pins its model, attributes to a tenant, is
 * recorded whatever happens, replays from fixtures deterministically, and returns a proposal
 * only when every cited source key resolves against the artifact.
 */

const fixtures = path.resolve(import.meta.dirname, "fixtures/model");
const graph = entityGraphSchema.parse(
  JSON.parse(
    readFileSync(
      path.resolve(import.meta.dirname, "../../../cad/tests/fixtures/structural-r1.entitygraph.json"),
      "utf-8",
    ),
  ),
);
const known = sourceKeysOf(graph);
const ctx = mintTenantCtx("00000000-0000-0000-0000-00000000000a");
const payload = z.object({ viewClass: z.enum(["layout-plan", "schedule", "detail"]) });

function call(input: string, transport: ModelTransport, records: ModelCallRecord[]) {
  return callModel(
    {
      ctx,
      model: "claude-sonnet-5",
      purpose: "view-caption-classify",
      system: "Classify the view caption. Cite the caption's source key.",
      input,
      payload,
      resolve: (k) => known.has(k),
    },
    { transport, record: async (r) => void records.push(r) },
  );
}

const canned = (text: string): ModelTransport => ({
  kind: "fixture",
  complete: async () => ({ text, usage: { inputTokens: 10, outputTokens: 5 } }),
});

describe("the model seam", () => {
  it("cites only model-space originals, so sheet furniture never resolves", () => {
    // EntityGraph v2 ships paper-space entities (ADR-0009). A proposal citing a title-block
    // note or a sheet border must stay unresolvable: cad-ingestion.md §3 admits original
    // entities only and §7 frames the citable atom as model space's. Without the filter,
    // `resolve` would accept sheet furniture as evidence.
    const sheet = entityGraphSchema.parse(
      JSON.parse(
        readFileSync(
          path.resolve(import.meta.dirname, "../../../cad/tests/fixtures/sheet-paperspace.entitygraph.json"),
          "utf-8",
        ),
      ),
    );
    const paper = sheet.entities.filter((e) => e.space !== "model" && e.src === null);
    expect(paper.length).toBeGreaterThan(0);
    const keys = sourceKeysOf(sheet);
    for (const e of paper) expect(keys.has(`DXF_HANDLE:${e.h}`)).toBe(false);
    expect(keys.size).toBe(
      sheet.entities.filter((e) => e.space === "model" && e.src === null).length,
    );
  });

  it("replays a recorded fixture deterministically and resolves its sources", async () => {
    const records: ModelCallRecord[] = [];
    const first = await call("TYPICAL FLOOR PLAN (R1)", fixtureTransport(fixtures), records);
    const second = await call("TYPICAL FLOOR PLAN (R1)", fixtureTransport(fixtures), records);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.proposal.payload).toEqual({ viewClass: "layout-plan" });
    expect(first.proposal.sources).toEqual(second.proposal.sources);
    expect(first.proposal.payload).toEqual(second.proposal.payload);
    expect(first.proposal.model).toBe("claude-sonnet-5");
    expect(records.map((r) => r.outcome)).toEqual(["PROPOSED", "PROPOSED"]);
    expect(records[0]?.tenantId).toBe(ctx.tenantId);
    expect(records[0]?.usage).toEqual({ inputTokens: 120, outputTokens: 18 });
  });

  it("refuses by name when no fixture exists — verify never reaches a network", async () => {
    const records: ModelCallRecord[] = [];
    const out = await call("no such caption", fixtureTransport(fixtures), records);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.cause).toBe("FIXTURE_MISSING");
    expect(records[0]?.outcome).toBe("FIXTURE_MISSING");
    expect(records[0]?.usage).toBeNull();
  });

  it("an unsourced proposal is refused, never returned", async () => {
    const records: ModelCallRecord[] = [];
    const out = await call("x", canned(JSON.stringify({ payload: { viewClass: "schedule" }, sources: [] })), records);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.cause).toBe("UNSOURCED");
    expect(records[0]?.outcome).toBe("UNSOURCED");
  });

  it("a source key the artifact does not hold refuses the whole proposal", async () => {
    const records: ModelCallRecord[] = [];
    const out = await call(
      "x",
      canned(JSON.stringify({ payload: { viewClass: "schedule" }, sources: ["DXF_HANDLE:DEADBEEF"] })),
      records,
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.cause).toBe("SOURCE_UNRESOLVED");
    expect(out.detail).toContain("DEADBEEF");
  });

  it("a key outside the closed scheme vocabulary is malformed, not a source", async () => {
    const out = await call(
      "x",
      canned(JSON.stringify({ payload: { viewClass: "schedule" }, sources: ["LAYER:GRID"] })),
      [],
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.cause).toBe("UNSOURCED");
  });

  it("non-JSON and off-schema replies are MALFORMED and still recorded with usage", async () => {
    const records: ModelCallRecord[] = [];
    const a = await call("x", canned("I think it is a plan."), records);
    const b = await call("x", canned(JSON.stringify({ payload: { viewClass: "roof" }, sources: ["DXF_HANDLE:1F"] })), records);
    expect(a.ok || b.ok).toBe(false);
    expect(records.map((r) => r.outcome)).toEqual(["MALFORMED", "MALFORMED"]);
    expect(records.every((r) => r.usage !== null)).toBe(true);
  });

  it("the fixture is keyed by the request's content hash, so a changed prompt cannot replay a stale reply", () => {
    const a = requestHash({ model: "claude-sonnet-5", system: "s", input: "i" });
    const b = requestHash({ model: "claude-sonnet-5", system: "s", input: "i " });
    const c = requestHash({ model: "claude-opus-5", system: "s", input: "i" });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

/**
 * The refusal register (issue #99). CLAUDE.md's "refuses or defers with a named reason. Reason
 * codes are closed enums, never prose" is the one NEVER whose enforcement was review; this makes
 * it mechanical. Every member of REFUSAL_CAUSES is driven here and the observed set is compared
 * with the enum both ways, so **a cause added without a case turns verify red** — and so does a
 * case for a cause that no longer exists. This is Anthropic's eval recipe applied to our own
 * taxonomy: tasks drawn from real failure modes, each with a verdict two readers would agree on.
 */
describe("every refusal cause fires by name (ADR-0006)", () => {
  const observed = new Set<string>();
  const drive = async (transport: ModelTransport) => {
    const out = await call("register", transport, []);
    expect(out.ok).toBe(false);
    if (!out.ok) observed.add(out.cause);
    return out;
  };
  /** A transport that fails rather than replies; the prefix is what `causeOfTransportError` reads. */
  const failing = (error: string): ModelTransport => ({ kind: "live", complete: async () => ({ error }) });
  const sourced = (sources: readonly string[]) =>
    canned(JSON.stringify({ payload: { viewClass: "schedule" }, sources }));

  it("UNSOURCED — a proposal citing nothing", () => drive(sourced([])));
  it("SOURCE_UNRESOLVED — a key the artifact does not hold", () => drive(sourced(["DXF_HANDLE:DEADBEEF"])));
  it("MALFORMED — a reply that is not the schema", () => drive(canned("I think it is a plan.")));
  it("FIXTURE_MISSING — no recorded reply, and verify never reaches a network", () =>
    drive(fixtureTransport(fixtures)));
  it("TRANSPORT_FAILED — the transport's own fault, which retry may remedy", () =>
    drive(failing("HTTP 529: overloaded")));
  it("MODEL_REFUSED — the model declining, which retry never remedies", () =>
    drive(failing("REFUSAL:unspecified")));

  afterAll(() => {
    expect([...observed].sort()).toEqual([...REFUSAL_CAUSES].sort());
  });
});
