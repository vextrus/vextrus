import { createHash } from "node:crypto";
import { compareCanonical } from "./order";

/**
 * The drawing-set revision's key (identity.md §9): an immutable, unordered set of
 * `(drawing, drawing revision)` surrogate-id pairs, content-addressed — a digest over the member
 * pairs in canonical sort order, zero minted ids (§3), so an identical pinned set *is* the
 * identical set revision and re-pinning an unchanged set voids nothing. Surrogate ids on both
 * axes: never a sheet number, title or issue date (§2).
 */
export type DrawingSetMember = { readonly drawingId: string; readonly drawingRevisionId: string };

/**
 * A set pins one revision per drawing; two revisions of one drawing is not a set, it is two
 * sets, and the caller must say which — refused, never resolved by picking one.
 */
export function drawingSetRevisionDigest(members: readonly DrawingSetMember[]): string {
  if (members.length === 0) throw new Error("DRAWING_SET_EMPTY: a set revision has at least one member");
  const seen = new Set<string>();
  const pairs: string[] = [];
  for (const m of members) {
    if (seen.has(m.drawingId)) throw new Error(`DRAWING_SET_DUPLICATE_DRAWING: ${m.drawingId}`);
    seen.add(m.drawingId);
    pairs.push(`${m.drawingId}:${m.drawingRevisionId}`);
  }
  pairs.sort(compareCanonical);
  return createHash("sha256").update(pairs.join("\n")).digest("hex");
}
