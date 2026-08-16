# The Quantity Contract

The publishability contract for every quantity in the system. Re-derived 2026-08-12 from the
legacy takeoff decision record (26 resolved tickets + a written contract, validated against a
measured correctness census). **Binding from the first line of module code** — a build either
satisfies a clause or it does not.

The governing sentence:

> **A partial faulty estimate is more harmful than no estimate.**

Corollaries that decide arguments: measure less, completely, and **say so** — never measure
more, partially, and stay quiet. An over-measurement is the same defect class as an
under-measurement, and harder to spot.

## 1. Two orthogonal axes, never one ladder

**Basis** — where a number came from. Ordered by strength:

| value | meaning |
|---|---|
| `MEASURED` | read from drawing geometry |
| `TRANSCRIBED` | copied verbatim from drawing **text** — a note, a schedule, a title block |
| `DERIVED` | produced by a named rule from a measured number |
| `IMPORTED` | carried in from an external artifact |
| `ENTERED` | typed by a human |
| `INTERPRETED` | machine-vectorized from a raster image — the source is pixels, not geometry |
| `DEFAULTED` | supplied by config where the drawing was silent |

`DEFAULTED` is weakest because it is the only value where *nobody looked and nobody decided*.
`TRANSCRIBED` is not cosmetic: geometry is checked by re-measuring, a transcription only by
re-reading, and ingestion losses are transcription failures that `MEASURED` would hide.

`INTERPRETED` is second-weakest — a machine looked, nobody decided. What orders this ladder is
**recourse**: `MEASURED` is rechecked by re-measuring, `DERIVED` by re-running a pinned rule id
and version, `IMPORTED` against its artifact, `ENTERED` by challenging a named human who owns an
act-log row. An interpreted number has no such check. It is *reproducible* — `cad-ingestion.md`
§2 requires determinism within a pinned extractor identity — but **reproducibility is not
recourse**: re-running the vectorizer re-derives the same guess and confirms nothing, where
`DERIVED` re-runs a named rule over an input that is itself independently checkable. Short of a
human looking, there is no second reading to compare against. It beats `DEFAULTED` on one count
only: something looked at the actual drawing. **`INTERPRETED` names the source medium, never the agent**: a QS
who hand-traces an outline on a calibrated scan also produces `INTERPRETED`. Their care is real
and is recorded — as an act and a corroboration state, which is where certainty belongs. Basis
is a historical claim and does not change when someone checks it; **`INTERPRETED` is never
relabelled `MEASURED`**.

**Coverage** — what fraction of the scope the line *claims* to account for:
`COMPLETE` · `PARTIAL_DECLARED` (every omitted component enumerated on the row) ·
`PARTIAL_UNDECLARED` — **illegal state, never representable**. One enum cannot express
*correctly measured, of the wrong scope* — in the legacy censuses that gap held two thirds of
the money error (a bill 54% short printed `incomplete: 0`).

**Basis is carried per attribute; the line derives two roll-ups.** Each attribute carries its
own basis and its **role** — quantity-determining, item-selecting, or both — declared once per
algebra, never per row. The line publishes `quantityBasis` (over determining attributes and the
geometry) and `selectionBasis` (over selecting attributes), both weakest-wins, neither stored.
Two, because they fail differently: a wrong determining attribute is a wrong **number**; a
wrong selecting attribute is a right number at the **wrong rate** — the measured 20.2×
overcharge class, which no quantity tolerance can catch.

## 2. Coverage's two denominators

1. **Within a line: the item description.** Bangladesh has no named method of measurement, so
   the description *is* the method of measurement (see `bd-authority.md`). A line asserts:
   this number accounts for everything this description names.
2. **For absence: the scope register.** A per-line column cannot annotate a row that does not
   exist (legacy: pile-cap rebar was −100% with no line and no deferral). The scope register is
   derived from **what ingestion saw**, keyed **`(element class × quantity kind)`** (amended by
   `.wayfinder/takeoff/tickets/01`); every (class × kind) cell that produced no line becomes a
   declared exclusion. Class grain alone hides the missing *rule* — a beam that produced a
   concrete line is not absent, so its unmeasured formwork goes silent, and one kind covers
   twelve PWD member-type sub-items. `(class × kind)` is also §8's dip-sample draw unit.
   Consequence: **surfacing ingestion truncation is mandatory** — the artifact's fidelity
   counters exist for this.

