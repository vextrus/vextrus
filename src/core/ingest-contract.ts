import { createHash } from "node:crypto";

/**
 * The extractor's parameter set (cad-ingestion.md §2): a source key is scoped to
 * `(file bytes, extractor identity)`, and the ingest record pins that identity as version +
 * parameter-set hash — or a re-minted key multiset is undetectable. The caps are the extractor
 * invariant's (§3): nested INSERTs recurse under an explicit depth cap and a derived-entity
 * budget, and a cap that trips says so in the artifact. They are extraction fidelity, never
 * measurement — a cap you raise (`INGESTION_TRUNCATED`, quantity-contract.md §2).
 */
export const INGEST_PARAMETER_KEYS = ["explodeDepth", "derivedBudget"] as const;
export type IngestParameters = { readonly [K in (typeof INGEST_PARAMETER_KEYS)[number]]: number };

/** The parameters the app passes to `cad/` by default; the CLI's own defaults are not relied on. */
export const INGEST_PARAMETERS: IngestParameters = { explodeDepth: 4, derivedBudget: 50_000 };

/** Canonical (fixed key order) so an identical parameter set hashes identically. */
export function ingestParameterHash(p: IngestParameters): string {
  const canonical = JSON.stringify(Object.fromEntries(INGEST_PARAMETER_KEYS.map((k) => [k, p[k]])));
  return createHash("sha256").update(canonical).digest("hex");
}
