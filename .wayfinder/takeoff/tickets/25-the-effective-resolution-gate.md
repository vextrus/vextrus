# The effective-resolution gate — refusing a scan before it lies

wayfinder:grilling
Status: open
Blocked by: 07-raster-to-geometry.md, 03-the-interpreted-basis.md
Claimed by:

## Objective

Ticket 07 ruled that a computed scan-quality gate runs **before** vectorization and refuses below
200 dpi effective, because at 150 dpi the bulk line class scores recall 0.157 and the lane becomes
confidently sparse rather than visibly broken. It named the band table but not the mechanism. This
ticket rules how "effective resolution" is established, since **the number that matters is the one
the page will not tell you.**

## The decision

1. **The upsampling trap.** A 150 dpi scan resampled to 600 dpi carries a 600 dpi header and none
   of the information — it passes any metadata check and fails every measurement. 07 ruled the
   figure must come from the pixels. From *what* in the pixels: stroke-width statistics, edge
   rise-distance, a spectral cutoff? Each has a different failure mode on a drawing that is
   legitimately mostly whitespace.
2. **What "effective" is measured against.** Effective dpi is a ratio to a physical sheet size,
   and a scan of an A1 sheet cropped to its border is not the same page as one with 40 mm of
   scanner bed around it. Does the gate need the sheet size affirmed first — making this
   downstream of the same affirmation `measurement-rules.md` §5 requires for scale — or can it be
   established from the title block?
3. **Stitched capture.** FADGI records that oversize originals captured in sections carry
   *"loss of geometric accuracy… inherent"*, unbounded and unstated, **regardless of DPI**. 07
   ruled it flagged. What detects a stitch seam, and is the flag a refusal, a declared exclusion,
   or an input to the disposition queue?
4. **Where the figure is stored.** 07 ruled the refusal must be *computed from stored data* so it
   never requires a model to judge whether a scan "looks bad". That means page dpi and affirmed
   scale are both durable. Which artifact holds them, and does re-ingesting the same page at a
   different rasterization dpi change the answer?
5. **One gate or per-region.** `raster-vectorization.md` §5b(ii) shows a single global dpi cannot
   be optimal for both the thinnest line and the largest text on one sheet — Tesseract documents
   an x-height *ceiling* near 30 px as well as a floor. Is the gate per-page, or does the text
   lane carry its own?

## Guardrails

- The refusal reason is **computed, never judged** — abstention is not the model's decision.
- A refusal can only cause us to measure less, so it needs no accuracy claim to be correct
  (`quantity-contract.md` §4). The gate's errors must fall on the refusing side by construction.
- Thresholds are **effective-dated config, never constants** (`CLAUDE.md`). "200 dpi" is 07's
  ruling on the band, not a literal to hardcode.
- Do not re-litigate 07's band table. This ticket rules the *mechanism*, and may only revisit the
  bands if the mechanism proves one unmeasurable.
