# Raster-to-geometry: a measured error distribution

Ticket: `.wayfinder/takeoff/tickets/07-raster-to-geometry.md` item 2 — *measured error, not claimed
error*. No published benchmark scores scanned-construction-drawing vectorization, so this
generates one against ground truth we own.

**Companion file:** `raster-vectorization.md` holds the licence/tooling/OCR literature. This file
holds only numbers this repo produced.

## Provenance

Taken 2026-08-13 on `claude/raster-to-geometry-wl4bsu@63baec8`, linux x64, in a disposable
container. Harness was throwaway (scratchpad, not committed — it is a measurement instrument, not
product code); it is reproducible from the description below and the numbers are quoted here
because the container is not.

Stack: `opencv-contrib-python-headless==5.0.0.93`, `numpy==2.5.2`, `pillow==12.3.0`, CPython 3.13.12.

## Method

- **Ground truth** — a synthetic 20 m × 15 m plan defined in *model* millimetres: external wall
  (0.50 mm plotted weight), internal partitions and a 4 × 3 grid of 450 mm columns (0.35 mm),
  and thin grid lines (0.13 mm). 62 segments. Because we author the DXF-equivalent geometry, the
  truth is exact — no human-traced reference to argue with.
- **Render** — 4× supersampled then box-filtered to the target DPI, so the raster is a plot, not
  a screenshot. Plotted weights convert paper-mm → px at the target DPI.
- **Degrade** — three levels. `clean` (born-digital raster), `scan` (σ=0.8 px blur, σ=6 Gaussian
  noise, JPEG q55), `fax` (σ=1.6 px blur, σ=14 noise, JPEG q25, photocopier contrast crush).
  Deskew is assumed perfect — rotation error is a separate, unmeasured term.
- **Vectorize** — Otsu binarize → `cv2.ximgproc.FastLineDetector` (`do_merge=True`). A
  deterministic classical detector, deliberately: it establishes the floor a stack with no
  licence risk and no model weights achieves.
- **Match** — detections are assigned to a ground-truth centreline by direction (±5°) and
  perpendicular band (half stroke + 2 px), then stroke edge-pairs are collapsed by
  length-weighted mean offset. A segment counts as *found* only at ≥50 % coverage.
- **Report** — all errors converted back to **model mm at 1:100**. Three separate error terms,
  because conflating them hides the finding:
  - **offset** — perpendicular distance of the recovered centreline from truth (*where the line is*)
  - **extent** — error in the recovered start-to-end span (*where the line stops*)
  - **gap** — length inside the extent that no detection covered (*fragmentation*)

## Results

Errors in **model mm at 1:100**; `rec` is recall at ≥50 % coverage; `spur` is unmatched
detections for the whole page.

