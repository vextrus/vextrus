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

Nobody in the field ships this; it is a differentiator, not overhead.

- **Affirmation ≠ calibration.** Scale is affirmatively established per **scale group**
  (~6–8 acts per project; per-drawing affirms a falsehood — one legacy sheet carried three
  internal scales; per-view degenerates into confirm-all). Machine proposes; a QS affirms.
- **Membership is positive, never residual.** A view joins a family on affirmative evidence;
  no evidence ⇒ **uncalibrated**, hatched, and it **measures nothing** — the strand is named,
  never silent. Known declared absence is traded for unknown silent error, deliberately.
  *Uncalibrated, not unplaceable* (amended by `.wayfinder/takeoff/tickets/12`): §9's
  **placement** locates an instance against the grid and needs no scale at all, so the two words
  named two different states and one of them was doing the other's work.
- **Precedence:** QS two-point → grid spacing match → overridden dimension ratio (style factor
  divided out) → file units header. **Printed scale notes are not evidence at any rank**
  (measured: the sheets printing `NOT TO SCALE` were the ones to scale). A QS override wins
  but is a declared disagreement and a dip-sample stratum. **The order is lane-independent** — a
  lane never re-ranks to compensate for a rung it lacks; what a short lane loses is *reach per
  act*, never lawfulness (amended by `.wayfinder/takeoff/tickets/12`, which also rules the two
  jobs the rungs do: **rung 2 transfers an affirmed value, never originates one**, and only from
  an affirmed value, so propagation depth is always exactly one act — that is the mechanism
  behind ~6–8 acts per project; and the verification rule below demotes **rung 4 to
  corroboration-only**, since a file holds exactly one units header and a second observation of
  its kind cannot exist).
- **A calibration is one pair `(sx, sy)`, in metres of real length per native drawing unit** —
  the *composite* of the drawing's unit and its plot ratio, never decomposed (that would
  attribute a factor between two unobserved quantities) and **never snapped to a nominal ratio**
  (a measured 1:99.2 stored as 1:100 is a silent 0.8% edit against a 1% budget; a nominal ratio
  may label, never multiply).
- X and Y derive independently and are **averaged as nothing** — anisotropic scale is a
  scanning remedy; disagreement beyond tolerance makes the view uncalibrated. Mechanically:
  **geometry always multiplies per axis** — an axis-aligned area is `(dx·sx)(dy·sy)`, a diagonal
  is `√((dx·sx)² + (dy·sy)²)` — so no scalar scale exists anywhere for a formula to reach for.
- Verification is mandatory for a scale from a single observation, rejected at **±1%
  symmetric** — derived, because scale error cubes into a volume against the ±3% band.
  **One band, four uses, every one a comparison of two *observations* and never of an
  observation against truth**: verification ±1%; anisotropy `sx` vs `sy` ±1% (two observations
  each within ±0.5% of their mean may differ by 1% by chance); rung-2 membership against the
  family's **affirmed** value — never against another member — ±0.5%, because the affirmed value
  has already spent half the axis budget; QS override vs machine proposal ±1%, inside which
  there is no disagreement to declare. These bands are **methods, not parameters** (§1): *a
  threshold that comes from an authority is a parameter; a threshold derived from our own error
  budget is a method*, so no project may configure its way out of the contract.
- **The band is symmetric though the contract is not**, deliberately: a calibration is an
  *observation*, not a quantity, and biasing it under to buy headroom is the move
  `.wayfinder/takeoff/tickets/03` already rejected for the vectorizer. The asymmetry is enforced
  at the gate on the value.
- **Amplification, and the kind the cubic budget does not cover.** `3ε ≤ 3%` holds for the
  volume kinds. It fails where a **scaled** gross nets an **unscaled** scheduled deduction:
  `net = G(1 ± 2ε) − D` carries `2ε·G/(G−D)` — 2.9ε at 30% deductions, 4ε at 50%, unbounded as
  `D → G`, so a curtain-walled elevation breaches ±3% at a lawful calibration. The remedy is
  neither a tighter band (the deduction ratio is unbounded) nor a block (the measurement is
  lawful): **the gate measures each line's amplification by re-evaluating that line's own
  formula with every drawing-unit-sourced variable perturbed by the band, and a result beyond
  ±3% joins a mandatory dip-sample stratum** — §5 of `quantity-contract.md`'s own precedent, on
  machinery `.wayfinder/takeoff/tickets/13` already requires.
- Every quantity references its calibration (**NOT NULL** — unrepresentable without); a scale
  family is in the signed rule set, so recalibration voids every signature scoped to it — and
  **the void is a query, never a flag**: a signature records each family's calibration id at
  signing and is void iff any is now superseded, so no `UPDATE` can be forgotten. The slot's
  lawful non-scaled form takes §7's `levelBases` pattern — `SCALED | UNSCALED`, never a bare
  null — and **`UNSCALED` is measured, not asserted**: the same perturbation above must move the
  value by nothing (amended by `.wayfinder/takeoff/tickets/12`, which measured that the first
  vertical slice is scale-free end to end — `count × L × B × H` takes count from grid-relative
  placement, `L`/`B` from the schedule and `H` from the level stack). The clause exists to stop
  a quantity that *depended on* a scale from existing without an affirmed one, and a formula
  with no scaled term did not.
- The strict unit lane: an unknown or unmapped unit resolves to **null — never guess a
  scale**. A sheet-layout lane may assume a convention to *partition and declare*, but nothing
  on that lane may multiply geometry into a stored dimension.
- **Two refusal causes, split on remedy** (the test that split `INGESTION_TRUNCATED` from
  `ENTITY_TYPE_UNHANDLED`): `SCALE_NOT_AFFIRMED` — a QS act inside the product fixes it, whether
  the act is a two-point measurement or a confirmation — and `SCALE_ANISOTROPIC`, which only a
  better source file fixes. Both are machine-originated in the one taxonomy (`identity.md` §7)
  and reach the scope register as machine deferral records; without them an unaffirmed family
  falls through to `NOT_ESTABLISHED` and reads as generic residue when one act would publish
  hundreds of lines.

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

**The gate's shape** (amended by `.wayfinder/takeoff/tickets/13`). A rail is a **pure function
returning offers**, never lines: it holds no tenant context and cannot write, so the gate is the
spine's sole writer of quantity lines — the register door's sibling one stage down, where the
guard is a constraint rather than a function a caller may decline to call. The rail supplies
per-attribute basis; the **gate** derives both roll-ups, the attribute roles (declared per
algebra, never per row), the refusal cause, and the algebra the kind selects — an offer's own
claim of algebra is checked, not trusted. Selection is two independent **total, code-owned maps
on the kind axis** — kind → authoritative discipline (`identity.md` §2) and kind → algebra — with
CI asserting totality both ways; they are independent exactly because one architectural
discipline serves two algebras. They range over a code-owned **`bears` relation on
`(element class × kind)`**, identical for every project and changed only by migration behind that
assert — never a project pin. Over-measurement's hard block is enforced here, once, on the
register's full-precision value and upstream of per-kind rounding.
