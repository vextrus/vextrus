# The rail gate — what a rail owes the spine

wayfinder:grilling
Status: closed
Blocked by: 01-the-work-item-catalogue.md
Claimed by: claude/the-rail-gate

## Objective

`measurement-rules.md` §8 rules that the four algebras share only setup, the register and the
document stage, and that **the gate's shape is spine-owned — a rail may not author its own
definition of done.** No such gate exists. Charting sequenced the effort so the member rail's
slice lands first and then **the gate lifts into the spine**, proven by the face rail. This
ticket rules what the gate *is*, and it is a named lift, not a refactor that happens by accident.

## The decision

1. **What "done" means for a rail**, expressed once, in the spine. A rail hands the spine a set
   of quantity lines; the gate decides whether they may be published. Enumerate what the gate
   checks — `quantity-contract.md` §3's publishability table is the starting list (both basis
   roll-ups, coverage never `PARTIAL_UNDECLARED`, provenance as a reference, the (drawing, view)
   read from, rule id + version where `DERIVED`, an affirmed calibration reference).
2. **Coverage's second denominator.** §2 says absence is declared against the scope register,
   which is derived from **what ingestion saw**, enumerated against the catalogue (ticket 01).
   Rule how a rail contributes candidate absences without being able to *declare* them — the
   machine's default cause is `NOT_ESTABLISHED` and `NOT_IN_PROJECT_SCOPE` / `NOT_IN_THIS_BILL`
   are **human-only**.
3. **The presence recogniser runs strictly one-way**: it can say *seen*, never *absent* (§2).
   Rule where that one-way valve lives so no rail can bypass it.
4. **Rail selection is per quantity kind, not per drawing** (§8) — one architectural sheet
   originates both brick volume (member) and finish area (face). Rule the selection mechanism.
5. **Over-measurement is a hard block, never a declared exclusion** (§4). The gate is where that
   is enforced, once, for all rails.

## Guardrails

- The gate must be built so the **face rail's slice proves it** — if the face rail needs the
  gate changed, the gate was member-shaped and the lift failed. That is the acceptance test.
- Rows are recomputed per ingestion; **human acts persist and re-resolve; a contradicted act
  suspends pending re-affirmation** (§2).
- Bill boundary and measurement boundary print **separately** — merging them tells a contractor
  the unmeasured scope is excluded from the *works*, a worse lie (§2).

## Blocks

Tickets 18 (signature and dip sample) and 21 (the run graph).

## Resolution

**A rail is a pure function that returns *offers*, and the gate is the spine's sole writer of
quantity lines — the same shape as the register's door one stage down.** "Done" is not a check a
rail passes; it is the fact that the rail's return type is the entire surface it has, and every
other channel to the register is closed to it. Absence is never transmitted at all: the cause
taxonomy is the **output of one query and the input to no writer**, so the one-way valve is the
missing channel rather than a guard that could be forgotten.

Five decisions asked, six ruled — the sixth is the condition under which the guardrail's
acceptance test can be run before the face rail exists.

### 1. The gate is the door's sibling: rails offer, the spine writes

`registerRevision` (`src/core/register.ts`) is already the one place a *sighting* becomes an
*identity*; the gate — `src/core/gate.ts` — is the one place an *offer* becomes a *quantity
line*. A rail lives in `src/modules/takeoff/rails/<algebra>.ts`, takes register objects,
resolved attributes and the pinned rule set, and **returns data**. It holds no `TenantCtx`, opens
no transaction, and imports neither `@/core/db` nor `drizzle-orm` — enforced by a
`no-restricted-imports` block scoped to `rails/**`, which is how `eslint.config.js` already
enforces ADR-0001's boundary law and ADR-0005's inward-only rule.

**The noun is load-bearing.** The ticket says a rail "hands the spine a set of quantity lines";
it does not, and may not. A rail that believes it produces lines has already published in its own
head, and every check the gate performs becomes advisory. `pairing.ts` names its input `offered`
for this exact reason, and the door's outcome type — `registered` / `unchanged` / `represented`
/ `removed` / `refused` — is decided by the door, never by the caller. The gate returns the same
shape of verdict over offers.

The dependency still points inward: **core never calls a rail.** The module's runner calls the
rail, then hands the result to the gate. The gate re-derives the rail's own selection (§4) rather
than trusting the runner's routing, so a misrouted call is a block, not a wrong line.