| dpi | level | spur | lw | n | rec | off p50 | off p95 | ext p50 | ext p95 | gap p95 | frag max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 150 | clean | 0 | 0.13 | 7 | 1.000 | 8.4 | 31.1 | 7.5 | 24.4 | 2099.7 | 10 |
| 150 | clean | 0 | 0.35 | 51 | 0.647 | 17.0 | 35.9 | 26.3 | 94.4 | 17.4 | 2 |
| 150 | clean | 0 | 0.50 | 4 | 1.000 | 16.1 | 17.7 | 19.9 | 19.9 | 16.9 | 2 |
| 150 | scan | 12 | 0.13 | 7 | 0.857 | 31.1 | 40.0 | 19.8 | 2520.3 | 7061.2 | 6 |
| 150 | scan | 12 | 0.35 | 51 | **0.157** | 32.1 | 37.4 | 25.2 | 103.3 | 85.7 | 2 |
| 150 | scan | 12 | 0.50 | 4 | 1.000 | 9.2 | 21.5 | 36.8 | 52.5 | 33.9 | 2 |
| 150 | fax | 16 | 0.13 | 7 | **0.000** | — | — | — | — | — | 0 |
| 150 | fax | 16 | 0.35 | 51 | 0.529 | 21.6 | 33.5 | 162.0 | 378.5 | 1946.5 | 14 |
| 150 | fax | 16 | 0.50 | 4 | 1.000 | 15.1 | 16.7 | 18.7 | 30.9 | 16.9 | 3 |
| 200 | clean | 0 | 0.13 | 7 | 1.000 | 4.3 | 24.9 | 2.8 | 11.7 | 127.0 | 2 |
| 200 | clean | 0 | 0.35 | 51 | 1.000 | 10.6 | 15.3 | 7.4 | 56.4 | 25.6 | 2 |
| 200 | clean | 0 | 0.50 | 4 | 1.000 | 14.0 | 14.0 | 22.9 | 36.8 | 25.4 | 2 |
| 200 | scan | 10 | 0.13 | 7 | 0.714 | 24.7 | 25.9 | 48.0 | 2219.7 | 2400.3 | 10 |
| 200 | scan | 10 | 0.35 | 51 | 0.922 | 9.0 | 17.7 | 18.3 | 71.9 | 25.7 | 6 |
| 200 | scan | 10 | 0.50 | 4 | 1.000 | 14.0 | 14.8 | 24.1 | 36.8 | 25.4 | 6 |
| 200 | fax | 5 | 0.13 | 7 | **0.000** | — | — | — | — | — | 0 |
| 200 | fax | 5 | 0.35 | 51 | 0.980 | 11.6 | 26.8 | 30.7 | 132.7 | 25.4 | 6 |
| 200 | fax | 5 | 0.50 | 4 | 1.000 | 8.5 | 8.8 | 11.4 | 28.0 | 25.5 | 3 |
| 300 | clean | 0 | 0.13 | 7 | 1.000 | 16.9 | 19.7 | 1.0 | 22.6 | 93.1 | 2 |
| 300 | clean | 0 | 0.35 | 51 | 1.000 | 7.1 | 12.3 | 15.7 | 50.7 | 25.7 | 2 |
| 300 | clean | 0 | 0.50 | 4 | 1.000 | 8.8 | 9.2 | 23.7 | 36.8 | 33.9 | 3 |
| 300 | scan | 5 | 0.13 | 7 | 1.000 | 16.9 | 19.8 | 9.5 | 14.1 | 110.1 | 3 |
| 300 | scan | 5 | 0.35 | 51 | 0.980 | 7.2 | 11.5 | 15.7 | 59.2 | 25.7 | 2 |
| 300 | scan | 5 | 0.50 | 4 | 1.000 | 8.8 | 8.9 | 32.1 | 36.8 | 33.8 | 3 |
| 300 | fax | 4 | 0.13 | 7 | **0.000** | — | — | — | — | — | 0 |
| 300 | fax | 4 | 0.35 | 51 | 1.000 | 6.4 | 9.1 | 15.7 | 56.4 | 17.3 | 3 |
| 300 | fax | 4 | 0.50 | 4 | 1.000 | 7.5 | 9.2 | 15.2 | 28.3 | 25.4 | 3 |
| 600 | clean | 0 | 0.13 | 7 | 1.000 | 4.0 | 4.3 | 3.2 | 11.7 | 8.5 | 3 |
| 600 | clean | 0 | 0.35 | 51 | 1.000 | 4.0 | 6.8 | 15.7 | 47.9 | 25.4 | 3 |
| 600 | clean | 0 | 0.50 | 4 | 1.000 | 3.4 | 4.6 | 24.1 | 32.1 | 29.6 | 3 |
| 600 | scan | 1 | 0.13 | 7 | 1.000 | 4.0 | 4.3 | 3.2 | 11.7 | 8.5 | 4 |
| 600 | scan | 1 | 0.35 | 51 | 1.000 | 4.0 | 6.8 | 15.7 | 52.2 | 25.5 | 3 |
| 600 | scan | 1 | 0.50 | 4 | 1.000 | 3.4 | 4.6 | 32.1 | 32.6 | 29.6 | 3 |
| 600 | fax | 4 | 0.13 | 7 | 1.000 | 6.1 | 8.0 | 9.4 | 22.6 | 448.7 | 43 |
| 600 | fax | 4 | 0.35 | 51 | 1.000 | 3.5 | 4.8 | 18.2 | 52.1 | 21.3 | 4 |
| 600 | fax | 4 | 0.50 | 4 | 1.000 | 3.6 | 4.5 | 32.1 | 32.4 | 29.6 | 3 |

## Findings

### F1 — Position error scales with DPI; extent error does not

Perpendicular offset improves monotonically and roughly linearly with resolution — on the 0.50 mm
class, p95 runs 17.7 → 14.0 → 9.2 → 4.6 mm across 150/200/300/600 dpi. Extent error on the same
class does not move: 19.9 → 36.8 → 36.8 → 32.1 mm. Same at 0.35 mm: p95 extent sits between 47.9
and 59.2 mm at every resolution from 200 dpi up, while offset falls from 15.3 to 4.8.

