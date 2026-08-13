import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * frontier.mjs is the fail-closed query the whole tracker rests on — the loop picks work with it,
 * and a wrong answer either stalls a campaign or hands two sessions the same ticket. It was landed
 * untested and stayed that way through three efforts (docs/specs/cloud-campaign.md §8).
 *
 * These drive the CLI rather than an extracted function, on purpose. The script already exists and
 * is load-bearing; extracting a pure core in the same change as its first test would mean the
 * tests validate the refactor instead of the behaviour that has been running. Exit codes are half
 * the contract here (conduct.mjs branches on 3 vs 4 vs 1), and only the CLI has them. A pure core
 * can be extracted later — guarded by these.
 */

const SCRIPT = path.resolve(import.meta.dirname, "../frontier.mjs");
const dirs = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

/** A ticket directory from `{ filename: "Status: ...\nBlocked by: ...\nClaimed by: ..." }`. */
function ticketDir(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "frontier-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
  return dir;
}

const t = ({ status = "open", blocked = "", claimed = "" } = {}) =>
  `# A ticket\n\nwayfinder:grilling\nStatus: ${status}\nBlocked by: ${blocked}\nClaimed by: ${claimed}\n\n## Objective\n`;

function run(dir, ...args) {
  const r = spawnSync(process.execPath, [SCRIPT, dir, ...args], { encoding: "utf8" });
  return { code: r.status, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
const names = (out) => (out === "" ? [] : out.split("\n").map((l) => l.split("/").pop()));

describe("the frontier", () => {
  it("prints the first frontier ticket and exits 0", () => {
    const dir = ticketDir({ "01-a.md": t(), "02-b.md": t() });
    const r = run(dir);
    expect(r.code).toBe(0);
    expect(names(r.out)).toEqual(["01-a.md"]);
  });

  it("--list prints every frontier ticket", () => {
    const dir = ticketDir({ "01-a.md": t(), "02-b.md": t(), "03-c.md": t({ status: "closed" }) });
    const r = run(dir, "--list");
    expect(r.code).toBe(0);
    expect(names(r.out)).toEqual(["01-a.md", "02-b.md"]);
  });

  it("breaks ties by filename, not by directory order", () => {
    const dir = ticketDir({ "20-t.md": t(), "03-c.md": t(), "10-j.md": t() });
    expect(names(run(dir, "--list").out)).toEqual(["03-c.md", "10-j.md", "20-t.md"]);
  });

  it("emits forward slashes even on Windows, so a path can be handed to git", () => {
    const dir = ticketDir({ "01-a.md": t() });
    expect(run(dir).out).not.toContain("\\");
  });
});

describe("blocking", () => {
  it("withholds a ticket whose blocker is still open", () => {
    const dir = ticketDir({ "01-a.md": t(), "02-b.md": t({ blocked: "01-a.md" }) });
    expect(names(run(dir, "--list").out)).toEqual(["01-a.md"]);
  });

  it("releases a ticket once every blocker is closed", () => {
    const dir = ticketDir({ "01-a.md": t({ status: "closed" }), "02-b.md": t({ blocked: "01-a.md" }) });
    expect(names(run(dir, "--list").out)).toEqual(["02-b.md"]);
  });

  it("requires ALL blockers closed, not any", () => {
    const dir = ticketDir({
      "01-a.md": t({ status: "closed" }),
      "02-b.md": t(),
      "03-c.md": t({ blocked: "01-a.md, 02-b.md" }),
    });
    expect(names(run(dir, "--list").out)).toEqual(["02-b.md"]);
  });

  it("accepts blockers separated by commas or whitespace", () => {
    const dir = ticketDir({
      "01-a.md": t({ status: "closed" }),
      "02-b.md": t({ status: "closed" }),
      "03-c.md": t({ blocked: "01-a.md 02-b.md" }),
    });
    expect(names(run(dir, "--list").out)).toEqual(["03-c.md"]);
  });

  it("fails CLOSED on a blocker that does not exist", () => {
    // The whole point: an unreadable blocker blocks. A dangling edge must never release work.
    const dir = ticketDir({ "01-a.md": t({ blocked: "99-gone.md" }) });
    const r = run(dir);
    expect(r.code).toBe(4);
    expect(r.err).toMatch(/blocked by 99-gone\.md/);
  });

  it("fails CLOSED on a blocker with no tracker status", () => {
    const dir = ticketDir({ "01-a.md": t({ blocked: "02-b.md" }), "02-b.md": "# no fields at all\n" });
    expect(run(dir).code).toBe(4);
  });
});

describe("claims", () => {
  it("withholds a claimed ticket and names the claimant", () => {
    const dir = ticketDir({ "01-a.md": t({ claimed: "container-7" }) });
    const r = run(dir);
    expect(r.code).toBe(4);
    expect(r.err).toMatch(/claimed by container-7/);
  });

  it("treats a whitespace-only claim as unclaimed", () => {
    const dir = ticketDir({ "01-a.md": t({ claimed: "   " }) });
    expect(run(dir).code).toBe(0);
  });
});

describe("field parsing — a label in a body is not a field", () => {
  it("ignores a bold **Status:** inside the body", () => {
    const dir = ticketDir({
      "01-a.md": `# T\n\nStatus: open\nBlocked by:\nClaimed by:\n\n## Notes\n\n**Status:** closed in spirit\n`,
    });
    expect(run(dir).code).toBe(0);
  });

  it("ignores an indented Status:, which is not at column 0", () => {
    const dir = ticketDir({ "01-a.md": `# T\n\n  Status: open\nBlocked by:\nClaimed by:\n` });
    // No field at column 0 means no status, which is not "open" — so it is not on the frontier.
    expect(run(dir).code).toBe(3);
  });

  it("matches Status case-insensitively in its value", () => {
    const dir = ticketDir({ "01-a.md": t({ status: "OPEN" }) });
    expect(run(dir).code).toBe(0);
  });

  it("reads only .md files", () => {
    const dir = ticketDir({ "01-a.md": t({ status: "closed" }), "notes.txt": t() });
    expect(run(dir).code).toBe(3);
  });
});

describe("exit codes — conduct.mjs branches on these", () => {
  it("exits 3 and says complete when no ticket is open", () => {
    const dir = ticketDir({ "01-a.md": t({ status: "closed" }), "02-b.md": t({ status: "closed" }) });
    const r = run(dir);
    expect(r.code).toBe(3);
    expect(r.err).toMatch(/complete/);
    expect(r.out).toBe("");
  });

  it("exits 4 and says stalled when tickets are open but none is frontier", () => {
    const dir = ticketDir({ "01-a.md": t({ claimed: "x" }), "02-b.md": t({ blocked: "01-a.md" }) });
    const r = run(dir);
    expect(r.code).toBe(4);
    expect(r.err).toMatch(/stalled/);
    expect(r.err).toMatch(/01-a\.md: claimed by x/);
    expect(r.err).toMatch(/02-b\.md: blocked by 01-a\.md/);
    expect(r.out).toBe("");
  });

  it("exits 1 with usage when given no directory", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/usage:/);
  });

  it("exits 1 when the directory cannot be read", () => {
    const r = spawnSync(process.execPath, [SCRIPT, path.join(tmpdir(), "no-such-dir-frontier")], {
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/cannot read directory/);
  });

  it("exits 3 on an empty directory — nothing open is complete, not an error", () => {
    expect(run(ticketDir({})).code).toBe(3);
  });
});

describe("the live tracker", () => {
  it("answers the real takeoff directory without crashing", () => {
    // A canary against a field-format drift that the synthetic fixtures above would not catch.
    const real = path.resolve(import.meta.dirname, "../../../.wayfinder/takeoff/tickets");
    const r = run(real, "--list");
    expect([0, 3, 4]).toContain(r.code);
    if (r.code === 0) expect(r.out).toMatch(/\.wayfinder\/takeoff\/tickets\//);
  });
});
