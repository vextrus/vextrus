# CAD ingestion — the extraction laws

Re-derived 2026-08-12 from the legacy pipeline (proven on real multi-drawing fixture sets) and
its measured censuses. The pipeline is `cad/` — a pure CLI, drawing in → EntityGraph JSON out
(ADR-0001).

## 1. Pipeline and licenses

DWG → DXF via **LibreDWG `dwg2dxf`** in an isolated subprocess (GPL: subprocess only, never
linked, license text shipped). ODA File Converter is **dev-only, banned from every production
artifact**. DXF → EntityGraph via **ezdxf** (MIT). PDFs via pypdfium2 (permissive);
**AGPL PDF libraries (PyMuPDF/fitz, mutool) are banned in shipped code** — a license test
asserts no shipped module imports them. Stateless, temp-dir per invocation, loud failures,
generous timeouts.

## 2. Provenance and units

- **Every original entity carries a source key (`h`) — one opaque `scheme:key` token.** Every
  entity carries source key, type, layer, resolved colour. Every schedule cell, note reading,
  and measurement cites source keys. The scheme vocabulary is **closed** and splits by *the
  extractor that minted the key*, never by the file the QS uploaded — a DWG converts to DXF in
  §1 and carries real DXF handles:

  | scheme | minted by | the key is | asserted by |
  |---|---|---|---|
  | `DXF_HANDLE` | ezdxf (DWG or DXF upload) | the file's own handle | the **file** |
  | `PDF_OBJECT` | pdfium | a content digest (below) | **pdfium's decomposition** |
  | `RASTER_TRACE` | the vectorizer | a content digest (below) | **us** |

  `PDF_OBJECT` and `RASTER_TRACE` stay distinct even where their digest construction agrees:
  they carry different stability warranties, and under `quantity-contract.md` a `RASTER_TRACE`
  citation is what makes a line `INTERPRETED`. One scheme for both would force the basis rule to
  consult something other than the key, which is a second lookup that goes stale.

  **The scheme rides per key, never per drawing** — one page may mint both `PDF_OBJECT` and
  `RASTER_TRACE` keys (a scanned detail pasted onto a drafted sheet, ordinary in BD practice).
  A token carrying **no prefix reads as `DXF_HANDLE`**: evidence is append-only by grant
  (`GRANT SELECT, INSERT`, migration 0009) and is never rewritten, so what keeps rows written
  before this amendment valid is a **read-side** rule and there is no data migration. Every
  write is prefixed. `:` is a safe delimiter because every key alphabet is hex or base32.

- **A source key is scoped to `(file bytes, extractor identity)`** — never across two files,
  never across two extractor versions. `identity.md` §3's "an identical re-derivation reproduces
  the identical key multiset" binds re-derivation *over the same bytes by the same extractor*;
  the re-derivation it protects is the **rebuild of derived state from the artifact**, not a
  re-run of the extractor. Continuity across a re-issued set is the identity key's job
  (`identity.md` §4 pairing) and never the source key's — a source key chasing cross-file
  stability would be a second, weaker pairing mechanism beside the one that works. The ingest
  record **pins extractor identity** (version + parameter-set hash, per scheme) or the
  re-minting below is undetectable rather than merely accepted.

- **The content digest (`PDF_OBJECT`, `RASTER_TRACE`) is taken over page index + object type +
  resolved page-space geometry, and nothing else.** Never an ordinal counter, never a byte
  offset into the content stream (a re-save preserves geometry and moves every offset). Page
  *index*, not page label — a label is authored metadata and correctable.
  - **Colour, line width, dash, fill and font name are excluded.** §4 resolves colour as a
    rendered attribute, and `identity.md` §2's principle is that anything a later act may
    correct never enters a key: a PDF re-exported with a changed pen table would otherwise
    re-mint every key over a change that moved no geometry.
  - **Text is geometry**: the digest takes the decoded string plus the resolved anchor and
    quantized height. Two identical strings at one anchor are the same evidence; two different
    strings there are not.
  - **Quantize to 0.001 pt** (resolve to points, applying the page's `UserUnit`), emitted as a
    fixed-precision decimal string with half-even rounding — the same fixed-precision-string
    discipline as `identity.md` §4's content signature. This quantum is **a collision policy,
    not a stability dial**: unlike §3's 0.1 drawing unit, which absorbs real jitter between
    different drawings of one building, there is no jitter inside one file (same bytes through
    the same code is bit-identical; CTM composition noise is ~1e-9 pt against page coordinates
    of ~1e3 pt). Widening it therefore buys nothing and manufactures collisions.
  - **Colliding objects collapse to one original, and the collapse is counted** per page and per
    object type, in the artifact — §3's law for a tripped cap applied to a new loss channel, and
    per-type for the same measured reason. At 0.001 pt a collision is coincidence within
    0.00035 mm, which *is* one mark on the page; the common cause is a double-drawn line, and
    one line drawn twice is one entity. **Never disambiguated by an ordinal within the collision
    set**: that ordinal is a counter, placed exactly where the digest has stopped
    distinguishing anything. After collapse the census reconciles as
    `objects seen = distinct keys + collapsed`; counting keys no longer answers "did we see
    everything".
  - **Why content-derived at all, once keys are file-scoped:** a digest is
    **self-authenticating** — verification recomputes the digest of the object a claim cites and
    compares. A counter is not; "index 417" checks only against a count, which is true of every
    number below it, so a model hallucinating a plausible integer passes the verifier. Under
    `formulas.md`'s "AI proposes, never concludes", that property is the point.

- **A vectorizer must be deterministic within a pinned extractor identity** — asserted by a
  torture-corpus fixture: vectorize one page twice, identical key multiset. Without it a
  50-sheet parallel ingest cannot agree with itself and resume cannot work. This admits
  classical CV freely and admits ML vectorizers only under deterministic kernels and a fixed
  seed. Vectorization runs **once per ingest** and freezes into the immutable artifact; nothing
  downstream re-runs it, so a vectorizer cannot orphan a citation within the life of an ingest.
  **Upgrading one is a declared re-ingest that mints a new key multiset** — `identity.md` §5
  then does exactly its stated job: cited evidence moved, so every raster-derived row
  re-presents for disposition though its numbers are unchanged. The price is real and is paid
  deliberately: pin the vectorizer, upgrade rarely. Cross-version key stability is **not**
  pursued, because matching old primitives to new ones is a matcher, and `identity.md` §2
  rejected matchers on the ground that a wrong merge silently deletes quantity.

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

**A PDF Form XObject is a block reference and takes this law verbatim.** The form *instance* is
the original and mints the key; its resolved contents are **derived**, carrying `src` = the
instance's key, exactly as INSERT children do. This is why §2's digest is over *resolved
page-space* coordinates: a form placed twice — one detail block dropped in two corners, which is
what CAD exporters emit — has byte-identical raw operator streams, so digesting the raw stream
would guarantee a collision on every repeated detail of the first real drawing. Resolved, the
two placements key apart, and a mark or schedule cell living inside a detail block still cannot
originate an element.

**The atom a source key names is the EntityGraph original entity, and only the extractor defines
it** — one pdfium page object, one vectorizer-emitted primitive. The EntityGraph is the one
interface: no downstream stage learns a second source format exists, and "resolve this key"
always returns exactly one thing to highlight. A key naming a byte range that several entities
share would break both, and would leave a PDF sheet with no single caption anchor to key a view
on (`identity.md` §3).

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
code. Fixtures: synthetic drawings including a **revision pair** (the identity-stability test
bed). Competitor-derived drawings never enter this repo.