The cause is structural, not optical. A line's *ends* are junctions, and every edge-based detector
trims or overshoots at a junction; more pixels do not resolve a corner the detector is choosing not
to commit to. **Buying resolution buys you position, never extent.** This is the single most
consequential number in the set, because a quantity is almost always an *extent*.

### F2 — The dimension floor is ~1.2 m

Worst-case extent p95 for a class that is reliably detected at ≥200 dpi is ≈ 37 mm (0.50 mm class,
scan). At `quantity-contract.md` §5's ±3 % under / +0 % over, a raster-derived dimension only fits
inside tolerance above 37 / 0.03 ≈ **1 230 mm**. A thickness measured *between* two detected lines
carries up to two position errors — 2 × 17.7 ≈ 35 mm at 200 dpi — landing in the same place.

Against real members:

| member | dimension | extent p95 as % | verdict |
|---|---|---|---|
| column 450 sq | 450 mm | 8.2 % | **unmeasurable** |
| beam width | 250 mm | 14.8 % | **unmeasurable** |
| wall thickness | 125 mm | 29.6 % | **unmeasurable** |
| room span | 3 000 mm | 1.2 % | within tolerance |
| floor plate run | 20 000 mm | 0.2 % | within tolerance |

Raster geometry is competent at *building-scale* extents and incompetent at *member-scale* ones —
and member-scale is where the concrete volume and the BBS live.

### F3 — Whole line classes vanish silently

At `fax` quality the 0.13 mm grid-line class scores **recall 0.000 at 150, 200 and 300 dpi**, while
the 0.35 mm and 0.50 mm classes on the very same image score 0.98–1.00. The thin class does not
degrade; it disappears. The detector reports no error, because a line that left no pixels leaves no
trace of having existed.

This is the governing sentence's exact failure mode. A raster page cannot compute its own coverage
denominator: "I found 55 lines" is indistinguishable from "there were 55 lines" and from "there
were 62 and 7 fell below my threshold". Vector and DXF lanes get their denominator from the
entity table; raster has no equivalent and cannot manufacture one.

### F4 — 150 dpi is below the floor, and the failure is quiet

At 150 dpi `scan`, the 0.35 mm class — the *bulk* of the drawing, 51 of 62 segments — scores
**recall 0.157**. 84 % of the drawing's geometry is gone, with 12 spurious detections in its place.
A 0.35 mm line at 150 dpi is 2.07 px; after a blur that spans it, it is below the detector's floor.
The ticket's "150 dpi fax of a 1:100 plan is not measurable by anyone" is confirmed with a number,
and it is worse than "inaccurate" — it is confidently sparse.

### F5 — The classical stack is bit-deterministic

Identical input produced byte-identical output across three separate interpreter processes
(SHA-256 over rounded coordinates, all four dpi × level cells stable). Otsu + FastLineDetector is a
pure function of the pixels.

Caveat, and it is not small: this tests one machine, one OpenCV build, one architecture. It says
nothing about determinism across OpenCV versions, across CPU architectures (SIMD paths differ), or
about any neural vectorizer. Determinism here is a property of *this stack choice*, and it is a
reason to prefer it — a neural detector would have to earn the same result before ticket 02's
source keys could depend on it.

### F6 — Fragmentation is the hidden term

`frag max` reaches 43 detections for a single ground-truth line (600 dpi fax, thin class) with
448 mm of uncovered gap inside the recovered extent. A pipeline that merges collinear fragments is
guessing across those gaps; one that does not emits 43 short lines where one belongs. Both are
wrong, differently. Fragmentation is where a "we found the line" claim quietly becomes a
"we invented its geometry" claim, and any merge rule needs its own named threshold — which by
`CLAUDE.md` is config, not a constant.

## What this does not measure

Stated so nobody reads more into the table than it holds:

- **Deskew** — rotation is assumed perfectly corrected. Real scans arrive rotated, and that error
  adds to everything above.
- **Scale affirmation** — the harness knows the scale because it authored it. A real scan's scale
  is exactly what ticket 03 says must be affirmed, never inferred.
- **Curves, arcs, hatches, dashed lines, text** — straight solid lines only. Dashed lines will
  behave like the fragmentation case, worse.
- **Neural vectorizers** — none tested. The measured floor is the classical stack's.
- **Real scans** — synthetic degradation is a model of a scanner, not a scanner. The direction of
  the findings is robust; the exact millimetres are not portable to a specific real device.
