# CAD ingestion — the extraction laws

Re-derived 2026-08-12 from the legacy pipeline (proven on real multi-drawing fixture sets) and
its measured censuses. The pipeline is `cad/` — a pure CLI, drawing in → EntityGraph JSON out
(ADR-0001).

## 1. Pipeline and licenses

DWG → DXF via **LibreDWG** in an isolated subprocess (GPL: subprocess only, never linked, license
text shipped), built `--enable-release`. **The lane is two passes and the converter is audited,
never trusted** (ADR-0012): `dwgread -O JSON` gives the object census, `dwg2dxf` gives the
geometry, and the two reconcile per entity type. `dwg2dxf` exits 0 on an empty DXF and on an
unparseable one — measured, 139/139 — so **its exit code is not a success signal**. Any per-type
shortfall, and any `UNKNOWN_ENT` in the census, refuses that class on that sheet by name; a DXF
the parser rejects refuses the sheet as `dwg_dxf_unparseable`. ODA File Converter is **banned from
every production artifact**, and its former dev-only permission is withdrawn — it may run only
inside a bounded, dated evaluation of ODA membership. DXF → EntityGraph via **ezdxf** (MIT).
PDFs via pypdfium2 (permissive);
**AGPL PDF libraries (PyMuPDF/fitz, mutool) are banned in shipped code** — a license test
asserts no shipped module imports them. Stateless, temp-dir per invocation, loud failures,
generous timeouts.

## 2. Provenance and units

- **The DXF handle (`h`) is THE stable provenance key.** Every entity carries handle, type,
  layer, resolved colour. Every schedule cell, note reading, and measurement cites handles.
- **Coordinates stay in native drawing units**; the artifact reports `$INSUNITS` (0 unitless ·
  1 inch · 2 foot · 4 mm · 5 cm · 6 m). **An unmapped code never silently reads as unitless**
  — it reports null + an unmapped flag (a legacy defect read codes 3, 14–20 as unitless).
  Interpretation is the app's scale law (`measurement-rules.md` §5), never the pipeline's.

## 3. The extractor invariant

