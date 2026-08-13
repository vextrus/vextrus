import { describe, expect, it } from "vitest";

import { plan } from "../promote.mjs";

/**
 * The allocator's whole job is to make an invisible collision impossible. The case that forced it
 * is reproduced verbatim in "the measured collision" below: two sessions, same two numbers, no
 * git conflict (docs/specs/cloud-campaign.md §1).
 */

const header = (extra = "") => `Status: open\nBlocked by:${extra}\nClaimed by:\n`;
const ticket = (name, extra) => ({ name, text: `# ${name}\n\nwayfinder:grilling\n${header(extra)}\n## Objective\n` });

describe("plan — allocation", () => {
  it("numbers from one past the highest existing ticket, in filename order", () => {
    const { refusals, moves } = plan(
      [ticket("the-dimension-annotation-lane.md"), ticket("a-lane-fidelity-declaration.md")],
      ["01-first.md", "09-ninth.md"],
    );
    expect(refusals).toEqual([]);
    expect(moves.map((m) => m.to)).toEqual([
      "10-a-lane-fidelity-declaration.md",
      "11-the-dimension-annotation-lane.md",
    ]);
  });

  it("never re-issues a number left by a deleted ticket", () => {
    // Highest, not count: re-issuing 03 would make an old `Blocked by: 03-...md` resolve to a
    // different ticket, silently — the exact class of fault this script exists to prevent.
    const { moves } = plan([ticket("new-work.md")], ["01-a.md", "04-d.md"]);
    expect(moves[0].to).toBe("05-new-work.md");
  });

  it("widens the number when the effort passes 99", () => {
    const { moves } = plan([ticket("new-work.md")], ["99-last.md"]);
    expect(moves[0].to).toBe("100-new-work.md");
  });

  it("allocates from zero on an effort with no numbered tickets", () => {
    const { moves } = plan([ticket("first-ever.md")], []);
    expect(moves[0].to).toBe("01-first-ever.md");
  });
});

describe("plan — the measured collision", () => {
  it("gives two same-slug-free inbox tickets from different sessions distinct numbers", () => {
    // Both sessions minted into the inbox against the same base (22 tickets). Merged, the inbox
    // holds all four; one promotion run numbers them 23..26 with no overlap. Under the old rule
    // both branches wrote 23- and 24- and git merged all four without a conflict.
    const inbox = [
      ticket("the-lane-fidelity-declaration.md"),
      ticket("who-decomposes-a-pdf-page.md"),
      ticket("the-effective-resolution-gate.md"),
      ticket("the-dimension-annotation-lane.md"),
    ];
    const existing = Array.from({ length: 22 }, (_, i) => `${String(i + 1).padStart(2, "0")}-t.md`);
    const { refusals, moves } = plan(inbox, existing);

    expect(refusals).toEqual([]);
    const numbers = moves.map((m) => m.to.slice(0, 2));
    expect(new Set(numbers).size).toBe(4);
    expect(numbers.sort()).toEqual(["23", "24", "25", "26"]);
  });
});

describe("plan — Blocked by rewriting", () => {
  it("rewrites an edge naming another inbox ticket by slug", () => {
    const { refusals, moves } = plan(
      [ticket("a-first.md"), ticket("b-second.md", " a-first.md")],
      ["01-existing.md"],
    );
    expect(refusals).toEqual([]);
    expect(moves.find((m) => m.from === "b-second.md").text).toContain("Blocked by: 02-a-first.md");
  });

  it("accepts a slug written without the .md extension", () => {
    const { refusals, moves } = plan([ticket("a-first.md"), ticket("b-second.md", " a-first")], []);
    expect(refusals).toEqual([]);
    expect(moves.find((m) => m.from === "b-second.md").text).toContain("Blocked by: 01-a-first.md");
  });

  it("leaves an edge to an already-numbered existing ticket alone", () => {
    const { refusals, moves } = plan([ticket("new-work.md", " 07-raster.md")], ["07-raster.md"]);
    expect(refusals).toEqual([]);
    expect(moves[0].text).toContain("Blocked by: 07-raster.md");
  });

  it("rewrites every target on a multi-blocker line", () => {
    const { moves } = plan(
      [ticket("a-first.md"), ticket("z-last.md", " a-first.md, 07-raster.md")],
      ["07-raster.md"],
    );
    // 08, not 01: `07-raster.md` already exists, so allocation starts past it.
    expect(moves.find((m) => m.from === "z-last.md").text).toContain("Blocked by: 08-a-first.md, 07-raster.md");
  });

  it("leaves an empty Blocked by line untouched", () => {
    const { moves } = plan([ticket("new-work.md")], []);
    expect(moves[0].text).toContain("Blocked by:\n");
  });

  it("refuses a dangling edge rather than promoting a stalled ticket", () => {
    const { refusals, moves } = plan([ticket("new-work.md", " 99-does-not-exist.md")], ["01-a.md"]);
    expect(moves).toEqual([]);
    expect(refusals.join("\n")).toMatch(/99-does-not-exist\.md.*neither an existing ticket nor another/s);
  });
});

describe("plan — refusals", () => {
  it("refuses a ticket that already carries a number", () => {
    const { refusals, moves } = plan([ticket("23-the-lane-fidelity-declaration.md")], []);
    expect(moves).toEqual([]);
    expect(refusals.join("\n")).toMatch(/already carries a number/);
  });

  it("refuses a ticket with no tracker header", () => {
    const { refusals } = plan([{ name: "bare.md", text: "# Bare\n\nno fields here\n" }], []);
    expect(refusals.join("\n")).toMatch(/Status:/);
    expect(refusals.join("\n")).toMatch(/Claimed by:/);
  });

  it("refuses a ticket claimed while still in the inbox", () => {
    const t = ticket("new-work.md");
    t.text = t.text.replace("Claimed by:", "Claimed by: some-container");
    const { refusals, moves } = plan([t], []);
    expect(moves).toEqual([]);
    expect(refusals.join("\n")).toMatch(/claimed by some-container while still in the inbox/);
  });

  it("moves nothing at all when any one ticket is refused", () => {
    // A half-promoted inbox is a graph with dangling edges.
    const { refusals, moves } = plan([ticket("good.md"), ticket("07-bad.md")], []);
    expect(refusals).toHaveLength(1);
    expect(moves).toEqual([]);
  });

  it("reports every refusal, not just the first", () => {
    const { refusals } = plan([ticket("01-bad.md"), ticket("02-also-bad.md")], []);
    expect(refusals).toHaveLength(2);
  });

  it("ignores a bold **Status:** inside a body — a label is not a field", () => {
    const t = { name: "bodied.md", text: `# T\n\n${header()}\n## Objective\n\n**Status:** closed in spirit\n` };
    const { refusals, moves } = plan([t], []);
    expect(refusals).toEqual([]);
    expect(moves).toHaveLength(1);
  });
});
