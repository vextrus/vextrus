# The scale group and its affirmation

wayfinder:grilling
Status: closed
Blocked by:
Claimed by:

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

## Resolution

Ruled 2026-08-13 by grilling. The law landed in `measurement-rules.md` §5 (the bullets are
unchanged and four new sub-sections carry the mechanism), with clauses in `identity.md` §8,
`cad-ingestion.md` §8 and `quantity-contract.md` §2, plus the two refusal causes the ruling makes
emittable (`src/core/enums.ts` + migration `0012_scale-refusal-causes.sql`, replayed against 126
existing rows, no drift). No `quantity_lines` table exists yet — grep-verified — so the
`calibration_id NOT NULL` clause is written as the law binding the migration that mints it, and
the spine tables land with it rather than standing empty in front of it (genesis §5: nothing
speculative is built).

**1. A scale family is the extent of one calibration act, and membership is a measured ratio of
1.** What forced the shape: §5 rules out both a sheet and a view, so the group had to be
constituted by something neither — and the only candidate that is *evidence* rather than style is
a **shared physical referent**. Two views are co-members iff both depict the same identified grid
axis pair (`cad-ingestion.md` §8's backbone, matched by label) and the ratio of their drawn
separations of it is 1 within §5.3's tolerance. That is a ratio, so it computes with no affirmed
scale, which is what keeps takeoff-core 05's guardrail unregressed. The family itself is an
**authored project object with a surrogate id** — the level's shape (`identity.md` §2), because
it is the subject of a human act and a content-derived key would re-mint on every re-partition
and orphan the calibrations hanging off it. `identity.md` §3's zero-minted-ids law binds *derived
row keys*; a level, an act and a set-revision pin already show the line, and a calibration sits on
the authored side of it.

*Rejected: the annotation-height cluster.* It is the obvious machine answer and it is wrong by
arithmetic — 2.5 mm of annotation plotted at 1:100 lands at the same world height as 5 mm at
1:50, so equal text height is consistent with two different scales. Ticket 05 uses text-height
*ratios within a sheet* to partition views, and that is all that quantity can carry; promoting it
to a scale witness would be the "assume a convention to partition" lane multiplying geometry into
a stored dimension, which this ticket's own guardrail bars.

*Rejected: cluster-then-confirm over anything (layer, sheet, style).* A similarity cluster has no
false-negative story — its residue is precisely a residual membership, which §5 forbids by name.

**2. Positive membership, made unrepresentable in four places.** Prose was not enough; the ruling
names the mechanisms. Membership is stored **extensionally** as enumerated view keys, so
"residual" has no syntax; there is **no default calibration** at project, drawing or sheet level
(`identity.md` §8's *never a nullable fallback*, whose stated reason — the rule set in force must
not be a query result that widens under a signed bill — transfers verbatim to the ruler in
force); a **bulk affirmation is lawful only over an enumerated proposal list**, so *confirm the
rest of this sheet* cannot be written even though `identity.md` §7 permits one act with N
subjects; and `calibration_id` is a NOT NULL FK to an immutable row. Affirmative evidence is
exactly the rank-1 act and the rank-2 shared-referent witness of ruling 3 — same sheet, same
layer, same text height and any printed scale note are each evidence of nothing.

The cost is smaller than it reads: only layout-plan-class views yield instances
(`cad-ingestion.md` §7), and schedules and details are read as text, so the views that must be
placed are the views one family act already covers.

**3. The two-rung ladder — ranks are not one kind of thing, and that is what the PDF lane
exposes.** Ruled: **rank 2 propagates, it does not originate.** Grid spacing match converts an
*already established* referent length into membership for every view depicting that referent; it
has no way to mint a length of its own, and the temptation to give it one — matching the drawn
spacing against a plausible round number — is a guess wearing arithmetic's clothes and is barred
by name. Ranks 1, 3 and 4 originate. Ticket 06 measured away 3 and 4 on the PDF lane (no
`$INSUNITS`; `/UserUnit` 1.0 in 14 of 14; `/Measure` in 0 of 14; no DIMENSION object), so **the
PDF lane retains no machine origination rank at all**, and the honest consequence is stated
without hedging: a PDF sheet that no QS two-point act reaches is unplaceable and measures
nothing. That is one act per set of plans, because rank 2 still propagates it — which is also the
answer to why the ladder losing two rungs is survivable at all.

*The arc-fit question, answered by splitting it.* A fitted circle may **order the queue** and may
never enter the artifact, position an axis, or multiply into a stored dimension. What is
admissible is not the fit but the **human's affirmation that these texts are grid bubbles** — an
act — with positions taken from the original TEXT anchors. This is takeoff-core 06's ruling
(*the circle corroborates a signature anchored on an original, never invents the bubble*) applied
to a lane where the circle is not even in the file: an arc-fit is derived paint *we invented*,
which is strictly weaker than the derived paint §3 already refuses. *Rejected: admitting an
affirmed arc-fit as geometry*, on the ground that a human looked — the human looked at the sheet,
not at our fitted radius, and storing the fit would launder a guess through an act. Where the
text is outlined too (0 chars on 3 of 3 CAD plots), rank 2 has no anchors either and the sheet is
rank-1-or-nothing.

**4. X and Y — never averaged, gated at ±1%, surfaced as a distinct refusal.** A calibration
stores `scale_x` and `scale_y` and applies each to its own axis; a mean is a ruler neither
observation supports, and "averaged as nothing" is read literally as *never averaged* rather than
as *store one number*. The gate is `|sx/sy − 1| ≤ 1%` — the same figure as the verification band,
because both answer the same question (how much disagreement between two readings of one ruler is
tolerable), and a second constant would be a second answer to it. Anisotropy surfaces as
`SCALE_ANISOTROPIC` in the disposition queue and as the scope-register exclusions its unplaceable
views produce on the certificate — never as a per-line note. The cause is **split from**
`SCALE_NOT_AFFIRMED` on `quantity-contract.md` §2's own test, opposite remedies: one clears with a
single QS act on the family, the other with no act at all (rectify or re-supply the sheet), and
one queue bucket holding both would route a one-click fix and an unfixable view identically.
*Rejected: folding both into `NOT_ESTABLISHED`* — it is true and useless, and the enum exists to
name remedies.

**5. ±1% symmetric — the arithmetic confirmed, and it is tighter than it looks.** `1.01³ =
1.0303`: a 1% scale error spends **3.03% of the ±3% band** on a wholly geometric volume — the
whole allowance and a hair, with nothing left for the rest of the pipeline. So ±1% is a
**ceiling, not a comfort margin**, and the correct reading of §5's derivation is that nothing
looser is arguable rather than that 1% is safe. Confirmed for our kinds with one honest
qualification: our first slice does not sit at the ceiling. RCC column concrete is
`count × L × B × H` (`formulas.md` §2) with L and B `TRANSCRIBED` off the schedule and H from the
level stack (§7), so on the good path scale multiplies **nothing**; the cubic exposure belongs to
the schedule-silent path, where the section is read off the plan, and to the face and slab kinds
that follow. The band is nevertheless set for the worst kind a ruler serves, because a family
cannot know which kinds will hang off it later. Symmetry holds although over-measurement is a
hard block at +0%: biasing the ruler low to protect that gate derives an input from the figure
the gate compares against, which `quantity-contract.md` §5's yardstick rules ban outright, and
§6 keeps the register free of safety margins. Verification is two observations per axis, and they
**corroborate rather than blend** — agreement bumps the edition, disagreement beyond 1% suspends
the family pending re-affirmation, which is `identity.md` §7's existing shape reused rather than
new machinery.

**6. The schema — immutable calibrations, and a void scope that is derived rather than listed.**
`scale_families` · `calibrations` (`scale_x`/`scale_y` as real SI length per drawing unit,
`numeric`; the printed `1:100` is never stored, per §6's facts-not-conventions rule) ·
`calibration_observations` · membership keyed `(family, view key)`. A recalibration **mints and
supersedes**; nothing is edited, so *which ruler produced this figure* is a pinned id rather than
a history diff (`identity.md` §7 rejects before-images). `calibration_id NOT NULL` on every
quantity line cites the calibration of the view the line's geometry was read from — the layout
plan, for a placed member — and stays unconditional even where every input is `TRANSCRIBED`,
because a conditional NOT NULL is a nullable column with a rule and its exception clause is
ruling 2's banned fallback.

**Voiding, modelled now as the ticket demanded:** a signature covers lines, a line pins a
calibration, a calibration names a family — so "every signature scoped to it" is a query, and a
family nobody measured against can void nothing. *Rejected: a signed-calibration list on the
signature* — `identity.md` §9 already faced this exact choice for the drawing-set manifest and
ruled there is no second list, because two lists diverge; and *rejected: bumping the project rule
set's edition*, which would void signatures over boundaries whose lines never touched the
recalibrated family, i.e. void wider than §5 says.

Ruled with it, because it is what makes the strict unit lane mechanical: **the unit seam is
typed.** Drawing-unit values are a distinct type from stored SI lengths and the single exported
conversion takes a `Calibration`, so multiplying geometry into a stored dimension without an
affirmed one is a compile error in one decision site, with the CI check for a second site that
`mayYieldInstances` already established.

### Assumption named (`CLAUDE.md` §5 — nobody was watching)

§5 says rank 2 is "grid spacing match" without saying *match against what*. Read as
match-against-an-established-referent it propagates; read as match-against-a-plausible-spacing it
originates by guessing. The propagation reading is taken, because the other reading is a
prohibited guess and because only the propagation reading explains the ~6–8 acts figure §5 states
as a fact. Everything in ruling 3 rests on it.

### Downstream

- **Ticket 13 (the rail gate) / the first slice** owes the migration: `scale_families`,
  `calibrations`, `calibration_observations`, membership, and `quantity_lines.calibration_id NOT
  NULL` — with the `db/rls.ts` block on every one (ADR-0004) and `pnpm db:replay` before commit.
  The two refusal causes are already landed and replayed, so nothing there widens an enum.
- **Ticket 14 (the disposition queue)** owes the two causes' routing: `SCALE_NOT_AFFIRMED` to a
  family-level affirmation surface (one act, N views), `SCALE_ANISOTROPIC` to a sheet-level
  remedy, and no "confirm remaining" control anywhere — ruling 2 makes that control
  unimplementable, and it must not be reintroduced in the UI.
- **Ticket 15 (the canvas)** owes the hatch: an unplaceable view is hatched, and the hatch is
  never carried by colour alone (`quantity-contract.md` §6).
- **Ticket 09 (the torture corpus)**: entry 7 (three internal scales; `NOT TO SCALE` that is to
  scale) and added case C (absent scale evidence) are now **ruled** on the expectation axis — the
  three-scale sheet partitions into three families and each measures nothing until affirmed; a
  view with no witness yields a `SCALE_NOT_AFFIRMED` refusal and no line. Both stay
  implementation-`pending`. Ticket 09's index is not yet code (grep-verified), so nothing was
  expired here; the ticket that builds it should read these as ruled.
- **Ticket 07 (raster to geometry)** gains a boundary: rectification is the remedy for
  anisotropy, and it belongs to the image, never to the calibration — the register never holds a
  two-axis ruler that disagrees with itself.