**Derived paint geometry must never reach the extractor.** Block references (INSERTs) explode
to world coordinates for *rendering*; every synthesized entity carries `src` (its parent's
handle), and extraction consumes **original entities only** — so richer paint can never invent
elements out of block-internal labels. Nested INSERTs recurse under an explicit depth cap and
a derived-entity budget; **a cap that trips must say so** (`explode_truncated` + per-type loss
counters — one global scalar was a named legacy defect; the census could not recover what was
lost from ingestion's own artifact). Block attributes (grid-bubble letters, callout tags)
collect separately off the INSERT. A dimension's measurement text emits as a *derived* text
entity, never as the schedule-cell channel.

## 4. Hard-won rendering/geometry lessons

- **Resolve colour server-side** (true_color → explicit → BYLAYER → BYBLOCK): ~98% of a real
  drawing is BYLAYER; an unresolving client paints everything one grey.
- **Text carries its world height** — clients that paint labels at screen size collide on zoom.
- **Robust extents with stray-entity rejection**: real DWGs carry xref junk; reject entities
  whose bbox centre falls outside the 2nd–98th inter-percentile window (+25%); when nothing is
  rejected the result equals naive extents byte-for-byte.
- Paper layouts get their own bbox; content-less layouts are dropped, not shipped.
- Closed polylines carry shoelace area; curve flattening at fixed tolerance with a point cap.

## 5. Schedule-table reconstruction (no gridlines needed)

Anchor on schedule-title text; collect body text within a reach window; **row-cluster by y**
with tolerance derived from the median consecutive gap; stop at a vertical gap > 3.5× local
pitch (real schedules put a blank band between header block and first row); the header row is
the first leading row carrying a name/mark cell (schedules lead with meta rows); **column
centres come from the header**; two texts in one cell join with `+` (double rebar curtains);
**every cell cites its source handles**.

Known defect class, measured: clustering on the gap between *distinct* y values lets 0.1–0.7
units of intra-row jitter outvote the real row gap 3:1 (pitch resolves to 0.50 against a true
7.4) and the reconstructor returns zero tables **on a sheet titled "& SCHEDULE"** — band-first
clustering fixes it; tuning constants in drawing units are the same species as guessed scale.
A schedule reconstructor returning zero on a schedule-titled sheet is a machine-knowable
silence and must surface.

## 6. BD drawing-notation parsers (golden-tested against real strings)

- Feet-inches (`8'-4"`, `8'4"`, `8'-4 1/2"`), size pairs (`12"X24"`, metric `450X600`).
- Rebar groups: `14-20mmØ`, `8-20+6-16mmØ`, `2-25+1-20Ø ext.`, shear-wall curtains
  (`1 of 24-25mmØ` — the `N of` multiplier spans its groups).
- Spacing: `10Ø @ 4" c/c`, `12%%C @ 5" c/c.`, unspaced vulgar fractions (`@ 61/2"` accepted
  only as a *proper* fraction — 6½", never 30.5"), variable series `@113/175/113`, the `@125m`
  mm-typo (consumed so it cannot corrupt the note tag).
- **AutoCAD escapes strip first** (`%%C`→Ø, `%%D`→°, `%%P`→±); all four Ø-lookalikes handled
  (Ø Φ ø and U+2205), grounded in the stored artifact's observed forms, never guessed.
- Floor zones: `1st-2nd` expands; `7th-Roof` keeps endpoint semantics; `1ST TO TOP FLOOR`
  maps TOP→ROOF; `Below GF`→BGF. Note tags (`ALT. CKD`, `(BOT.)`) are retained verbatim and
  never corrupt dia/spacing.
- These parsers live **beside their consumer in the app**, not in `cad/` — the pipeline stays
  geometry/spatial-only.

## 7. The view law

Every model-space original entity belongs to exactly one view; view types are a closed
vocabulary (layout plan · schedule · long-section strip · member section · detail · stair plan
· stair section · legend/notes · title · untyped · unassigned). **Only layout-plan-class views
may yield instances**; schedules/sections/details yield types and dimensions only. That
decision lives in exactly one exported predicate, with a CI check that no second decision site
exists. Classification follows caption grammar (en+bn stems), never title literals; an
unclassifiable caption anchors nothing and the view is honestly untyped. Member-scoped plans
("PLAN OF <subject>") are details — never countable.

## 8. The grid backbone

Axes in two families (letter/numeral) with per-view georeference, derived **only from
layout-plan evidence** — filtered before detection, so a grid stamp in a detail can never
shift an axis. **Content signature, never layer names**: a grid bubble is a bare letter/numeral
text anchored inside a circle — a template whose bubbles live on layer `PILE` detects
identically. A view without lawful bubble evidence georeferences as deferred with a named
reason. Machine proposes; disposition is human.

## 9. Instance placement

Placement constants are **content-scaled shares of the minimum grid spacing, never absolute**:
containment/merge expansion 0.08; near-anchor grid-ref bound 0.9 (beyond it, honest absence);
footprint min 0.6 / max 2.5 of grid spacing (filters building cores and sheet frames); human
snap-to-intersection 0.5 (beyond it, the honest off-grid form — never a snapped lie).
Foundation classes (pile cap, pile, tie/grade beam) take the lawful-null level basis; vertical
classes (column, shear wall) expand per level. Label normalization strips size parentheticals
and compares dotless-uppercase (`TB` matches registered `T.B`) — both forms are the drawing's
own; nothing is invented.

## 10. The extraction convention profile (the generalisation mechanism)

A drawing's conventions — which layers carry bar linework / member outlines / text /
dimensions, which caption grammars name its views — are **resolved per drawing from an entity
census** by geometry statistics and generic features. The resolver is pure; drawing-specific
literals live only in a replaceable seed that may **corroborate but never add, drop, or
re-assign a role** — the ablation law: `resolve(census, {})` must deep-equal
`resolve(census)` for any census. This is what frees the extractor from hardcoded drawing
constants; it is CI-enforced.

## 11. The member-type registry (reading schedules)

One row per mark family, variants beneath, rebar zones per band, provenance to schedule cell /
caption / band label. Evidence admission is view-membership-filtered before derivation.
**Raw retention**: every zone keeps its source cell text verbatim; parses grade on top of raw
truth, never instead of it. **Noise never becomes a family** (markless rows, spec-bleed cells,
junk headers exit as named non-family dispositions, never dropped). A schedule view
contributing zero evidence surfaces a named deferral. **Nothing here emits a member count** —
a schedule has no Nos column; counts come from placement.

## 12. Operational discipline

Keep a **sanity number**: after any converter change, the entity count on a pinned reference
drawing must read an exact known value — a lower count means you are grading stale pipeline
code. **Pinned (ADR-0012, LibreDWG 0.13.3 `--enable-release`):** `example_2018.dwg` reads **207
recovered + 4 named losses** (2 `WIPEOUT`, 1 `ACAD_TABLE`, 1 `ARC_DIMENSION`) against an
AutoCAD-authored twin of **211**. A silent 207 fails this assertion exactly as a silent 211 does —
the losses are part of the number. Re-take it whenever the pinned converter version moves.
Fixtures: synthetic drawings including a **revision pair** (the identity-stability test
bed). Competitor-derived drawings never enter this repo.
