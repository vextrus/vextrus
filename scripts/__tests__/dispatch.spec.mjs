import { describe, expect, it } from "vitest";

import { awaitingClick, renderPrompt, setClaim, slugOf } from "../dispatch.mjs";

describe("slugOf", () => {
  it("strips the number and the extension, keeps the slug", () => {
    expect(slugOf(".wayfinder/takeoff/tickets/18-what-fills-a-cloud-session.md")).toBe("what-fills-a-cloud-session");
    expect(slugOf("tickets\\07-the-quantity-register.md")).toBe("the-quantity-register");
  });

  it("leaves an unnumbered name alone — inbox tickets have no number to strip", () => {
    expect(slugOf("inbox/a-slug-only-ticket.md")).toBe("a-slug-only-ticket");
  });
});

describe("setClaim — a claim is set once, on an open ticket, or not at all", () => {
  const ticket = (status, claim) => `# T\n\nwayfinder:task\nStatus: ${status}\nBlocked by:\nClaimed by:${claim}\n\n## Objective\n`;

  it("claims an open, unclaimed ticket", () => {
    const r = setClaim(ticket("open", ""), "claude/some-branch");
    expect(r.refusal).toBeUndefined();
    expect(r.text).toContain("Claimed by: claude/some-branch");
  });

  it("refuses a ticket that is already claimed — a second dispatch is a collision", () => {
    const r = setClaim(ticket("open", " conductor r1"), "claude/x");
    expect(r.refusal).toMatch(/already claimed by 'conductor r1'/);
    expect(r.text).toBeUndefined();
  });

  it("refuses a ticket that is not open", () => {
    expect(setClaim(ticket("closed", ""), "x").refusal).toMatch(/not open/);
  });

  it("refuses text with no tracker fields — not everything .md is a ticket", () => {
    expect(setClaim("# just prose\n", "x").refusal).toMatch(/Status/);
    expect(setClaim("Status: open\n", "x").refusal).toMatch(/Claimed by/);
  });

  it("ignores a bold **Status:** label in a body — column-0 fields only", () => {
    const text = "**Status:** closed in prose\nStatus: open\nClaimed by:\n";
    expect(setClaim(text, "x").refusal).toBeUndefined();
  });
});

describe("renderPrompt", () => {
  it("names the ticket, the branch, and the rules that outrank the runner", () => {
    const p = renderPrompt({ ticketPath: ".wayfinder/harness/tickets/19-x.md", branch: "claude/x" });
    expect(p).toContain(".wayfinder/harness/tickets/19-x.md");
    expect(p).toContain("claude/x");
    expect(p).toMatch(/check it out and never leave it/);
    expect(p).toMatch(/never merge your own PR/);
    expect(p).toMatch(/## Stuck/);
  });

  it("tells a cloud session the claim is the lock, not the branch", () => {
    // A cloud runner creates its own branch regardless of what was pre-pushed; telling the
    // session to check out a dispatcher branch there would contradict its own environment.
    const p = renderPrompt({ ticketPath: "tickets/19-x.md", branch: "claude/x", cloud: true });
    expect(p).toMatch(/the claim, not the branch, is the lock/);
    expect(p).toContain("claimed on main as claude/x");
    expect(p).not.toMatch(/check it out/);
    expect(p).toMatch(/never merge your own PR/);
  });
});

describe("awaitingClick — the click queue is the report", () => {
  const pr = (number, mergeStateStatus, isDraft = false) => ({ number, title: `t${number}`, mergeStateStatus, isDraft });

  it("buckets by what each PR actually waits on", () => {
    const b = awaitingClick([pr(1, "CLEAN"), pr(2, "BLOCKED"), pr(3, "DIRTY"), pr(4, "CLEAN", true), pr(5, "BEHIND")]);
    expect(b.click.map((p) => p.number)).toEqual([1]);
    expect(b.checks.map((p) => p.number)).toEqual([2, 5]);
    expect(b.conflict.map((p) => p.number)).toEqual([3]);
    expect(b.draft.map((p) => p.number)).toEqual([4]);
  });

  it("never guesses an unhandled state into the click queue", () => {
    const b = awaitingClick([pr(9, "UNKNOWN")]);
    expect(b.click).toEqual([]);
    expect(b.unknown.map((p) => p.number)).toEqual([9]);
  });
});
