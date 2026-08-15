# The entity index — the artifact stays evidence, the index answers questions

wayfinder:grilling
Status: closed
Blocked by:
Claimed by:

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

## What the environment says (AFK pass, 2026-08-14)

An unattended session took the facts half of this HITL ticket (ADR-0015): everything below is
measured or read out of the tree, and **no decision is taken**. Rig, run order and corpus
regeneration: `docs/research/probes/entity-index/`. Machine: `linux x64 · node v24.19.0 ·
PostgreSQL 16.13 · 15 GB RAM · claude/entity-index-xm51lg@2135dc6`, `pnpm verify` green
(52.3s) and `parity` clean before measuring. The corpus is synthetic and uncommitted:
`gen_sheet.py` reproduces the committed fixture's drafting conventions (block-referenced
columns with internal paint and a nested rebar tag, attributed grid bubbles, a schedule view)
and scales the column grid; every artifact below came out of the **real** cad CLI, so the
original-to-derived ratio is the extractor's own and not an assumption.

### 1. The premise needs restating: no stage ever sees 500K entities

The artifact is per **file**, and `extract()` walks `doc.modelspace()` only
(`cad/src/vextrus_cad/ingest.py:255`) — paper layouts are not walked at all. One file is one
revision is one artifact. At the per-sheet bar (10,095 originals → 29,835 entities, the
extractor's ×2.96 fan-out):

| | one sheet |
|---|---|
| artifact on disk | **8.9 MB** (312 B/entity) |
| `JSON.parse` | **55 ms**, +23 MB RSS |
| `entityGraphSchema.safeParse` (runs today, in `runCadIngest`) | **108 ms** |
| bbox over every entity | 9 ms |
| cad CLI extraction, `uv run` startup included | **2.9 s** |

Even the pathological shape — 500K originals in **one** model space, which is what the ticket's
premise assumes — is not a memory wall: 136 MB artifact, `JSON.parse` **1.01 s** at 507 MB RSS,
zod **980 ms**. So "every stage loads the whole JSON into memory" is survivable at both shapes,
and **the index's warrant is the query, not the memory**. That is a narrowing of the ticket, not
an answer to it.

### 2. The derived-entity cap fires long before the index does

`DERIVED_BUDGET = 50_000` per file (`ingest.py:32`). The 500K-original single file tripped it:
`explode_truncated: true` and **947,002 entities lost by type** (`LINE` 236,751 ·
`LWPOLYLINE` 236,750 · `TEXT` 473,501) against 50,000 derived kept. The extractor was honest
about it — §3's law worked exactly as written — but the consequence for **this** ticket is
concrete: on such a file the viewer is missing ~95% of its paint before an index exists, and
no index decision can recover it.

At the per-sheet shape the budget is never approached (19,740 derived, 39% of the cap).
**So the cap's relevance turns entirely on the open fact in §7 below.**

### 3. Spatial mechanism — measured, and one candidate is not merely slower

1,491,750 rows (50 sheets), identical row shape, only the mechanism differing. `→` is the row
count returned; the exact answer is the bbox-overlap predicate's.

| viewport | `gist_box` (core `box` + GiST) | `postgis` (`geometry` + GiST) | `tile_key` (2 m quantized centre tile) |
|---|---|---|---|
| whole set | 197.8 ms → 14,91,750 | 272.1 ms → 14,91,750 | 154.4 ms → 14,91,750 |
| 4 sheets | 17.9 ms → 1,15,792 | 38.5 ms → 1,15,792 | 55.7 ms → 1,15,792 |
| one sheet | **4.1 ms** → 29,835 | 8.0 ms → 29,835 | 27.6 ms → 29,835 |
| quarter | 1.9 ms → 10,746 | 3.0 ms → 10,746 | 17.0 ms → 10,746 |
| a corner | **0.8 ms** → 1,698 | 1.0 ms → 1,698 | 7.8 ms → **1,681** |
| a bay | 0.3 ms → 73 | 0.5 ms → 73 | 1.5 ms → **69** |

**The tile key returns the wrong rows, silently.** The 17 it dropped from "a corner" are
`LINE`×16 and `LWPOLYLINE`×1, the widest 353,000 units: they are **the gridlines and the slab
outline** — bboxes overlapping the viewport whose *centre* tile sits far outside it. A
centre-tile scheme loses precisely the longest entities on the sheet, which are the ones a QS
orients by. Correctness costs one of:

- **one row per covered tile** — 44,19,115 rows for 14,91,750 entities (**×2.96**), or
- **pad the range by the widest entity** — sweeps 2,08,985 rows to answer a query whose true
  answer is 1,698 (**~123× read amplification**), collapsing the index to a near-scan.

Storage and load, same run:

| | COPY | index build | heap + index | B/row |
|---|---|---|---|---|
| `gist_box` | 12.9 s (1,16,045 rows/s) | 12.1 s | 606.4 + 126.1 = **732.4 MB** | 515 |
| `tile_key` | 15.7 s (94,768 rows/s) | 3.8 s | 569.3 + 121.1 = 690.4 MB | 485 |
| `postgis` | 20.3 s (73,400 rows/s) | 5.3 s | 728.0 + 59.4 = 787.4 MB | 554 |

A 50-sheet project's index lands at **~0.72–0.76 GB**, derived from **0.43 GB** of artifacts.

**PostGIS's real cost is provisioning, not performance.** It is absent from both lanes: not in
the `postgres:16` compose image, not in `postgresql-contrib` (this machine's
`pg_available_extensions` had no `postgis` row until the probe installed it). Adding it means
`apt-get install postgresql-16-postgis-3` — **76.6 MB** installed, pulling libgdal/libgeos/libproj
— *and* a different compose image, *and* a `CREATE EXTENSION` that must ride the one migration
lane (ADR-0002). Against that, it lost every viewport to core `box` + GiST. Its one measured win
is a smaller index (59.4 MB vs 126.1 MB), paid for with a larger heap.

### 4. Ingest throughput is not where the risk is

Per-sheet load into an **already-indexed** table (GiST bbox + partial ingest index + unique
`(ingest_id, source_key)`), which is the real shape — sheets arrive one at a time through the
ADR-0009 queue, not as one bulk load:

- serial **0.67 s/sheet** → **34 s** for 50 sheets
- 4 workers 0.33 s/sheet effective; 8 workers 0.36 s/sheet — **parallelism saturates at 4**
- `COPY` 1,16,045 rows/s vs batched 1000-row `INSERT` 37,469 rows/s — **3.1×**, and *both* fit

Against the 10-minute bar the whole set is roughly **2.4 min extraction (2.9 s × 50, serial) +
34 s index load + ~9 s parse/validate ≈ 3.2 min**, before any parallelism. **Extraction
dominates the index by ~4×**; `COPY` vs `INSERT` decides nothing about meeting the bar, only how
much headroom is left. The unique `(ingest_id, source_key)` index built without violation across
1.19M rows — consistent with ticket 02's collapse-on-collision rule, so it is a viable natural
key **for originals**.

### 5. The viewport is overwhelmingly sub-pixel, and saying so costs nothing

Viewport painted into 1920 px; "sub-pixel" = bbox under one pixel in both axes.

| zoom | in view | sub-pixel | actually paintable | query |
|---|---|---|---|---|
| whole set | 14,91,750 | 14,84,600 (100%) | **7,150** | 680 ms |
| 4 sheets | 1,15,792 | 95,622 (83%) | 20,170 | 50 ms |
| one sheet | 29,835 | 14,843 (50%) | 14,992 | 10 ms |
| quarter | 10,746 | 1,804 (17%) | 8,942 | 4 ms |
| a bay | 73 | 12 (16%) | 61 | 1 ms |

A whole-set view collapses from 1.49M rows to **7,150** that a screen can distinguish. The filter
is a predicate over `maxx-minx`/`maxy-miny` — columns the index already carries — so LOD needs no
decimated *copy* of anything, which is the shape `takeoff-core` 03 caught leaking into area.

Materialising rather than counting: one sheet's 29,835 rows come back in **156 ms** and weigh
**10.0 MB as row JSON** (a whole 50-sheet set would be ~500 MB). So "ship the sheet, index it
client-side" is a 10 MB download per sheet before compression.

### 6. Derived entities have no key at all

Measured over the sheet artifact: **0 of 19,740 derived entities carry a source key**, and every
original does (10,095 distinct `h`, no collisions). The 19,740 derived rows cite only **5,040**
distinct `src` parents — 3.9 derived per parent — so `(ingest, src)` is not unique either. A
derived row is addressable **only** by a minted row id. `identity.md` §3 permits that exactly as
far as nothing downstream rides it ("row ids re-mint on every partition rebuild; the key, not the
row id, rides in downstream keys"), and 66% of this index would be derived paint.

### 7. One fact this session could not settle

**How a 50-sheet set arrives is not ruled anywhere.** Nothing in `docs/domain/`, `docs/adr/` or
the closed decisions says whether 50 sheets means 50 files (50 revisions, 50 artifacts, ~10K
originals each) or one file whose model space carries all 500K. The measurements above cover
both, and they diverge sharply — §2's cap fires only on the second. Ticket 04 lifted pairing to
set scope without ruling the set's file granularity; ticket 05 (the DWG lane) and ticket 24 are
the neighbours.

## The questions, sharpened

Unchanged in substance; these are the forms the measurements put them in. **They are decisions,
so this session stops here** — the numbers narrow §1 and §5 to near-formalities and turn §3 and
§4 into genuine forks.

1. **Spatial mechanism (was §1).** Core `box` + GiST won every viewport, is exact, and costs no
   dependency; the tile key is slower *and* silently drops gridlines; PostGIS costs 76.6 MB
   across two provisioning lanes and a `CREATE EXTENSION` in the one migration lane, and lost.
   Is there a *future* claim on PostGIS — a real intersection, buffer or overlay op that
   `box` cannot express — that outweighs losing today's measurement? If not, this is settled by
   the table.
2. **Rebuild (was §2).** The rebuild input is the artifact, not the source file, so a rebuild is
   parse + `COPY` ≈ **0.8 s/sheet, ~40 s per 50-sheet project** — cheap enough to be routine.
   The open half is not cost, it is the guarantee: what enforces that no minted index row id
   rides into a downstream key (§6)? A test, a grant, or a column that simply is not selectable?
3. **Original vs derived (was §3).** Now the sharpest question. 66% of the index is paint that
   the *viewer* must have and that `cad-ingestion.md` §3 bars from extraction, and paint carries
   **no key** (§6). One table with `is_original` repeats the exact shape `identity.md` §2
   disqualified for refused sightings — one forgotten `WHERE`. Two tables cannot be forgotten,
   but split the viewport query in two. **Does anything measuring ever read this index at all?**
   If the index is viewer-only and the measuring stages keep reading the artifact, the forgotten
   `WHERE` cannot cause over-measurement and the whole question deflates.
4. **The viewer's query (was §4).** Server-side sub-pixel culling makes the worst viewport 7,150
   paintable rows at 680 ms, and per-sheet payload is 10 MB. That looks like "server-side
   viewport query with a sub-pixel predicate, no tiling, no LOD copies" — but 60 fps is a
   *client* property this probe cannot measure, and it is ticket 15's. What does 15 need
   guaranteed here: a row budget per request, a stable ordering, or a cursor?
5. **Ingest throughput (was §5).** ~3.2 min against a 10-min bar, serial, extraction dominating
   the index 4×. `COPY` is 3.1× faster than batched insert and both fit; parallelism saturates
   at 4 workers. Is there any reason left to prefer batched inserts, or does `COPY` land on the
   sole ground that it is simpler in one place?
6. **New, forced by §7.** Does the set granularity have to be ruled *before* this ticket, or does
   ruling the index against the per-sheet shape and treating a 500K-entity single file as a
   named refusal (`explode_truncated` already says it out loud) discharge it?

## Resolution

Ruled 2026-08-15, HITL, on the measurements in "What the environment says" above. **The index is
a viewer-only, derived, id-less spatial cache over `box` + GiST, loaded by `COPY`.** One ruling
made the other five cheap, and it is the first one.

### 1. The index is viewer-only. Measurement never reads it.

The measuring stages — `views.ts`, `grid.ts`, `placement.ts` — keep reading the **artifact**, in
memory, as pure functions over the immutable evidence of record. The index is never a
measurement input.

This is a law, not a phase. The artifact is the evidence a figure traces to; a rebuildable cache
must never stand between a signed quantity and the evidence for it, and the purity is why
`pnpm verify` proves the measuring stages without a database at all.

It also disarms the question the ticket called sharpest. §3's fear was `identity.md` §2's
disqualifying shape — one forgotten `WHERE` over-measuring. Under this ruling a forgotten `WHERE`
on the index yields **a wrong picture, never a wrong number**. Note the fear was never
database-shaped anyway: the `src === null` filter is already written at five separate sites
(`views.ts:357`, `placement.ts:182,381`, `grid.ts:111,120`) and the forgettable thing is a
`.filter()`, guarded by the `view-law.spec.ts` mould.

*Alternative put and rejected:* migrating the measuring reads onto SQL later. Rejected because it
buys nothing measured (§1: even the pathological 136 MB artifact parses in 1.01 s — the index's
warrant was always the query, never the memory) and costs the property that makes the whole
question above go away.

### 2. One table, discriminated by `source_key` nullability. No `is_original` flag.

66% of rows are derived paint and the viewport always wants both classes, so two tables would
`UNION ALL` every query for a split that can never be forgotten but is never wanted.

The discriminator is not a boolean. §6 measured that **every original carries a source key and
zero derived rows do**, so `source_key IS NULL` *is* "derived" — an `is_original` column would be
a second copy of a fact one column already states, and two copies can disagree. A
`CHECK (source_key IS NOT NULL OR parent_key IS NOT NULL)` makes a row that is neither
unrepresentable.

*Rejected:* the physical split, and the redundant flag.

### 3. The table has no surrogate id column at all.

Not a test, not a grant, not an unselectable column — **no column**. `identity.md` §3's hazard
("row ids re-mint on every partition rebuild") is discharged by there being no row id to re-mint
or to leak into a minted key. It holds because nothing needs one:

- **Uniqueness** is a *partial* unique index on `(ingest_id, source_key) WHERE source_key IS NOT
  NULL` — §4 built it violation-free across 1.19M rows, consistent with ticket 02's
  collapse-on-collision rule. It needs no primary key to exist, and derived rows assert no
  uniqueness (§6: 3.9 derived per parent).
- **Deletion** is by `ingest_id`, never row-wise, and the table is never `UPDATE`d. It is `COPY`ed
  in and dropped whole. A derived index that mutates rows has stopped being derived.
- **Nothing addresses a derived row.** A disposition says "look here" by citing *source keys*
  (ticket 15 §3) — originals. Paint is fetched by viewport, painted, discarded; its client render
  key dies at the next frame and cannot be written anywhere.

Backed by one law test in the `view-law.spec.ts` mould (a source scan that first proves it read
the repo, so it cannot pass vacuously): the index table's Drizzle schema declares no
identity/serial/uuid-default column and the query layer's row type exposes none. The test's job is
to stop such a column being *added* — the guarantee itself is structural.

*Rejected:* a minted id fenced by a test or a grant — that catches the leak after someone writes
it. Accepted cost: a disposition can never point at a specific piece of derived geometry, only at
its parent key. `cad-ingestion.md` §3 bars derived geometry from originating anything, so this
reads as correct rather than as a cost.

### 4. Core `box` + GiST. PostGIS and the tile key both ruled out.

`box` + GiST won **every** viewport in §3 (4.1 ms on one sheet vs PostGIS 8.0 ms and tile key
27.6 ms; 0.8 ms on a corner), is exact, and adds no dependency.

- **The tile key is disqualified on correctness, not speed.** It silently dropped the 16 gridlines
  and the slab outline from "a corner" — the widest entities on the sheet, the ones a QS orients
  by. A mechanism that returns a confident subset is not a candidate here. Its repairs are ×2.96
  row fan-out or ~123× read amplification, which collapses it to a near-scan.
- **PostGIS's only live argument was a future op `box` cannot express — and ruling 1 removed it.**
  Any such op would now be serving a picture, never a measurement: opening deduction,
  point-in-polygon placement and shoelace area all live in the measuring stages, which read the
  artifact and will never issue a query. What remains for PostGIS is "what overlaps this
  rectangle", the query it lost. Against that: 76.6 MB pulling libgdal/libgeos/libproj, a
  *different compose image* so the two provisioning lanes diverge, and a `CREATE EXTENSION` on the
  single migration lane (ADR-0002).

Reversal is cheap and deliberately so: if a genuine overlay need ever appears *for the viewer*,
adopting PostGIS is a new migration against a table that is derived and droppable — no data
migration, because the artifact rebuilds it.

### 5. Two query shapes, honest capping, no cursor.

60 fps is a client property this ticket cannot measure, so what ticket 15 receives is a contract:

- **Single sheet — ship the sheet.** 29,835 rows, 156 ms, 10 MB pre-compression, fetched once; 15
  then owns pan/zoom entirely client-side. A per-frame server query can never hold 16 ms, so the
  60 fps bar is met by removing the server from the interaction loop.
- **Multi-sheet overview — viewport query with a server-side sub-pixel predicate.** §5's
  1,491,750 → **7,150** paintable at the whole-set view, computed from `maxx-minx`/`maxy-miny`
  columns the index already carries. **No decimated copy of anything exists**, so the leak
  `takeoff-core` 03 caught has no channel — and could not reach a measured value regardless under
  ruling 1.
- **A row budget per response, from config, never hardcoded** (`CLAUDE.md`). When it bites the
  response *says so* — a `capped` count on the envelope, not a short array. A viewport that
  silently returns 80% of the paint is the drawing-shaped partial faulty estimate.
- **`ORDER BY` bbox area descending**, so a capped response degrades to the largest features
  rather than an arbitrary slice. It is explicitly *not* a total order — ruling 3 removed the
  unique identity a tiebreak would need — and equal-area paint is interchangeable.
- **No cursor.** It needs the stable total order ruling 3 declined, and pan/zoom re-queries
  anyway: a cursor pages through an answer for a viewport that has already moved.

### 6. Ruled against the per-sheet shape; the single-file case is a carried refusal.

Set granularity (§7) does **not** block this ticket and this ticket does not rule it — it belongs
to the sheet lane (05/24). At the per-sheet shape everything fits with headroom; at the
pathological 500K-original single model space the index is not what breaks. §2 is decisive: the
extractor's `DERIVED_BUDGET = 50_000` fires first and loses 947,002 entities, and no index
decision recovers them.

What this ticket owes instead is that the extractor's honesty survives the DB seam:
**`explode_truncated` and its by-type loss counters ride into the index's per-ingest metadata and
out to the viewer**, so the canvas renders "this sheet's paint is incomplete — 947,002 entities
dropped at extraction" instead of painting ~5% of a sheet with full confidence. The counters are
already written back verbatim (`ingestion.ts`); the failure mode is that dying at the seam, and
that would be silence.

### 7. `COPY`, not batched inserts.

116,045 rows/s vs 37,469 (3.1×). Both fit the bar — §4 puts the full set at ~3.2 min serial
against 10 min, with extraction dominating the index ~4× — so this decides headroom, not
feasibility, and it lands on the ground that it is one code path in one place. Per-sheet load into
the already-indexed table is 0.67 s serial; **parallelism saturates at 4 workers** (0.33 s/sheet;
8 workers is worse at 0.36), so the ADR-0009 `FOR UPDATE SKIP LOCKED` queue runs at 4 and there is
no reason to go wider.

### Carried into implementation

- Every tenant table gets the `db/rls.ts` block (ADR-0004) — an index of drawing contents is
  tenant data. `pnpm db:replay` before the migration commits.
- Rebuild is parse + `COPY` from the **artifact**, not the source file: ~0.8 s/sheet, ~40 s for a
  50-sheet project. Droppable with no ceremony and no data loss, which is what "derived" means
  here.
- The artifact's byte-stability and sanity number (`cad-ingestion.md` §12) are untouched: nothing
  above writes to the artifact, and the CLI stays pure (ADR-0001).
