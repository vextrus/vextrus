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
