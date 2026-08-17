import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The licence test ADR-0001 promised — "AGPL PDF libraries banned, enforced by a test when a PDF
 * lane lands" — now due, because ADR-0008 named a document renderer and a document renderer is a
 * PDF lane. `cad-ingestion.md` §1 is the clause; the banned set is a closed list read from one
 * file by both halves of the tree, because `eslint.config.js` ignores `cad/**` and a lint rule
 * cannot reach the Python half (`cad/tests/test_licence.py` is its mirror).
 *
 * Two arms, and each has a fixture proving it fires (ADR-0007): a shipped module may not import a
 * banned library nor spawn its executable, and no lockfile a shipped module resolves may carry
 * one. Test files are not shipped modules — which is also what lets the fixtures below name the
 * banned strings without tripping the scan they exercise.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

type BannedLibrary = {
  readonly name: string;
  readonly licence: string;
  readonly cite: string;
  readonly npm: readonly string[];
  readonly pypi: readonly string[];
  readonly imports: readonly string[];
  readonly executables: readonly string[];
};
const BANNED: readonly BannedLibrary[] = JSON.parse(
  readFileSync(path.join(ROOT, "src/__tests__/fixtures/banned-pdf-libraries.json"), "utf8"),
).libraries;

/** Closed enum: a violation is one of these, never prose. */
type Reason =
  | "AGPL_IMPORT"
  | "AGPL_EXECUTABLE"
  | "AGPL_LOCKFILE_ENTRY"
  | "RENDERER_VERSION_UNPINNED"
  | "RENDERER_HASH_UNPINNED";
type Violation = { readonly reason: Reason; readonly where: string; readonly what: string };

/**
 * ADR-0008: the renderer is pinned by version and hash, and the pin is a sanity number in the
 * sense of `cad-ingestion.md` §12. The pin lives here while no renderer is resolved anywhere in
 * the tree; it moves to the resolver the day one lands, and this test asserts against it there.
 * `binarySha256` is null because no ADR or research note records a measured hash — so the day a
 * call site appears, `RENDERER_HASH_UNPINNED` fires and the hash must be measured to go green.
 */
type RendererPin = {
  readonly engine: string;
  readonly version: string;
  readonly binarySha256: string | null;
  /** The two floors ADR-0008 and its 2026-08-17 amendment name: /ActualText, then variable fonts. */
  readonly floors: readonly { readonly version: string; readonly because: string }[];
};
const RENDERER_PIN: RendererPin = {
  engine: "typst",
  version: "0.15.1",
  binarySha256: null,
  floors: [
    { version: "0.14.0", because: "/ActualText arrives at Typst >= 0.14 (krilla backend, PR #5420)" },
    { version: "0.15.0", because: "variable fonts arrive at Typst >= 0.15.0 (PR #8425)" },
  ],
};

const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".next-verify", "__pycache__", "fixtures"]);
const SHIPPED_ROOTS = ["src", "db", "scripts"];
const SHIPPED_ROOT_FILES = ["next.config.ts", "drizzle.config.ts", "eslint.config.js", "vitest.config.ts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js", ".jsx"]);

/** A test file is not a shipped module: this file and its mirrors name the banned strings on purpose. */
const isTestFile = (rel: string) =>
  rel.includes("__tests__") || /\.(spec|dbspec)\.[a-z]+$/.test(rel) || rel.startsWith("cad/tests/");

type ShippedFile = { readonly rel: string; readonly source: string };

function shippedFiles(): ShippedFile[] {
  const out: ShippedFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      if (IGNORED_DIRS.has(entry)) continue;
      const abs = path.join(dir, entry);
      const rel = path.relative(ROOT, abs);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry)) || isTestFile(rel)) continue;
      out.push({ rel, source: readFileSync(abs, "utf8") });
    }
  };
  for (const root of SHIPPED_ROOTS) walk(path.join(ROOT, root));
  for (const file of SHIPPED_ROOT_FILES) {
    out.push({ rel: file, source: readFileSync(path.join(ROOT, file), "utf8") });
  }
  return out;
}

/** Module specifiers, however they are spelled: static import/export, require, dynamic import. */
function specifiers(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g,
    /(?:^|\n)\s*import\s*["']([^"']+)["']/g,
    /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]!);
  }
  return [...found];
}

/** The package a specifier resolves to: '@scope/pkg/sub' -> '@scope/pkg', 'fitz.x' -> 'fitz'. */
function packageOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A banned executable named as a subprocess argument — mutool is a CLI, not an import. */
const executablePattern = (name: string) => new RegExp(`["'\`]\\s*${escapeRe(name)}\\b|\\b${escapeRe(name)}\\s+[a-z]`);

function importViolations(files: readonly ShippedFile[]): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    const packages = new Set(specifiers(file.source).map(packageOf));
    for (const library of BANNED) {
      for (const name of library.imports) {
        if (packages.has(name)) out.push({ reason: "AGPL_IMPORT", where: file.rel, what: `${name} (${library.name}, ${library.licence})` });
      }
      for (const executable of library.executables) {
        if (executablePattern(executable).test(file.source)) {
          out.push({ reason: "AGPL_EXECUTABLE", where: file.rel, what: `${executable} (${library.name}, ${library.licence})` });
        }
      }
    }
  }
  return out;
}

function manifestViolations(where: string, text: string): Violation[] {
  const out: Violation[] = [];
  for (const library of BANNED) {
    for (const name of library.npm) {
      // A lockfile entry, a dependency line, or a resolved tarball path all spell the name then '@'.
      if (new RegExp(`["'/]${escapeRe(name)}(["']\\s*:|@)`).test(text)) {
        out.push({ reason: "AGPL_LOCKFILE_ENTRY", where, what: `${name} (${library.name}, ${library.licence})` });
      }
    }
  }
  return out;
}

