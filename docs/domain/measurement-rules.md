# Measurement rules — versioned data, cited, refusing

Re-derived 2026-08-12 from the legacy decision record and its measured censuses.

## 1. Rules as data; parameter vs method

Measurement thresholds are **versioned data with clause citations**, pinned per project,
consulted by the engine at fan-out time — swapping a threshold changes output with **no code
edit**, and a QS reviewer checks *which rules priced the job*. The load-bearing split:

- **Parameters** (per-project config, carried on the project record, identified by record
  edition — a priced line names the exact figures that priced it).
- **Methods** (never configurable, typed as literals, enumerated by rule id + version, CI
  asserting a content hash of the implementation). Exemplar: **rebar volume is never deducted
  from concrete** — a method, with no engine path to toggle it.

Seed rule set `IS1200_IN @ 2026.08` — **the version string names India**, because Bangladesh
has no measurement authority for these values and mislabeling them Bangladeshi was a named
legacy defect (see `bd-authority.md`):

| key | seed | meaning |
|---|---|---|
| `openingDeductionMinM2` | 0.1 | openings deduct from concrete volume / formwork contact area only above this |
| `memberEndNoDeductMaxCm2` | 500 | ends of dissimilar members not deducted up to this section |
| `embeddedDuctNoDeductMaxCm2` | 100 | embedded pipes/ducts not deducted up to this |
| `finishOpeningDeductionMinM2` | 0.1 | openings deduct from brickwork/plaster/paint area only above this |
| `finishMinOutlineArea` / `finishMaxOutlineArea` | 0.2 / 20,000 sft | plausibility band; out-of-band outlines are dropped **listed**, never silently |

Junction conventions carry citations, and **silence is never lawful**: vertical members measure
full storey height floor-to-floor (beam/slab intersections not deducted); beam length is the
drawn long-section span with the beam-column junction in the beam; slab–beam junction
deductions defer **with a reason**, never a silent zero.

## 2. Openings

- **The opening schedule is the authority; adjacency is a declared cross-check; a face with no
  schedule is not measured at all.** Gross area would be an over-measurement, which the
  contract hard-blocks rather than declares.
- Deduction semantics: an opening deducts only if **strictly greater** than the threshold;
  below-threshold openings are **ignored by rule, not dropped silently** — deducted sum,
  ignored sum, counts, and the threshold in force all land in the line's variables.
- Opening marks are scoped to their floor group (the same mark can be two different windows);
  a schedule row claiming floors (`1ST, 2ND, 5TH & 6TH`) makes the expansion `DERIVED`, not
  `TRANSCRIBED`; header text is evidence to verify, not trust (the legacy fixture labels every
  window sub-table "WOODEN DOOR NO.").

## 3. Finishes

A surface that is not a closed outline **defers** with a reason — never bounding-boxed
("a box dressed as a measured cap is fabrication"). `net = gross − Σ(deducted openings)`
exactly, per surface group, every deducted opening citing its source entity; an opening the
engine can see but cannot area is flagged, never silently ignored; retained openings carry the
rule that retained them.

## 4. The quantity kind

**`kind = (chapter × dimension), named for the trade.`** Dimension-named kinds (`AREA`,
`LENGTH`, `COUNT`, `WEIGHT`) are illegal for trade-bearing quantities — a kind that names a
dimension instead of a trade is the defect class that produced a measured 20.2× overcharge
(plaster waved through at a painting rate is the same bug better camouflaged). Consequences:

- The enum is **code-owned and closed** (the register keys on it); the rate book carries the
  same kind as a platform-owned column with attributed override; **CI asserts totality both
  ways**; a dimension-named kind is illegal to emit.
- **No null kind in the book, ever** — every item carries a kind or an authored exclusion
  reason. The **rate-modifier class** is load-bearing: "added rate" items (e.g. per additional
  floor) price as their own line **beside** the base item; without the class, no-null
  manufactures over-measurement. **The class is a pricing role, not a kind** (amended by
  `.wayfinder/takeoff/tickets/01`): an added-rate item carries *its base item's* kind plus an
  `isRateModifier` column in `book/`. A kind naming a pricing role is the same category error
  this clause bans for dimension-named kinds — it names neither chapter, nor dimension, nor
  trade. Under `identity.md` §1 a modifier **inherits** a quantity rather than originating one,
  so it has no claim on the coverage denominator; the certificate query filters it out.
