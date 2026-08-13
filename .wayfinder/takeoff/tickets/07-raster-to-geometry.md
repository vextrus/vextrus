# Raster to geometry — the scan lane

wayfinder:research
Status: closed
Blocked by:
Claimed by:

## Objective

The CEO ruled raster PDF **genuinely in**: BD clients send scans often and a module that refuses
them gets returned. Ticket 03 rules its *basis*; this ticket establishes what is actually
achievable, with what tooling, at what measured error.

## What must be established

1. **The vectorization stack**, permissively licensed only. `docs/research/ai-for-drawing-understanding.md`
   already flagged two licence bombs to avoid — **LayoutLMv3 is CC BY-NC-SA 4.0**, and **Surya's
   weights are modified Open-RAIL-M** (free only below $5M revenue, with Marker depending on
   them). Verified-clean candidates found: PaddleOCR-VL (Apache-2.0, and **beating Gemini 3 Pro
   on table TEDS, 94.76 vs 89.15**), DeepSeek-OCR (MIT), docTR (Apache-2.0), Table Transformer
   (MIT).
2. **Measured error, not claimed error.** There is **no published benchmark for scanned-drawing
   vectorization quality** — so we must generate one: rasterize a known synthetic DXF at several
   DPIs, vectorize, and measure the geometric error distribution against ground truth we own.
   This is the only way ticket 03's tolerance question can be answered with a number.
3. **Determinism.** Ticket 02 needs to know whether re-vectorizing the same page reproduces the
   same geometry. If not, source keys orphan on re-ingest and the consequence must be named.
4. **Bangla OCR.** Research found **no primary-source Bangla OCR accuracy figure exists**.
   Measure one, or state that we cannot and route Bangla text to a human.
5. **The honest floor.** At what scan quality does the lane stop being usable? A 150 dpi fax of a
   1:100 plan is not measurable by anyone, and the product must say so with a named cause rather
   than produce a number.

## Guardrails

- Charting's staged ruling: **human tracing over a calibrated scan ships first** — it is the
  incumbent workflow, needs no accuracy claim, and lands the on-screen measurement surface we
  need on every lane anyway. Machine vectorization ships alongside it under `INTERPRETED`.
- Abstention is never the model's decision (`docs/research/ai-for-drawing-understanding.md`:
  GPT-5 scores 34.46% on ChartHal, where the answer is absent from the chart).
- Over-measurement is a hard block with no qualification door (`quantity-contract.md` §5).

## Resolution

Two files carry the detail; this holds the rulings.

- `docs/research/raster-vectorization.md` — licences, determinism, Bangla, benchmarks, scan floor,
  every claim to a primary source, 14 items named unverified.
- `docs/research/raster-geometry-error-measurement.md` — the error distribution we generated,
  because none is published.

### R1 — The scan lane originates a location, never a dimension

**Raster-derived geometry may propose an element's position, extent-of-existence and topology. It
may never originate a number that reaches a bill line.** Dimensions come from the schedule
(ticket 19) or from plan annotation, cited by source key, or the element defers with a named cause.

*The measurement that forced it.* Perpendicular position error scales with resolution — p95 falls
17.7 → 4.6 mm across 150/200/300/600 dpi. **Extent error does not move**: 19.9 → 32.1 mm, no trend.
Expressed in paper space the whole table collapses onto one ratio: extent p95 is **0.3–0.7 paper mm
at every resolution**, roughly one plotted line weight. Line ends are junctions, and pixels do not
resolve a junction. So the floor is set by the pen, not the scanner:

> extent error p95 ≈ 0.7 paper mm × the scale denominator → a **±3 % dimension floor of ≈ 23 ×
> the scale denominator**: ~1.2 m at 1:50, **~2.4 m at 1:100**, ~4.8 m at 1:200.

Every member-scale dimension is out of reach by an order of magnitude — wall thickness 125 mm at
58 % error, beam width 250 mm at 29 %, column 450 mm at 16 % — and member scale is where concrete
volume and the entire BBS live. Even a 3 m room span consumes the whole ±3 % band on its own before
any other error term is added. Corroboration that this is the junction and not the pixel: at 300 dpi
the scan quantum is 8.5 mm on site (`raster-vectorization.md` §5b iii) while measured extent error
is 6–8× that.

*The alternative put and rejected.* **Demand better scans.** Rejected on F1: extent error is flat in
DPI, so the money buys position we already have and not the extent we need. Worse, the one published
DPI-vs-accuracy study on engineering drawings (Al-Douri et al. 2011) found two of three commercial
vectorizers *peaked at 300 dpi and declined at 400* — higher resolution resolves more paper grain.
Scanning hotter is not merely insufficient, it is not reliably even monotone.

