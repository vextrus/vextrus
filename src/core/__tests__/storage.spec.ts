import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  drawingRef,
  readArtifact,
  resolveRef,
  sha256,
  storageRoot,
  writeArtifact,
} from "@/core/storage";

/**
 * Artifact storage holds references, and a reference is data: it may never be
 * trusted into a path that leaves the root. The DB stores the reference and the
 * hash — never the blob (ticket 04 guardrail).
 */

let root: string;
const ids = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  projectId: "22222222-2222-2222-2222-222222222222",
  drawingId: "33333333-3333-3333-3333-333333333333",
};

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "vextrus-storage-"));
  process.env.VEXTRUS_STORAGE_ROOT = root;
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("artifact storage", () => {
  it("names an unset root rather than defaulting to one", () => {
    const set = process.env.VEXTRUS_STORAGE_ROOT;
    delete process.env.VEXTRUS_STORAGE_ROOT;
    expect(() => storageRoot()).toThrow(/VEXTRUS_STORAGE_ROOT is not set/);
    process.env.VEXTRUS_STORAGE_ROOT = set;
  });

  it("refuses a relative root: two processes must resolve a reference alike", () => {
    const set = process.env.VEXTRUS_STORAGE_ROOT;
    process.env.VEXTRUS_STORAGE_ROOT = ".data/artifacts";
    expect(() => storageRoot()).toThrow(/must be an absolute path/);
    process.env.VEXTRUS_STORAGE_ROOT = set;
  });

  it("round-trips bytes under a uuid-only path, returning their sha256", async () => {
    const bytes = new TextEncoder().encode("0 SECTION\n");
    const digest = sha256(bytes);
    const ref = drawingRef(ids, `${digest}.dxf`);
    expect(ref).toBe(
      `${ids.tenantId}/${ids.projectId}/${ids.drawingId}/${digest}.dxf`,
    );
    expect(await writeArtifact(ref, bytes)).toBe(digest);
    expect(new Uint8Array(await readArtifact(ref))).toEqual(bytes);
  });

  it("refuses to conjure a root that does not exist, rather than minting a second artifact tree", async () => {
    const set = process.env.VEXTRUS_STORAGE_ROOT;
    process.env.VEXTRUS_STORAGE_ROOT = path.join(root, "not-provisioned");
    await expect(
      writeArtifact(drawingRef(ids, "x.json"), new Uint8Array([1])),
    ).rejects.toThrow(/does not exist/);
    process.env.VEXTRUS_STORAGE_ROOT = set;
  });

  it("refuses a reference that escapes the storage root", () => {
    expect(() => resolveRef("../../etc/passwd")).toThrow(
      /escapes the storage root/,
    );
    expect(() => resolveRef(path.join(root, "..", "elsewhere"))).toThrow(
      /escapes the storage root/,
    );
  });
});
