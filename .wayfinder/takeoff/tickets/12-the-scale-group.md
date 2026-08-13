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

Ruled 2026-08-13. **Worked AFK against a `grilling` ticket** — the dispatcher was not in session
and this ticket's questions are answerable from the domain law, the landed `takeoff-core` code and
tickets 05/06/07/13's measurements. Every ruling below names the evidence that forced it; the one
place where a live QS would have changed the answer is flagged in ruling 3.

### 0. The premise is wrong, and that is the most useful thing here

The objective says *"a quantity now needs a length."* **It does not.** Walk the first vertical
slice's formulas:

| term | source | scaled? |
|---|---|---|
| column count | `placement.ts` — content-scaled shares of grid spacing, `cad-ingestion.md` §9 | no |
| `L`, `B` | the column schedule / the mark's size parenthetical — text, `TRANSCRIBED` | no |
| `H` | the level stack, `measurement-rules.md` §7 — `TRANSCRIBED\|DERIVED\|ENTERED` | no |

`formulas.md` §2's rect prism (`count × L × B × H`) and §3's vertical formwork
(`count × 2(L+B) × storey height`) are **entirely scale-free**, and so is everything upstream:
`takeoff-core` 05 proved the view partition reads only text-height *ratios*, §8's grid derives
axes in native units, §9's placement constants are shares. **RCC column concrete and its formwork
publish with no calibration at all.**

The first *scaled* consumers are `PRISM_POLY`'s `shoelace(plan)` (a pile cap), `AREA_THICK`
(a slab), `FRUSTUM_RECT` off a section, and the face algebra's outline — the second slice.

This is why the spine is modelled **now** rather than under slice pressure: it is the last moment
at which the schema can be got right without a rail leaning on it. And it forces ruling 6's
`UNSCALED` form — had this ticket not run, the first slice would have hit `calibration_id NOT NULL`
with nothing lawful to put in it, and the pressure would have been to mint a fake calibration.

### 1. What a scale group is: an equivalence class of views under one calibration

A **scale family** is the set of views the evidence says share one calibration. It is not a
semantic grouping ("the plans"), not a sheet, and not a view.

- **A calibration is one scalar pair, `(sx, sy)`, in metres of real length per native drawing
  unit** — the *composite* of the drawing's unit and its plot ratio, never decomposed into the
  two. Decomposition would require attributing the factor between two quantities neither of which
  is observed. This is also why the file-units rung is weakest: it observes the unit and
  *assumes* model space is 1:1.
- **The stored value is the measured number, never a nominal ratio snapped to it.** A measured
  1:99.2 is not stored as 1:100 — that is a silent 0.8% edit, and ruling 5 shows the whole budget
  is 1%. A nominal ratio may print as a label; it may never multiply.
- **Membership is by evidence, not by enrolment**, so the affirmation act covers members that
  join later on the same evidence, and group affirmation is not a confirm-all wearing a hat.
  Membership is a pure function of the pinned revision's artifact (ticket 04), so re-derivation
  inside one campaign is idempotent and new members arrive only through a revision — which is
  04's delta and re-presents by construction.
- **Grouping evidence must be over-determined**: it must carry more independent constraints than
  the one number it establishes, so a false grouping is *detected* rather than assumed. This is
  the general rule the rest of this ticket leans on. It admits grid match (N shared axes ⇒ N−1
  ratio checks, ≥3 axes required) and it **rules out matching by text height** — real evidence
  (text plotted at a fixed paper size has model height inversely proportional to plot scale, and
  `takeoff-core` 05 already computes heights) but a single scalar coincidence with zero checks.
  Over-merging applies one affirmed scale to a view of another, silently, in the *over* direction
  half the time; that is the class §4 hard-blocks.

*Rejected:* clustering views by proposed value with single-link agglomeration — chaining walks a
±1% link from 1:100 to 1:105 across enough views, and the result is order-dependent.

