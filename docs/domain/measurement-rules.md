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
| `scaleVerificationTolerance` | 0.01 | symmetric band a single-observation scale is verified against (§5) |
| `scaleAnisotropyTolerance` | 0.01 | symmetric band X is checked against Y; beyond it the view is unplaceable (§5) |

Junction conventions carry citations, and **silence is never lawful**: vertical members measure
full storey height floor-to-floor (beam/slab intersections not deducted); beam length is the
drawn long-section span with the beam-column junction in the beam; slab–beam junction
deductions defer **with a reason**, never a silent zero.

*Amendment, 2026-08-16.* "Carried on the project record" is a **reference**, not a column set: the
project record points at an immutable **rule-set edition** it forked at creation (`identity.md`
§8). The edition holds the parameter values; the project holds the pin.

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

*Amendment, 2026-08-16.* `(chapter × dimension)` is the rule for what makes two kinds **distinct**,
not a schema. A chapter reference is `(book, chapter)` and never a bare code (`bd-authority.md`
§4), numbering differs across books, and a unified national schedule is imminent — so a code-owned
`chapter` column would pin a closed platform enum to one edition of one book. The chapter is
**cited as evidence** in the enum's declaration; the `(book, chapter)` itself lives on the book
item and joins up on `kind`. A kind whose chapter cannot be verified ships **uncited**, never
under a fallback name.

**The naming law, closed.** A kind's name may contain **trade and material tokens only** — never a
dimension or unit, never an **element class or member type**, never a pricing role (the
`isRateModifier` ruling above), never a book or chapter code. A kind is deliberately **coarser**
than the book item: `quantity-contract.md` §2.2's *one kind covers twelve PWD member-type
sub-items* is the same twelve `bd-authority.md` §4 lists for formwork, so a kind naming the member
type covers exactly one of them and §2.2's argument for `(class × kind)` grain collapses. It would
also make §8's `bears` derivable from a substring, violating *the class is in the key, the kind is
not* by spelling. The class supplies the member-type axis at book-item selection.

**The ban is on the dimension category, not on a list of four.** `VOLUME` is a dimension this
clause's `AREA · LENGTH · COUNT · WEIGHT` omitted; unit abbreviations (`CUM`, `SQM`, `RFT`, `NR`)
name a dimension in shorthand. The mechanical form is a token test over kind names against the
dimension set, its unit abbreviations, **and `ELEMENT_TYPES`** — so the class ban is checked by the
same construct, and adding an element class re-runs it for free.