- The **work-item catalogue** is thereby the **coverage denominator**: the certificate becomes
  a query. The catalogue is the spine-owned half of the book's job — platform-owned,
  code-derived at kind grain, primary-keyed on the kind value, rate-free (amended by
  `.wayfinder/takeoff/tickets/01`; a book item joins up to it on `kind`, unit as the dimension
  veto).

**Mapping a line to a book item:** match on **trade first** (kind → chapter); the dimension
lock has the final veto; never on dimension alone (a dimension-only matcher priced pile-cap
*excavation* at the RCC casting rate — ৳316/Cft against ৳15/Cft). **Never guess**: no
confident trade ⇒ no selection, the line stays visibly unpriced. One table serves both the
automatic matcher and the learned dictionary — no drift.

## 5. Scale — per-region fail-closed

Nobody in the field ships this; it is a differentiator, not overhead. The mechanism below was
ruled in full by `.wayfinder/takeoff/tickets/12-the-scale-group.md`, which carries what forced
each clause and what was rejected.

- **Affirmation ≠ calibration.** Scale is affirmatively established per **scale group**
  (~6–8 acts per project; per-drawing affirms a falsehood — one legacy sheet carried three
  internal scales; per-view degenerates into confirm-all). Machine proposes; a QS affirms.
- **Membership is positive, never residual.** A view joins a family on affirmative evidence;
  no evidence ⇒ unplaceable, hatched, and it **measures nothing** — the strand is named, never
  silent. Known declared absence is traded for unknown silent error, deliberately.
- **Precedence:** QS two-point → grid spacing match → overridden dimension ratio (style factor
  divided out) → file units header. **Printed scale notes are not evidence at any rank**
  (measured: the sheets printing `NOT TO SCALE` were the ones to scale). A QS override wins
  but is a declared disagreement and a dip-sample stratum.
- X and Y derive independently and are **averaged as nothing** — anisotropic scale is a
  scanning remedy; disagreement beyond tolerance makes the view unplaceable.
- Verification is mandatory for a scale from a single observation, rejected at **±1%
  symmetric** — derived, because scale error cubes into a volume against the ±3% band.
- Every quantity references its calibration (**NOT NULL** — unrepresentable without); a scale
  family is in the signed rule set, so recalibration voids every signature scoped to it.
- The strict unit lane: an unknown or unmapped unit resolves to **null — never guess a
  scale**. A sheet-layout lane may assume a convention to *partition and declare*, but nothing
  on that lane may multiply geometry into a stored dimension.

### 5.1 The scale family, mechanically

A scale family is **the extent of one calibration act** — the set of views one affirmed ruler
lawfully measures. It is an **authored, project-scoped object with a surrogate id**, taking the
level's shape (`identity.md` §2): its label and its membership are non-identifying, because a
calibration must not orphan when membership re-derives against a new ingest.

**Co-membership is a measured ratio of 1, never a similarity.** Two views are co-members iff both
depict one identified physical referent — the same pair of grid axes, matched by axis label
inside the project's own grid backbone (`cad-ingestion.md` §8) — and the ratio of their drawn
separations of it is 1 within §5.3's tolerance. That quantity is a **ratio**, so it is computable
before any scale exists, which is what lets membership derive without regressing the view
partition's scale-free law. Nothing else is a witness: the same sheet is not, the same layer is
not, and an equal annotation-text height is not — 2.5 mm of annotation at 1:100 plots to the same
world height as 5 mm at 1:50, so height agreement is consistent with two different scales and is
evidence of nothing.

**The residual case is unrepresentable, not discouraged.** Four mechanisms, none of them prose:

1. Membership is stored **extensionally**, as enumerated view keys — never as a predicate with an
   else-branch, which is what "residual" would have to be written as.
2. There is **no project-, sheet- or drawing-level default calibration** — `identity.md` §8's
   *never a nullable fallback*, for its stated reason: a fallback makes *the ruler in force* a
   query result that widens under a signed bill.
3. A bulk affirmation is lawful only over an **enumerated** proposal list (`identity.md` §7's one
   act with N subjects), so *confirm the rest of this sheet* cannot be expressed at all.
