import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { forTenant, schema, type TenantCtx } from "@/core/db";
import { entityGraphSchema, type EntityGraph } from "@/core/entitygraph";
import { storageRoot } from "@/core/env";
import { INGEST_PARAMETERS, ingestParameterHash, type IngestParameters } from "@/core/ingest-contract";

/**
 * Ingest (cad-ingestion.md §1–§3, §12; ADR-0001): a DXF upload goes to storage, `cad/` runs as
 * a subprocess over it — never a resident service — and its EntityGraph artifact is parsed at
 * this boundary, stored, and recorded in `ingests` with the extractor identity and the fidelity
 * counters verbatim. Nothing here measures anything: the unit is reported, never interpreted
 * (measurement-rules.md §5), and every original entity's source key is `DXF_HANDLE:<h>` — read
 * off the artifact by `sourceKeysOf` (src/core/model.ts), never minted here.
 */

const execFileAsync = promisify(execFile);
const CAD_DIR = path.resolve(process.cwd(), "cad");
/** The DWG lane (LibreDWG, cad-ingestion.md §1) has not been ported; until it is, only DXF is ingestible. */
const SUPPORTED_UPLOAD_EXTENSIONS = [".dxf"] as const;

/** Why an ingest did not happen — closed, never prose. */
export const INGEST_REFUSAL_CAUSES = [
  "UNSUPPORTED_FILE_TYPE",
  "DRAWING_REVISION_NOT_FOUND",
  "EXTRACTOR_FAILED",
  "ARTIFACT_MALFORMED",
  "SOURCE_MISMATCH",
] as const;
export type IngestRefusalCause = (typeof INGEST_REFUSAL_CAUSES)[number];
export type IngestRefusal = { readonly ok: false; readonly cause: IngestRefusalCause; readonly detail: string };

export type Upload = { readonly filename: string; readonly bytes: Uint8Array };

/** What one run of the extractor produced, before any row is written. */
export type Extraction = {
  readonly ingestId: string;
  readonly upload: { readonly filename: string; readonly ref: string; readonly sha256: string };
  readonly artifact: { readonly ref: string; readonly sha256: string; readonly graph: EntityGraph };
  readonly extractor: { readonly version: string; readonly parameters: IngestParameters; readonly parameterHash: string };
};

const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

