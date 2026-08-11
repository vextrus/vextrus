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
