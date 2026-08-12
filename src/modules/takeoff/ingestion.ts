import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { forTenant, type TenantCtx } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph";
import { insertIngestJob, type IngestJob } from "@/core/queue";
import {
  completeIngest,
  getDrawingRevision,
  insertDrawingRevision,
  insertIngest,
  listRevisionIngests,
  nextRevisionSeq,
  startIngest,
  type DrawingRevision,
  type Ingest,
} from "@/core/register";
import {
  drawingRef,
  readArtifact,
  resolveRef,
  sha256,
  writeArtifact,
} from "@/core/storage";
import { runCadIngest } from "./cad";

/**
 * Drawing ingestion, end to end: an uploaded source lands as a revision, its
 * ingest and its queued job in one transaction; the worker runs the cad CLI
 * against it and writes the fidelity counters back verbatim.
 *
 * The counters are the artifact's own (cad-ingestion.md §3) — nothing here
 * re-derives them, and nothing here summarises a loss away.
 */

/** DXF only for now; DWG arrives through the LibreDWG lane (cad-ingestion.md §1). */
const SOURCE_EXTENSION = ".dxf";

/** A drawing that does not fit in a request body needs a different upload path — say so. */
export const MAX_SOURCE_BYTES = 64 * 1024 * 1024;

export type UploadInput = {
  projectId: string;
  drawingId: string;
  filename: string;
  bytes: Uint8Array;
};

export type Upload = { revision: DrawingRevision; ingest: Ingest; job: IngestJob };

/**
 * Land revision + ingest + job together, with the source written inside that
 * transaction — after the drawing is proven to be this project's (so a bogus
 * id cannot spend disk), and before the rows that cite the file exist (so a
 * row can never cite a file that is not there). A commit that fails after the
 * write leaves only garbage, and the path is content-addressed, so a retry
 * writes the same bytes to the same place.
 */
export async function uploadRevision(
  ctx: TenantCtx,
  input: UploadInput,
): Promise<Upload> {
  const ext = path.extname(input.filename).toLowerCase();
  if (ext !== SOURCE_EXTENSION) {
    throw new Error(
      `upload refused: ${input.filename} is not a ${SOURCE_EXTENSION} drawing`,
    );
  }
  if (input.bytes.byteLength === 0) {
    throw new Error(`upload refused: ${input.filename} is empty`);
  }
  if (input.bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error(
      `upload refused: ${input.filename} is ${input.bytes.byteLength} bytes, over the ${MAX_SOURCE_BYTES}-byte upload limit`,
    );
  }
  const ids = {
    tenantId: ctx.tenantId,
    projectId: input.projectId,
    drawingId: input.drawingId,
  };
  const digest = sha256(input.bytes);
  const sourceRef = drawingRef(ids, `${digest}${SOURCE_EXTENSION}`);

  return forTenant(ctx, async (tx) => {
    // locks the drawing and proves it is this project's, before any bytes land
    const seq = await nextRevisionSeq(tx, input.projectId, input.drawingId);
    await writeArtifact(sourceRef, input.bytes);
    const revision = await insertDrawingRevision(tx, ctx.tenantId, {
      projectId: input.projectId,
      drawingId: input.drawingId,
      seq,
      sourceFilename: input.filename,
      sourceRef,
      sourceSha256: digest,
    });
    const ingest = await insertIngest(tx, ctx.tenantId, {
      projectId: input.projectId,
      drawingRevisionId: revision.id,
    });
    const job = await insertIngestJob(tx, ctx.tenantId, {
      projectId: input.projectId,
      ingestId: ingest.id,
    });
    return { revision, ingest, job };
  });
}

/**
 * Run one claimed job: source → cad CLI → artifact → counters on the ingest
 * row. Every refusal throws by name; the worker turns that into a failed
 * ingest, never a silent one.
 */
export async function runIngestJob(
  ctx: TenantCtx,
  job: IngestJob,
): Promise<Ingest> {
  const ingest = await startIngest(ctx, job.ingestId);
  const revision = await getDrawingRevision(ctx, ingest.drawingRevisionId);
  if (!revision) {
    throw new Error(
      `ingest ${ingest.id} cites revision ${ingest.drawingRevisionId}, which is not in tenant scope`,
    );
  }
  const graph = await extract(revision);
  const artifactBytes = new TextEncoder().encode(
    JSON.stringify(graph, null, 2) + "\n",
  );
  const artifactRef = drawingRef(
    {
      tenantId: ctx.tenantId,
      projectId: revision.projectId,
      drawingId: revision.drawingId,
    },
    `${revision.sourceSha256}.entitygraph.json`,
  );
  const artifactSha256 = await writeArtifact(artifactRef, artifactBytes);
  return completeIngest(ctx, {
    ingestId: ingest.id,
    artifactRef,
    artifactSha256,
    fidelity: { counters: graph.counters, units: graph.units },
  });
}