The scope register attaches a **cause** to an absence the **work-item catalogue** already knows
about (the catalogue is the enumeration — the spine-owned, rate-free half of the book's job;
amended by `.wayfinder/takeoff/tickets/01`). The two sources divide the work: the catalogue
catches the **missing sheet** (ingestion saw nothing, so it can report nothing); the
`(class × kind)` rows catch the **missing rule**. Causes have per-member originator legality:
`NOT_IN_PROJECT_SCOPE` and `NOT_IN_THIS_BILL` are **human-only** (a machine can rarely
establish absence); the machine's default is `NOT_ESTABLISHED`; ingestion-fidelity rows split
`INGESTION_TRUNCATED` (a cap you raise) from `ENTITY_TYPE_UNHANDLED` (code nobody wrote) —
opposite remedies. A presence recogniser runs strictly one-way: it can say *seen*, never
*absent*. Rows are recomputed per ingestion; human acts persist and re-resolve; a contradicted
act suspends pending re-affirmation. Bill boundary and measurement boundary print separately —
merging them tells a contractor the unmeasured scope is excluded from the *works*, a worse lie.

**The scope register is a query, never a table** (amended by `.wayfinder/takeoff/tickets/13`):
denominator from the classes ingestion sighted × the kinds they bear, numerator from published
lines, cause a `CASE` in which **`NOT_ESTABLISHED` is the fall-through arm with no writer**. A
machine `INSERT` into a scope table is a filter with no actor — the shape ticket 01 rejected the
per-project pin for. Because the residue is computed it cannot be forged, §8's *name the evidence
or lose the cause* degrades automatically, *recomputed per ingestion* is free, and *contradicted
act suspends* is another arm rather than a column someone must remember to update. The three
originator classes therefore have three mechanisms and **a rail can reach none**: the human-only
causes only through the act seam (the sole construct that refuses a non-human actor), the machine
default through the fall-through, the ingestion-owned pair off the artifact's verbatim fidelity
counters. **A rail contributes a candidate absence by not offering**, attaching a reason in its
own vocabulary that rides the queue item as evidence — never a cause, since the cause taxonomy
carries the originator legality this clause defines. **The one-way valve is the output type's
shape**: a recogniser returns a list of sightings and there is no `absent()` constructor anywhere,
so finding nothing returns an empty list, which says nothing rather than denying something. That
distinction must stay representable — *a channel ran and yielded zero* is `NOT_ESTABLISHED`, *no
channel ran* is `ENTITY_TYPE_UNHANDLED`.

## 3. Publishability, per line

| attribute | required |
|---|---|
| `quantityBasis` and `selectionBasis` | always, both |
| coverage | always, never `PARTIAL_UNDECLARED` |
| provenance to a register row | always, as a **reference**, never prose |
| the (drawing, view) it was read from | always |
| the rule id + version that produced it | wherever basis is `DERIVED` |
| the vectorizer id + version + render DPI | wherever basis is `INTERPRETED` |
| an affirmed calibration reference | always — a quantity without one is unrepresentable |

Provenance must be a reference because prose provenance is uncheckable (the legacy census found
`why` strings citing row values the source sheet did not contain).

**Attribution is two-level.** One named responsible surveyor per issued bill (RICS AI standard,
mandatory since 9 March 2026: written reliability decision, randomised dip samples on automated
output, AI disclosure) — plus a per-line actor **only where judgement entered** (basis neither
`MEASURED` nor `INTERPRETED`, coverage not `COMPLETE`, or a deferral). `INTERPRETED` is excluded
because no human authored the reading: machine work is *checkable rather than believable*
(`identity.md` §7), so it carries machine provenance above and a manufactured actor would degrade
the signature the same way signing every line does. Signing every line puts a name on rows
where nobody decided anything and degrades the signature where it matters. Attribution is
**derived from the append-only act log**, never stamped on rows (see `identity.md`).

## 4. Refusal — shape determined by the axes, never chosen per site

| condition | shape |
|---|---|
| a mandatory publishable attribute is missing | **hard block** — nothing publishes |
| known scope, not measured | **declared exclusion** + queue item |
| evidence absent or illegible | **declared exclusion** |
| the drawing was silent | **never a silent default** |
| interpreted geometry, uncorroborated | **declared exclusion** + queue item — never a line |

**The over-measurement asymmetry:** over-measurement is a **hard block**, never a declared
exclusion. A disclosure lets a reader know to *add*; nothing lets a reader know to *subtract*.
Where the system cannot establish that an element belongs to the class and drawing it is
measuring under, it refuses to emit at all. (Legacy exemplar: a phantom pile cap read off the
wrong plan invented money inside a class that read net short.) Prevention sits upstream of the
signature — an unaffirmed scale *declares*; an unauthorised sighting *never emits*.