### 2. Positive membership, and the residual made unrepresentable

Affirmative evidence is a candidate calibration derived **from that view's own original
entities**, by a named rung. Nothing else is evidence: not the sheet a view sits on, not a
neighbouring view, not a layer or block name (§8/§10), not a printed scale note (§5, measured).

Six mechanisms make the residual case unrepresentable rather than discouraged:

1. `view_calibrations` holds **positive rows only**. A view is in a family iff a row exists;
   there is no complement, no "unassigned" family, no default row.
2. **No project-level, tenant-level or lane-level fallback calibration column exists anywhere**,
   by prohibition. The `NOT NULL` on the line is defeated by exactly one thing — a fallback —
   and `identity.md` §8 already ruled the analogous case for rule sets ("never nullable
   fallback — a fallback makes *the rule set in force* a query result that widens").
3. `calibrations.act_id` is `NOT NULL`: **no calibration exists without a human act**, and the
   act row and the calibration row commit in one transaction (`identity.md` §7).
4. A line's calibration slot is **gate-derived, never rail-supplied** (ticket 13's law for basis
   roll-ups, applied here for the same reason).
5. It is **measured, not asserted** — see ruling 6.
6. A torture-corpus case (09's already-admitted *absent scale*) asserts that a view with no
   evidence yields no membership row and that its scaled kinds surface `SCALE_NOT_AFFIRMED`.

A view with no evidence measures nothing, is hatched on the canvas, and its absence is named.

### 3. The ladder, its two jobs, and what a short lane really costs

The four rungs stand, **in one lane-independent order** — a lane never re-ranks to compensate for
a rung it lacks. What varies is which rungs have input. Restated with the job each does:

| rank | rung | job | DXF | vector PDF | raster |
|---|---|---|---|---|---|
| 1 | QS two-point | originates a value, per axis | ✓ | ✓ | ✓ |
| 2 | grid spacing match | **transfers** an affirmed value to another view via ≥3 shared axis labels | ✓ | ✗ no CIRCLE | ✗ |
| 3 | overridden dimension ratio (style factor divided out) | originates a value | ✓ | ✗ no DIMENSION (see below) | ✗ |
| 4 | file units header | originates a value under a declared 1:1 assumption | ✓ `$INSUNITS` | ✗ `/UserUnit` 1.0 in 14/14, `/Measure` 0/14 | ✗ |

**Rung 2 is the mechanism behind §5's "~6–8 acts per project."** It matches a view's own axis
labels against an *already affirmed* member's grid — the grid is one physical object seen twice,
so the match is over-determined and self-checking. It **matches only against an affirmed
calibration, never against a proposal**: propagation depth is therefore always exactly one act,
and error cannot compound down a chain. A family may form on rung-2 evidence alone *before* any
value exists ("these views share an unknown scale"); one two-point act then values all of them.
That, not a checkbox, is what turns ~400 views into ~8 acts.

**The verification rule silently demotes rung 4 to corroboration-only.** Ruling 5 requires two
agreeing observations per axis, and a file has exactly one units header — a second of its kind can
never exist. Rung 3 can self-verify (two dimensions on different baselines); rung 1 self-verifies
(two acts). So affirmation is always rung 1 or rung 3, optionally corroborated by rung 4, and
spread by rung 2.

**What the vector-PDF lane costs, stated as a number.** Rungs 3 and 4 have no input (ticket 06,
measured); rung 2 has none either, so nothing spreads. The lane is not *unlawful* — affirmation's
shape is lane-independent — it loses **reach per act**: **one QS act per view carrying scaled
quantities, against ~6–8 per project on the DXF lane.** That figure belongs in front of a QS
*before* they upload a PDF set → handed to ticket 23 (the lane fidelity declaration).

**Arc-fitting is admissible, and is not the binding constraint.** A closed path approximating a
circle is over-determined (8+ control points, 3 unknowns), so recovering the centre is a
*rejecting* recogniser, not a guess: a rounded rectangle and a filled dot fail the residual and
are refused. It meets ruling 1's over-determination test, the axis position comes from the
original's own geometry, and it originates no dimension — it is `grid.ts`'s already-ruled
"free-standing bubble" form with the circle recovered by fit rather than declared by type, and
`grid.ts`'s law ("the circle is admissible as corroboration of a signature anchored on an
original — never as the thing that invents the bubble") binds it unchanged. So it is admitted in
principle and **not built now**, on sequencing rather than safety: it restores rung 2 only, rung 2
spreads a value it cannot originate, and originating one on a PDF view needs the canvas and the
disposition queue (15, 14) that do not exist. Build it after those, with the rounded-rectangle and
filled-dot refusals as corpus cases. *This is the one ruling a live QS might have moved:* if PDF
sets dominate real BD practice, the acts-per-view cost may be intolerable enough to pull the
recogniser forward. The ruling does not block that; it orders it.

**Rung 3 on the PDF lane is not permanently dead — it is ticket 26's.** The DIMENSION *object* is
gone but its measurement text survives as an original TEXT and its extension lines as polylines,
so the rung could be reconstructed by pairing a number to a baseline. There is a trap in it worth
recording: on the DXF lane the rung reads the **override** and divides the style factor out
against the object's own measured value; on the PDF lane the printed number is *all* there is, and
the only thing to check it against is the polyline geometry — which is the very thing being
calibrated. Reconstructing rung 3 there is circular unless the pairing itself is trusted. Handed
to 26 (*the dimension annotation lane*), which already owns exactly this disagreement.

### 4. X and Y, and where anisotropy surfaces

`(sx, sy)` are two independent observations of one isotropic scale and are **never averaged, and
never collapsed to a scalar**. The mechanical consequence: **geometry always multiplies per axis**
— an axis-aligned area is `(dx·sx)(dy·sy)`, a diagonal length is `√((dx·sx)² + (dy·sy)²)`. There
is no scalar scale anywhere in the system for a formula to reach for, which is what makes
"averaged as nothing" a property rather than a slogan.

- **Beyond band ⇒ no calibration row exists.** The view is unplaceable, measures nothing, and
  carries the named cause `SCALE_ANISOTROPIC`.
- **Within band ⇒ both values stored**, and the residual ratio is recorded on the calibration and
  printed **on the certificate per scale family** — never per line and never per count, taking
  ticket 03's disclosure grain verbatim, for the same reason (a per-line disclosure is noise a
  reader cannot act on).

