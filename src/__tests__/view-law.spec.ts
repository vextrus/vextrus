import { readFileSync } from "node:fs";
import path from "node:path";
import { glob } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { viewTypes } from "@/modules/takeoff";

/**
 * The view law's single decision site (cad-ingestion.md §7): "only
 * layout-plan-class views may yield instances" is decided by
 * `mayYieldInstances` in `src/modules/takeoff/views.ts` and NOWHERE else. A
 * second site is how the rule rots — one place is amended, the other keeps
 * counting a schedule as a plan, and nothing goes red.
 *
 * The check: outside the predicate's own file, no source file may name a view
 * type as a literal. Code that needs the countability decision imports the
 * predicate; code that needs a type carries the value. Tests may name types —
 * they must, to build the cases — so the law is enforced on shipped code.
 */

const HOME = path.join("src", "modules", "takeoff", "views.ts");

/** Pure so the check itself can be proven to fire (below). */
export function findDecisionSites(files: Array<{ path: string; text: string }>): string[] {
  const literal = new RegExp(`["'\`](?:${viewTypes.join("|")})["'\`]`);
  return files
    .filter((f) => {
      const normalized = f.path.replaceAll("\\", "/");
      if (normalized.endsWith(HOME.replaceAll("\\", "/"))) return false;
      if (/\.spec\.ts$|\/__tests__\//.test(normalized)) return false;
      return literal.test(f.text);
    })
    .map((f) => f.path);
}

describe("the view law's single decision site", () => {
  it("finds no second site in shipped source", async () => {
    const files: Array<{ path: string; text: string }> = [];
    for await (const file of glob("src/**/*.{ts,tsx}")) {
      files.push({ path: file, text: readFileSync(file, "utf-8") });
    }
    // The scan must actually have read the repo — an empty sweep would pass
    // vacuously, which is the failure mode this file exists to prevent.
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.path.replaceAll("\\", "/").endsWith(HOME.replaceAll("\\", "/")))).toBe(true);
    expect(findDecisionSites(files)).toEqual([]);
  });

  it("goes red when a second site is introduced", () => {
    const files = [
      { path: "src/modules/takeoff/views.ts", text: 'const t = "layout_plan";' },
      { path: "src/modules/takeoff/placement.ts", text: 'if (view.type === "layout_plan") count();' },
    ];
    expect(findDecisionSites(files)).toEqual(["src/modules/takeoff/placement.ts"]);
  });

  it("goes red on any view type, not just the countable one", () => {
    const files = [
      { path: "src/server/report.ts", text: 'if (v.type !== "schedule") emit(v);' },
    ];
    expect(findDecisionSites(files)).toEqual(["src/server/report.ts"]);
  });

  it("leaves code that imports the predicate alone", () => {
    const files = [
      {
        path: "src/modules/takeoff/placement.ts",
        text: "import { mayYieldInstances } from './views';\nif (mayYieldInstances(view.type)) count();",
      },
    ];
    expect(findDecisionSites(files)).toEqual([]);
  });
});
