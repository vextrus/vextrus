# Raster to geometry — the scan lane

[Ticket](../tickets/07-raster-to-geometry.md) · ruled 2026-08-13 · findings in [`docs/research/raster-vectorization.md`](../../../docs/research/raster-vectorization.md) and [`raster-geometry-error-measurement.md`](../../../docs/research/raster-geometry-error-measurement.md)

The scan lane **originates a location, never a dimension**: measured extent error is flat in DPI
and set by the plotted line weight (~0.7 paper mm), putting a ±3% dimension floor at ~23× the
scale denominator — ~2.4 m at 1:100, above every member-scale dimension we measure. The signed
error is **biased 66% into over-measurement** (median +7.4 mm), the direction §4 hard-blocks —
which independently evidences 03's rejection of a "reliably one-sided-under" vectorizer. A raster
page also cannot compute its own coverage denominator (thin line classes hit recall 0.000 while
heavy classes on the same image hit 1.000), so the denominator comes from the schedule or a human,
or the page refuses. A computed quality gate refuses below 200 dpi *effective*. Vectorizer is
classical and bit-deterministic (OpenCV LSD, Apache-2.0 — the ticket's "patent" premise was wrong,
it was an AGPL conflict, resolved in 4.5.4). Bangla routes to a human: PaddleOCR ships no Bengali
model and the best open figure on scanned Bengali documents is CER 0.59. Rejected: demand better
scans (extent error is flat in DPI, and published work shows accuracy can *fall* from 300→400 dpi)
and per-line confidence scores (the missing class carries no score at all). Opens tickets 25
and 26.