*Independent of the tolerance arithmetic*, `quantity-contract.md` §4 closes this anyway, and the
signed distribution is worse than a symmetric one: **66 % of recovered extents overshoot** (240 of
365 at ≥200 dpi, median **+7.4 mm**), because an edge detector carries a line into the corner blob
where two strokes meet. The mean sits near zero only because thin-line fragmentation contributes a
few very large undershoots. Over-measurement is a **hard block with no qualification door**, so a
raster-originated dimension can never be made publishable by disclosure — no disclosure lets a
reader know to subtract. A vectorizer biased two-to-one into the forbidden direction does not need
a wider band; it must not originate a dimension at all.

### R2 — A raster page cannot compute its own coverage denominator

**The denominator is supplied from outside the pixels — the sheet's own schedule, or a human
affirming the boundary (`quantity-contract.md` §6) — or the page publishes a refusal, not a
partial bill.**

*The measurement that forced it.* At fax quality the 0.13 mm grid-line class scores **recall 0.000
at 150, 200 and 300 dpi** while the 0.35 mm and 0.50 mm classes on the very same image score
0.98–1.00. The thin class does not degrade; it disappears, and the detector emits no error, because
a line that left no pixels leaves no trace of having existed. `quantity-contract.md` §2's second
denominator derives the scope register from *what ingestion saw* — and raster ingestion provably
cannot see what it missed. DXF and vector lanes get their denominator from the entity table; raster
has no equivalent and cannot manufacture one.

*The alternative put and rejected.* **Per-line confidence scores, and let the QS review the low
ones.** Rejected because the failure is invisible to the producer: a score can only be attached to a
line that was found, and the entire missing class carries no score at all. This is exactly the
confidence-score reflex `quantity-contract.md` §1's two-axes law exists to prevent — it would
convert a silent absence into a reassuring number.

### R3 — A computed scan-quality gate runs before vectorization and refuses by name

| band | behaviour |
|---|---|
| **< 200 dpi effective** | **refuse** — `SCAN_BELOW_MEASURABLE_FLOOR`. No geometry proposed |
| **200–300 dpi** | human tracing over a calibrated scan only. No machine geometry |
| **≥ 300 dpi, unstitched** | machine vectorization permitted under `INTERPRETED` |
| **any stitched oversize capture** | flagged regardless of DPI |

"Effective dpi" is computed from the raster's pixel dimensions and the sheet's physical size, and
from stroke-width statistics — **never trusted from PDF metadata**, since a 150 dpi scan upsampled
to 600 dpi carries a 600 dpi header and none of the information.

*The measurement that forced it.* At 150 dpi `scan` the 0.35 mm class — 51 of the 62 segments, the
bulk of the drawing — scores **recall 0.157**, with 12 spurious detections replacing what vanished.
The lane does not degrade at 150 dpi, it becomes confidently sparse. Two independent primary rules
condemn the same point without reference to our data: NARA's *"at least 2 pixels should cover"* the
finest line (a 0.18 mm line gets 1.06 px at 150 dpi) and Tesseract's 10-px x-height floor. 150 dpi
is below **every** FADGI star level for plans. The stitched-capture flag is FADGI's: oversize
originals captured in sections suffer *"loss of geometric accuracy… inherent"* — an unbounded,
unstated error before any detector runs.

The refusal is legal under the governing sentence because it needs no accuracy claim to be correct
and can only cause us to measure less, and it is **computed from stored data — page dpi and affirmed
scale — never judged.** Abstention stays out of the model's hands.

### R4 — The vectorizer is classical and deterministic; no neural model originates geometry

**Stack** (all permissive, verified at the licence file this session): pypdfium2 → scikit-image
binarize (BSD-3) → `cv2.ximgproc.thinning` (Apache-2.0) → **`cv2.LineSegmentDetector`** (Apache-2.0,
core `imgproc`) → Tesseract or PaddleOCR for text (both Apache-2.0).

**Two ticket premises are corrected.** LSD left OpenCV over an **AGPL licence conflict, not a
patent** — the IPOL reference implementation is AGPL-3.0-or-later — and it was **restored in 4.5.4**
under Apache-2.0. The original IPOL `lsd.c` must never enter the tree; OpenCV's is clean. And LSD is
preferred over the `FastLineDetector` this harness used: FLD is Canny-based with two hardcoded
thresholds, which against scans of unknown contrast is precisely `CLAUDE.md`'s no-silent-defaults
hazard, whereas LSD is presented by its authors as parameter-free. Potrace is disqualified on
capability before licence — its own FAQ says it does not do centreline tracing.

*The measurement that forced the determinism half.* Identical input produced **byte-identical output
across three separate interpreter processes**, all dpi × degradation cells stable under SHA-256.
Verified in source rather than inferred: `lsd.cpp` and `fast_line_detector.cpp` contain no RNG and
no `parallel_for`; `HoughLinesP` randomises but with a hardcoded seed. Neural OCR is the opposite and
its vendors say so — PyTorch disclaims reproducibility across releases, commits and platforms; vLLM's
FAQ answers "can output vary across runs" with *"Yes, it can."*