*The measurement that forced it:* `identity.md` §1 — no module may originate a quantity — is
today enforced only by convention, because no writer of quantity lines exists yet. The door
proves the enforceable form: `insertRegisterObject` is exported for composition, but the
double-count guard is `register_objects_identity_uq`, a **constraint**, and the file says so —
*"the double-count guard is the constraint, not this function."* A gate a rail calls is a
function; a gate that is the only writer is a constraint.

*Rejected:* a `validateLine(line)` helper each rail calls before writing. It is exactly "a rail
authors its own definition of done" wearing a spine-shaped hat: the rail chooses whether to call
it, what to do with the verdict, and what to write afterwards. Nothing in `measurement-rules.md`
§8's clause survives that.

### 2. What the gate checks — and the two things it cannot

Three tiers, because the cheapest enforcement is the one that has no runtime.

**Tier 1 — unrepresentable, no check runs.** `quantity-contract.md` §2 says
`PARTIAL_UNDECLARED` is *"illegal state, never representable"*; a gate that checks for it has
already lost. Coverage on an offer is a discriminated union —
`{ coverage: "COMPLETE" } | { coverage: "PARTIAL_DECLARED"; omitted: [Component, ...Component[]] }`
— so a partial claim without its enumeration does not compile. The same for the calibration
reference (`measurement-rules.md` §5: NOT NULL, *"unrepresentable without"*), provenance (a
register-object id, never a string — §3 requires a **reference** because the legacy census found
`why` strings citing row values the source sheet did not contain), and the citation set (§6.2).

**Tier 2 — the gate computes it; the rail may not supply it.**

| the rail supplies | the gate derives | why the rail may not |
|---|---|---|
| per-attribute basis | `quantityBasis`, `selectionBasis` (weakest-wins) | §1 says both are *"neither stored"* — a rail-supplied roll-up launders a `DEFAULTED` attribute into a `MEASURED` line, and the roll-up is the one number a reader trusts |
| nothing | the attribute **role** (determining / selecting / both) | §1: roles are *"declared once per algebra, never per row"* — per-row roles let one line move an attribute out of the determining set and lose its own weakest basis |
| nothing | the refusal **cause** | §3 below |
| the algebra it ran as | the algebra the kind selects | §4 below |

**Tier 3 — checked at runtime, once, for every rail.**

| check | law |
|---|---|
| the cited (drawing, revision) is a member of the campaign's pinned set-revision manifest | `identity.md` §9 — *"the manifest is the citation list… there is no second list"* |
| the cited view's calibration is **affirmed**, and is the calibration of *that* view | `measurement-rules.md` §5 — an unplaceable view *"measures nothing"* |
| the subject register object exists, is not repudiated, and is not a refused second sighting | `identity.md` §2, §7 — both live in the table *"with no join from any bill"* |
| rule id + version cited wherever any determining attribute is `DERIVED`, **and the rule id is a member of the pinned rule set** | §3; `identity.md` §8 — a rule outside the pinned set makes *"the rule set in force"* a query result that widens under a signature |
| vectorizer id + version + render DPI wherever any basis is `INTERPRETED` | §3 |
| an `INTERPRETED` offer that is not `AGREED` is **converted** — not a line, but a deferral with a named cause and a queue item | §4 — the conversion is the gate's, never the rail's |
| exactly one line per `(object × kind × level)`, by unique constraint | `identity.md` §6 |
| the quantity is non-negative, and no offer is a correction of another | §5 — netting inside a pass is forbidden, and a netting line is over-measurement's cover story |
| **the formula re-evaluates to the value**, exactly, in decimal over the declared variables | §3's provenance census, turned on the audit string |
| an offer claiming `COMPLETE` in a cell where the same rail also filed a deferral is a block | self-contradiction, mechanically detectable |

The formula check is the one that costs something: it makes the "human-auditable formula string
+ named variables" of `identity.md` §6 a **closed-grammar expression the spine evaluates**, not
free prose, and it needs a small decimal evaluator in `src/core/`. It is worth it because it is
the same move `identity.md` §7 makes everywhere else — machine work is *checkable rather than
believable* — and because `measurement-rules.md` §2 already requires the deducted sum, the
ignored sum, the counts and the threshold in force to *"land in the line's variables"*. Unchecked,
that clause buys a decorative string; checked, the published number is provably built out of the
declared parts. **Cost accepted:** rails cannot emit prose formulas, and the grammar is a spine
asset that grows by ruling.