async function cad(args: readonly string[]): Promise<{ ok: true; stdout: string } | { ok: false; detail: string }> {
  try {
    const { stdout } = await execFileAsync("uv", ["run", "python", "-m", "vextrus_cad", ...args], {
      cwd: CAD_DIR,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { ok: true, stdout };
  } catch (err) {
    const e = err as { code?: unknown; stderr?: unknown; message?: string };
    const stderr = typeof e.stderr === "string" ? e.stderr.trim() : "";
    return { ok: false, detail: stderr || e.message || String(e.code ?? "unknown") };
  }
}

/**
 * Store the upload, run `cad/` over it, parse the artifact at the boundary. Pure of the
 * database: `pnpm verify` exercises this against the committed fixtures with a temp storage
 * root. Refuses by name; never returns a partial artifact.
 */
export async function extractUpload(
  ctx: TenantCtx,
  drawingRevisionId: string,
  upload: Upload,
  parameters: IngestParameters = INGEST_PARAMETERS,
): Promise<Extraction | IngestRefusal> {
  const ext = path.extname(upload.filename).toLowerCase();
  if (!(SUPPORTED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, cause: "UNSUPPORTED_FILE_TYPE", detail: `${ext || "(none)"} — supported: ${SUPPORTED_UPLOAD_EXTENSIONS.join(", ")}` };
  }
  const root = storageRoot();
  const ingestId = randomUUID();
  const scope = path.join(ctx.tenantId, drawingRevisionId);
  const uploadSha = sha256(upload.bytes);
  const uploadRef = path.join(scope, "uploads", `${uploadSha}${ext}`);
  const artifactRef = path.join(scope, "artifacts", `${ingestId}.entitygraph.json`);
  await mkdir(path.dirname(path.join(root, uploadRef)), { recursive: true });
  await mkdir(path.dirname(path.join(root, artifactRef)), { recursive: true });
  await writeFile(path.join(root, uploadRef), upload.bytes);

  const version = await cad(["--version"]);
  if (!version.ok) return { ok: false, cause: "EXTRACTOR_FAILED", detail: version.detail };
  const run = await cad([
    "ingest",
    path.join(root, uploadRef),
    "--explode-depth",
    String(parameters.explodeDepth),
    "--derived-budget",
    String(parameters.derivedBudget),
    "--out",
    path.join(root, artifactRef),
  ]);
  if (!run.ok) return { ok: false, cause: "EXTRACTOR_FAILED", detail: run.detail };

  const artifactBytes = await readFile(path.join(root, artifactRef));
  let json: unknown;
  try {
    json = JSON.parse(artifactBytes.toString("utf-8"));
  } catch {
    return { ok: false, cause: "ARTIFACT_MALFORMED", detail: "artifact is not JSON" };
  }
  const parsed = entityGraphSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, cause: "ARTIFACT_MALFORMED", detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  if (parsed.data.source.sha256 !== uploadSha) {
    return { ok: false, cause: "SOURCE_MISMATCH", detail: `artifact cites ${parsed.data.source.sha256}, upload is ${uploadSha}` };
  }
  return {
    ingestId,
    upload: { filename: upload.filename, ref: uploadRef, sha256: uploadSha },
    artifact: { ref: artifactRef, sha256: sha256(artifactBytes), graph: parsed.data },
    extractor: { version: version.stdout.trim(), parameters, parameterHash: ingestParameterHash(parameters) },
  };
}

export type IngestOutcome = { readonly ok: true; readonly extraction: Extraction } | IngestRefusal;

/**
 * The whole act: resolve the drawing revision through the seam, extract, record. The `ingests`
 * row carries the counters verbatim off the artifact — the scope register reads them
 * (quantity-contract.md §2: `INGESTION_TRUNCATED` vs `ENTITY_TYPE_UNHANDLED`, opposite remedies).
 */
export async function ingestDrawingRevision(
  ctx: TenantCtx,
  input: { readonly drawingRevisionId: string; readonly upload: Upload; readonly parameters?: IngestParameters },
): Promise<IngestOutcome> {
  const [revision] = await forTenant(ctx, (tx) =>
    tx.select().from(schema.drawingRevisions).where(eq(schema.drawingRevisions.id, input.drawingRevisionId)).limit(1),
  );
  if (!revision) return { ok: false, cause: "DRAWING_REVISION_NOT_FOUND", detail: input.drawingRevisionId };

  const extraction = await extractUpload(ctx, revision.id, input.upload, input.parameters ?? INGEST_PARAMETERS);
  if ("ok" in extraction) return extraction;

  const { graph } = extraction.artifact;
  await forTenant(ctx, (tx) =>
    tx.insert(schema.ingests).values({
      id: extraction.ingestId,
      tenantId: ctx.tenantId,
      projectId: revision.projectId,
      drawingRevisionId: revision.id,
      uploadFilename: extraction.upload.filename,
      uploadRef: extraction.upload.ref,
      uploadSha256: extraction.upload.sha256,
      artifactRef: extraction.artifact.ref,
      artifactSha256: extraction.artifact.sha256,
      extractorVersion: extraction.extractor.version,
      extractorParameters: extraction.extractor.parameters,
      extractorParameterHash: extraction.extractor.parameterHash,
      insunits: graph.units.insunits,
      unitDetected: graph.units.detected,
      insunitsUnmapped: graph.units.insunits_unmapped,
      original: graph.counters.original,
      derived: graph.counters.derived,
      explodeTruncated: graph.counters.explode_truncated,
      lostByType: graph.counters.lost_by_type,
      unsupportedByType: graph.counters.unsupported_by_type,
    }),
  );
  return { ok: true, extraction };
}
