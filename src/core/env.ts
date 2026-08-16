import path from "node:path";

/** Environment preconditions, in one place: an unset variable names the file that documents it. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (see .env.example)`);
  }
  return value;
}

/**
 * Where uploads and their artifacts live (cad-ingestion.md; ADR-0001): an absolute directory the
 * DB refers into by relative path and content digest — the DB stores references, never blobs.
 * Absent or relative is a machine fault, reported by `pnpm checkup`, and refused here by name.
 */
export function storageRoot(): string {
  const root = requireEnv("VEXTRUS_STORAGE_ROOT");
  if (!path.isAbsolute(root)) {
    throw new Error(`VEXTRUS_STORAGE_ROOT must be an absolute path, got "${root}" (see .env.example)`);
  }
  return root;
}
