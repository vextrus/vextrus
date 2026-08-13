# The entity index — the artifact stays evidence, the index answers questions

wayfinder:grilling
Status: open
Blocked by:
Claimed by: dispatched 2026-08-13

## Objective

Charting ruled the split: the EntityGraph JSON stays the **immutable, hashable evidence of
record**; a **derived, rebuildable Postgres entity index** serves queries and the viewer. The
CLI stays pure — ADR-0001 untouched. This ticket rules the index's shape.

The gap is three orders of magnitude and will break: the synthetic fixture is **59 entities**;
the bar is **50 sheets / 500K original entities**, ingest under 10 minutes, viewer at 60 fps.
Today every stage loads the whole JSON into memory.

## The decision

1. **Schema.** Indexed by handle/source key, sheet, layer, type, and **spatially**. Which
   spatial mechanism — PostGIS, native `box`/GiST, or a quantized tile key? PostGIS is a large
   dependency and a second migration-lane risk; a tile key is code we own. Rule with a
   measurement, not a preference.
2. **Derived means droppable.** The index must be rebuildable from the artifact with no
   ceremony and no data loss. State the rebuild command and prove nothing else depends on index
   row ids — `identity.md` §3 bars minted ids from derived keys, and an index row id is exactly
   the kind of thing that leaks into one.
3. **Original vs derived entities.** `cad-ingestion.md` §3 bars derived paint from the
   extractor, but the *viewer* must render it — that is what it is for. Does the index hold both
   with a flag, or two tables? A single forgotten `WHERE` is the failure mode `identity.md` §2
   already cites as disqualifying for the refused-sightings design.
4. **The viewer's query.** "What is in this viewport at this zoom" over 500K entities at 60 fps
   is not a naive query. Rule the approach — server-side tiling, client-side spatial structure
   over a per-sheet payload, or level-of-detail decimation. Note that §4 already stores
   decimation-aware data and `takeoff-core` 03 caught decimation **leaking into area**, so any
   LOD scheme must not touch measured values.
5. **Ingest throughput.** 500K rows in under 10 minutes including conversion. `COPY` versus
   batched inserts; per-sheet parallelism against the existing `FOR UPDATE SKIP LOCKED` queue
   (ADR-0009).

## Guardrails

- Every tenant table gets the `db/rls.ts` block in its migration (ADR-0004). An index of drawing
  contents is tenant data.
- `pnpm db:replay` before committing the migration (`CLAUDE.md`).
- The artifact's byte-stability and sanity number (`cad-ingestion.md` §12) must survive.

## Blocks

Tickets 15 (the canvas) and 22 (the deployed environment).
