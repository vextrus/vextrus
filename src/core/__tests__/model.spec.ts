import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mintTenantCtx } from "../db";
import {
  callModel,
  fixtureTransport,
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
