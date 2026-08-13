# The scale group and its affirmation

[Ticket](../tickets/12-the-scale-group.md) · ruled 2026-08-13

A **scale family** is the set of views the evidence says share one calibration — a `numeric`
pair `(sx, sy)` of metres per native drawing unit, the composite of unit and plot ratio, never
decomposed, never snapped to a nominal ratio, and never collapsed to a scalar (geometry
multiplies per axis, so *"averaged as nothing"* becomes a property). Membership is by evidence,
not enrolment, and **grouping evidence must be over-determined** — more independent constraints
than the one number it establishes — which admits grid match (≥3 shared axes) and rules out
text-height matching. The residual is unrepresentable by six mechanisms, chiefly: positive rows
only, `act_id NOT NULL`, and **no fallback calibration column anywhere**. The ladder keeps one
lane-independent order and gains two clarifications: **rung 2 transfers, never originates** (and
only from an *affirmed* value, so propagation depth is always one act — this is the mechanism
behind "~6–8 acts per project"), and the verification rule **silently demotes rung 4 to
corroboration-only**, since a file has exactly one units header. Arc-fitting is admitted in
principle — over-determined, therefore rejecting — but **not built now**, on sequencing: it
restores only rung 2, which cannot originate the value a PDF view still lacks. The vector-PDF
lane's real cost is stated as a number for ticket 23: **one act per view, against ~6–8 per
project.** Rung 3 there is 26's to resurrect from the surviving dimension *text*, and is circular
until the pairing is trusted.

**The premise was wrong, and that was the finding.** The first slice needs no scale at all:
`count × L × B × H` takes count from grid-relative placement, `L`/`B` from the schedule and `H`
from the level stack. So `calibration_basis` is `SCALED | UNSCALED` on the `levelBases` pattern,
and **`UNSCALED` is measured, not asserted** — the gate perturbs every drawing-unit-sourced
variable by the band and the value must not move.

The arithmetic confirms ±1% for the volume kinds (`3ε ≤ 3%`) and **fails for a heavily-deducted
face**: `net = G(1±2ε) − D` amplifies to 4ε at 50% deductions, unbounded as `D → G`. Remedy is a
**mandatory dip-sample stratum measured by re-evaluating the line's own formula**, not a tighter
band and not a block. One band, four uses (verification ±1%, anisotropy ±1%, rung-2 membership
±0.5%, override ±1%), all comparing two *observations*; they are **methods, not parameters** —
*a threshold from an authority is a parameter; a threshold from our own error budget is a method.*

Schema: `scale_families` (project-scoped, survives a revision) / `calibrations` (append-only,
`act_id NOT NULL`, superseded never updated) / `calibration_observations` (≥2 per axis,
CHECK-enforced) / `view_calibrations` (positive membership, PK `(revision, view)`).
**Recalibration voids a signature by query, never by flag.** Two refusal causes split on remedy:
`SCALE_NOT_AFFIRMED` (a QS act fixes it) and `SCALE_ANISOTROPIC` (only a better file does).

**Corrects two pieces of landed law.** `quantity-contract.md` §4 listed *an unaffirmed
calibration* in the **existence**-impugning reach (ticket 13's amendment), two lines below §4's
own *"an unaffirmed scale declares"*; since identity, placement and the view partition are all
scale-free, it impugns the **number** — the row survives with no quantity, and a lawful `UNSCALED`
line on the same object is no longer severed with it. And §5's *"unplaceable"* is disambiguated
from §9's *placement*, which needs no scale.

Rejected: single-link clustering of proposed values (chains), text-height grouping (zero checks),
symbolic error analysis (a second implementation of the formula), a tighter band, and biasing the
calibration under to buy headroom (ticket 03's rejected move). Opens
`inbox/the-paper-space-viewport-rung.md`.