**The two things the gate cannot check, stated plainly.** It cannot detect a `COMPLETE` that is
false, and it cannot detect a correct arithmetic over a wrong scope — `measurement-rules.md` §7
already concedes the class (*"no gate can detect present-and-wrong"*). Those are `quantity-contract.md`
§8's, not the gate's: an unvalidated engine class is a mandatory dip-sample stratum, and Part B's
draw unit is `(register object × quantity kind)` — the gate's own cell. The instruments meet at
the same grain, which is the expected state.

### 3. Absence: the cause is computed, never written — and that *is* the one-way valve

**(decisions 2 and 3, which turn out to be one ruling)**

**Nothing writes `NOT_ESTABLISHED`.** The scope register is not a table of rows somebody inserts;
it is a **query** whose denominator is `(classes ingestion sighted) × (kinds those classes bear)`
against the work-item catalogue (ticket 01), whose numerator is the published lines, and whose
cause column is a `CASE` over four left joins — lines, the gate's deferral records, ingestion's
own fidelity counters, and human scope acts. `NOT_ESTABLISHED` is the fall-through arm. It is the
machine's default not because a default was configured but because **it is the residue**, and a
residue cannot be forged.

That answers both questions at once:

- **A rail contributes candidate absences by not offering, and attaches evidence it cannot
  attach a cause to.** Its non-offer is a *deferral record* — subject cell, named reason, source
  keys, queue item — written by the gate into `quantity_refusals` (machine-authored, sibling to
  `refused_sightings`, which stays what `identity.md` §2 made it). The rail's deferral type has
  **no cause field**. `NOT_IN_PROJECT_SCOPE` and `NOT_IN_THIS_BILL` are human-only not because a
  branch rejects a machine principal, but because the only path that sets them is `withAct`
  (`src/core/acts.ts`), which already refuses any actor who is not a real tenant member.
- **`INGESTION_TRUNCATED` and `ENTITY_TYPE_UNHANDLED` are ingestion's, never a rail's.** They are
  read off the artifact's own fidelity counters, which `completeIngest` already stores verbatim
  (`cad-ingestion.md` §3). A rail cannot see them, so it cannot guess between *a cap you raise*
  and *code nobody wrote* — §2's own words for opposite remedies. A rail that could name its
  absence's cause would name the flattering one.
- **The presence recogniser's valve is the same valve.** A recogniser registers through the
  door, which takes sightings and returns identities; there is no argument by which it says
  *nothing is here*. No rail can bypass it because there is nothing to bypass — the inbound
  channel does not exist, in the same way `PARTIAL_UNDECLARED` is not a value.

**Re-resolution.** Rows are recomputed per ingestion by construction: the query has no state to
go stale. Human acts persist because they are act rows, and they re-resolve because the query
reads them fresh. A contradicted act — a cell declared `NOT_IN_PROJECT_SCOPE` that now carries a
published line — **suspends**: the cause reverts to the fall-through arm and the act enters Part
A's directed review queue. That needs no new machinery; it is `identity.md` §7's suspension
(*"disagreeing readings suspend the fact pending re-affirmation"*) and §8's census rule (*"name
the evidence or lose the cause — degrades to `NOT_ESTABLISHED`, never blocks"*) reading the same
way from two directions.

*Rejected:* a materialised `scope_rows` table recomputed on each ingestion. It is the same
answer with a writable surface bolted on, and the writable surface is the whole risk: one
`INSERT … cause = 'NOT_IN_PROJECT_SCOPE'` from anywhere is a silent exclusion with no actor,
which is precisely the shape ticket 01 rejected the project pin for. A materialised view is
available later as an optimisation *because* nothing may write it.

### 4. Selection: two total maps on the kind axis, and the grid they range over

`measurement-rules.md` §8's *per quantity kind, not per drawing* is implemented as a
**spine-owned, code-owned, total map** `kindRail: Record<QuantityKind, Algebra>` in `src/core/`,
with CI asserting totality both ways — the pattern §4 already mandates for the kind enum against
the catalogue. It is **functional on kind**: one kind, exactly one rail. Two rails on one kind
reopens the double-count door at line grain, for the identical reason `identity.md` §2 gives each
kind exactly one authoritative discipline.

**The two maps are independent, and the ticket's own example proves it.** One architectural sheet
originating brick volume and finish area is *one* discipline and *two* algebras:

