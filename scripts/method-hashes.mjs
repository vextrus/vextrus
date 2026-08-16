#!/usr/bin/env node
/**
 * The method content-hash stage (measurement-rules.md §1: methods are *never configurable,
 * enumerated by rule id + version, **CI asserting a content hash of the implementation***;
 * ADR-0010). One method per file under `src/core/methods/`, hashed **whole**, against the manifest
 * committed beside `src/core/rule-set.ts`. Drift is a red build, so changing a method's arithmetic
 * without bumping its version cannot reach main quietly; the bump moves the rule-set edition key,
 * which is the governed event identity.md §8 describes.
 *
 * **How a method is versioned:** the landed file is never edited. Version 2 is a **new file**
 * beside version 1, and version 1 stays exactly as it is — an edition already pinning it must go
 * on resolving, which is the same law as a landed migration being superseded rather than edited.
 * Editing `version:` in place both mutates a landed hash and withdraws the old pair, and the base
 * guard below refuses each of those by name.
 *
 * The hash is over the **implementation file**, deliberately (ADR-0010): not the function source
 * via `Function.prototype.toString`, which hashes post-transform text so a bundler upgrade would
 * void every method with no rule change; and not the registry declaration, which would fix the
 * interface while leaving the arithmetic free to change underneath a stable version — the
 * laundering the hash exists to stop. Accepted cost, stated in the ruling: a comment edit in a
 * method file forces a version bump.
 *
 * Three modes, all exit-code contracts:
 *   node scripts/method-hashes.mjs                  # check the tree against the manifest
 *   node scripts/method-hashes.mjs --write          # regenerate the manifest (review the diff)
 *   node scripts/method-hashes.mjs --against <file> # a landed (rule id, version) is immutable
 *
 * The last is the base-manifest comparison the CI job runs on a pull request, the shape the landed
 * migration guard already uses: an entry present on the base may not change its hash or vanish,
 * because an edition naming it would otherwise measure under arithmetic nobody bumped.
 *
 * This file cannot import TypeScript, so it checks **files against the manifest** only; that the
 * *registry* and the manifest name the same methods is asserted in `src/core/__tests__/methods.spec.ts`.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const METHODS_DIR = "src/core/methods";
export const MANIFEST_PATH = "src/core/methods.manifest.json";

/** A method file declares its identity as literals; both are read off the hashed text itself. */
const RULE_ID = /^\s*ruleId:\s*"([A-Z0-9_]+)",$/m;
const VERSION = /^\s*version:\s*(\d+),$/m;

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Every method file in the directory, in canonical order — one method per file, `.ts` only. */
export function methodFiles(methodsDir) {
  return readdirSync(methodsDir)
    .filter((f) => f.endsWith(".ts"))
    .sort();
}

/**
 * One manifest entry: `(rule id, version)` read off the file, and the digest of the whole file.
 * A file whose identity cannot be read refuses by name — never hashed under a guessed key.
 */
export function methodEntry(methodsDir, file) {
  const source = readFileSync(path.join(methodsDir, file), "utf8");
  const ruleId = source.match(RULE_ID)?.[1];
  const version = source.match(VERSION)?.[1];
  if (!ruleId || !version) {
    return { fault: `METHOD_IDENTITY_UNREADABLE: ${file} declares no literal ruleId/version pair` };
  }
  return { key: `${ruleId}@${Number(version)}`, entry: { file, sha256: sha256(source) } };
}

/** The manifest the tree implies, sorted by key so the file is stable across machines. */
export function buildManifest(methodsDir) {
  const methods = {};
  const faults = [];
  for (const file of methodFiles(methodsDir)) {
    const read = methodEntry(methodsDir, file);
    if (read.fault) {
      faults.push(read.fault);
      continue;
    }
    if (methods[read.key]) faults.push(`METHOD_DUPLICATE_KEY: ${read.key} is declared by two files`);
    methods[read.key] = read.entry;
  }
  const sorted = Object.fromEntries(Object.keys(methods).sort().map((k) => [k, methods[k]]));
  return { manifest: { methods: sorted }, faults };
}

