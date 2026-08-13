import { describe, expect, it } from "vitest";

import { setClaim, slugOf } from "../dispatch.mjs";

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
    const r = setClaim(ticket("open", ""), "dispatched 2026-08-14");
    expect(r.refusal).toBeUndefined();
    expect(r.text).toContain("Claimed by: dispatched 2026-08-14");
  });

  it("refuses a ticket that is already claimed — a second dispatch is a collision", () => {
    const r = setClaim(ticket("open", " conductor r1"), "dispatched 2026-08-14");
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
