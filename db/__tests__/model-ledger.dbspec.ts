import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { forTenant, mintTenantCtx, runAsSystem, schema } from "@/core/db";
import { callModel, fixtureTransport, type ModelTransport } from "@/core/model";
import { dbRecorder } from "@/core/model-ledger";
import { createProject } from "@/core/projects";
import { mintTenantRuleSetTemplate } from "@/core/rule-set-editions";

/**
 * The ledger's writer (ADR-0006), live: `dbRecorder` lands exactly one `model_calls` row per call
 * through `callModel`, proposed or refused, under the tenant's RLS policy, and attributes to a
 * project only through the composite FK. Runs via `pnpm test:db`.
 */
const fixtures = path.resolve(process.cwd(), "src/core/__tests__/fixtures/model");
let tenantId: string;
let projectId: string;

beforeAll(async () => {
  await runAsSystem("model-ledger dbspec setup", async (tx) => {
    const [t] = await tx.insert(schema.tenants).values({ name: "dbspec ledger", slug: `dbspec-ledger-${crypto.randomUUID()}` }).returning();
    if (!t) throw new Error("setup failed");
    tenantId = t.id;
  });
  await mintTenantRuleSetTemplate(mintTenantCtx(tenantId));
  projectId = (await createProject(mintTenantCtx(tenantId), { name: "ledger project" })).id;
});

afterAll(async () => {
  await runAsSystem("model-ledger dbspec teardown", async (tx) => {
    await tx.delete(schema.modelCalls).where(eq(schema.modelCalls.tenantId, tenantId));
    await tx.delete(schema.projects).where(eq(schema.projects.tenantId, tenantId));
    await tx.delete(schema.ruleSetEditionParameters).where(eq(schema.ruleSetEditionParameters.tenantId, tenantId));
    await tx.delete(schema.ruleSetEditionMethods).where(eq(schema.ruleSetEditionMethods.tenantId, tenantId));
    await tx.delete(schema.ruleSetEditions).where(eq(schema.ruleSetEditions.tenantId, tenantId));
    await tx.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
  });
});

const payload = z.object({ viewClass: z.enum(["layout-plan", "schedule", "detail"]) });
const call = (input: string, transport: ModelTransport, purpose = "view-caption-classify") =>
  callModel(
    {
      ctx: mintTenantCtx(tenantId),
      model: "claude-sonnet-5",
      purpose,
      system: "Classify the view caption. Cite the caption's source key.",
      input,
      payload,
      resolve: (k) => k === "DXF_HANDLE:E6",
    },
    { transport: fixtureTransport(fixtures), record: dbRecorder(mintTenantCtx(tenantId), projectId) },
  ).then((out) => ({ out, transport }));

describe("dbRecorder", () => {
  it("writes exactly one row per call, proposed or refused, with usage where the model answered", async () => {
    const proposed = await call("TYPICAL FLOOR PLAN (R1)", fixtureTransport(fixtures));
    const missing = await call("no such caption", fixtureTransport(fixtures));
    const malformed = await callModel(
      {
        ctx: mintTenantCtx(tenantId),
        model: "claude-sonnet-5",
        purpose: "malformed",
        system: "s",
        input: "i",
        payload,
        resolve: () => true,
      },
      {
        transport: { kind: "fixture", complete: async () => ({ text: "not json", usage: { inputTokens: 3, outputTokens: 1 } }) },
        record: dbRecorder(mintTenantCtx(tenantId), projectId),
      },
    );
    // The model's own refusal is a named cause of its own (migration 0004 admits it in the CHECK).
    const modelRefused = await callModel(
      { ctx: mintTenantCtx(tenantId), model: "claude-sonnet-5", purpose: "refused", system: "s", input: "i", payload, resolve: () => true },
      { transport: { kind: "live", complete: async () => ({ error: "REFUSAL:cyber" }) }, record: dbRecorder(mintTenantCtx(tenantId), projectId) },
    );
    expect(proposed.out.ok).toBe(true);
    expect(missing.out).toMatchObject({ ok: false, cause: "FIXTURE_MISSING" });
    expect(malformed).toMatchObject({ ok: false, cause: "MALFORMED" });
    expect(modelRefused).toMatchObject({ ok: false, cause: "MODEL_REFUSED" });

    const rows = await forTenant(mintTenantCtx(tenantId), (tx) => tx.select().from(schema.modelCalls));
    expect(rows).toHaveLength(4);
    const byOutcome = Object.fromEntries(rows.map((r) => [r.outcome, r]));
    expect(byOutcome.MODEL_REFUSED).toMatchObject({ transport: "live", inputTokens: null, outputTokens: null, purpose: "refused" });
    expect(byOutcome.PROPOSED).toMatchObject({ transport: "fixture", inputTokens: 120, outputTokens: 18, projectId, purpose: "view-caption-classify" });
    expect(byOutcome.FIXTURE_MISSING).toMatchObject({ inputTokens: null, outputTokens: null });
    expect(byOutcome.MALFORMED).toMatchObject({ inputTokens: 3, outputTokens: 1, purpose: "malformed" });
    if (proposed.out.ok) expect(byOutcome.PROPOSED?.id).toBe(proposed.out.proposal.callId);
    expect(rows.every((r) => r.tenantId === tenantId && r.model === "claude-sonnet-5" && /^[0-9a-f]{64}$/.test(r.requestHash))).toBe(true);
  });

  it("refuses to attribute a call to another tenant's project — the composite FK, not convention", async () => {
    const [t] = await runAsSystem("make a foreign project", (tx) =>
      tx.insert(schema.tenants).values({ name: "dbspec ledger other", slug: `dbspec-ledger-o-${crypto.randomUUID()}` }).returning(),
    );
    if (!t) throw new Error("setup failed");
    await mintTenantRuleSetTemplate(mintTenantCtx(t.id));
    const other = await createProject(mintTenantCtx(t.id), { name: "other" });
    let refused: unknown;
    try {
      await callModel(
        { ctx: mintTenantCtx(tenantId), model: "claude-sonnet-5", purpose: "x", system: "s", input: "i", payload, resolve: () => true },
        { transport: fixtureTransport(fixtures), record: dbRecorder(mintTenantCtx(tenantId), other.id) },
      );
    } catch (err) {
      refused = err;
    }
    const messages: string[] = [];
    for (let e = refused; e instanceof Error; e = e.cause) messages.push(e.message);
    expect(messages.join(" | ")).toMatch(/foreign key/i);
    await runAsSystem("teardown foreign project", async (tx) => {
      await tx.delete(schema.projects).where(eq(schema.projects.id, other.id));
      await tx.delete(schema.ruleSetEditionParameters).where(eq(schema.ruleSetEditionParameters.tenantId, t.id));
      await tx.delete(schema.ruleSetEditionMethods).where(eq(schema.ruleSetEditionMethods.tenantId, t.id));
      await tx.delete(schema.ruleSetEditions).where(eq(schema.ruleSetEditions.tenantId, t.id));
      await tx.delete(schema.tenants).where(eq(schema.tenants.id, t.id));
    });
  });
});
