import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireEnv } from "./env";

/**
 * Artifact storage: the filesystem, for now (ticket 04 guardrail — object
 * storage is a future named need). The database stores the *reference* and the
 * sha256, never the blob.
 *
 * A reference is always relative to the storage root, so moving the root does
 * not invalidate a single row. Resolution refuses any reference that escapes
 * the root — a stored path is data, and data is never trusted into a filename.
 */

/**
 * The root must be absolute. The web server and the worker are separate
 * processes: resolving a relative root against each one's cwd would let them
 * disagree about where a stored reference lives, and the symptom would be an
 * ENOENT — or a hash mismatch that reads like tampering — rather than a
 * configuration error.
 */
export function storageRoot(): string {
  const root = requireEnv("VEXTRUS_STORAGE_ROOT");
  if (!path.isAbsolute(root)) {
    throw new Error(
      `VEXTRUS_STORAGE_ROOT must be an absolute path, not ${root}: every process must resolve a reference to the same place`,
    );
  }
  return path.resolve(root);
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The reference layout: tenant / project / drawing / <name>, where <name> is
 * content-addressed by the caller. Every directory segment is a uuid we
 * minted, so the path carries no user-supplied text — the uploaded filename
 * lives in its database column, not on disk.
 */
export function drawingRef(
  ids: { tenantId: string; projectId: string; drawingId: string },
  name: string,
): string {
  return [ids.tenantId, ids.projectId, ids.drawingId, name].join("/");
}

/** Absolute path for a stored reference, refusing escapes from the root. */
export function resolveRef(ref: string): string {
  const root = storageRoot();
  const resolved = path.resolve(root, ref);
  const inside =
    resolved === root || resolved.startsWith(root + path.sep);
  if (!inside) {
    throw new Error(`artifact reference escapes the storage root: ${ref}`);
  }
  return resolved;
}

/**
 * The root is a precondition, never something a writer conjures.
 *
 * `mkdir -p` on a reference would create the whole chain, root included, so a
 * stale or mistyped `VEXTRUS_STORAGE_ROOT` never refuses on write — it mints a
 * second artifact tree and works perfectly, and the fault surfaces days later
 * as an ENOENT from a read of a row written under the *other* root. That reads
 * like corruption or tampering rather than the configuration error it is,
 * which is the same silent divergence the absolute-path rule above exists to
 * prevent, arriving through a different door. So: the tenant/project/drawing
 * segments below the root are ours to create, and the root itself must already
 * be there. `scripts/provision.sh` creates it, so a provisioned machine passes
 * this without noticing it.
 */
async function requireStorageRoot(): Promise<string> {
  const root = storageRoot();
  try {
    const entry = await stat(root);
    if (!entry.isDirectory()) {
      throw new Error(
        `VEXTRUS_STORAGE_ROOT=${root} is not a directory: artifacts cannot be stored under it`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    throw new Error(
      `VEXTRUS_STORAGE_ROOT=${root} does not exist. Artifacts written under a root that is created on demand are invisible to every process resolving the configured one — create the directory, or fix the value (see .env.example).`,
    );
  }
  return root;
}

/** Writes bytes at `ref` (creating parents below the root) and returns their sha256. */
export async function writeArtifact(
  ref: string,
  bytes: Uint8Array,
): Promise<string> {
  await requireStorageRoot();
  const target = resolveRef(ref);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return sha256(bytes);
}

export async function readArtifact(ref: string): Promise<Buffer> {
  return readFile(resolveRef(ref));
}