| kind | authoritative discipline (`identity.md` §2) | algebra (`measurement-rules.md` §8) |
|---|---|---|
| brick masonry volume | architectural | member |
| plaster / finish area | architectural | face |
| RCC column concrete | structural | member |

Collapsing them into one map would make the architectural rail *a* rail — which is the
per-drawing selection §8 bans, spelled differently.

**The grid they range over.** Selection needs to know which `(object, kind)` pairs exist at all,
and ticket 01 left that open: it ruled scope rows key `(class × kind)` without ruling whether
every class bears every kind. Ruled here, because a rail cannot be selected without it: **`bears`
is a code-owned relation on `(elementType × kind)`, with the same authority as the kind enum
itself** — identical for every project, changed only by migration and deploy behind a CI assert,
never a project-scoped pin. Ticket 01's objection to filtering the denominator does not reach it:
that objection was to a *pin* — a per-project filter with no actor, invisible to §8's absence
census. `bears` is a statement about physics, reviewable in one place, and the catalogue axis it
does not touch stays whole: a kind no sighted class bears still reads `NOT_ESTABLISHED` at
project level, exactly as ticket 01 requires.

The spine's run is therefore: for each sighted class × each kind it bears × each object of that
class → `kindRail[kind]` → the rail → the gate. **That loop is ticket 21's**, and it is a loop
over the register, never over the drawing set.

*Note on what does not exist yet:* `QuantityKind` is not in `src/core/enums.ts` — genesis §4 and
`measurement-rules.md` §4 rule it closed and code-owned, but it lands with the first rail's
slice. Both totality asserts are stated here and are written on the day the enum is.

*Rejected:* rails declaring the kinds they serve. It is rail-authored scope; two rails can claim
one kind, or none can, and either failure is silent — where a total map makes *"which kind has no
rail yet"* a CI fact.

### 5. Over-measurement: one block, two reaches, discriminated by what the defect impugns

