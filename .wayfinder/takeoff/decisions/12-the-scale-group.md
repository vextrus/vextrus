# The scale group — a cross-sheet class over annotation height, calibrated by content address

[Ticket](../tickets/12-the-scale-group.md) · ruled 2026-08-15

A scale group is an **equivalence class of views over body-annotation plotted height**, cross-sheet
and never a sheet — the QS affirms *scales* (1:50, 1:100, 1:20), which is what makes ~6–8 acts
arithmetically possible against O(100+) views. **Grid spacing is struck** as corroboration and as a
ladder rank: model space is 1:1, so `minSpacing` is the building's module and carries no scale
information — neither necessary nor sufficient. **Captions are excluded** from the signal (a title
is plotted at constant height whatever the view's scale). The relation runs on **physical plotted
height** — points natively on PDF (absolute, header-free, so the lane that lost two ranks
partitions best), millimetres via `$INSUNITS` on DWG — and a sheet that cannot normalise
(`INSUNITS=0`, unmapped) forms its own **island group**, a smaller partition honestly stated.
Membership is positive: no body text or no dominant mode ⇒ unplaceable, and the residual case is
unrepresentable *structurally* because `calibration_id NOT NULL` leaves no row shape for it. Sheet
inheritance was refused outright, which is why `SCALE_GROUP_ASSIGNED` has to be a real act.

With rank 2 struck the ladder is **rank 4 complete on DWG** (1:1 model space is not a degraded rank
1), rank 3 blocked until the extractor carries DIMENSION defpoints/`measurement`/`DIMLFAC`, and
**rank 1 alone on PDF** — so a PDF group without an affirmed calibration measures nothing, and the
PDF lane measures nothing at all until ticket 15's canvas lands. **No pre-fill from printed scale
notes**: it converts a measurement into a confirmation click. X/Y independence is a property of the
rank (rank 4 isotropic by construction; ranks 1 and 3 demand both axes, costing two drags per
group, with **no isotropic fallback and never an average**), and its tolerance is the **same single
effective-dated ε** as single-observation verification, because both are "two observations of one
quantity must agree". **±1% holds** though the binding exponent is 2 today (`(1+e)^n − 1`: n=2 →
+2.01%, honest threshold ±1.49%) — n=3 arrives with excavation, one number explains, and headroom
costs a re-measure while slack costs a quantity. It bounds *agreement*, not accuracy, and must not
be netted against the under-only ±3% band. Three machine-originated refusal causes
(`SCALE_NOT_AFFIRMED` / `SCALE_GROUP_UNRESOLVED` / `SCALE_SELF_DISAGREEING`) because three remedies
differ; three act types (`SCALE_AFFIRMED` / `SCALE_OVERRIDDEN` / `SCALE_GROUP_ASSIGNED`) so the
dip-sample stratum is a query, not a payload dig.

The calibration key is **derived and content-addressed over the quantized band** —
`(project, normaliser, quantized nominal height, affirmed X, affirmed Y, rank)` — with membership
**recomputed and never stored**. Digesting the member set would void the calibration when the set
merely *grew*, which is the tell it is the wrong thing to digest; quantizing the representative
keeps adding sheets free. Per `identity.md` §9 a calibration is a row-level *semantic* concern.
Per-set-revision affirmation was put and beaten on the map's own destination — it makes a revision a
do-over at the calibration layer. **This ticket builds nothing**: `scale_families` (derived,
per-ingest, member keys as provenance never identity) and `calibrations` (immutable,
content-addressed) are ruled in shape, quantity lines **FK to `calibrations`** so the immutable row
is what survives, and **ticket 13 inherits `calibration_id NOT NULL`** — it may not land a
quantity-line table without it. On slice 1 that constraint multiplies nothing (RCC column concrete
is n=0 and `placement.ts` is ratio-only), so the **torture corpus asserts the refusals, not the
products**. Filed: `inbox/measurement-rules-5-strike-the-grid-rank.md` (the §5 amendment — not made
here) and `inbox/dwg-dimension-attributes.md`. F4's 6–8 figure remains design intent, not a
measurement.