### 5. The arithmetic: ±1% holds for the volume kinds and **fails for a heavily-deducted face**

The derivation, confirmed: a quantity whose every dimension is scaled carries `3ε` against the
±3% band, so `ε ≤ 1%` per axis. `FRUSTUM_RECT` off a section is the real cubic case. Verification
at ±1% between two observations leaves each ~±0.5% of their mean, so a volume spends ~1.5% of the
3% band and leaves ~1.5% for transcription, junction conventions and rounding. That holds.

**One band, four uses, one arithmetic** — every scale comparison in the system is a comparison of
two *observations*, never of an observation against truth:

| test | band | derivation |
|---|---|---|
| verification (two observations, one axis) | ±1.0% | `3ε ≤ 3%`, §5 |
| anisotropy (`sx` vs `sy`) | ±1.0% | two observations each ±0.5% may differ by 1% by chance |
| rung-2 membership (member vs the family's **affirmed** value, never another member) | ±0.5% | the affirmed value already spent half the axis budget |
| QS override vs machine proposal | ±1.0% | inside it there is no disagreement to declare |

**These bands are `methods`, not `parameters`** (`measurement-rules.md` §1) — typed as literals,
enumerated by rule id + version, CI-asserting a content hash. The distinction the seed table was
missing, now stated: **a threshold that comes from an authority is a parameter; a threshold
derived from our own error budget is a method.** A project that could loosen `±1%` to `±5%` would
be configuring its way out of the contract.

**The finding the ticket did not ask for.** The worst exponent in our kinds is *not* the volume's
3. The face algebra nets a **scaled** gross against **unscaled** scheduled openings:
`net = G(1 ± 2ε) − D`, so the relative error on the net is `2ε·G/(G−D)` — 2.9ε at 30% deductions,
**4ε at 50%**, unbounded as `D → G`. A curtain-walled elevation therefore breaches ±3% at a
lawful ±1% calibration.

The remedy is **not** a tighter band (the band is derived and the deduction ratio is unbounded)
and **not** a block (the measurement is lawful; it has less headroom). It is:

> **The gate measures each line's scale-error amplification by re-evaluating the line's own
> formula with every drawing-unit-sourced variable perturbed by the band, and where the result
> exceeds ±3%, the line joins a mandatory dip-sample stratum.**

This costs one extra decimal evaluation, uses ticket 13's existing formula re-evaluation, is
deterministic, and follows §5's own precedent (an unvalidated class becomes a mandatory
dip-sample stratum). *Rejected:* symbolic error analysis — a second implementation of the formula,
which is the thing 13's re-evaluation check exists to avoid.

