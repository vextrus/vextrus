# Vector PDF to EntityGraph

wayfinder:research
Status: closed
Blocked by:
Claimed by:

## Objective

Charting ruled the **EntityGraph is the one interface**: no downstream stage may learn a second
source format exists. Vector PDF must therefore land in the same versioned 10-type vocabulary
that `cad/` already emits from DXF. Establish, from primary sources and from running code
against real files, whether that is achievable and at what fidelity.

## What must be established

1. **Which permissively-licensed library exposes vector paths with coordinates** — pdfplumber /
   pdfminer.six, pypdfium2, pikepdf, PDFBox. The distinction that matters: *rendering* a page is
   not *extracting* it. We need path operators, not pixels.
2. **Text with position AND world height.** `cad-ingestion.md` §4 requires text to carry its
   world height because clients painting labels at screen size collide on zoom — and the view
   partition (`takeoff-core` 05) keys its coverage band on **caption height**. If PDF text
   height is not recoverable, the whole partition is unavailable on this lane and that must be
   known now, not after the member rail is built.
3. **Optional Content Groups → layers.** `cad-ingestion.md` §10's convention profile resolves
   roles from an entity census including layer statistics. Do OCGs survive extraction?
4. **Units and scale.** A PDF has no `$INSUNITS`. `measurement-rules.md` §5's precedence loses
   its lowest rank, so the fail-closed path runs for real on every PDF. Confirm what *is*
   available — page MediaBox, embedded scale annotations — and at what rank, remembering §5's
   measured finding that **printed scale notes are not evidence at any rank**.
5. **The mapping.** Which of the 10 EntityGraph types each PDF construct becomes, and what has
   no representation — those become `unsupported_by_type` counters, never silent drops.
6. **The derived/original distinction.** §3's extractor invariant bars derived paint. A PDF is
   *all* paint — there are no block references, everything is flattened. State plainly what
   "original" means on this lane, because if everything is original the invariant is vacuous and
   if nothing is, the lane yields nothing.

## Guardrails

- AGPL PDF libraries (PyMuPDF/fitz, mutool) are **banned in shipped code** and a licence test
  asserts it (`cad-ingestion.md` §1). Ghostscript is AGPL — confirm before proposing.
- Findings land in `docs/research/`; the ruling lands here.
- HABS/HAER is licence-clean and PDF (`docs/research/drawing-corpora.md`) — it is the lawful
  test material for this lane.

## Resolution

**Ruled 2026-08-13.** Findings: `docs/research/vector-pdf-to-entitygraph.md`. Probe:
`docs/research/probes/vector-pdf/` (every figure below reproduces from it; corpus is scratch-only
by `drawing-corpora.md`). Measured on `claude/vector-pdf-entity-graph-vsl1f2@63baec8`, linux x64,
pikepdf 10.11.0 / libqpdf 12.3.2 · pdfplumber 0.11.10 · pypdfium2 5.12.1 / PDFium 152.0.7947.0.

**The lane is admitted, at a fidelity of two entity types out of ten and one channel in four.**
A vector PDF lands in the EntityGraph as **LWPOLYLINE + TEXT**; LINE, CIRCLE, ARC, SOLID,
POLYLINE, MTEXT, INSERT and DIMENSION have no PDF representation and become
`unsupported_by_type` counters. The one-interface ruling holds — the envelope needs no new
type — but the artifact must say **which lane produced it**, because a consumer that cannot
distinguish a 2-of-10 artifact from a 10-of-10 one reads absence as evidence of absence. That is
the new ticket, *The lane fidelity declaration*.

**The extractor is `pikepdf` (MPL-2.0); `pypdfium2` stays, for rendering, not extraction.**
This completes `cad-ingestion.md` §1's choice rather than displacing it. The measurement that
forced it: PDFium's public API **cannot name an object's layer**. It reports the `/OC` mark and
even the OCG dictionary's key names, but every param types as `FPDF_OBJECT_UNKNOWN` and
`GetParamStringValue` returns 0 — verified on two files. pikepdf does paths, text, layers and
the clip/paint distinction in one content-stream pass; a second library would mean a second
geometry model joined on floating-point coordinates. Throughput is not the constraint: **21,651
painted paths/s** single-threaded pure Python (138,017 paths across 39 sheets in 6.37 s) against
a bar of 833/s.

**Answers to the six questions, each with the measurement:**

1. **Library** — pikepdf, above.
2. **Text with world height — available, and routinely absent.** Recoverable as `Tf` size ×
   text-matrix scale, matching pdfplumber exactly (9.0 / 8.4 / 10.0 across three files). But
   **three of three real CAD-plotted sheets yielded zero characters** (2,784 / 6,935 / 7,153
   paths, 0 chars) — AutoCAD SHX text plots as outlines, and our own r1 fixture reproduces it.
   Text extractability is a property of the object, not the file. **The view partition is
   therefore unavailable on any sheet whose captions are outlined** — the ticket's stated fear,
   confirmed. It is a *lawful* refusal rather than a silence because the absence is decidable at
   ingest: `chars == 0 ∧ paths > 0`.
