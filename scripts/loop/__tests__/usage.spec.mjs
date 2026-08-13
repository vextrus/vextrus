import { describe, expect, it } from "vitest";

import { CONTEXT_LINE, flagPile, overLine, parseWorkerOutput } from "../usage.mjs";

/**
 * Fixtures are the shapes measured from the real CLI on the Windows workstation at `c0cd8f1`
 * (see usage.mjs's header for the probe and its numbers), not invented ones.
 */
const assistant = (input, read, create) =>
  JSON.stringify({
    type: "assistant",
    message: { usage: { input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: create } },
  });

const result = (extra = {}) =>
  JSON.stringify({
    type: "result",
    subtype: "success",
    num_turns: 2,
    total_cost_usd: 0.14,
    modelUsage: { "claude-opus-5[1m]": { contextWindow: 1_000_000 } },
    ...extra,
  });

describe("parseWorkerOutput — the stream shape", () => {
  it("takes the peak across messages, not the last and not the sum", () => {
    // Monotonic growth is the normal case; the peak is the last. Asserted explicitly so a change
    // to "use the final message" does not pass by coincidence.
    const out = parseWorkerOutput([assistant(2, 14065, 2), assistant(2, 14100, 46), result()].join("\n"));
    expect(out.ctxSeries).toEqual([14069, 14148]);
    expect(out.ctxPeak).toBe(14148);
  });

  it("takes the peak when a session compacts and context falls back", () => {
    const out = parseWorkerOutput([assistant(1, 900, 0), assistant(1, 200_000, 0), assistant(1, 5_000, 0), result()].join("\n"));
    expect(out.ctxPeak).toBe(200_001);
  });

  it("reads turns, cost, outcome and the window off the result event", () => {
    const out = parseWorkerOutput([assistant(2, 100, 0), result()].join("\n"));
    expect(out.turns).toBe(2);
    expect(out.costUsd).toBe(0.14);
    expect(out.workerResult).toBe("success");
    expect(out.ctxWindow).toBe(1_000_000);
  });

  it("reads permission denials off the result, and null when the result never came", () => {
    // Under the dontAsk spawn line a refusal is data, not a hang. Empty array means "nothing
    // refused"; null means "no result record", which must never read as a clean bill.
    const denied = parseWorkerOutput(
      [assistant(2, 100, 0), result({ permission_denials: [{ tool_name: "WebSearch" }] })].join("\n"),
    );
    expect(denied.permissionDenials).toEqual([{ tool_name: "WebSearch" }]);
    expect(parseWorkerOutput([assistant(2, 100, 0), result()].join("\n")).permissionDenials).toBeNull();
    expect(parseWorkerOutput(assistant(2, 100, 0)).permissionDenials).toBeNull();
  });

  it("skips non-JSON lines rather than losing the run", () => {
    const out = parseWorkerOutput(["a stray warning on stdout", assistant(2, 500, 0), "", result()].join("\n"));
    expect(out.ctxPeak).toBe(502);
    expect(out.turns).toBe(2);
  });
});

describe("parseWorkerOutput — degrading to the single-object shape", () => {
  it("falls back to usage.iterations when there is no per-message stream", () => {
    // The old --output-format json. iterations is PARTIAL (measured: 1 entry for 2 turns), so this
    // is a floor on the peak and is used only when the stream gave nothing.
    const single = JSON.stringify({
      type: "result",
      subtype: "success",
      num_turns: 2,
      total_cost_usd: 0.14,
      usage: {
        input_tokens: 4,
        cache_read_input_tokens: 23_391,
        iterations: [{ input_tokens: 2, cache_read_input_tokens: 14_065, cache_creation_input_tokens: 82 }],
      },
      modelUsage: { "claude-opus-5[1m]": { contextWindow: 1_000_000 } },
    });
    const out = parseWorkerOutput(single);
    expect(out.ctxPeak).toBe(14_149);
    expect(out.turns).toBe(2);
  });

  it("never reads the cumulative top-level usage as a context size", () => {
    // The trap this module exists for: top-level cache_read was 23,391 on a session whose real
    // peak was 14,148. If that number ever appears as ctxPeak, the flag pile is lying.
    const single = JSON.stringify({
      type: "result",
      num_turns: 2,
      usage: { input_tokens: 4, cache_read_input_tokens: 23_391, cache_creation_input_tokens: 4_821 },
    });
    expect(parseWorkerOutput(single).ctxPeak).toBeNull();
  });
});

describe("parseWorkerOutput — nothing to read", () => {
  it("returns null context for empty output, never zero", () => {
    for (const input of ["", "   ", undefined, null]) {
      expect(parseWorkerOutput(input).ctxPeak).toBeNull();
    }
  });

  it("returns null context for output that is not JSON at all", () => {
    const out = parseWorkerOutput("bubblewrap is required for subprocess env scrubbing\nstack trace here");
    expect(out.ctxPeak).toBeNull();
    expect(out.turns).toBeNull();
  });
});

describe("the context line", () => {
  it("is the number .wayfinder/TRACKER.md already states, not a second one", () => {
    expect(CONTEXT_LINE).toBe(150_000);
  });

  it("flags at and above the line, not below", () => {
    expect(overLine(CONTEXT_LINE - 1)).toBe(false);
    expect(overLine(CONTEXT_LINE)).toBe(true);
    expect(overLine(CONTEXT_LINE + 1)).toBe(true);
  });

  it("never flags an unmeasured session", () => {
    expect(overLine(null)).toBe(false);
  });
});

describe("flagPile", () => {
  const entry = (ticket, ctxPeak, event = "advance") => ({
    event,
    ticket,
    ctxPeak,
    ctxWindow: 1_000_000,
    turns: 40,
  });

  it("lists sessions over the line, worst first, with the window fraction", () => {
    const pile = flagPile([entry("a.md", 160_000), entry("b.md", 900_000), entry("c.md", 10_000)]);
    expect(pile.indexOf("b.md")).toBeLessThan(pile.indexOf("a.md"));
    expect(pile).not.toContain("c.md");
    expect(pile).toContain("90% of window");
  });

  it("says so in words when nothing crossed", () => {
    // A blank space cannot distinguish "none crossed" from "nobody measured".
    const pile = flagPile([entry("a.md", 10_000)]);
    expect(pile).toMatch(/none/);
    expect(pile).toMatch(/1,50,000/); // lakh grouping — CLAUDE.md bans en-US grouping
  });

  it("reports unmeasured sessions separately from clean ones", () => {
    const pile = flagPile([entry("a.md", null), entry("b.md", 10_000)]);
    expect(pile).toMatch(/unmeasured is not the same\s+as under the line/);
    expect(pile).toContain("a.md");
  });

  it("flags a session that failed a gate or got stuck, not only ones that advanced", () => {
    const pile = flagPile([entry("a.md", 200_000, "gate-fail"), entry("b.md", 300_000, "stuck")]);
    expect(pile).toContain("a.md");
    expect(pile).toContain("b.md");
  });

  it("ignores bookkeeping entries that carry no ticket", () => {
    const pile = flagPile([{ event: "start", caps: {} }, { event: "end", advanced: 2 }]);
    expect(pile).toMatch(/none/);
  });
});