**Why the band is symmetric while the contract is not.** A calibration is an *observation*, not a
quantity. Biasing it under to buy headroom is the move ticket 03 already rejected for the
vectorizer, and it would corrupt anisotropy, verification and membership — every one of which
compares two observations. The asymmetry is enforced at the gate, on the value, and is never
smuggled into the scale.

### 6. The schema

Four tables and one column pair. Nothing here is built by this ticket.

- **`scale_families`** — tenant- and project-scoped, surrogate id, a **display-only** label
  (correctable, never identity). No calibration columns: *a family with no calibration is the
  normal pre-affirmation state.* The family is **project-scoped and survives a revision**;
  membership is revision-scoped. That is what makes a re-issued sheet a delta — evidence that
  still reconciles re-joins with no new act; evidence that does not, presents.
- **`calibrations`** — append-only. `scale_family_id`, `sx`/`sy` `numeric` (never float, per
  `CLAUDE.md`), the originating rung, `act_id NOT NULL`, `superseded_by` nullable. Recalibration
  **inserts**; it never updates (`identity.md` §7 rejects before-images).
- **`calibration_observations`** — append-only, **≥2 per axis, CHECK-enforced**: axis, value,
  rung, and the `scheme:key` source keys (ticket 02) the observation cites. The affirmation is
  *one act at the granularity performed* (§7) carrying four or more observations — which is how
  "~6–8 acts" and "two observations per axis" are both true at once.
- **`view_calibrations`** — positive membership. PK `(drawing_revision_id, view_id)`, so a view is
  in **at most one** family; `calibration_id NOT NULL`; the joining rung and the measured residual.

On `quantity_lines`, the `levelBases` pattern verbatim (`register_objects` is the working
exemplar): `calibration_basis text NOT NULL` over a new
`calibrationBases = ["SCALED", "UNSCALED"] as const`, `calibration_id uuid` nullable, and
`CHECK (("calibration_basis" = 'SCALED') = ("calibration_id" is not null))` — never a bare NULL.

**`UNSCALED` is measured, not asserted.** The gate perturbs every drawing-unit-sourced variable by
the band (the same evaluation ruling 5 already requires) and a line is `UNSCALED` **iff the value
does not move**. A rail cannot claim it and a mislabel is caught by the check that was already
running. This is the amendment to §5's `NOT NULL` clause, and it is not a loophole: the clause
exists to stop a quantity that *depended on* a scale from existing without an affirmed one, and a
formula with no scaled term did not.

**Recalibration voids a signature by query, never by flag.** A signature records each scale family
it scoped and that family's calibration id at signing; it is void iff any of those ids is now
superseded. Nothing writes the void, so no `UPDATE` can be forgotten — 13's ruling that the scope
register is a query, applied to the same failure mode. Voiding is **whole** (`identity.md` §8).

