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
| `DEFAULTED` | supplied by config where the drawing was silent |

`DEFAULTED` is weakest because it is the only value where *nobody looked and nobody decided*.
`TRANSCRIBED` is not cosmetic: geometry is checked by re-measuring, a transcription only by
re-reading, and ingestion losses are transcription failures that `MEASURED` would hide.

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
   derived from **what ingestion saw**; every element class present in a drawing that produced
   no line becomes a declared exclusion. Consequence: **surfacing ingestion truncation is
   mandatory** — the artifact's fidelity counters exist for this.

The scope register attaches a **cause** to an absence the rate book already knows about (the
book is the enumeration; see `bd-authority.md`). Causes have per-member originator legality:
`NOT_IN_PROJECT_SCOPE` and `NOT_IN_THIS_BILL` are **human-only** (a machine can rarely
establish absence); the machine's default is `NOT_ESTABLISHED`; ingestion-fidelity rows split
`INGESTION_TRUNCATED` (a cap you raise) from `ENTITY_TYPE_UNHANDLED` (code nobody wrote) —
opposite remedies. A presence recogniser runs strictly one-way: it can say *seen*, never
*absent*. Rows are recomputed per ingestion; human acts persist and re-resolve; a contradicted
act suspends pending re-affirmation. Bill boundary and measurement boundary print separately —
merging them tells a contractor the unmeasured scope is excluded from the *works*, a worse lie.

## 3. Publishability, per line

| attribute | required |
|---|---|
| `quantityBasis` and `selectionBasis` | always, both |
| coverage | always, never `PARTIAL_UNDECLARED` |
| provenance to a register row | always, as a **reference**, never prose |
| the (drawing, view) it was read from | always |
| the rule id + version that produced it | wherever basis is `DERIVED` |
| an affirmed calibration reference | always — a quantity without one is unrepresentable |

Provenance must be a reference because prose provenance is uncheckable (the legacy census found
`why` strings citing row values the source sheet did not contain).

**Attribution is two-level.** One named responsible surveyor per issued bill (RICS AI standard,
mandatory since 9 March 2026: written reliability decision, randomised dip samples on automated
output, AI disclosure) — plus a per-line actor **only where judgement entered** (basis not
`MEASURED`, coverage not `COMPLETE`, or a deferral). Signing every line puts a name on rows
where nobody decided anything and degrades the signature where it matters. Attribution is
**derived from the append-only act log**, never stamped on rows (see `identity.md`).

## 4. Refusal — shape determined by the axes, never chosen per site

| condition | shape |
|---|---|
| a mandatory publishable attribute is missing | **hard block** — nothing publishes |
| known scope, not measured | **declared exclusion** + queue item |
| evidence absent or illegible | **declared exclusion** |
| the drawing was silent | **never a silent default** |

**The over-measurement asymmetry:** over-measurement is a **hard block**, never a declared
exclusion. A disclosure lets a reader know to *add*; nothing lets a reader know to *subtract*.
Where the system cannot establish that an element belongs to the class and drawing it is
measuring under, it refuses to emit at all. (Legacy exemplar: a phantom pile cap read off the
wrong plan invented money inside a class that read net short.) Prevention sits upstream of the
signature — an unaffirmed scale *declares*; an unauthorised sighting *never emits*.

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
a mandatory dip-sample stratum.

## 6. Declaring the boundary

- **One coverage statement, computed at publish**, from the scope register. The **Certificate
  of Measured Coverage is that statement** — a query over book × scope register, never prose. A
  bill without its certificate is not a bill and cannot be emitted; they bind into **one
  server-generated PDF** (a browser print cannot guarantee the certificate travels).
- The certificate rides in **every export channel** and is **never carried by colour alone** —
  a tint dies in greyscale and print.
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

## 7. The gates

The hard gate is **signature, not disposition** (universal per-row confirmation degenerates
into `confirm-all` at volume, and the money is in *absence*, which disposing rows never meets).
Two gates, deliberately separate because one conflated gate is how `incomplete: 0` printed over
a bill 54% short:

1. **Coverage/boundary** — founded outside the register (the book + scope register). No
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
  pinned drawing-set revision manifest, which is why there is no second list (`identity.md` §9). No clock-based or volume-based re-sampling — the
  bill's freshness gate is the volume rule. Draws are irrevocable; abandonment is recorded; the
  certificate prints the failure count. No numeric void threshold — that judgement already has
  a name (`NOT_RELIABLE`).
