# The scale group and its affirmation

wayfinder:grilling
Status: open
Blocked by:
Claimed by: claude/the-scale-group

## Objective

Graduated from `takeoff-core`'s fog, which parked this with *"chart it when a quantity needs a
length."* The first vertical slice is RCC column concrete. **A quantity now needs a length.**

`measurement-rules.md` §5 calls per-region fail-closed scale a differentiator nobody in the field
ships. It also states the hardest constraint in the system: **a quantity without an affirmed
calibration is unrepresentable — `calibration_id NOT NULL`.** No spine table exists for this yet.

## The decision

1. **What a scale group *is*, mechanically.** §5 says affirmation happens per **scale group**
   (~6–8 acts per project), that per-drawing "affirms a falsehood" (one legacy sheet carried
   three internal scales), and that per-view "degenerates into confirm-all". So a group is
   neither. What derives group membership, and from what evidence?
2. **Positive membership.** §5: *membership is positive, never residual* — a view joins on
   affirmative evidence; no evidence means unplaceable, hatched, and it **measures nothing**.
   Rule what counts as affirmative evidence, and confirm the residual case is unrepresentable
   rather than merely discouraged.
3. **Precedence, implemented.** QS two-point → grid spacing match → overridden dimension ratio
   (style factor divided out) → file units header. **Printed scale notes rank nowhere.** The
   PDF lane loses **two** ranks, not one — ticket 06 measured it: no file-units header exists,
   and no DIMENSION object exists either, so the dimension-ratio rank has no input. `/UserUnit`
   read 1.0 in 14 of 14 files and PDF's own `/Measure` viewport (ISO 32000-1 §12.9) appeared in
   none, so there is no PDF-native substitute. Worse, the surviving grid-spacing rank is itself
   degraded: `cad-ingestion.md` §8 detects a bubble as text inside a **circle**, and the PDF lane
   has no CIRCLE (a circle is four Beziers; recovering one is arc-fitting, which is a guess).
   Rule what a two-rung ladder does to affirmation — and whether an arc-fit *proposal* a QS
   affirms is admissible, or whether the honest answer is that a PDF sheet without a QS two-point
   act is unplaceable and measures nothing.
4. **X and Y derive independently and are averaged as nothing.** Disagreement beyond tolerance
   makes the view unplaceable. Rule the tolerance and where anisotropy is surfaced.
5. **Single-observation verification at ±1% symmetric** — §5 derives this because scale error
   *cubes* into a volume against the ±3% band. Confirm the arithmetic holds for our kinds.
6. **The schema.** `scale_families` / `calibrations` per genesis §4, with `calibration_id NOT
   NULL` on every quantity line. A scale family is in the signed rule set, so **recalibration
   voids every signature scoped to it** — model that now, not after signatures exist.

## Guardrails

- The strict unit lane: an unknown or unmapped unit resolves to **null — never guess a scale**.
  A sheet-layout lane may assume a convention to partition and declare, but nothing on that lane
  may multiply geometry into a stored dimension.
- Machine proposes; a QS affirms. A QS override wins but is a **declared disagreement and a
  dip-sample stratum**.
- `takeoff-core` 05 proved the view partition needs no affirmed scale at all — it reads only
  ratios of the drawing's own text heights. Do not regress that.