4. `calibration_id` on a quantity line is **NOT NULL** against an immutable calibration row
   (§5.4).

A view no witness reaches is hatched, refuses as `SCALE_NOT_AFFIRMED`, and measures nothing. It
costs nothing where it measures nothing anyway: only layout-plan-class views yield instances
(`cad-ingestion.md` §7), and schedules and details are **read**, not scaled.

### 5.2 The ladder — three ranks originate, one propagates

What each rank *supplies* is load-bearing, and the ladder is read this way:

| rank | supplies | basis of the number |
|---|---|---|
| 1 · QS two-point | **originates** a length; a human act, one chord per axis | `ENTERED` |
| 2 · grid spacing match | **propagates** an established length to every view sharing the referent | machine, no act |
| 3 · overridden dimension ratio | originates, from dimension text over the geometry it dimensions | `TRANSCRIBED` |
| 4 · file units header | originates, by declaring the unit of a 1:1 model space (`$INSUNITS`) | `TRANSCRIBED` |

Rank 2 matches against an **established** referent length and never against a plausible round
number — *5000 is a normal grid spacing* is a guess wearing arithmetic's clothes. Rank 2 is why
the family exists: without a propagation rank, affirmation is per view and degenerates into
confirm-all; with it, the act count is **the number of distinct scales in the set**, not the
number of views — which is where ~6–8 comes from.

**The PDF lane retains no machine origination rank at all** (measured, ticket 06: no
`$INSUNITS`, `/UserUnit` = 1.0 in 14 of 14 files and ISO 32000-1 §12.9 `/Measure` in none, so
rank 4 has no input; no DIMENSION object exists, so rank 3 has none). Ranks 1 and 2 survive and
rank 2 originates nothing. **A PDF sheet that no QS two-point act reaches is unplaceable and
measures nothing** — the fail-closed path running as designed, at a cost of one act per set of
plans, not an apology.

**An arc-fit is admissible as a queue ordering and as nothing else.** §8 detects a bubble as text
inside a circle; a PDF has no CIRCLE (a circle is four Beziers, and recovering one is arc-fitting,
a guess). A fitted circle may **propose** candidates to a human and may never enter the artifact,
position an axis, or multiply into a stored dimension — `cad-ingestion.md` §3 bars derived paint
from the extractor, and a fit is derived paint *we invented* rather than paint the file carries.
What is admissible is the human's affirmation that these texts are grid bubbles, which is an act;
the axis positions then come from the original TEXT anchors. Where the sheet's text is outlined
(measured: 0 chars on 3 of 3 CAD plots) there are no anchors either, and rank 2 is gone with it.

### 5.3 X, Y, and the tolerance

A calibration stores `scale_x` and `scale_y` and applies each to its own axis; **it never
collapses them to a mean**, which would be a ruler neither observation supports. The gate is
`|sx / sy − 1| ≤ 1%`; beyond it the view is unplaceable and refuses as `SCALE_ANISOTROPIC` — a
cause distinct from `SCALE_NOT_AFFIRMED` because the remedy is opposite: no act on either axis
repairs a contradiction between them, and the sheet must be rectified or re-supplied. Anisotropy
surfaces in the disposition queue as that named refusal and on the certificate as the
scope-register exclusions its unplaceable views produce (`quantity-contract.md` §2.2) — never as
a per-line note, and never as a stored anisotropic ruler the engine quietly applies.

**±1% symmetric — the arithmetic, confirmed for our kinds.** A scale error ε enters a length
once, an area twice, and a wholly geometric volume three times: `1.01³ = 1.0303`. A 1% scale
error therefore spends **3.03% of the ±3% band** on a volume — the entire allowance and a hair,
leaving nothing for any other error source. ±1% is a **ceiling, not a comfort margin**: nothing
looser is arguable. It stays **symmetric** even though over-measurement is a hard block at +0%,
because a ruler biased low to protect a downstream gate is an input derived from the figure that
gate compares against — banned by `quantity-contract.md` §5's yardstick rules — and because the
register holds facts, never safety margins (§6).

Two observations per axis, minimum. They **corroborate; they never blend**: agreement bumps the
edition, and disagreement beyond 1% suspends the family pending re-affirmation — `identity.md`
§7's existing shape, not new machinery. The band is set for the worst kind a ruler serves,
because a family cannot know which kinds will later hang off it.

