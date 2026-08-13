# The scale group and its affirmation

[Ticket](../tickets/12-the-scale-group.md) · ruled 2026-08-13 · law in
[`docs/domain/measurement-rules.md`](../../../docs/domain/measurement-rules.md) §5.1–§5.4

A **scale family is the extent of one calibration act**, and co-membership is a *measured ratio
of 1* over a shared physical referent — the same grid axis pair, matched by label — never a
similarity cluster. The annotation-height cluster was rejected by arithmetic: 2.5 mm at 1:100 and
5 mm at 1:50 plot to the same world height. The family is an authored project object with a
surrogate id (the level's shape); calibrations are **immutable and superseded, never edited**.

**Ranks are two kinds of thing: 1, 3 and 4 originate a length; rank 2 only propagates one.** That
is why the family exists (without propagation, affirmation is per view and degenerates into
confirm-all) and why ticket 06's measurement bites: the PDF lane keeps ranks 1 and 2, so it
retains **no machine origination rank at all**, and a PDF sheet no QS two-point act reaches is
unplaceable and measures nothing. An arc-fit may order the human's queue and may never enter the
artifact, position an axis, or become a stored dimension.

Residual membership is made unrepresentable in four places (extensional membership, no default
calibration anywhere, bulk affirmation only over an enumerated list, `calibration_id NOT NULL`),
not merely discouraged. X and Y are stored and applied separately and **never averaged**, gated at
`|sx/sy − 1| ≤ 1%`. The ±1% verification band is confirmed and re-read as a **ceiling**: `1.01³ =
1.0303` spends the entire ±3% band on a volume. Recalibration's void scope is **derived** —
signature → line → `calibration_id` → family — so there is no second list, the same construction
as the drawing-set manifest.

Landed with it: `SCALE_NOT_AFFIRMED` and `SCALE_ANISOTROPIC` in the shared refusal taxonomy
(split on opposite remedies), migration `0012_scale-refusal-causes.sql`. The spine tables and the
`NOT NULL` clause are owed by the first slice's migration — `quantity_lines` does not exist yet.