**This answers ticket 02's question 3 conditionally, and the condition is load-bearing.** Source keys
over raster geometry are stable for a pinned OpenCV version on one build. Bit-identity **across CPU
architectures and SIMD dispatch paths is unverified** — cheaply measurable, and 02 must measure it
before relying on it rather than inherit this as settled.

**Two named holes, both builds rather than dependencies**: no permissive text/graphics separation
implementation was found (without it, dimension strings and hatching reach the line detector as
spurious segments — on a drawing this matters more than the detector choice), and **no permissive
tool emits a bounded arc with endpoints**, which is why GREC ran an arc-segmentation contest for a
decade. Arcs are an unsolved sub-problem of this lane, not a library call.

### R5 — Bangla text on a scan routes to a human

*The evidence that forced it.* The ticket's premise that no primary Bangla figure exists is
**superseded — three now do, and they are bad.** On scanned Bengali documents, bbOCR (the best open
system) reports text-level **CER 0.59** and Tesseract **0.78**: the majority of characters wrong.
Surya reports Bengali 82.7 % but its weights are revenue-gated and unusable. Decisively, **PaddleOCR
— our preferred Apache-2.0 OCR stack — ships no Bengali model at all**; its 11 published
multilingual models contain none and the `bengali_dict.txt` on `main` is an orphan with zero code
references. docTR has a Bengali vocab but no pretrained model.

*The alternative put and rejected.* **Ship EasyOCR's Bengali model unattended** — it is Apache-2.0,
has a Bengali model, and is the best conventional engine in the one head-to-head that exists.
Rejected on the numbers: nothing in this range supports an unattended path, and its weights licence
is itself unverified. EasyOCR remains the candidate to *measure* if a machine Bangla path is
attempted later, licence confirmed first.

### R6 — Amend the "no benchmark" claim rather than repeat it

No published benchmark measures **metric geometric error on scanned construction drawings** — that
much stands. But the IAPR GREC arc/line segmentation contests (2009–2013) and Liu & Dori's **Vector
Recovery Index** are the right metric family, and modern floorplan work (R2V, CubiCasa5K,
FloorplanVLM's 92.52 % IoU) scores *topology* or *area overlap*, never millimetres. Report VRI for
comparability against that literature — but **decisions need the three-term decomposition**
(position / extent / fragmentation), because VRI is a single scalar with no term separating *where
the line is* from *where it stops*, and R1 lives entirely in that separation. A VRI-only harness
would have hidden the finding.

### Reconciliation with 02 and 03

Both closed on `main` in parallel sessions while this ticket was worked, and both are **consistent
with these rulings** — reconciled here rather than left to a reader to notice.

- **03 (`INTERPRETED` basis)** reached R1's conclusion from the other side and got there first:
  an `INTERPRETED` line reaches a bill **only as `AGREED`**, and uncorroborated interpreted
  geometry is a declared exclusion, not a line. R1 is the *geometric* reason that gate is the right
  one — the numbers were never publishable on their own.
- **03 explicitly asked this ticket for the signed distribution**, having rejected a hypothetical
  inner-edge-biased vectorizer that was "reliably one-sided-under". **Measured: it runs the
  opposite way — 66 % overshoot, median +7.4 mm.** 03's rejection stands and is now evidenced
  rather than precautionary.
- **03 also makes the vectorizer id + version + DPI triple a mandatory publishable attribute.**
  R4 pins the stack and version, and R3 already requires the effective dpi to be stored and
  computed rather than judged, so the triple is satisfiable. This ticket adds no new obligation.
- **02 (source key)** minted `RASTER_TRACE` with its `asserted by` column reading **"us"** — our
  own vectorizer is the atom, as against `PDF_OBJECT`'s "pdfium's decomposition". R4's classical,
  pinned, deterministic stack is what makes that atom well-defined.
- **02 scoped keys to `(file bytes, extractor identity)`, ruling a vectorizer upgrade a declared
  re-ingest.** That disposes of *version* drift. It does **not** dispose of R4's caveat, which
  sharpens rather than dissolves: two machines running the *same* extractor identity on different
  CPU architectures or SIMD dispatch paths would mint different keys **inside one identity**, which
  is the case 02's scoping does not cover and no re-ingest declares. Cheap to measure; measure it
  before the raster lane runs on heterogeneous hardware.

### What this hands forward

- **19 (member-type registry)** — promoted to critical path for the raster lane. Under R1 the
  schedule is not one dimension source among several on a scan; it is the **only** one.
- **09 (torture corpus)** — F3's vanishing line class is a fixture: a page whose thin layer is
  below the floor must produce a named refusal, never a sparse bill.

### Named assumption

The DPI-vs-line-width arithmetic is parametric because **ISO 128's line-width series could not be
verified** — `iso.org` returned HTTP 403 twice — so no ISO value is asserted anywhere. 0.13–0.18 mm
is treated as the plausible thin end of a CAD-plotted plan, a working assumption to be replaced by a
verified figure. Our own harness authored its line weights, so R1's paper-space law is unaffected;
the *required-dpi* tables in `raster-vectorization.md` §5b move if the series differs.