### 5.4 The schema, and what a recalibration voids

`scale_families` (project-scoped, surrogate id, authored) · `calibrations` (family; `scale_x` /
`scale_y` as **real SI length per drawing unit**, `numeric`, never a float and never a stored
`1:100` — §6 keeps facts, not conventions; evidence rank; the affirming act; **immutable**) ·
`calibration_observations` (axis, rank, value, cited source keys) · membership rows keyed
`(family, view key)`. A recalibration **mints a new calibration and supersedes**; nothing is
edited, so *which ruler produced this figure* is answered by a pinned id instead of a history
diff (`identity.md` §7 rejects before-images).

Every quantity line carries `calibration_id` **NOT NULL**, citing the calibration of the view its
geometry was read from — for a placed member, its layout plan. Unconditional, even where every
input is `TRANSCRIBED`: a conditional NOT NULL is a nullable column with a rule, and its
exception clause is the fallback §5.1 just banned.

**Recalibration voids every signature scoped to the family, and there is no second list.** The
scope is derived — a signature covers lines, a line pins `calibration_id`, a calibration names
its family — so a new calibration on family F voids exactly those signatures whose covered lines
cite F's superseded calibration, and no others. Same construction as the drawing-set manifest
(`identity.md` §9), for the same reason: two lists diverge, a derived one cannot.

**The unit seam is typed, not documented.** Drawing-unit values are a distinct type from stored
SI lengths, and the one exported conversion takes a `Calibration` — so *multiplying geometry into
a stored dimension without an affirmed calibration* is a compile error, in one decision site with
a CI check that no second site exists (`cad-ingestion.md` §7's shape). This is what makes the
strict unit lane above mechanical rather than a rule to remember.

## 6. The register holds facts, never bands

Store *clear height 6.2 m*, never `band: 3` — a band is a pricing convention; storing it
fossilises one book edition into the system of record. One excavation object with a depth and
a lead; the pricing seam emits base + banded add-items, all inheriting. **Defaults are barred
from quantity-determining attributes** (a citable clause is `DERIVED`, not `DEFAULTED`; a
`DEFAULTED` selecting attribute names its convention on the certificate).

**The `SITE` attribute class** — facts no drawing carries, always `ENTERED`, never
`DEFAULTED`: `lead` (two attributes — PWD bands metres within-site, LGED also kilometres
off-site, 2.2× rate spread), `lift`, `elapsedHours`, `operationOrdinal`, `formworkReuses`,
`haulDistanceKm`, plus project-level `inaccessibleAreaCategory` (PWD Ch. 33, 5/10/15% by
upazila, multiplying every item in the book — derived from the project's own location and
affirmed). Consequence stated plainly: **earthwork is structurally unpriceable from drawings
alone**, and the product says so instead of guessing.

## 7. Levels

A level is a project-scoped object with a **surrogate id**; label, ordinal and height are all
non-identifying. The **ordinal is physical** and the floor-multiplier scheme keys to it —
label-joined multipliers priced an eighth-floor item at ground rate in the legacy (`F1` vs
`1F`), the wrong-rate failure class no quantity tolerance catches. A scheme with no row for an
ordinal **throws**; a tenant with no scheme is a different fact. Storey heights take basis
`TRANSCRIBED`/`DERIVED`/`ENTERED` — `DEFAULTED` is barred (quantity-determining); an `ENTERED`
height is declared and dip-sampled, not blocked (no gate can detect present-and-wrong). The
level stack is the **vertical coverage denominator**, and the certificate prints the stack's
own basis. Per-floor rollups sort by ordinal — never lexicographic.

## 8. Algebras and rails

Four measurement algebras — **member** (section × run + bar rule; structure *and* brick
walls), **face** (a face of a space, gross less scheduled openings), **network** (runs by
diameter), **topology** (a pipe tee is a junction in the run graph, not a symbol anyone drew).
The general-note sheet is a zero-algebra authority source. Rails share only setup, the
register, and the document stage; the gate's shape is spine-owned (a rail may not author its
own definition of done); **rail is selected per quantity kind, not per drawing** — one
architectural sheet originates both brick volume and finish area. MEP fittings: **derive,
never count**; until ingestion fidelity is proven, MEP publishes runs only.
