import { describe, expect, it } from "vitest";
import { drawingSetRevisionDigest } from "@/core/identity";
import { manifestChangesOf, repinStatementOf } from "@/core/repin";

/**
 * The re-pin statement, pure (identity.md §9): what moved between two manifests, what that costs
 * the work already done, and the content address a caller must carry back so the act cannot be
 * performed blind. Nothing here touches the database — the seam test is db/__tests__.
 */
const a = { drawingId: "d-a", drawingRevisionId: "r-a1" };
const b = { drawingId: "d-b", drawingRevisionId: "r-b1" };
const b2 = { drawingId: "d-b", drawingRevisionId: "r-b2" };
const c = { drawingId: "d-c", drawingRevisionId: "r-c1" };

const RULES_1 = "11111111-1111-4111-8111-111111111111";
const RULES_2 = "22222222-2222-4222-8222-222222222222";
const CAT_1 = "a".repeat(64);
const CAT_2 = "b".repeat(64);
const CAMPAIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** The outgoing side: one campaign pinned {a, b} under edition 1 and catalogue 1, unsigned. */
function outgoing(members: readonly { drawingId: string; drawingRevisionId: string }[] = [a, b]) {
  return {
    setDigest: drawingSetRevisionDigest(members),
    ruleSetEditionId: RULES_1,
    catalogueDigest: CAT_1,
  };
}

function statement(args: {
  members: readonly { drawingId: string; drawingRevisionId: string }[];
  ruleSetEditionId?: string;
  catalogueDigest?: string;
  outgoingSigned?: boolean;
  outgoingMembers?: readonly { drawingId: string; drawingRevisionId: string }[];
}) {
  const outgoingMembers = args.outgoingMembers ?? [a, b];
  return repinStatementOf({
    campaignId: CAMPAIGN,
    outgoing: outgoing(outgoingMembers),
    outgoingMembers,
    outgoingSigned: args.outgoingSigned ?? false,
    incoming: {
      setDigest: drawingSetRevisionDigest(args.members),
      ruleSetEditionId: args.ruleSetEditionId ?? RULES_1,
      catalogueDigest: args.catalogueDigest ?? CAT_1,
    },
    incomingMembers: args.members,
  });
}

describe("the member changes between two manifests (identity.md §9)", () => {
  it("names the added, the removed and the re-revved separately", () => {
    expect(manifestChangesOf([a, b], [a, b2, c])).toEqual({
      added: [c],
      removed: [],
      reRevved: [{ drawingId: "d-b", outgoingRevisionId: "r-b1", incomingRevisionId: "r-b2" }],
    });
    expect(manifestChangesOf([a, b], [a])).toEqual({ added: [], removed: [b], reRevved: [] });
  });

  it("is order-independent and canonically sorted — the changes go into a content address", () => {
    expect(manifestChangesOf([b, a], [c, a])).toEqual(manifestChangesOf([a, b], [a, c]));
    expect(manifestChangesOf([a], [c, b]).added.map((m) => m.drawingId)).toEqual(["d-b", "d-c"]);
  });

  it("reports nothing between two identical manifests", () => {
    expect(manifestChangesOf([a, b], [b, a])).toEqual({ added: [], removed: [], reRevved: [] });
  });
});

describe("the consequences, stated before the act (identity.md §9)", () => {
  it("names a widened denominator for an added member — the one that forbids an implicit re-pin", () => {
    expect(statement({ members: [a, b, c] }).consequences).toEqual(["DENOMINATOR_WIDENS"]);
  });

  it("names moved evidence for a re-revved or a removed member", () => {
    expect(statement({ members: [a, b2] }).consequences).toEqual(["EVIDENCE_MOVED"]);
    expect(statement({ members: [a] }).consequences).toEqual(["EVIDENCE_MOVED"]);
  });

  it("names both pins when both snapshots advance", () => {
    expect(statement({ members: [a, b], ruleSetEditionId: RULES_2, catalogueDigest: CAT_2 }).consequences).toEqual([
      "CATALOGUE_MOVES",
      "RULE_SET_EDITION_MOVES",
    ]);
  });

  it("voids a signature whole, and says so before it commits", () => {
    expect(statement({ members: [a, b, c], outgoingSigned: true }).consequences).toEqual([
      "DENOMINATOR_WIDENS",
      "SIGNATURE_VOIDS_WHOLE",
    ]);
  });

  it("refuses a re-pin that moves nothing — never a signature voided for nothing", () => {
    expect(() => statement({ members: [b, a] })).toThrow(/REPIN_NOTHING_MOVED/);
    // Signed and unchanged is the case the clause names: the void must not be the only consequence.
    expect(() => statement({ members: [a, b], outgoingSigned: true })).toThrow(/REPIN_NOTHING_MOVED/);
  });
});

describe("the statement's content address", () => {
  it("names the outgoing and incoming keys, so a reviewer reconstructs what moved", () => {
    const s = statement({ members: [a, b, c] });
    expect(s.outgoing).toEqual(outgoing());
    expect(s.incoming.setDigest).toBe(drawingSetRevisionDigest([a, b, c]));
    expect(s.campaignId).toBe(CAMPAIGN);
  });

  it("addresses the whole statement: two statements agree only when everything agrees", () => {
    expect(statement({ members: [a, b, c] }).digest).toBe(statement({ members: [c, b, a] }).digest);
    expect(statement({ members: [a, b, c] }).digest).toMatch(/^[0-9a-f]{64}$/);
    expect(statement({ members: [a, b, c] }).digest).not.toBe(
      statement({ members: [a, b, c], outgoingSigned: true }).digest,
    );
    expect(statement({ members: [a, b, c] }).digest).not.toBe(
      statement({ members: [a, b, c], catalogueDigest: CAT_2 }).digest,
    );
    expect(statement({ members: [a, b2, c] }).digest).not.toBe(statement({ members: [a, b, c] }).digest);
  });
});
