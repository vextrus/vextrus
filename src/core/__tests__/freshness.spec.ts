import { describe, expect, it } from "vitest";
import { CAMPAIGN_FRESHNESS_REFUSALS, CAMPAIGN_PINS } from "@/core/enums";
import { campaignFreshnessOf, type CampaignPins } from "@/core/freshness";
import { compareCanonical } from "@/core/order";

/**
 * The diff, without a database (identity.md §8, amended 2026-08-16: *staleness is a diff, never a
 * flag*). What the live seam adds is where the two sides come from; the verdict itself is a pure
 * comparison and is proven here, including that each pin moves the verdict on its own.
 */

const PINNED: CampaignPins = {
  ruleSetEditionId: "0f8f0b1e-0000-4000-8000-000000000001",
  catalogueDigest: "a".repeat(64),
};

describe("the freshness verdict (identity.md §8)", () => {
  it("returns current before anything moves", () => {
    expect(campaignFreshnessOf(PINNED, { ...PINNED })).toEqual({ verdict: "CURRENT" });
  });

  it("returns stale when the rule-set edition advances, naming that pin alone", () => {
    expect(
      campaignFreshnessOf(PINNED, { ...PINNED, ruleSetEditionId: "0f8f0b1e-0000-4000-8000-000000000002" }),
    ).toEqual({ verdict: "STALE", reason: "PIN_STALE", moved: ["RULE_SET_EDITION"] });
  });

  it("returns stale when the catalogue digest moves, naming that pin alone", () => {
    expect(campaignFreshnessOf(PINNED, { ...PINNED, catalogueDigest: "b".repeat(64) })).toEqual({
      verdict: "STALE",
      reason: "PIN_STALE",
      moved: ["CATALOGUE"],
    });
  });

  it("names every pin that moved when both did — a verdict states what moved, not that something did", () => {
    const verdict = campaignFreshnessOf(PINNED, {
      ruleSetEditionId: "0f8f0b1e-0000-4000-8000-000000000002",
      catalogueDigest: "b".repeat(64),
    });
    expect(verdict).toEqual({ verdict: "STALE", reason: "PIN_STALE", moved: ["CATALOGUE", "RULE_SET_EDITION"] });
    // Canonically ordered, so the re-pin act that reads this list reads it the same way twice.
    if (verdict.verdict !== "STALE") throw new Error("expected the stale verdict");
    expect([...verdict.moved]).toEqual([...verdict.moved].sort(compareCanonical));
  });

  it("carries PIN_STALE from the closed vocabulary, never as prose", () => {
    const verdict = campaignFreshnessOf(PINNED, { ...PINNED, catalogueDigest: "c".repeat(64) });
    if (verdict.verdict !== "STALE") throw new Error("expected the stale verdict");
    expect(CAMPAIGN_FRESHNESS_REFUSALS).toContain(verdict.reason);
    // Every named mover is a member of the closed pin vocabulary too.
    expect(verdict.moved.every((pin) => CAMPAIGN_PINS.includes(pin))).toBe(true);
  });
});
