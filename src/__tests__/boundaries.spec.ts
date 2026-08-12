import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/**
 * The boundary rules must FAIL CLOSED. The legacy repo's boundary plugin
 * silently reported zero violations twice when misconfigured; this test makes
 * that failure mode impossible to miss — if the config stops firing, verify
 * goes red.
 */
const eslint = new ESLint({ cwd: process.cwd() });

async function boundaryErrors(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter(
    (m) => m.ruleId === "no-restricted-imports",
  );
}

describe("module boundaries", () => {
  it("flags a deep cross-module import", async () => {
    const errors = await boundaryErrors(
      "src/modules/takeoff/some-file.ts",
      "import { secret } from '@/modules/book/internal/secret';\n",
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("allows importing a module's public index", async () => {
    const errors = await boundaryErrors(
      "src/modules/takeoff/some-file.ts",
      "import * as book from '@/modules/book';\n",
    );
    expect(errors).toHaveLength(0);
  });

  it("flags core importing any module, even the public index", async () => {
    const errors = await boundaryErrors(
      "src/core/some-file.ts",
      "import * as book from '@/modules/book';\n",
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("flags a deep import from app code", async () => {
    const errors = await boundaryErrors(
      "src/app/page-helper.ts",
      "import { x } from '@/modules/estimate/documents/pdf';\n",
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});

/**
 * The comparator rule fails closed for the same reason: identity is derived
 * from sorted strings, so a lint that stops firing lets a locale-dependent
 * order back onto the frozen-ordinal path without anyone noticing
 * (.wayfinder/harness ticket 11).
 */
async function comparatorErrors(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-syntax");
}

describe("the canonical comparator", () => {
  it("flags localeCompare in core", async () => {
    const errors = await comparatorErrors(
      "src/core/some-file.ts",
      "export const cmp = (a: string, b: string) => a.localeCompare(b);\n",
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("flags localeCompare in a module", async () => {
    const errors = await comparatorErrors(
      "src/modules/takeoff/some-file.ts",
      "export const s = (xs: string[]) => [...xs].sort((a, b) => a.localeCompare(b));\n",
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("allows compareCanonical and a bare sort", async () => {
    const errors = await comparatorErrors(
      "src/modules/takeoff/some-file.ts",
      "import { compareCanonical } from '@/core/order';\n" +
        "export const s = (xs: string[]) => [...xs].sort(compareCanonical);\n" +
        "export const t = (xs: string[]) => [...xs].sort();\n",
    );
    expect(errors).toHaveLength(0);
  });
});
