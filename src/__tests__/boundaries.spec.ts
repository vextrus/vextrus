import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/**
 * Every guardrail in eslint.config.js must FAIL CLOSED: if a rule stops firing, verify goes red.
 * (A boundary plugin that silently reported zero violations when misconfigured is a paid-for
 * lesson.) Each case lints a synthetic file at a path the rule scopes to.
 */
const eslint = new ESLint({ cwd: process.cwd() });

async function errors(filePath: string, code: string, ruleId: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId === ruleId);
}
const imports = (filePath: string, code: string) => errors(filePath, code, "no-restricted-imports");
const syntax = (filePath: string, code: string) => errors(filePath, code, "no-restricted-syntax");

describe("module boundaries (ADR-0001, ADR-0005)", () => {
  it("flags a deep cross-module import", async () => {
    expect(
      await imports("src/modules/takeoff/x.ts", "import { s } from '@/modules/book/internal/secret';\n"),
    ).not.toHaveLength(0);
  });
  it("allows a module's public index", async () => {
    expect(await imports("src/modules/takeoff/x.ts", "import * as book from '@/modules/book';\n")).toHaveLength(0);
  });
  it("flags core importing any module, even the public index", async () => {
    expect(await imports("src/core/x.ts", "import * as book from '@/modules/book';\n")).not.toHaveLength(0);
  });
  it("flags a deep import from app code", async () => {
    expect(await imports("src/app/x.ts", "import { x } from '@/modules/estimate/documents/pdf';\n")).not.toHaveLength(0);
  });
});

describe("the tenant seam (ADR-0004)", () => {
  it("flags the driver outside src/core/db.ts", async () => {
    expect(await imports("src/modules/takeoff/x.ts", "import postgres from 'postgres';\n")).not.toHaveLength(0);
    expect(await imports("src/app/x.ts", "import { drizzle } from 'drizzle-orm/postgres-js';\n")).not.toHaveLength(0);
  });
  it("flags the schema outside src/core/db.ts, by alias or relative path", async () => {
    expect(await imports("src/modules/takeoff/x.ts", "import { projects } from '../../../db/schema/core';\n")).not.toHaveLength(0);
    expect(await imports("src/core/x.ts", "import * as s from '../../db/schema/core';\n")).not.toHaveLength(0);
  });
  it("allows the seam itself", async () => {
    expect(
      await imports(
        "src/core/db.ts",
        "import postgres from 'postgres';\nimport * as schema from '../../db/schema/core';\n",
      ),
    ).toHaveLength(0);
  });
});

describe("the model seam (ADR-0006)", () => {
  it("flags the SDK outside src/core/model.ts", async () => {
    expect(await imports("src/modules/takeoff/x.ts", "import Anthropic from '@anthropic-ai/sdk';\n")).not.toHaveLength(0);
    expect(await imports("src/core/x.ts", "import Anthropic from '@anthropic-ai/sdk';\n")).not.toHaveLength(0);
  });
  it("allows the seam itself", async () => {
    expect(await imports("src/core/model.ts", "import Anthropic from '@anthropic-ai/sdk';\n")).toHaveLength(0);
  });
});

describe("the canonical comparator (identity.md §4)", () => {
  it("flags localeCompare in core and in a module", async () => {
    expect(await syntax("src/core/x.ts", "export const c = (a: string, b: string) => a.localeCompare(b);\n")).not.toHaveLength(0);
    expect(
      await syntax("src/modules/takeoff/x.ts", "export const s = (xs: string[]) => [...xs].sort((a, b) => a.localeCompare(b));\n"),
    ).not.toHaveLength(0);
  });
  it("allows compareCanonical and a bare sort", async () => {
    expect(
      await syntax(
        "src/modules/takeoff/x.ts",
        "import { compareCanonical } from '@/core/order';\nexport const s = (xs: string[]) => [...xs].sort(compareCanonical);\nexport const t = (xs: string[]) => [...xs].sort();\n",
      ),
    ).toHaveLength(0);
  });
});

describe("number formatting (lakh/crore, never Western grouping)", () => {
  it("flags a bare toLocaleString", async () => {
    expect(await syntax("src/app/x.ts", "export const s = (n: number) => n.toLocaleString('en-US');\n")).not.toHaveLength(0);
    expect(await syntax("src/modules/estimate/x.ts", "export const s = (d: Date) => d.toLocaleString();\n")).not.toHaveLength(0);
  });
});