**The over-measurement check is scope attribution, not magnitude** (amended by
`.wayfinder/takeoff/tickets/13`): the gate has neither §5's band against a manual takeoff nor §8's
sample, so it cannot know a number is too big — it asks only whether the offer establishes its
object belongs to the class and drawing it measures under, and severs the object from bill reach
where it does not. Severance making a cell read as an absence is not the disclosure this clause
bans, because the ban is on telling a reader to **subtract** and severance leaves nothing to
subtract; where it removes something real it converts an over-measurement into a *disclosed*
under-measurement, which is the governing sentence exactly.

**A hard block is not silence.** *Nothing publishes* would be the condemned state if a blocked
line simply vanished; it cannot, because §2's query derives absence from published lines, so a
blocked line leaves a cell that reports as an absence with a cause. The block discloses itself.
**Where a domain attribute is missing, §6 governs, not this table**: the rows above are about
§3's metadata of the reading, and the discriminator is what the defect impugns — rate selection
publishes **unpriced**, the number keeps the **row with no quantity**, the reading's admissibility
**hard-blocks**, the scope's existence **hard-blocks and severs**.

**Corroboration is the publishability gate for `INTERPRETED`.** An interpreted line reaches a
bill only as `AGREED` (`identity.md` §7); uncorroborated interpreted geometry is not a line at
all but a declared exclusion with a named cause and a queue item — the *known scope, not
measured* shape above. The raster lane therefore measures less, completely, and says so. Bulk
corroboration is lawful and recorded at the granularity performed (a sheet's class in one act
with N subjects); the force against rubber-stamping is not per-row ceremony — §7 rejects that as
degenerating into `confirm-all` at volume — but §8, under which an unvalidated engine class is a
mandatory dip-sample stratum with Part A reviewed **in full**.

## 5. Tolerance

**±3% under, +0% over**, against a competent manual takeoff, with three binding conditions:

1. **Per class, and a class passes only if its components pass — netting inside a pass is
   forbidden.** (A +0.57% "pass" was once −9.4% and +19.6% cancelling.)
2. The band applies **only where coverage is `COMPLETE`**.
3. **A number cannot reconcile with the source it was copied from.**

And the yardstick rules: ground truth is **row sums, never printed grand totals** (a printed
total is one cell of arithmetic with no scope on it); **an input may never be derived from the
figure the gate it feeds compares against** (back-solving bans); correcting ground truth
requires corroboration on the artefact; a self-disagreeing yardstick row prints **ungated**,
never dropped; every disagreement is our defect until outside evidence says otherwise — and
yardstick-defect, basis difference, and revision drift are **unavailable as excuses for an
over-measurement**. Two ledgers: **coverage** is per bill and client-facing; **validation** is
per engine, per class, internal — an unvalidated class never reaches a certificate and becomes
a mandatory dip-sample stratum. **The raster path is a distinct engine**: it produces the same
classes as the vector path and may never borrow the vector path's validation. The band binds it
unchanged — a relaxed `+0%` for scan-derived lines is a basis-difference excuse, which the
sentence above already forecloses.

## 6. Declaring the boundary

- **One coverage statement, computed at publish**, from the scope register. The **Certificate
  of Measured Coverage is that statement** — a query over **work-item catalogue × scope
  register**, never prose (amended by `.wayfinder/takeoff/tickets/01`). The whole catalogue is
  in every project's denominator; narrowing is an **attributed act** (`NOT_IN_PROJECT_SCOPE`,
  human-only), never a project pin — a pin that filters the denominator is a silent exclusion
  with no actor, and §8's absence census has nothing to census. A
  bill without its certificate is not a bill and cannot be emitted; they bind into **one
  server-generated PDF** (a browser print cannot guarantee the certificate travels).
- The certificate rides in **every export channel** and is **never carried by colour alone** —
  a tint dies in greyscale and print.
- **Scan-derived geometry discloses by sheet, never by line.** Sheets supplied as raster images
  are named, with the vectorizer id + version and render DPI: *"all geometry on these sheets is
  machine-interpreted from a raster render and was not read from drawing geometry."* The unit is
  the sheet because §3 already makes the (drawing, view) a mandatory per-line citation, so the
  statement is a query over data the register holds; because §8 makes the boundary instrument
  **enumerated and few** while a per-line list is the bill reprinted inside its own certificate;
  and because a sheet count converts to no percentage in either direction. **No count of
  interpreted lines prints** — by count meaningless, and a reader recovers the banned percentage
  by subtraction. No corroborated/uncorroborated split prints either: uncorroborated interpreted
  geometry is never a line (§4), so it is already reported as a scope-register exclusion. This
  statement is also the **AI disclosure** §3 requires.