**The four artifacts of §8 have one declaration site each, in code.** The closed enum, the two
total maps and `bears` are TS consts; the **work-item catalogue** and `bears` are additionally
**emitted as tables by migration**, with a drift stage in `pnpm verify` failing when table and
const disagree (ADR-0002's pattern, extended from CHECK constraints to seed rows). Emission is
forced, not stylistic: the residue is a query (`quantity-contract.md` §2.2) and the certificate a
query over catalogue × residue (§6), so both denominator axes must be reachable in SQL. The two
maps stay pure code — they never enter a query, and typed as total records the compiler is their
totality proof. The catalogue carries, per kind: en+bn description (each string carrying whether it
is natively reviewed), the canonical SI unit and its dimension, and the **fixed document rounding
precision** §6 requires — a code constant, since a rounding precision is neither a rate nor a
measurement threshold and decides no measured number.

**A class that bears no kind is declared, never absent.** Every element class appears in `bears` or
in a code-owned unborne set carrying `KIND_NOT_YET_SEEDED`, and the certificate prints the
**sighted** members of that set as a boundary statement. Otherwise a sighted class contributes zero
rows to the residue denominator and its wholly unmeasured scope reports nothing — the failure
`quantity-contract.md` §2.2 names for class grain, one level up. `bears` states what a class
**lawfully bears**, never what a rail emits: seeding it to the build state makes the residue report
nothing and turns the relation into a changelog.

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

*Amendment, 2026-08-16.* §5 above is the rule; this is the rule as data. Two of its sentences were
wrong once the campaign's pin set landed (`identity.md` §8) and are corrected here.

**There is no scale-group row.** A *scale group* is the **subject set of one affirmation act** —
`identity.md` §7's *recorded at the granularity performed* applied to scale, which is why "~6–8 acts
per project" reads literally. The machine's candidate partition is a **proposal**: derived,
recomputable, never stored. This answers *project-scoped or set-revision-scoped* with **neither**:
the act's subjects are content-derived **view keys** (§3), so a re-issued sheet mints new source
keys, hence new view keys, hence unaffirmed views — while views on sheets that did not move keep
their affirmation with no rule of their own. That is §9's *partial re-issue re-presents nothing by
itself*, inherited rather than restated.

**Evidence is a query; the act is the only row.** Ranks 2–4 (grid spacing match, overridden
dimension ratio, file units header) recompute from the frozen ingest artifact, so storing them
would be the writerless machine `INSERT` `quantity-contract.md` §2.2 rejected for the scope
register — a filter with no actor. Rank 1 is an act. Positive membership is therefore recorded
exactly once: **a view is in a group because an act names it**, and the act names the rank it stood
on and the source keys under it. A view no act names has no scale, which is §5's *membership is
positive, never residual* with nothing left over to enforce it with.

**A two-point observation cites source keys, or it is refused** (`SCALE_OBSERVATION_UNCITED`). The
QS two-point outranks every machine rank, so a free click would be the one rung of the ladder that
cannot be rechecked — and `cad-ingestion.md` §2's argument for content digests over counters is
exactly this: verification recomputes what a claim cites, and a click cites nothing. The factor's
two halves have different recourse: the stated real-world distance is `ENTERED` and is challenged
through the act's named human; the drawing distance is geometry and is re-measurable only through a
key. Each point records **source key + world coordinate quantized to 0.1 drawing unit** (§3's
placement quantum) — the key names *what*, the coordinate names *where on it*.

**The calibration reference is a content-addressed key, carried per measured attribute.** It
digests `(view key, factorX, factorY)`, with the **act id beside it** for the named human
`quantity-contract.md` §3 requires. Content-addressed for the reason §8 and §9 already give: under
a minted pointer a QS re-affirming and deriving *the same factor* would supersede every line citing
the old act, voiding a signature that nothing invalidated. Per **attribute**, because
`quantity-contract.md` §1 already carries basis per attribute and a calibration is the provenance of
a `MEASURED` basis — a member whose section is measured off a section view and whose run is measured
off a plan has two. The line stores a **non-empty set**; empty is unrepresentable, which is §3's
`NOT NULL` exactly. **No `COUNT` exemption**: placement is scale-free (`cad-ingestion.md` §9's
constants are content-scaled shares), so a count's number does not depend on the factor — but the
reference is also the evidence that *this view was established at all*, and exempting counts would
put counted items on a bill face read off views nobody could scale. §5's *measures nothing* is flat.

**The factors digest as fixed-precision decimal strings, 12 places, half-even** — the discipline of
§4's content signature and `cad-ingestion.md` §2's 0.001 pt, and, in §2's words, **a collision
policy and not a stability dial**. The temptation is a coarse quantum so a trivially-different
re-affirmation voids nothing; `quantity-contract.md` §8 forecloses it — *no numeric void threshold,
that judgement already has a name* — and a coarse quantum is a void threshold wearing a rounding
rule. At a factor of 1e-3, 12 places sits seven orders above float noise and four below any
observation difference a human can produce.

**Re-affirmation is an authored act naming the outgoing and incoming keys**, stating before it
commits which lines re-derive and that a signature over any of them **voids whole** — §9's re-pin
shape, for §7's reason: before-images are rejected, a competing observation declares its precedence,
and under an implicit *latest act wins* the voiding of a signature becomes the side effect of a
click. Never silently blocked, never silently applied.

**The gate multiplies, not the rail.** §8 gives the rail geometry and the spine arithmetic; an offer
carries geometry in **drawing units** plus the view it was read from, and the gate resolves the
calibration in force and evaluates in decimal. A rail handing over metres has applied a factor the
gate never checked, which makes the `NOT NULL` reference decorative — the same defect §8 names for a
rail that hands over lines. **A diagonal computes componentwise — `hypot(dx·X, dy·Y)`, areas `X·Y`**
— which is the exact induced length of a diagonal linear map, not a fudge, and satisfies *averaged
as nothing* because `(X+Y)/2` never appears.

**Two tolerances, both rule-set parameters** (§1): `scaleVerificationTolerance` for a
single-observation scale and `scaleAnisotropyTolerance` for X against Y, seeded equal at 0.01. They
fail differently — the first asks whether an observation is trustworthy, the second whether the
drawing is anisotropic, which is a scanning property — so collapsing them would let a future
scan-lane change to one silently move the other.

**Two named causes on the unit lane, not one.** An unmapped `$INSUNITS` does not refuse at ingest;
it is **rank 4 declining to contribute**, and a view becomes unplaceable only if ranks 1–3 also
yield nothing. `SCALE_NO_EVIDENCE` (nothing at any rank) and `SCALE_UNIT_UNMAPPED` (rank 4 carried a
code we do not map) split for `quantity-contract.md` §2.2's reason — opposite remedies, as
`INGESTION_TRUNCATED` splits from `ENTITY_TYPE_UNHANDLED`. Both are **rail-vocabulary reasons riding
the queue item**, never scope-register causes: §2.2 reserves the cause taxonomy for its originator
legality and the register's cause stays `NOT_ESTABLISHED`. Per `quantity-contract.md` §4 an
unaffirmed scale **declares**; it never hard-blocks.

**The two corrections.** *A scale family is **not** in the signed rule set* — after `identity.md`
§8 an edition is immutable and forked platform → tenant → project at project creation, so a
calibration derived from this drawing's geometry cannot live inside one. The **tolerances** are
rule-set parameters; the **calibration** is a third signed instrument, bound to the signature
through the lines' own keys (`quantity-contract.md` §7). And *a QS override is **not** a dip-sample
stratum in the Part B sense*: §8 fixes Part B's draw unit and stratum at `(class × kind)`, which has
no scale axis, while Part A already enumerates declared disagreements **in full** — that is the
gate. Nor does an override **suspend**: §7's suspension exists where precedence is undeclared, and
here the ladder declares it in advance, so suspending would freeze a fact the law has already
decided.

**What a recalibration voids, exactly.** A signature **voids whole** when any line inside its
boundary cites a calibration key that is no longer the key in force for its view. It is the diff
§8's freshness gate already runs, over data the register already holds, so there is no second list
(§9). Two things deliberately do **not** void: an identical re-affirmation, because the key is
content-addressed; and an evidence *upgrade* at the same factor (rank 4 → rank 1), because the
number did not move — though that row **re-presents**, since §5's semantic carries cited evidence
source keys. Row-level re-presentation is governed by the semantic, boundary-level validity by the
key: §9's own split, and both are honest.

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

*Amendment, 2026-08-16.* The *tenant with no scheme* fact means: **no priced line may be emitted;
no quantity is affected**. The scheme is a rate-modifier instrument (`quantity-contract.md` §4),
so it is not a campaign precondition and pins nothing at campaign creation (`identity.md` §8).

*Amendment, 2026-08-17 (issue #134).* **Inserting a level mid-stack re-keys nothing.** A level is
referenced by surrogate id and its ordinal is non-identifying (`identity.md` §2), so rows above the
insert are untouched while their **level ordinals move** — the ordinal is physical, and moving it is
this clause working rather than an exception to it. The **mark-family ordinal** (`identity.md` §4) is a
different quantity under the same word: it is scoped inside an identity key that already contains the
level, so `C1#1` on the third floor cannot be moved by anything happening on another. Rows do not
re-present, a level's ordinal being in no row's semantic; the new level's expansion registers new
objects and emits lines normally. What the stack's movement does reach is the signature — the stack is
the vertical coverage denominator, and `identity.md` §8 now pins it on the campaign as a digest.

*Amendment, 2026-08-17 (issue #186).* **A storey height is an observation set, not a field — and it
is floor-to-floor.** Two corrections, both forced by the destination: `structural-r1.dxf` carries no
section, no level table and no FFL, so its column heights are authored, and an authored height is
recourse-bearing only if the authoring is (`quantity-contract.md` §1, §5).

**The datum is named in the term.** §3 measures columns at full storey height floor-to-floor while §6
stores *clear height* for excavation — one word, two physical facts. A level carries
**`storeyHeightFloorToFloor`**, in metres, and nothing else; clear height is a different attribute and
is not representable on a level. A QS handed a field called *height* cannot tell which is wanted, and
floor-to-floor entered where clear was meant over-measures every column by a slab thickness — uniform,
silent, and invisible to a stratum that has averaged (`quantity-contract.md` §8).

**A height is a set of readings, never a scalar.** `identity.md` §7 bars the before-image: a human
never overwrites a machine value, they add a **competing observation** with its own basis. One
height-plus-basis pair on the level row makes a correction an overwrite — that bar broken by
construction — and the second reading arrives the first time a set carries a section, the fixture's
`ENTERED` and a drawn section's `TRANSCRIBED` being two readings of one fact. So a height is keyed
**`(level, actor, basis, evidence source key)`**: a disagreement is two rows. Each reading stores its
value **as written with its unit as written** beside the canonical metres, carrying the factor and the
factor's provenance (`identity.md` §1) — `3000` under a mm title block is not the fact `3.0` is. The
evidence source key is `cad-ingestion.md` §2's `scheme:key`, null for `ENTERED`, where the named actor
*is* the recourse the basis ladder promises. The level's effective height is a **resolver over the
set**, stored nowhere: readings agreeing on the canonical metres corroborate and the fact stands;
readings that disagree **suspend** it, cleared only by re-affirmation and never by precedence — this
clause authors no precedence rule.

**The act is `AUTHOR_STOREY_HEIGHT`**, subject the observation row, recorded at the granularity
performed — six storeys typed in one submission is one act with six subjects, which is `identity.md`
§7's *a confirm-all is one act with N subjects* and is exactly the stratum `quantity-contract.md` §8
reads at the grain of the entered attribute. A correction is a new act and a new row. The act states
its consequence before it commits, as a level insert does (`identity.md` §8). Authoring a height
**carries its own permission**, named here ad hoc as every act clause so far names its own, and
distinct from the permission to insert a level: an insert adds quantity and moves a pinned digest, a
height moves neither. The general permission model stays unwritten; this clause does not write it.

**The act writes one row and no lines.** A height reaches the register only through the gate, §8's
sole writer of the spine. The act moves the affected rows' semantic and they re-present
(`identity.md` §5); their published numbers move when the gate next runs, not when the height is
typed. This is what preserves #134's order-independent resolver — a height is an input to expansion,
never a second writer beside it.

**A level is authorable with no height.** The row exists, the reading is absent, and the consequence
is reported on the line (`quantity-contract.md` §6), never refused at the level: a stack unauthorable
from a plan-only set is a stack unauthorable from this product's first drawing.

## 8. Algebras and rails

Four measurement algebras — **member** (section × run + bar rule; structure *and* brick
walls), **face** (a face of a space, gross less scheduled openings), **network** (runs by
diameter), **topology** (a pipe tee is a junction in the run graph, not a symbol anyone drew).
The general-note sheet is a zero-algebra authority source. Rails share only setup, the
register, and the document stage; the gate's shape is spine-owned (a rail may not author its
own definition of done); **rail is selected per quantity kind, not per drawing** — one
architectural sheet originates both brick volume and finish area. MEP fittings: **derive,
never count**; until ingestion fidelity is proven, MEP publishes runs only.

**The gate's shape** (amended by `.wayfinder/takeoff/tickets/13`). A rail is a pure function
returning **offers** — geometry, attributes each carrying its own basis, the rule id, the
(drawing, view), the register-row reference — and **the gate is the spine's sole writer of
quantity lines**. A rail that hands over *lines* has authored the values the gate reads, which
makes every check advisory and lets a `DEFAULTED` attribute launder into a `MEASURED` line; §1's
roll-ups are derived and neither stored, so a rail supplying one is a rail authoring done. Done is
the gate's **return type**, never a helper a rail chooses to call. The rail owns **geometry**; the
spine owns **arithmetic** — the offer carries the inputs and the expression combining them, and
the gate evaluates it in decimal, which is what makes §2's deducted sum, ignored sum, counts and
threshold enforced rather than decorative. The gate does not check that the expression is the
*right* one: choosing the formula is a §1 method, CI-hashed.

**Selection runs on four code-owned artifacts**: the closed `quantityKinds` enum (§4), a total
**kind → authoritative discipline** map (`identity.md` §2), a total **kind → algebra** map, and a
**`bears`** relation on `(element class × kind)`. The two maps are **independent** — collapsing
them yields discipline → algebra, which is the per-drawing selection this clause bans, spelled
differently. `bears` carries the kind axis **outside the identity key**: the class is in the key,
the kind is not, and the kinds a class bears are looked up, never stored on the row.

*Amendment, 2026-08-17 (issue #135, ADR-0010).* **The expression travels by reference, never
transported.** "The offer carries the inputs and the expression combining them" above admits an
expression a rail authors — an AST the gate walks — which defeats the very sentence that follows
it: an expression no `(rule id, version)` names cannot be CI-hashed, so choosing the formula stops
being a §1 method. Read instead: **the offer carries the inputs and names the method that combines
them** — a `ruleId` and **no version**, the gate resolving the version from the project's pinned
rule-set edition (`identity.md` §8) and refusing by name when the edition does not name it or the
registry lacks the implementation. A rail naming its own version would let two rails price one
campaign under two versions of one method while the edition key certifies them as one rule set. The
gate renders §6's human-auditable formula string from the same registry template it evaluates, so
the printed string and the arithmetic have one source. Unchanged: the gate does not check that the
method is the *right* one.
