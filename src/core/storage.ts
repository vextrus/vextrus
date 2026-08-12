import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
  const root = process.env.VEXTRUS_STORAGE_ROOT;
  if (!root) {
    throw new Error("VEXTRUS_STORAGE_ROOT is not set (see .env.example)");
  }
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

/** Writes bytes at `ref` (creating parents) and returns their sha256. */
export async function writeArtifact(
  ref: string,
  bytes: Uint8Array,
): Promise<string> {
  const target = resolveRef(ref);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return sha256(bytes);
}

export async function readArtifact(ref: string): Promise<Buffer> {
  return readFile(resolveRef(ref));
}
