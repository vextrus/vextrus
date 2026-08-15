# The entity index — viewer-only, id-less, `box` + GiST

[Ticket](../tickets/11-the-entity-index.md) · ruled 2026-08-15

The index is **viewer-only: measurement never reads it**, and that one ruling settled the rest.
The measuring stages keep reading the artifact in memory as pure functions, so a forgotten
`WHERE` yields a wrong picture, never a wrong number — which deflates `identity.md` §2's
disqualifying shape and lets **one table** hold originals and paint, discriminated by
`source_key` nullability (measured: every original has a key, no derived row does) rather than by
a redundant `is_original` flag. The table has **no surrogate id column at all** — uniqueness is a
partial unique index on `(ingest_id, source_key)`, deletion is by `ingest_id`, and nothing
addresses a derived row — so `identity.md` §3's leak is unrepresentable rather than merely
tested. Spatially: **core `box` + GiST**; the tile key is disqualified on *correctness* (it
silently drops gridlines and the slab outline), and PostGIS lost every viewport and lost its one
remaining argument when the index went viewer-only — leaving 76.6 MB, a diverged compose image
and a `CREATE EXTENSION` on the single migration lane for nothing. Ticket 15 gets: whole-sheet
payload for the 60 fps single-sheet bar, viewport query with a server-side sub-pixel predicate
(1.49M → 7,150 paintable) for overviews, a configurable row budget that **reports** when it caps,
area-descending order, no cursor. Ingest is `COPY` at 4 workers. Set granularity is left to
05/24 — the extractor's `DERIVED_BUDGET` fires long before the index does on a 500K-entity single
file, and this ticket's obligation is that `explode_truncated` **rides through to the viewer**
instead of dying at the DB seam.
