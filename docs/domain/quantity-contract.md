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

*Amendment, 2026-08-17 (issue #134).* **An expanded object's geometry carries basis `DERIVED`.** Where
`cad-ingestion.md` §9 replicates a vertical member across a level stack, the outline on the seventh
floor was not read from the seventh floor's drawing — a named rule produced it — so the geometry term
of the `quantityBasis` roll-up is `DERIVED` under that rule's `(rule id, version)`, and only the level
the caption anchors keeps `MEASURED`. Without this the distinction states nothing: the roll-up is
weakest-wins, an expanded column's determining attributes are section dimensions (`MEASURED`) and a
storey height (`TRANSCRIBED`), and `TRANSCRIBED` outranks `DERIVED` — so every expanded line would
publish exactly what the drawn level publishes. Basis stays per attribute; the geometry was always a
term of the roll-up and always able to vary (`INTERPRETED` is a geometry basis). The rejected
alternative was a synthetic `levelMembership` attribute, which names no physical fact, buys a
corroboration axis promotion already covers (`identity.md` §2), and would have to be hand-excluded from
§4's content signature there.

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

*Amendment, 2026-08-17 (issue #136).* **The residue's cell gains level, sighting is a query, and the
bill boundary leaves this clause.** Six rulings, each closing a hole this clause left open:

- **The cell is `(sighted class × kind borne × level sighted)`.** Flat, a tower whose columns are
  measured on levels 1–5 and missed on 6–10 has a `(COLUMN, RCC_CONCRETE)` cell that published, so it
  is quantity-bearing, leaves the residue, and certifies as measured scope — *correctly measured, of
  the wrong scope*, which §1 calls two thirds of the legacy money error, reappearing one axis up.
  Level is already in the identity key, so this costs no new concept, and §8 already picks level
  uniformly before object. It does not disturb `bears`, which stays `(class × kind)`: the level axis
  comes from the sighting, never from the relation. The 2026-08-17 amendment to §6 stands unchanged —
  a row kept with no quantity is still `PARTIAL_DECLARED` — but its stated reason is now the weaker
  of two: with level in the cell the missing-storey case is caught twice, and that rule still governs
  the case this one cannot see, where the row exists and the number does not.

- **"Ingestion sighted a class" is a query, never a table** — the ruling this clause already made for
  the residue, applied to its denominator. It is a **union of `EXISTS`** over three named channels
  within the campaign's pinned revision manifest: register rows of the class; the stored §7–§9
  partition's placements and member-type registry families; view membership off the artifact's layout
  inventory. No new writer, and *recomputed per ingestion* stays free. Register-only was put and
  rejected: a column schedule carrying forty marks that registers no column would make `COLUMN`
  unsighted, dropping the class out of the residue entirely so the bill reports no columns in the
  project — the silent-loss defect wearing a denominator. The one-way valve is structural in three
  layers: a union of existence claims cannot express absence; the recogniser type is `Sighting[]` with
  no `absent()` constructor; and **`NOT EXISTS` is lint-banned inside the channel module**, so
  negation appears exactly once, in the spine-owned residue query. The third layer is what makes the
  first two more than a convention.

- **`NO_BEARER_SIGHTED`** — a kind-grain, writerless fall-through for a catalogue kind that no sighted
  class bears. This is this clause's *missing sheet*, and it has no cell to attach to. Collapsing it
  into `NOT_ESTABLISHED` was put and rejected on the argument that already split `INGESTION_TRUNCATED`
  from `ENTITY_TYPE_UNHANDLED`: **different remedy, different code**. `NOT_ESTABLISHED` tells a reader
  we saw the scope and measured nothing; the truth here is that no drawing carrying that work ever
  arrived, and the remedy is to supply the sheet. It reopens no *filter with no actor* door — it is an
  arm of a query with no writer, exactly as the fall-through is.

- **`NOT_IN_THIS_BILL` leaves this clause's cause taxonomy.** It sits happily on a cell that
  *published*, which a residue whose numerator is published lines structurally cannot hold. Bill
  boundary and measurement boundary are therefore **two orthogonal axes over one borne grid**, the
  move §1 already makes for basis and coverage: a **measurement axis** (measured, or not with a cause
  — `NOT_ESTABLISHED` · `INGESTION_TRUNCATED` · `NOT_IN_PROJECT_SCOPE` · `NO_BEARER_SIGHTED` ·
  unborne) and a **bill axis**, whose only non-default value is `NOT_IN_THIS_BILL`, always a named
  human act. Listing them in one enum is what made merging them expressible; two axes make the lie
  this clause names unrepresentable rather than forbidden.

- **The fidelity counters land on cells only through `src`.** They are per entity type and per page
  (`cad-ingestion.md` §2, §3) while a cell is per class × kind × level, and most of that gap is
  unbridgeable — `LWPOLYLINE` names no element class. So: **`INGESTION_TRUNCATED` attributes to a cell
  only through the parent chain** — §3 makes every synthesized entity carry its parent INSERT's
  handle, so a tripped cap names a parent instance, and where that key is cited by a sighting of class
  X, the counter lands on X's borne cells for that page. **`ENTITY_TYPE_UNHANDLED` never reaches a
  cell**: code nobody wrote cannot know what class the bytes were, and attributing it would be a guess
  wearing a cause code. The honest answer for everything unattributable is a **sheet-grain fidelity
  block, enumerated and never summarised**, naming the sheet and the entity type — §6's unit and §6's
  reason, that a per-line list is the bill reprinted inside its own certificate. And an attributed
  truncation makes **`COMPLETE` unrepresentable on that cell's lines**: a lost entity cannot
  over-measure, so the defect is always short, and §1's coverage axis is where a short line belongs.

- **The `CASE`'s arms, in order, first match wins**: (1) published lines exist — the cell is
  quantity-bearing and not in the residue at all; (2) a human act in force whose evidence resolves —
  its cause, and because this arm is a **join on the evidence**, §8's *name the evidence or lose the
  cause* degrades by the join failing, with nothing to remember to run; (3) an attributed
  `INGESTION_TRUNCATED`; (4) the fall-through, `NOT_ESTABLISHED`. **Contradiction needs no state**: it
  computes to *a cell an act declared absent is now quantity-bearing*, so arm 1 beats arm 2 and the
  act is suspended by arm order. Only `NOT_IN_PROJECT_SCOPE` can be contradicted this way; the same
  shape under the bill axis is not a contradiction at all but measured scope lawfully held out. A
  contradiction surfaces in §8's Part A as a declared disagreement, **not on the certificate** — the
  boundary is not wrong there, a human's belief about it is, and the certificate reports the boundary.

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

*Amendment, 2026-08-17 (issue #138).* **The validation ledger as data — and what "never reaches a
certificate" means.** This clause's two sentences on validation were read strictly and the strict
reading is dead law: §4 and §8 both make an unvalidated engine class a **mandatory Part A stratum
reviewed in full**, which is unreachable if such a class never reaches a bill. Worse, condition 2
above binds the band to `COMPLETE` coverage, so a class whose rows are `PARTIAL_DECLARED` (§6, issue
#134) could never be validated and therefore never be certified — a permanent refusal where the
governing sentence asks for *measure less, completely, and say so*. The clause is read as follows.

- **An unvalidated class never reaches a certificate *as validated scope*.** It certifies under a
  named `UNVALIDATED` disclosure (§6) and pays for it with full Part A review. It is not withheld.
- **The ledger's key is `(engine, class, kind)`, not `(engine, class)`.** Column concrete and column
  formwork come off one object through unrelated formulas with unrelated error modes; a class-grain
  ledger would hand a later kind the earlier kind's validation, which is an over-measurement path.
  §8's stratum is already `(class × kind)`, and a ledger keyed coarser than the stratum it feeds
  cannot compute that stratum.
- **A row is an observation, never a status.** The ledger holds observations only; the set of cells
  that ought to be validated is `bears(class, kind)` from the work-item catalogue
  (`measurement-rules.md` §8), so *unvalidated* is the query `NOT EXISTS (a live passing observation)`
  over that grid. A registry row carrying a status was put and rejected — it goes stale against the
  catalogue exactly as a remembered `is_validated` flag goes stale against the pins.
- **An observation is outlived, never deleted or flagged.** It cites the same instruments a signature
  does — **rule-set edition, method hash, converter version** (`cad-ingestion.md` §12's sanity number)
  — and ceases to count when any cited instrument leaves force. Liveness is a query, in the shape
  `identity.md` §8 already uses for `PIN_STALE`.
- **The drawing set is evidence, not key.** Keying a validation to the set it was proved on makes
  every project start unvalidated forever and the gate never fires; keying it to nothing lets a
  nine-column fixture claim validation for a five-hundred-column tower. The set revision, the band's
  inputs and its verdict ride the observation as recorded evidence. **A class is validated on one
  live passing observation** — there is no quorum, which would be an unsourced measurement threshold;
  overclaiming is fought by printing the evidence.
- **Provenance is a field on the observation, closed:** `HAND_FROM_RENDER` · `HAND_FROM_AUTHORED_SOURCE`
  · `INDEPENDENT_HUMAN_TAKEOFF`. A golden derived from a synthetic fixture's authoring script does not
  breach the back-solving ban — the generator is upstream of the engine, not derived from its output —
  but it validates the **engine** and never the **domain**, because drawing and golden share one
  author. The enum is what keeps that visible on the certificate's face rather than equal to a real
  takeoff.
- **Every published line carries the `engine` that read the drawing**, non-null, from a closed enum
  (`VECTOR`, `RASTER`); the certificate joins line → ledger on the line's own engine, so *the raster
  path may never borrow the vector path's validation* is unrepresentable rather than merely forbidden,
  and admitting a second engine adds values and rows without re-keying a landed one. `engine` is
  **orthogonal to basis**: basis says how a value was known, `engine` says which reader produced the
  drawing-side inputs. A line with a human-entered input keeps its engine — a nullable engine would
  unbind the ledger the moment entered attributes appear, and human entry already has its own
  instrument in §8's Part A.
- **The band's two arms fail differently at the build.** A missing or unparseable golden, or a trip of
  the **over** arm, is a hard failure — `+0% over` admits no qualification door (§8). An **under** miss
  records a *failing observation*, leaves the class unvalidated, and the certificate says so.

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

*Amendment, 2026-08-16.* The document's Bengali is **machine-readable**, not merely legible: for
every shaped run the emitted PDF carries text that extracts back to the **logical** string. This is
a requirement on the producer, because shaping merges and reorders clusters and a `/ToUnicode` CMap
alone cannot describe that merge — Bengali then extracts in visual order with holes in it, from a
document that looks perfect. Three reasons, each already in this file: a signed bill is later
**searched, indexed and read by a machine** — a procuring entity's as much as ours; a document only
a human can read back can only be **checked** by a human, and the governing sentence is about output
nobody can check; and the native-Bengali review this product owes its first client
(`docs/CONTEXT.md`) reviews **strings**, not pixels. Measured 2026-08-16
(`docs/research/pdf-bengali-2026-08.md`): of the permissive toolchains that shape Bengali
correctly, one emits it — so this clause selects the renderer, which ADR-0008 names and pins. The
round-trip is asserted mechanically; a document whose Bengali does not survive it is a failed
build, never a shipped bill. It is **not** a shaping test — measured, a round-trip passes the
visibly broken document and fails the correct one, so the two gates are separate and both are owed.

*Amendment, 2026-08-17 (issue #134).* **A row kept with no quantity is `PARTIAL_DECLARED`, never
`COMPLETE`.** The exemplar is a storey height the drawing never states: quantity-determining,
`DEFAULTED` barred (`measurement-rules.md` §7), so the line keeps its row and publishes no number,
deferred `STOREY_HEIGHT_UNSTATED`. Coverage has to follow, because the residue is `(class × kind)`
grained and that cell is not absent — the column class produced lines on every other level, so a bill
one storey short would certify the cell measured and say nothing. The enumerated omitted component is
the quantity itself with its named cause. `PARTIAL_UNDECLARED` is unrepresentable and `COMPLETE` on a
row with no number is the same lie by a shorter route; this also suppresses the grand total by this
section's own rule rather than by anyone remembering to.

*Amendment, 2026-08-17 (issue #138).* **The `UNVALIDATED` disclosure is a third statement, at the
ledger's own grain.** Where a published line's `(engine, class, kind)` has no live passing observation
(§5), the certificate prints a statement naming that cell as measured by an unvalidated engine, with
the observation's provenance where one exists. It is **not** a value in the measurement-boundary cause
enum and **not** a third axis on the residue's grid: nothing is absent, and the cause taxonomy is about
why a cell is missing — folding confidence into it makes `COMPLETE` mean two incomparable things again,
which is what the amendment above spent its length preventing. Grain is `(engine, class, kind)`, so the
statement prints correctly when the class is sound and only the *engine* is new.

*Amendment, 2026-08-17 (issue #136).* **The certificate's face: a left join from the catalogue, two
statements, enumerations never cardinalities.** This clause makes the certificate a query over
catalogue × residue without saying how the two denominators meet. They meet as a **left join from the
catalogue to the residue on kind** — the catalogue is the outer axis, cells are inner — so every cell
appears exactly once under exactly one kind and non-double-reporting is structural rather than a
de-dup pass. A union was put and rejected for needing that pass. Three shapes fall out, each a
different fact with a different remedy: a kind with borne cells that published nothing prints those
cells with their causes; a kind **no sighted class bears** prints one line at kind grain
(`NO_BEARER_SIGHTED`, §2.2) and no cells; and a **sighted class bearing no kind** prints in a
**class-grain appendix, in full**, because it hangs under no kind and dropping it would let an unborne
slice read as completed scope. The converse — a sighted class bearing a kind with no catalogue row —
is unrepresentable, the catalogue being primary-keyed on the kind, so it is designed out and never
printed.

The two boundaries §2.2 separates print as **two separately titled statements, each projecting one
axis**, never a shared cause column, and the **measurement statement prints first and in full over the
whole catalogue, before any narrowing**. A cell both unmeasured and held out appears in both: not
double-reporting, because they are different facts, and neither statement is expressible in the
other's vocabulary — which is what makes *the unmeasured scope is excluded from the works*
unrecoverable rather than merely forbidden.

Five further bans, each one this face newly invites. **The certificate prints enumerations, never
cardinalities** — no cell count, no *nine of twelve kinds measured*: a numerator beside a denominator
is the banned percentage with one division added, and an aggregate destroys the remedy, which is
always per cell. **No money on the measurement statement**, ever, on this section's own stated ground
that a value-weighted figure originates quantities outside the register. **No severity ordering** —
causes differ in remedy, not in size, and ranking them invents a magnitude; the sort is
`compareCanonical` over `(kind code, class code, level)`, which the signature needs anyway, since two
renderings of one boundary must be byte-identical. **No empty-section suppression**: a statement with
no rows prints its heading and a closed *none* code, a heading that vanishes being indistinguishable
from a heading nobody wrote. **Never a symbol alone**, on this section's colour argument — a ✓/✗
column dies the same death in greyscale; every cause is a closed code rendered en+bn by the document
formatter. The sighting channel that established a cell stays queryable and **off the face**: it is
evidence for the cause, not the cause. Contiguous level runs **collapse on the face** (`L6–L10`) while
the query stays per level — a run is an enumeration written shortly, not a cardinality.

*Amendment, 2026-08-17 (issue #186).* **`STOREY_HEIGHT_CONTESTED` joins `STOREY_HEIGHT_UNSTATED`.**
`measurement-rules.md` §7 as amended makes a storey height a set of readings that **suspends** when two
disagree, so a line may now lack a height for two reasons whose recourse is different: nobody has
looked, or two people looked and disagreed. Both publish no number and **both take
`PARTIAL_DECLARED`** — the coverage consequence must be identical, or declaring a disagreement would
become a way to make a bill look more complete than a silence does. What differs is the named cause,
which is this contract's own rule that a refusal carries a reason and never prose. Equality is on the
**canonical metres**: a `TRANSCRIBED` 3000 mm and an `ENTERED` 3.0 m corroborate, they do not contest.

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

*Amendment, 2026-08-16.* **The signed object carries a third instrument: the calibration.**
`measurement-rules.md` §5 bound scale to the signature by declaring that *a scale family sits in the
signed rule set*. `identity.md` §8 made that unrepresentable — a rule-set edition is immutable and
forked platform → tenant → project at project creation, so it cannot contain a factor derived from a
drawing uploaded afterwards. The split that replaces it: the **tolerances** are rule-set parameters,
and the **calibration** binds through the lines' own content-addressed calibration keys.

*Amendment, 2026-08-17 (issue #136).* **The boundary in the signed object is both boundaries.** §2.2
as amended splits measurement boundary from bill boundary into two orthogonal axes, and the signature
binds the grid, not one projection of it: a bill narrowed by a `NOT_IN_THIS_BILL` act after signing
widens nothing measured and is exactly as fatal as scope measured after it, because the reader's
recourse — check what this signature covered — fails identically either way. This needs no addition to
§8's void list: an act moving either axis moves the boundary, which that list already names.

So the signed object is the **boundary + the rule set in force + the calibration in force**, and §8's
void list gains a fourth member: a signature **voids whole** when any line inside its boundary cites
a calibration key that is no longer the key in force for its view. This needs no second list — it is
the diff §8's freshness gate already runs, over the references §3 already makes mandatory
(`identity.md` §9). An identical re-affirmation voids nothing, because the key is content-addressed
and not a pointer at an act; nor does an evidence upgrade that moves no factor, though that row
re-presents under `identity.md` §5. §3's *an affirmed calibration reference — always* is carried
**per measured attribute**, as basis already is in §1, and the line stores a non-empty set: empty is
unrepresentable, which is what that row's `NOT NULL` was always saying.

A QS scale override is a **declared disagreement**, so §8's **Part A** enumerates it in full. It is
not a Part B stratum: Part B's draw unit and stratum are `(class × kind)` and have no scale axis.

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

*Amendment, 2026-08-16.* This clause uses one root for two sets, and they are not the same. A
**borne cell** is `bears(class, kind)` (`measurement-rules.md` §8) restricted to the classes
ingestion sighted — §2.2's residue denominator. A **quantity-bearing cell** is a borne cell that
published at least one line — this clause's stratum, so `N = quantity-bearing cells × 2` is
determined at **publish**, not at ingestion. Reading *quantity-bearing* as the borne set was put
and rejected: a cell with no published line has nothing to blind-re-derive, and absence is already
routed to a census over human-authored declarations. The residue is exactly *borne minus
quantity-bearing*, so the two instruments partition one grid with no gap and no overlap —
producing cells sampled (Part B), absent cells enumerated (Part A + census).

A borne cell whose **rail does not exist** falls through to `NOT_ESTABLISHED` (§2.2). A cause
naming the missing rule was put and rejected: it needs a machine writer, reopening the *filter with
no actor* door §2.2 shut, and the reader's remedy is unchanged. §2.2's `ENTITY_TYPE_UNHANDLED` is
ingestion-owned, off the artifact's fidelity counters, and does not reach a stage ingestion knows
nothing about.

*Amendment, 2026-08-17 (issue #136).* **Both cell sets gain level, and a contradicted act is a Part A
row.** §2.2 as amended makes the residue's cell `(class × kind × level)`, and the borne and
quantity-bearing sets are defined off it, so both carry the level axis and `N = quantity-bearing
cells × 2` grows with the level stack. That is the intended price: the stratum this clause chose
exists because systematic errors are present in every member of their class, and a rule that misfires
on one storey is systematic within that storey and invisible in a stratum that has averaged the
building. *Level picked uniformly before object* survives unchanged — it now selects within a stratum
rather than across strata, which is the same draw with the bias removed one step earlier.

A **contradicted scope act** — `NOT_IN_PROJECT_SCOPE` on a cell that is now quantity-bearing (§2.2) —
is a machine-enumerable declared disagreement and therefore a **Part A** row, checked in full. It is
not a Part B stratum (the cell has lines, which Part B already samples) and it is not a certificate
line (the boundary is right; a human's belief about it is not). The absence census is unaffected: it
runs over human-authored declarations still in force, and a contradicted act is not.

*Amendment, 2026-08-17 (issue #138).* **Part A enumerates the entered attribute, never its
derivations — and a failure's reach is that attribute's closure.** A storey height is authored once
per level and every column row on that level derives from it (`identity.md` §8's level stack; issue
#134 put the `DERIVED` on the geometry precisely so the entered value stays distinguishable).
Enumerating the derived rows would put fifty-four rows into Part A on a six-storey job and breach
*Part A ≤ Part B* on the first realistic project, while enumerating six storey heights is the review
actually worth asking a QS for. So this clause's `ENTERED` heights stratum is read at the grain of the
**entered attribute**. It follows that **the error's reach — which this clause condemns instead of the
draw's cell — resolves to the transitive closure of the rows derived from the failed input**: a wrong
storey height condemns every column row on that level, not the drawn cell and not the building.

*Amendment, 2026-08-17 (issue #137).* **The sample as data — four things this clause fixed in
arithmetic and left open in shape.**

**The remainder is allocated by a named basis, and money is one of two.** `N = quantity-bearing
cells × 2` with a minimum of one draw per cell spends its remainder as exactly one further draw per
cell, and *by money* is a **consequence** weight — it decides where the second draw goes, never
whether the first is drawn, because the first draw already carries this clause's systematic-error
argument. An unpriced bill is a lawful bill face (§6), so that input can be absent. The remainder is
therefore allocated by a **closed basis recorded on the sample** — `MONEY` where a book prices the
cells, `UNIFORM` where none does — printed as a named disclosure on the certificate. Uniform keeps
everything this clause guarantees mechanically (every cell drawn, `N` met, stratum intact) and loses
only the consequence weighting the absent book was carrying. Allocating by **quantity magnitude**
was put and rejected: it substitutes a different variable and reports it under the same word.
Deferring the remainder until the book exists was put and rejected harder — the drawn set would fall
short of a determined `N`, and this clause binds the signature one-to-one to its sample, so a short
sample is a signature bound to less than the law fixed.

**A draw is reproducible because its entropy is minted inside the draw, not before it.** The sample
records `seed` — entropy minted in the draw's own transaction — beside the **population digest** (the
published-line set the draw ran over) and the **algorithm id**, and materialises the drawn units as
rows. Replay recomputes the same set, which is `identity.md` §7's standard for machine authorship:
*checkable rather than believable*. Predictability is answered by ordering rather than secrecy —
nothing exists to leak before the draw exists, and the draw is irrevocable, so a seed known afterwards
buys nothing. A seed derived deterministically from campaign content was put and rejected: it is
recomputable by anyone before the draw and so predicts it. An **abandoned draw is recorded with a
closed cause** from the shared refusal taxonomy (§7's deferral shape), is **never replaced** — a
replacement draw is a re-roll wearing another word — and does **not** refuse signing: an abandonment
is a disclosed reduction of check, not an over-measurement, and this clause reserves the hard block
for the over arm. The certificate prints the abandoned count beside the failure count; the printing
is the enforcement.

**Blindness is a write ordering with a stated limit, never a screen's promise.** The machine's figure
is a published line, so no store can keep it secret from the QS who is entitled to read the bill. Two
constraints are mechanical and both refuse by name: the draw's entered figure is **write-once** (a
second write refuses `DRAW_ALREADY_ANSWERED`, which is this clause's irrevocability at the row), and
the reveal of the machine figure **for a draw** has a committed entered figure as its precondition
(refusing `BLIND_ENTRY_MISSING`). The claim the certificate may therefore make is exactly *a human
entered a figure with no machine figure served to them on that path*, which the act log's ordering
makes checkable — and it is stated at that strength, not stronger. Logging every read of a published
quantity, and abandoning any draw whose object was read before entry, was put and rejected: it buys a
stronger claim with a surveillance surface over every bill view and a sample that erodes as a QS reads
their own bill.

**Part A is a query, and its bound is a signing refusal.** Part A is enumerated, never stored — a
union of four disjuncts at the **entered-attribute** grain (amendment above): `(engine, class, kind)`
cells with no live passing validation observation (§5) · declared disagreements — suspended
attributes, contradicted scope acts, `STOREY_HEIGHT_CONTESTED` · `ENTERED` attributes · contested
authorities, *which is an empty disjunct until a book exists* (assumption named, `bd-authority.md`).
A row is **reviewed** when a disposition act cites the attribute revision now in force — #186's
re-presentation shape, so a disposition goes stale by query rather than by a flag somebody clears.
Unreviewed Part A rows refuse the signature. When the census outgrows the bound, the signature
refuses **`PART_A_EXCEEDS_SAMPLE`**, computed at sign time and never stored: *Part A ≤ Part B* is a
quality gate in an economics costume — a bill with more suspect inputs than sampled cells is not in a
state to be signed — and its remedies are this clause's own two, fix the input or move the boundary.
Truncating Part A was put and rejected (*checked in full* is what Part A is); growing `N` until it
covers was put and rejected (it samples a more broken bill *more*, and the size is determined, not
chosen).

*Amendment, 2026-08-17 (issue #189).* **The directed review queue — one queue, one row shape, one
act.** The clause above made Part A a query and left the queue itself named across four clauses and
defined by none. It is defined here.

**A row is a suspicion, keyed `(subject, disjunct)`.** The queue is one list with **one row shape** —
an opaque `(subject kind, subject ids)` pair, the shape `identity.md` §7's act log already uses, plus
the disjunct that put the row there, a closed enum. Four row shapes with four disposition acts was
put and rejected: this clause gives Part A **one** bound, and four queues cannot be counted against
one bound. One attribute entering through two disjuncts — an `ENTERED` storey height that is also
`STOREY_HEIGHT_CONTESTED` — is therefore **two rows**, because keying on subject alone lets one
disposition clear a disjunct the QS never considered. The cost is a census that inflates toward
`PART_A_EXCEEDS_SAMPLE`, which is the honest direction: more suspect inputs makes a bill *harder* to
sign.

**The validation disjunct's row is the cell, never its lines.** An unvalidated `(engine, class,
kind, level)` cell is **one row**. This is the amendment above's own argument reused: enumerating
derivations puts fifty-four rows into Part A on a six-storey job and breaches *Part A ≤ Part B* on
the first realistic project, and the originating fact — the absence of a live passing observation at
the cell (§5) — is one fact. *Checked in full* therefore means **every unvalidated cell is disposed,
none sampled away**, not that every line is re-derived: Part B already samples lines. Authoring a
golden is a different act, and it removes the row by making the disjunct false rather than by
disposing it.

**A Part A row cannot be deferred.** `identity.md` §7's deferral carries *a scope reference*:
deferral is an instrument of the **boundary**, not of scrutiny. A deferral that cleared the signing
refusal would be a review that found nothing by declining to look; one that held it would make
deferral useless on the only queue that blocks. Both readings were put and rejected because the
question mistakes the axis: the remedy for a row that will not be reviewed is this clause's own two —
fix the input, or move the boundary — and moving it (holding the cell out of the bill,
`NOT_IN_THIS_BILL`, §6) **removes the row from the census**, because its lines leave the bill. So
deferral keeps its full force one axis over, and `PART_A_EXCEEDS_SAMPLE` cannot be defeated by
note-writing.

**The disagreement fixpoint, and what breaks it.** A QS disputing a row adds a competing observation
(`identity.md` §7 bars before-images), which suspends the fact — and a suspended attribute is itself
a disjunct here, so disposition re-presents its own subject. That is the **intended fixpoint, not a
cycle**, and the row key above is what terminates it: the row the disagreement creates carries a
*different disjunct* from the one disposed, so no row is ever cleared by the act that created its
successor. It ends the way #186's resolver ends — corroboration on agreement, suspension on
disagreement — so termination is a second reading **agreeing**, never a counter, and the signature
refuses while the fact is suspended, which is the correct state for a contested input. One mechanical
guard: a disposition may not dispose the row its own act created, refusing
**`DISPOSITION_SELF_REVIEWED`**.

**The bound is computed over the whole census, reviewed or not.** `PART_A_EXCEEDS_SAMPLE` is a
judgement about the **shape of the bill**, not about work remaining, so review does not shrink it and
a QS cannot review their way out of it. Computing it over the unreviewed residue was put and rejected:
it turns a quality gate into a to-do list.

**Order is derived, never authored.** *Checked in full* makes order economically irrelevant, so an
authored priority field buys nothing and offers a place for a partial review to hide behind a ranking.
The queue sorts by disjunct in enum order, then by subject key in code-point order
(`compareCanonical`; `localeCompare` is banned). Order is a reproducibility guarantee — a surface and
a test see the same list twice — and never a guarantee about what is reviewed first.

**The act: `DISPOSE_REVIEW_ROW`, one type with a closed outcome.** `NO_EXCEPTION` |
`EXCEPTION_TAKEN`; when `EXCEPTION_TAKEN`, the competing observation is written **in the same
transaction** (`identity.md` §7). Two act types was put and rejected — one act keeps the queue's
clearing traceable to one row, instead of leaving *the QS looked and disagreed* to be reconstructed by
inference across two logs. What the act **cites** is a **closed per-disjunct tuple**, each naming
exactly the instruments whose movement re-presents the row:

| disjunct | citation |
|---|---|
| `ENTERED` attribute | the observation row's identity and revision (#186) |
| declared disagreement | the revisions of the observations in contest — a new observation re-presents it |
| validation-absent cell | **rule-set edition, method hash, converter version** — §5's own three instruments, so a disposition goes stale exactly when the validation observation beside it would |
| contradicted scope act | the scope act's id and revision, and **not** the line population, which would stale every disposition on every publish |
| contested authority | empty until a book exists (assumption unchanged) |

**Bulk disposal has one structural test, not a per-disjunct list.** Bulk is lawful when **one
judgement genuinely covers N subjects — the subjects share the fact being judged**; it is
`confirm-all` (§7) when each subject carries an independent fact. That test generates the answers
rather than listing them: validation-absent cells sharing one `(engine, class, kind)` method across
levels are bulk-disposable, as are one contradicted scope act's cells — one belief about one boundary;
`ENTERED` attributes are **never** bulk, because six storey heights are six authored numbers and the
amendment above chose that grain precisely as *the review worth asking a QS for*; suspended attributes
are never bulk, a contest being individual by definition. Recorded, as always, at the granularity
performed.

**The queue is a query; the looking is state.** Part A is enumerated, never stored — but a disposition
is written to a **typed table in the same transaction as its act row**, not to `detail` JSON. The
reviewed-ness query joins citations against the revisions now in force, and JSON carries no enum check:
the outcome enum, the disjunct and the citation would all become code-side conventions on a column the
database does not constrain.

**Permission: `DISPOSE_REVIEW_ROW` is held apart from signing and apart from draw abandonment.** Held
apart — distinct permissions — and **not** a same-person bar: a solo QS is a real Bangladeshi customer,
and a hard bar would make them unable to sign their own work and push it off-system. Concentration is
made **visible** instead — the certificate prints the actors, so one name across disposal and signature
is legible on the bill's face. This is the third act clause to name a permission ad hoc and the first
to state a **separation** the general permission model will have to generalise.