const readManifest = (manifestPath) => JSON.parse(readFileSync(manifestPath, "utf8"));

/**
 * The tree against the manifest. Three faults, each named: a method file no entry covers, an entry
 * no file backs, and a file whose bytes moved under a held `(rule id, version)`.
 */
export function checkMethodHashes({ methodsDir, manifestPath }) {
  const { manifest, faults } = buildManifest(methodsDir);
  const committed = readManifest(manifestPath).methods ?? {};
  for (const [key, entry] of Object.entries(manifest.methods)) {
    const held = committed[key];
    if (!held) {
      faults.push(`METHOD_FILE_UNMANIFESTED: ${entry.file} implements ${key}, which the manifest does not carry`);
      continue;
    }
    if (held.file !== entry.file) {
      faults.push(`METHOD_FILE_MOVED: ${key} is manifested as ${held.file} and implemented in ${entry.file}`);
    }
    if (held.sha256 !== entry.sha256) {
      faults.push(
        `METHOD_HASH_DRIFT: ${entry.file} changed under a held version. A landed (rule id, version) is immutable — restore this file and add the next version as a **new file** beside it, then \`pnpm methods:hash --write\`. Editing the version in place withdraws ${key} and fails the base guard (${held.sha256} → ${entry.sha256})`,
      );
    }
  }
  for (const key of Object.keys(committed)) {
    if (!manifest.methods[key]) faults.push(`METHOD_MANIFEST_ORPHAN: ${key} is manifested and no file implements it`);
  }
  return { ok: faults.length === 0, faults };
}

/**
 * A landed `(rule id, version)` is immutable — the landed-migration law applied to methods. A base
 * entry that changed its hash is arithmetic moving under a version an edition already pins; one
 * that vanished is an edition left naming an implementation this binary lacks.
 */
export function manifestDrift(base, head) {
  const faults = [];
  for (const [key, entry] of Object.entries(base.methods ?? {})) {
    const now = (head.methods ?? {})[key];
    if (!now) {
      faults.push(`METHOD_ENTRY_WITHDRAWN: ${key} was on the base and is gone — an edition naming it can no longer measure`);
      continue;
    }
    if (now.sha256 !== entry.sha256) {
      faults.push(`METHOD_ENTRY_MUTATED: ${key} landed with ${entry.sha256} and now hashes ${now.sha256} — bump the version instead`);
    }
  }
  return faults;
}

const main = () => {
  const root = path.resolve(import.meta.dirname, "..");
  const methodsDir = path.join(root, METHODS_DIR);
  const manifestPath = path.join(root, MANIFEST_PATH);
  const args = process.argv.slice(2);

  if (args[0] === "--write") {
    const { manifest, faults } = buildManifest(methodsDir);
    if (faults.length > 0) {
      console.error(faults.join("\n"));
      process.exit(1);
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`method-hashes: wrote ${MANIFEST_PATH} (${Object.keys(manifest.methods).length} method(s))`);
    return;
  }

  if (args[0] === "--against") {
    const basePath = args[1];
    if (!basePath) {
      console.error("method-hashes: --against needs the base manifest's path");
      process.exit(1);
    }
    const faults = manifestDrift(readManifest(basePath), readManifest(manifestPath));
    if (faults.length > 0) {
      console.error(faults.join("\n"));
      process.exit(1);
    }
    console.log("method-hashes: every landed (rule id, version) is untouched");
    return;
  }

  const { ok, faults } = checkMethodHashes({ methodsDir, manifestPath });
  if (!ok) {
    console.error(faults.join("\n"));
    process.exit(1);
  }
  console.log(`method-hashes: ${methodFiles(methodsDir).length} method file(s) match ${MANIFEST_PATH}`);
};

// Exported for the fixture test; run as a command by `pnpm verify` and by CI.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