- **No grand total under incomplete coverage.** The bill emits a labelled *measured-scope
  subtotal* only. The bill's face stays clean — no per-row marks (a hatched "not measured" row
  inside a priced bill reads as *excluded from contract*, a worse lie); missing item-selecting
  attributes publish the quantity **unpriced** (empty rate cells the arithmetic shows); missing
  quantity-determining attributes keep the **row with no quantity** — *no line* is the most
  expensive defect. The amount-in-words belongs on the certificate, attached to a scope
  statement. No coverage percentage prints on the certificate (by count meaningless, by value
  it would originate quantities outside the register).
- Documents round the quantity **before** extension at a per-kind fixed precision (arithmetic
  closure on the face); the register keeps full precision; the over-measurement block reads the
  **register** value, never the printed one.

*Amendment, 2026-08-16.* The certificate names the **instruments in force** as enumerated fields,
never prose: the **rule-set edition** — its human string, its digest, and its fork lineage where a
tenant authored one — and the **catalogue digest** its denominator was enumerated from
(`identity.md` §8). A reader who cannot name which rules measured the job cannot check the bill.
Where the bill is unpriced there is no amount, so the amount-in-words is replaced by a **closed
reason code** — no book edition pinned — rendered by the document formatter with a stated locale.
Prose there reopens the door this clause shuts; silence is the condemned state.

## 7. The gates

The hard gate is **signature, not disposition** (universal per-row confirmation degenerates
into `confirm-all` at volume, and the money is in *absence*, which disposing rows never meets).
Two gates, deliberately separate because one conflated gate is how `incomplete: 0` printed over
a bill 54% short:

1. **Coverage/boundary** — founded outside the register (the work-item catalogue + scope
   register). No
   sampling rate finds the row that is not there; this gate is enumerated, in full.
2. **Reliability** — the named surveyor's written decision, informed by the dip sample.

Generation refuses on **unsigned**, never on *bad* and never on *unknown* — adverse verdicts
and unquantified unknowns print on the face of the bill. The signed object is the **boundary
plus the rule set in force**, not the values: an authored rule re-derives and voids every
signature it moves; a signed bill is **superseded**, never silently invalidated (issued
documents snapshot their attribution and disclosure, citing act ids).

## 8. The dip sample

Two instruments: quantities are **sampled** (many, expensive); the boundary is **enumerated**
(few, fatal).

- **Part A — directed review queue:** every machine-enumerable suspect class (unvalidated
  engine classes, declared disagreements, `ENTERED` heights, contested authorities), checked in
  full, never reported as a sample rate. Global bound: Part A ≤ Part B.
- **Part B — blind sample:** draw unit is `(register object × quantity kind)` — systematic
  errors are present in every member of their class, so the cheapest check finds them. Stratum
  `(class × kind)`; minimum one draw per quantity-bearing cell; remainder allocated by money;
  level picked uniformly before object. Size is **determined, not chosen**:
  `N = quantity-bearing cells × 2`. The act is **blind re-derivation** — the QS enters their
  own figure before seeing the machine's (a shown formula that omits crank bars gives nothing
  to disagree with; blind is the only version that catches an absence).
- **Absence draws are a census, not a sample**, over human-authored scope declarations only —
  *name the evidence or lose the cause* (degrades to `NOT_ESTABLISHED`, never blocks). A
  withdrawal voids the bill: a wrong boundary is not deferrable.
- A failure **condemns the error's reach, not the draw's cell**. Direction decides: under →
  fix / move the boundary / qualify; **over → hard block, no qualification door**. A failed dip
  sample has exactly two legitimate outputs: fix the input, or move the boundary.
- The signature binds **one-to-one to its sample**; void on boundary change, rule-set change,
  or a new revision of any cited drawing — the cited drawings being exactly the campaign's
  pinned drawing-set revision manifest, which is why there is no second list (`identity.md` §9).
  No clock-based or volume-based re-sampling — the bill's freshness gate is the volume rule.
  Draws are irrevocable; abandonment is recorded; the certificate prints the failure count. No numeric void threshold — that judgement already has
  a name (`NOT_RELIABLE`).
