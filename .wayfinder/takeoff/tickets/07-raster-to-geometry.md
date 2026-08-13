# Raster to geometry — the scan lane

wayfinder:research
Status: open
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