The gate enforces §4's asymmetry once, for all rails. What it can check is not *the number is too
big* — no general gate can — but the **structural preconditions of over-measurement**, all of
which are class-general and all of which sit in Tier 3 above: an object outside the pinned
manifest (the legacy's phantom pile cap read off the wrong plan), a repudiated or duplicate
object, an unaffirmed calibration, a second line in an occupied cell, a negative or correcting
offer. There is no `force` flag, no severity field, and no per-site choice: `quantity-contract.md`
§4 says the shape is *"determined by the axes, never chosen per site"*, and a rail that could ask
for publication anyway is a rail authoring its definition of done.

**The reconciliation §4 and §6 need, stated once.** §4 says a missing mandatory attribute is a
*hard block — nothing publishes*; §6 says missing quantity-determining attributes *keep the row
with no quantity*, because *"no line is the most expensive defect"*. Both are true, and the
discriminator is **what the defect impugns**:

- **The number** — a missing, unresolvable or unpinned publishable attribute. The *quantity* is
  suppressed; the **row survives** with no quantity, a deferral record and a queue item. Nothing
  is asserted that cannot be supported, and nothing is hidden.
- **The existence of the scope** — the over-measurement class above. The *object* loses bill
  reach entirely: no row, no line, moved to the no-join-from-any-bill table `identity.md` §2 and
  §7 already chose, for the reason they already gave — a status flag on the register is one
  forgotten `WHERE` from over-measurement. A row here would itself be the assertion that the
  scope exists.

**And the apparent contradiction dissolves.** §4 bans over-measurement from being a *declared
exclusion*, yet a severed object leaves a cell that the certificate reports as `NOT_ESTABLISHED`
— which looks like a declared exclusion. It is not: the ban is on the shape *"we measured this,
it may be too much, noted"*, where a reader is told to subtract and cannot. Severance deletes the
number; the absence it leaves is reported by §3's ordinary residue, with no claim attached. A
disclosure lets a reader know to **add**, which is the only direction that works.

Finally, §6's *"the over-measurement block reads the register value, never the printed one"*
binds the gate's placement: it is upstream of the document stage, on full-precision `numeric`,
and per-kind rounding never touches an input to a block.

### 6. The acceptance test, written now: six assumptions the gate is forbidden to make

The guardrail — *if the face rail needs the gate changed, the lift failed* — is a retrospective
judgement, and retrospective judgements do not fail builds. Ruled: **the gate ships with a
synthetic face-shaped rail in its own test suite, before the face rail exists**, exercising six
properties the member rail would never have forced. Each is a concrete prediction; each is a red
test if the gate was built member-shaped.

1. **One object bears lines from two rails.** Uniqueness is `(object × kind × level)`, never
   `(object × level)`. A brick wall carries member volume *and* face area — §8's own example.
2. **The gate branches on no element type and no kind.** Everything kind-specific arrives as
   data: roles per algebra, rule ids from the pinned set, precision per kind. A `switch` on
   `elementType` in `src/core/gate.ts` is the failure, and it is greppable.
3. **Provenance is a set of citations, not one.** A face's quantity cites its outline *and* the
   opening-schedule rows that deducted from it, which `measurement-rules.md` §2 puts on a
   different sheet under a different authority. A gate accepting a single `(drawing, view)` is
   member-shaped and breaks on the first face.
4. **A line's inputs may resolve through a second register object.** Openings are scheduled
   against a mark, not against the face. Attributes are referenced, never copied
   (`identity.md` §6), so resolution is spine-side and the rail receives resolved values.
5. **A zero-offer rail is lawful.** Topology is *"the refusal, not the measurement"* (MAP's
   algebra ladder): a rail whose entire output is deferrals must pass the gate unchanged, with
   the run visible and every cell loud.
6. **A whole-subject deferral is lawful.** `measurement-rules.md` §3: a surface that is not a
   closed outline defers *with a reason* and is never bounding-boxed. The gate must have no path
   on which a partial geometry becomes a partial number.

The face rail's slice then either passes this suite untouched — the lift held — or it does not,
and the diff to `src/core/gate.ts` is the measured evidence that it did not. **The corpus** takes
the same six as cases (MAP: *"every rail ticket owes the corpus"*), each declaring a seam
terminus at the gate; they are `pending` until the gate lands and `undecided` for nothing, since
this ticket rules them. **Stated plainly: no case is written here, because the index does not
exist yet** — ticket 09 framed it and nothing has built `cad/tests/corpus/` (verified). The six
are the gate's slice's corpus debt, named now so it cannot be discovered later.

*Rejected:* landing the gate with the member rail's slice and lifting it when the face rail
arrives. That is the *"refactor that happens by accident"* the objective names, and it has no
failing state — a member-shaped gate quietly grows a branch and nobody can say when the lift
stopped being a lift.

### Found in passing

**`DISCIPLINE_NOT_AUTHORITATIVE` is documented in the wrong place.** `src/core/enums.ts` groups
it with `DUPLICATE_IDENTITY` as a *door* refusal — *"sighting from a discipline that does not own
the kind"* — but the door cannot enforce it: `registerRevision` never sees a kind, and the value
is declared and emitted nowhere in the codebase (verified: two occurrences, both in the enum's
own declaration). Under this ruling it is a **gate** refusal, checkable exactly where the kind is
first known. The comment is corrected with the first rail's slice, not here.

### Consequences for other tickets

- **18 (signature and dip sample)** — Part B's draw unit and the gate's cell are the same
  `(object × kind)`, and the gate's two unenforceable checks (§2) are precisely Part A's
  mandatory strata. The signed boundary reads the §3 query, which has no writer to distrust.
- **21 (the run graph)** — the run is a loop over `sighted class × bears × object`, resolved
  through two total maps (§4), never over the drawing set. Its unit of work is a cell.
- **16 (the bill and certificate)** — the certificate query gains its second axis: ticket 01 gave
  it `catalogue × scope register`; §3 and §4 here give the scope register its denominator
  (`bears`) and its cause `CASE`, and it materialises nothing.
- **The face rail's slice** — inherits §6 as its acceptance test, not as advice.
- **MAP fog, graduated:** *the architectural rail's element vocabulary* is now half-ruled — a
  wall is **one object bearing two kinds**, because two objects are two sightings of one physical
  scope and the door refuses the second as `DUPLICATE_IDENTITY`. Which classes the architectural
  set registers is now a sharp question and rides an inbox ticket. *Curved geometry on the scan
  lane* is answered outright: a raster arc that can be seen but not measured is a **presence
  sighting plus a deferral with a named reason**, leaving an evidence-bearing `NOT_ESTABLISHED`
  cell. It is never a line and never silence — the one-way valve applied unchanged.

**Amends `measurement-rules.md` §8** (the gate's shape, named) and **`quantity-contract.md` §2
and §4** (the cause is computed; the two block reaches). This ticket is one of the five named
amendment vehicles (MAP Notes).