/** Temp dir per invocation (ADR-0001); the artifact only reaches storage intact. */
async function extract(revision: DrawingRevision): Promise<EntityGraph> {
  const sourcePath = resolveRef(revision.sourceRef);
  // the reference is only a reference: prove the bytes are still the ones the
  // revision landed with before anything measures them
  const stored = sha256(await readArtifact(revision.sourceRef));
  if (stored !== revision.sourceSha256) {
    throw new Error(
      `source for revision ${revision.id} has changed on disk (sha256 ${stored}, expected ${revision.sourceSha256})`,
    );
  }
  const workDir = await mkdtemp(path.join(tmpdir(), "vextrus-ingest-"));
  try {
    const outPath = path.join(workDir, "entitygraph.json");
    const graph = await runCadIngest(sourcePath, outPath);
    if (graph.source.sha256 !== revision.sourceSha256) {
      throw new Error(
        `the pipeline read a different file than the revision landed (artifact sha256 ${graph.source.sha256}, revision ${revision.sourceSha256})`,
      );
    }
    return graph;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/* ------------------------------ screen-facing ----------------------------- */

export type IngestFidelity = {
  entitiesOriginal: number;
  entitiesDerived: number;
  explodeTruncated: boolean;
  lostByType: Record<string, number>;
  unsupportedByType: Record<string, number>;
  insunits: number | null;
  unitDetected: string | null;
  insunitsUnmapped: boolean;
};

export type RevisionStatus = {
  revisionId: string;
  seq: number;
  sourceFilename: string;
  uploadedAt: Date;
  status: Ingest["status"] | "unqueued";
  error: string | null;
  artifactRef: string | null;
  fidelity: IngestFidelity | null;
  /** Machine-knowable losses, said out loud (quantity-contract §2). */
  warnings: string[];
};

/**
 * What the drawing's screen reads. A truncation or an unhandled entity type is
 * a warning on a *succeeded* ingest — the run finished, the extraction did not
 * see everything, and staying quiet about that is the condemned state.
 */
export async function drawingStatus(
  ctx: TenantCtx,
  drawingId: string,
): Promise<RevisionStatus[]> {
  const rows = await listRevisionIngests(ctx, drawingId);
  return rows.map(({ revision, ingest }) => ({
    revisionId: revision.id,
    seq: revision.seq,
    sourceFilename: revision.sourceFilename,
    uploadedAt: revision.createdAt,
    // no ingest row at all is itself a state worth naming, not a blank cell
    status: ingest?.status ?? "unqueued",
    error: ingest?.error ?? null,
    artifactRef: ingest?.artifactRef ?? null,
    fidelity: fidelityOf(ingest),
    warnings: warningsOf(ingest),
  }));
}

function fidelityOf(ingest: Ingest | null): IngestFidelity | null {
  if (
    !ingest ||
    ingest.entitiesOriginal === null ||
    ingest.entitiesDerived === null ||
    ingest.explodeTruncated === null ||
    ingest.lostByType === null ||
    ingest.unsupportedByType === null ||
    ingest.insunitsUnmapped === null
  ) {
    return null;
  }
  return {
    entitiesOriginal: ingest.entitiesOriginal,
    entitiesDerived: ingest.entitiesDerived,
    explodeTruncated: ingest.explodeTruncated,
    lostByType: ingest.lostByType,
    unsupportedByType: ingest.unsupportedByType,
    insunits: ingest.insunits,
    unitDetected: ingest.unitDetected,
    insunitsUnmapped: ingest.insunitsUnmapped,
  };
}

function counted(byType: Record<string, number>): string {
  return Object.entries(byType)
    .map(([type, count]) => `${type}×${count}`)
    .join(", ");
}

function warningsOf(ingest: Ingest | null): string[] {
  const fidelity = fidelityOf(ingest);
  if (!fidelity) return [];
  const warnings: string[] = [];
  if (fidelity.explodeTruncated) {
    warnings.push(
      "block explosion hit its depth or budget cap: this drawing was not fully rendered",
    );
  }
  if (Object.keys(fidelity.lostByType).length > 0) {
    warnings.push(`entities lost to the cap: ${counted(fidelity.lostByType)}`);
  }
  if (Object.keys(fidelity.unsupportedByType).length > 0) {
    warnings.push(
      `entity types the extractor does not handle: ${counted(fidelity.unsupportedByType)}`,
    );
  }
  if (fidelity.insunitsUnmapped) {
    warnings.push(
      `drawing units code ${fidelity.insunits ?? "?"} is unmapped: units are undetermined, never assumed`,
    );
  } else if (fidelity.unitDetected === null) {
    warnings.push("the drawing declares no units: scale must be affirmed");
  }
  return warnings;
}
