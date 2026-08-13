# Vector PDF to EntityGraph

wayfinder:research
Status: open
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
