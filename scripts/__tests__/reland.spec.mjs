import { describe, expect, it } from "vitest";

import { classify, summarize } from "../reland.mjs";

const pr = (mergeStateStatus, extra = {}) => ({ number: 1, mergeStateStatus, isDraft: false, ...extra });

describe("classify", () => {
  it("updates a PR that is only behind main — the case the wave produced nine times", () => {
    expect(classify(pr("BEHIND")).action).toBe("update");
  });

  it("reports a conflict and never claims it can fix one", () => {
    const { action, reason } = classify(pr("DIRTY"));
    expect(action).toBe("conflict");
    expect(reason).toMatch(/never/);
  });

  it("leaves an up-to-date PR alone whatever its checks say", () => {
    // Updating a BLOCKED branch restarts CI for no reason and hides why it is blocked.
    for (const state of ["CLEAN", "BLOCKED", "UNSTABLE"]) {
      expect(classify(pr(state)).action).toBe("skip");
    }
  });

  it("does not act on a mergeability GitHub has not computed", () => {
    const { action, reason } = classify(pr("UNKNOWN"));
    expect(action).toBe("skip");
    expect(reason).toMatch(/re-run/);
  });

  it("skips a draft even when it is behind", () => {
    expect(classify(pr("BEHIND", { isDraft: true })).action).toBe("skip");
  });

  it("skips rather than guesses on a state it does not know", () => {
    expect(classify(pr("HAS_HOOKS")).action).toBe("skip");
    expect(classify(pr("SOMETHING_NEW")).action).toBe("skip");
  });
});

describe("summarize", () => {
  it("counts every outcome", () => {
    expect(
      summarize([
        { outcome: "updated" },
        { outcome: "updated" },
        { outcome: "conflict" },
        { outcome: "skipped" },
        { outcome: "failed" },
      ]),
    ).toEqual({ updated: 2, conflict: 1, skipped: 1, failed: 1 });
  });

  it("counts an empty run as all zeroes", () => {
    expect(summarize([])).toEqual({ updated: 0, conflict: 0, skipped: 0, failed: 0 });
  });
});