function pinViolations(files: readonly ShippedFile[], pin: RendererPin): Violation[] {
  const out: Violation[] = [];
  const callSite = new RegExp(`\\b${escapeRe(pin.engine)}\\b`, "i");
  for (const file of files.filter((f) => callSite.test(f.source))) {
    if (!file.source.includes(pin.version)) {
      out.push({ reason: "RENDERER_VERSION_UNPINNED", where: file.rel, what: `${pin.engine} resolved without the pinned version ${pin.version}` });
    }
    if (pin.binarySha256 === null) {
      out.push({ reason: "RENDERER_HASH_UNPINNED", where: file.rel, what: `${pin.engine} resolved while no binary hash is recorded (ADR-0008)` });
    } else if (!file.source.includes(pin.binarySha256)) {
      out.push({ reason: "RENDERER_HASH_UNPINNED", where: file.rel, what: `${pin.engine} resolved without the pinned binary hash` });
    }
  }
  return out;
}

const compareVersions = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

describe("AGPL PDF libraries are banned in shipped code (cad-ingestion.md §1, ADR-0001)", () => {
  const files = shippedFiles();

  it("scans a tree it actually found", () => {
    // The scan is worthless if the walk returns nothing — a silent zero is the failure mode here.
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.rel === "src/core/model.ts")).toBe(true);
    expect(files.every((f) => !isTestFile(f.rel))).toBe(true);
  });

  it("no shipped module imports a banned library or spawns its executable", () => {
    expect(importViolations(files)).toEqual([]);
  });

  it("no manifest or lockfile a shipped module resolves carries one", () => {
    for (const manifest of ["package.json", "pnpm-lock.yaml"]) {
      expect(manifestViolations(manifest, readFileSync(path.join(ROOT, manifest), "utf8"))).toEqual([]);
    }
  });

  it("the closed list is the doc's list, spelled for both ecosystems", () => {
    const names = BANNED.flatMap((l) => [...l.imports, ...l.executables, ...l.pypi, ...l.npm]);
    for (const named of ["fitz", "pymupdf", "mutool"]) expect(names).toContain(named);
    for (const library of BANNED) expect(library.licence).toBe("AGPL-3.0");
  });
});

describe("the guardrail fires (ADR-0007)", () => {
  const fixture = (source: string) => [{ rel: "src/modules/estimate/document.ts", source }];

  it("flags a banned import, however it is spelled", () => {
    expect(importViolations(fixture("import { render } from '@vivliostyle/cli';\n"))[0]?.reason).toBe("AGPL_IMPORT");
    expect(importViolations(fixture("const mupdf = require('mupdf/lib/mupdf');\n"))[0]?.reason).toBe("AGPL_IMPORT");
    expect(importViolations(fixture("const m = await import('mupdf');\n"))[0]?.reason).toBe("AGPL_IMPORT");
  });

  it("flags a banned executable spawned as a subprocess", () => {
    expect(importViolations(fixture("spawnSync('mutool', ['draw', input]);\n"))[0]?.reason).toBe("AGPL_EXECUTABLE");
  });

  it("passes a shipped module that uses the permitted toolchain", () => {
    expect(importViolations(fixture("import { PdfDocument } from 'pypdfium2-bridge';\nimport ezdxf from 'ezdxf';\n"))).toEqual([]);
  });

  it("flags a lockfile entry", () => {
    expect(manifestViolations("pnpm-lock.yaml", "  '@vivliostyle/cli@9.4.0':\n    resolution: {}\n")[0]?.reason).toBe("AGPL_LOCKFILE_ENTRY");
    expect(manifestViolations("package.json", '{"dependencies":{"mupdf":"^1.26.0"}}')[0]?.reason).toBe("AGPL_LOCKFILE_ENTRY");
    expect(manifestViolations("package.json", '{"dependencies":{"pypdfium2-bridge":"^1.0.0"}}')).toEqual([]);
  });
});

describe("the renderer pin (ADR-0008)", () => {
  const files = shippedFiles();

  it("the pinned version clears both floors the ADR names", () => {
    for (const floor of RENDERER_PIN.floors) {
      expect(compareVersions(RENDERER_PIN.version, floor.version), floor.because).toBeGreaterThanOrEqual(0);
    }
  });

  it("no shipped module resolves the renderer without the pin", () => {
    // Vacuous today — no renderer is in the tree — and red the day one arrives unpinned.
    expect(pinViolations(files, RENDERER_PIN)).toEqual([]);
  });

  it("fires on a call site that carries no version, and on an unmeasured hash", () => {
    const site = [{ rel: "src/modules/estimate/render.ts", source: "spawnSync('typst', ['compile', input]);\n" }];
    expect(pinViolations(site, RENDERER_PIN).map((v) => v.reason)).toEqual([
      "RENDERER_VERSION_UNPINNED",
      "RENDERER_HASH_UNPINNED",
    ]);
    const measured = { ...RENDERER_PIN, binarySha256: "a".repeat(64) };
    expect(pinViolations(site, measured).map((v) => v.reason)).toEqual([
      "RENDERER_VERSION_UNPINNED",
      "RENDERER_HASH_UNPINNED",
    ]);
    const pinned = [{ rel: "src/core/renderer.ts", source: `const PIN = { version: "0.15.1", sha256: "${"a".repeat(64)}" };\nspawnSync("typst", ["compile"]);\n` }];
    expect(pinViolations(pinned, measured)).toEqual([]);
  });
});