### 7. Two corrections to landed law

**(a) `quantity-contract.md` §4 lists "an unaffirmed calibration" in the wrong reach.** Ticket 13's
amendment put it in the **existence**-impugning class, which severs the object from bill reach
entirely — two lines below §4's own sentence *"an unaffirmed scale **declares**"*, which is
number-impugning behaviour. Ruling 0 is the measurement that settles it: identity, placement and
the view partition are all scale-free, so an unaffirmed calibration leaves the object's existence
untouched and impugns only the number. Under 13's placement, a column whose `UNSCALED` concrete
line is perfectly lawful would be severed because *another* offer on the same object cited an
unaffirmed calibration — severance is per object, suppression is per line, and *no line is the
most expensive defect* (§6). **Amended:** an unaffirmed calibration suppresses the *quantity* —
the row survives with no quantity, a named deferral and a queue item. Nothing else in 13 moves:
the gate still refuses an offer carrying a scaled term with no calibration.

**(b) "Unplaceable" is two words in §5.** §5's *unplaceable* means "no calibration can be placed
on this view"; `cad-ingestion.md` §9's *placement* means "this instance is located against the
grid", and `takeoff-core` proved the second needs no scale. Disambiguated in the amendment.

### 8. Two refusal causes, split on remedy

`refusalCauses` gains two members (a schema change riding a new migration, per `enums.ts`),
split on the test that already split `INGESTION_TRUNCATED` from `ENTITY_TYPE_UNHANDLED` —
**opposite remedies**:

- **`SCALE_NOT_AFFIRMED`** — a calibration is obtainable by a QS act inside the product. Covers
  both *no evidence at all* (the act is a two-point measurement) and *a proposal awaiting
  affirmation* (the act is a confirmation); they differ in how much work the act is, which the
  queue shows, not in what fixes them.
- **`SCALE_ANISOTROPIC`** — the axes disagree beyond band. No act inside the product fixes it;
  the remedy is a better source file.

Both are machine-originated, in the one taxonomy with two originators (`identity.md` §7). Neither
is written onto a bill row: they reach the scope register as **machine deferral records**, which
the register's `CASE` already reads (13) — and they matter precisely because without them an
unaffirmed scale group falls through to `NOT_ESTABLISHED` and reads as generic residue, when in
fact one act would make two hundred lines appear.

### 9. What this owes the corpus (ticket 09)

Expires 09's already-admitted **absent scale** `undecided` entry, and adds:

1. a view with no scale evidence ⇒ **no** membership row; its scaled kinds surface
   `SCALE_NOT_AFFIRMED`; its `UNSCALED` kinds **still publish**;
2. `sx`/`sy` disagreeing by >1% ⇒ no calibration, `SCALE_ANISOTROPIC`, view measures nothing;
3. a rung-2 join at 0.4% and a refusal at 0.6%;
4. a single observation on an axis ⇒ **not affirmed**, no calibration;
5. a rail offering a scaled term with no calibration ⇒ gate refusal, row survives, object intact;
6. a rail labelling a scaled line `UNSCALED` ⇒ caught by perturbation;
7. a 55%-deducted face at a lawful ±1% calibration ⇒ published **and** in the dip-sample stratum;
8. a superseded calibration ⇒ every signature scoping that family reads void;
9. (deferred to the PDF grid build) a rounded rectangle and a filled dot ⇒ **not** bubbles.

### 10. Surfaced

- `inbox/the-paper-space-viewport-rung.md` — a DXF paper-space VIEWPORT carries the exporter's own
  model→paper ratio. It is not a printed note (§5's ban is on *text*), it is the transform the
  plot actually used, and §5's ladder does not mention it. Where it ranks, and whether the
  sheet-layout lane §5 permits to "partition and declare" may originate a value, is sharp and
  unanswered.