3. **OCGs survive when present, and are usually not present.** Full per-object membership
   recovered via `BDC /OC` + `/Resources/Properties` — proven on a constructed two-layer file and
   on `level11.pdf` (1,079 paths attributed to `Layer 1`). But **zero of five real CAD-plotted
   sheets carried an OCG**: the PostScript→Distiller path flattens them away. So `cad-ingestion.md`
   §10's convention profile loses its layer-statistics column on the dominant real case and must
   report `layer_channel_absent` rather than an empty layer on every entity. Trap, measured:
   Seattle's 327-sheet set has an `/OCProperties` dictionary containing **zero OCGs** — count the
   OCGs, never test for the key.
4. **Scale — the ladder loses two rungs, not one.** MediaBox is paper (all five CAD sheets are
   US Letter, plotted to fit); `/UserUnit` is 1.0 in 14 of 14; and PDF's own measurement
   mechanism, ISO 32000-1 §12.9 viewport `/Measure`, appeared in **zero of 14 files**. The
   ticket expected to lose the file-units rank; the **dimension-ratio rank dies too**, because a
   PDF has no DIMENSION object tying a measurement string to the geometry it measures. Only QS
   two-point and grid-spacing match remain — and grid detection is itself degraded, since §8
   detects a bubble as text inside a **circle** and this lane has no CIRCLE. Fed to ticket 12,
   whose point 3 is amended.
5. **The mapping** — above; detail in §5 of the findings. Two channels PDF gives us free: colour
   arrives already resolved (no BYLAYER problem), and page extents are exact (§4's stray-entity
   percentile rejection has nothing to do).
6. **The derived/original distinction is not vacuous, and the handle has no analogue.** Against
   ground truth we own: 59 original DXF entities plot to **100 painted paths, 0 text, and 99
   clip rectangles** (`re W n`). Treating `n` as paint would have invented 99 phantom closed
   outlines on a 59-entity drawing — a 2.7× over-count, the fabrication class
   `measurement-rules.md` §3 hard-blocks. So the invariant restates as *no operator that does not
   paint may become an entity, and no entity may be synthesized from a construct the file does
   not contain*. What it can no longer do is separate a block-internal label from a drawn one;
   the plotter destroyed that. Separately, on ordinals: across the committed r1→r2 revision pair,
   **90 of 100 painted paths match by geometry while only 65 keep their content-stream index** —
   a three-column edit renumbers a quarter of the untouched drawing.

**Two notes added after this ticket closed, when ticket 02 landed on `main` the same day:**

- **The ordinal measurement above is weaker evidence than first written here.** 02 scoped source
  keys to `(file bytes, extractor identity)` and *does not* claim cross-file survival — pairing
  across revisions stays `identity.md` §4's job. Within one file, same bytes through same code,
  an ordinal re-derives identically, and 02's ruling 7 says so explicitly: the real warrant for a
  content digest is **self-authentication**, not counter re-minting. What the measurement does
  show, and it is worth keeping: a geometry digest would have carried 90 of 100 across a revision
  where an ordinal carried 65. That is a fact for §4's pairing, not a load-bearing argument for
  02's construction.
- **02 and this ticket disagree about who decomposes a PDF page.** 02 ruled `PDF_OBJECT` is
  minted by **pdfium** and landed that in `cad-ingestion.md` §2's table, whose `asserted by`
  column reads "pdfium's decomposition"; this ticket ruled the extractor is **pikepdf**, under
  which the answer is "us". Neither session could see the other. **Not resolved here** — a
  merge is the wrong place to overturn a landed amendment. Opened as ticket 24.

**The alternative put and rejected: pypdfium2 alone, keeping ADR §1 untouched.** It is the
cheaper answer and it is already the ADR's choice, so the bar for changing it was high. Rejected
on the measured layer finding — a lane that can see an object is on a layer but never which one
would have to synthesize a layer name or emit none, and both are the silent-default class
`CLAUDE.md` bars. A second alternative, pdfplumber (MIT, the gentlest licence), was rejected for
the same gap plus a worse one: it surfaces clip rectangles as ordinary `rects`, which is how the
99 phantom outlines get in.

**A correction to this ticket's own guardrail.** HABS/HAER is *not* vector-PDF test material:
verified against the LoC item API, its measured drawings are TIFF/JPEG and its only PDFs are the
typed data-page reports. HABS belongs to ticket 07. The replacement corpus — agency-published
CAD-plotted sheets and CC BY-SA Commons plans — is listed in the findings and refetchable by
`docs/research/probes/vector-pdf/fetch.sh`.

**Stated plainly, not established:** no AutoCAD-plotted (`DWG To PDF.pc3`) sample was obtainable
in this session, so the OCG-present case rests on an Illustrator file, a constructed file, and
vendor documentation. No Bangladeshi drawing was measured on this lane. Rotated text was never
measured on a text-bearing sheet — every sheet in the corpus carrying rotated text has it
outlined.
