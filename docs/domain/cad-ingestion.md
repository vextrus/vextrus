# CAD ingestion — the extraction laws

Re-derived 2026-08-12 from the legacy pipeline (proven on real multi-drawing fixture sets) and
its measured censuses. The pipeline is `cad/` — a pure CLI, drawing in → EntityGraph JSON out
(ADR-0001).

*Amendment, 2026-08-16 (the governing sentence of this document; ADR-0009).* **The seam is a
format boundary, not a stage boundary, and the CLI is one-shot.** `cad/` turns file formats into
one geometry vocabulary and stops: §§1–4 and nothing else. It is invoked once per drawing
revision and is **never fed app-produced input**. Everything that reads *meaning* — §5, §7, §8,
§9, §10, §11 — runs in the app, over the artifact, and never re-opens the drawing. §6's closing
bullet, which said this of the notation parsers alone, is hereby the whole pipeline's law. The
consequence that decides arguments: a stage in the app is improved by a **partition rebuild**,
where the same stage inside `cad/` would be a declared re-ingest minting a new key multiset and
forcing every derived row to re-present for disposition (`identity.md` §5).

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

*Amendment, 2026-08-16 (ADR-0009).* Because the app never re-opens the drawing, four facts of this
section must ride **in the artifact**, and the envelope advances to `version: 2` to carry them: a
**space marker per entity** (model space, or the named paper layout — §7 partitions model-space
entities and v1 records no such distinction); a **layout inventory** with each layout's bbox and
the count of layouts dropped as content-less; the **robust extents** with the count of entities
the inter-percentile window rejected; and a **flatten point-cap counter**, because unlike
`explode_truncated` a tripped point cap currently says nothing, and a loss nobody counted is the
silence §3 forbids. The bump is purely additive and re-mints no key, so there is no data
migration.

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

*Amendment, 2026-08-16 (ADR-0009).* **Runs in the app.** Keeping it in `cad/` as the one geometric
exception was put and rejected: §11 admits schedule evidence only after view-membership filtering,
so the exception re-acquires §7's dependency at its consumer, having bought nothing.

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

*Amendment, 2026-08-16 (ADR-0009).* This bullet is generalised into the document's governing
sentence above. Its corollary for the artifact: **text crosses the seam raw.** `cad/` never strips
the AutoCAD escapes (`%%C`→Ø, `%%D`→°); the app's parsers do, grading on top of raw truth as §11
requires. §2's "decoded string" means the file's own character decoding, which ezdxf resolves —
never AutoCAD's formatting escapes.

## 7. The view law

Every model-space original entity belongs to exactly one view; view types are a closed
vocabulary (layout plan · schedule · long-section strip · member section · detail · stair plan
· stair section · legend/notes · title · untyped · unassigned). **Only layout-plan-class views
may yield instances**; schedules/sections/details yield types and dimensions only. That
decision lives in exactly one exported predicate, with a CI check that no second decision site
exists. Classification follows caption grammar (en+bn stems), never title literals; an
unclassifiable caption anchors nothing and the view is honestly untyped. Member-scoped plans
("PLAN OF <subject>") are details — never countable.

*Amendment, 2026-08-16 (ADR-0009).* **Runs in the app**, in `src/modules/takeoff/` — never in
`src/core/`, because `book`, `estimate` and `bid` never classify a view and core would become the
home of takeoff's judgement. Only the view **key grammar** stays in `src/core/identity.ts` (§3
there). The "one exported predicate" is enforced **by construction, not by detection**: the closed
vocabulary is a branded type exported from one module beside the predicate, and the view-type
literals are a lint error anywhere else — so a second decision site cannot be written. The lint
rule carries a fixture test proving it fires; a check nobody proved fires is not a check.

## 8. The grid backbone

Axes in two families (letter/numeral) with per-view georeference, derived **only from
layout-plan evidence** — filtered before detection, so a grid stamp in a detail can never
shift an axis. **Content signature, never layer names**: a grid bubble is a bare letter/numeral
text anchored inside a circle — a template whose bubbles live on layer `PILE` detects
identically. A view without lawful bubble evidence georeferences as deferred with a named
reason. Machine proposes; disposition is human.

*Amendment, 2026-08-16 (ADR-0009).* **Runs in the app.** This clause is what settles the seam for
all five stages: "derived only from layout-plan evidence, filtered before detection" makes grid
detection a consumer of §7's classification, and §7 classifies by caption grammar, which §6 places
in the app. A grid stage in `cad/` would have to read back an answer the app owns — a second CLI
pass fed with app-produced input, which turns a pure CLI into a two-way protocol and gives the
pinned extractor identity a second, unpinned input.

## 9. Instance placement

Placement constants are **content-scaled shares of the minimum grid spacing, never absolute**:
containment/merge expansion 0.08; near-anchor grid-ref bound 0.9 (beyond it, honest absence);
footprint min 0.6 / max 2.5 of grid spacing (filters building cores and sheet frames); human
snap-to-intersection 0.5 (beyond it, the honest off-grid form — never a snapped lie).
Foundation classes (pile cap, pile, tie/grade beam) take the lawful-null level basis; vertical
classes (column, shear wall) expand per level. Label normalization strips size parentheticals
and compares dotless-uppercase (`TB` matches registered `T.B`) — both forms are the drawing's
own; nothing is invented.

*Amendment, 2026-08-16 (ADR-0009).* **Runs in the app**, and it is the stage that needs the
register: it mints `identity.md` §3's placement and instance row keys behind `forTenant`
(ADR-0004). **The partition it produces is stored and rebuilt per ingest, never computed per
read** — §3 there already presumes it ("row ids re-mint on every partition rebuild"), and the
one-hop level carry has to move filed human dispositions across a rebuild, which no value returned
by a function can hold. The scope register stays a query (`quantity-contract.md` §2.2) because it
reads register rows that already exist; this partition is what makes them exist.

*Amendment, 2026-08-16 (ADR-0009).* **The constants above are rule-set edition parameter values**
(`identity.md` §8) — pinned, signed, and voidable — because a footprint band that rejects a real
column deletes quantity. They are never code literals and never a config file. §10's seed is the
opposite species and is pinned by nothing; see there.

## 10. The extraction convention profile (the generalisation mechanism)

A drawing's conventions — which layers carry bar linework / member outlines / text /
dimensions, which caption grammars name its views — are **resolved per drawing from an entity
census** by geometry statistics and generic features. The resolver is pure; drawing-specific
literals live only in a replaceable seed that may **corroborate but never add, drop, or
re-assign a role** — the ablation law: `resolve(census, {})` must deep-equal
`resolve(census)` for any census. This is what frees the extractor from hardcoded drawing
constants; it is CI-enforced.

*Amendment, 2026-08-16 (ADR-0009).* **Runs in the app.** A profile in `cad/` would mint a
*semantic* claim — this layer carries bar linework — inside an immutable artifact, where it can
never be re-resolved or shown to a human without a re-ingest. The **census is computed by the app
from the entities and is not an artifact field**: shipping it would create a second place the
census is defined. And the **seed is pinned by nothing** — the ablation law bars it from changing
any outcome, so putting its key in a signature would void signatures on a change that by law
affects nothing. What enters the rule-set edition for this clause is the **resolver**, as a
`(rule id, version)` pair.

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
