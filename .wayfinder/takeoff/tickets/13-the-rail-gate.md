# The rail gate — what a rail owes the spine

wayfinder:grilling
Status: closed
Blocked by: 01-the-work-item-catalogue.md
Claimed by:

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

## Findings — unattended reading, 2026-08-13

Read by a session claimed `dispatched` (nobody watching). Facts only: ADR-0015 §1–3 permit an
unattended session to do the looking-up half of `/grilling` and require it to stop at the first
decision. Nothing below is a ruling, and no decision is closed.

### The blocker is clear, and what it left behind

01 (the work-item catalogue) is **closed**; this ticket's `Blocked by:` is satisfied. What 01
ruled that lands directly here: the catalogue is `work_item_catalogue`, **platform-owned,
code-derived at quantity-kind grain, primary-keyed on the kind value**, the whole catalogue is
every project's denominator, narrowing is an attributed human act, and — the part decision 2
inherits — **scope rows key `(class × kind)`**, because at class grain a beam's unmeasured
formwork hides behind its concrete line. 01 also rejected a per-project pin *"because a filter
with no actor is a silent exclusion"*, which is a shape decision 2 should test its own answer
against.

### What exists in code — the gate's actual starting surface

- **No quantity line exists anywhere.** `grep -i "rail\|algebra\|publishab"` across `src/`
  returns nothing. `src/core/register.ts` is the whole spine: projects, levels, drawings,
  revisions, ingests, register objects, refused sightings, and the door
  (`registerSightings`, `register.ts:644`). The register today holds **identity and evidence,
  never a quantity**.
- **The catalogue is a decision, not a table.** `db/schema/` is two files and neither carries
  `work_item_catalogue`. 01 ruled it; nothing built it. The gate can be ruled against it without
  waiting on schema.
- **`(class × kind)` exists in no code.** The identity key ends at `elementType`
  (`register.ts:747-755`, `enums.ts:23-33`), and `identity.md` §2 bars a mutable attribute from
  the key — so whatever carries the kind axis for decision 4 must live *outside* the identity
  key. There is no kind enum at all yet.
- **`DISCIPLINE_NOT_AUTHORITATIVE` is declared and emitted nowhere** (`enums.ts:66`). The door
  refuses on duplicate identity only; it never sees a quantity kind. Decision 4's selection
  mechanism has no existing hook in the door.
- **Originator legality is a comment, not a mechanism.** `enums.ts:56-73` documents human-only
  `NOT_IN_PROJECT_SCOPE` / `NOT_IN_THIS_BILL` and machine-default `NOT_ESTABLISHED`; nothing
  enforces it. The only construct in the repo that refuses a non-human actor is `withAct`
  (`acts.ts:38-52`, tenant-membership check on a real `actorUserId`). Today, "human-only" is
  enforceable exactly by routing a cause through the act seam and no other way.
- **`actTypes` has four values** (`enums.ts:48-53`) — no act type for filing a scope cause or a
  corroboration. Any human-only cause the gate leans on costs a new enum value, which is a
  migration (ADR-0002).
- **No decimal library in `package.json`.** `CLAUDE.md` bans floats for quantities. If the gate
  re-checks arithmetic rather than trusting it, that is the repo's first decimal dependency.
- **`elementTypes` is nine *structural* classes.** The guardrail's acceptance test needs
  architectural classes that do not exist — which is precisely the MAP fog entry *"the
  architectural rail's element vocabulary"* this ticket is supposed to graduate.
- **Ingestion already writes fidelity verbatim and never re-derives it** (`completeIngest`,
  `register.ts:369-403`; a counterless success is CHECK-refused). That is a candidate home for
  decision 3's one-way valve: a channel that saw nothing produces a **counter**, never an
  assertion of absence.

### What the domain law binds beyond this ticket's own list

- **§3's table has seven rows, not the six enumerated above.** The missing one:
  *vectorizer id + version + render DPI wherever basis is `INTERPRETED`*
  (`quantity-contract.md:99`).
- **An eighth check is already ruled and sits outside §3's table.** Ticket 03 (closed) ruled
  **corroboration is the publishability gate for `INTERPRETED`** — uncorroborated interpreted
  geometry is a declared exclusion with a queue item, *never a line*
  (`quantity-contract.md:132-139`).
- **§3 also binds attribution**: a per-line actor only where judgement entered, **derived from
  the act log, never stamped on rows**, and `INTERPRETED` excluded because no human authored the
  reading. That is a gate-derived attribute by construction — a rail cannot supply it.
- **§4 and §6 point opposite ways and the gate is where they meet.** §4 hard-blocks a line
  missing a mandatory publishable attribute; §6 says a missing *quantity-determining* attribute
  keeps **the row with no quantity**, because *"no line is the most expensive defect"*, and a
  missing *item-selecting* attribute publishes **unpriced**. Decision 5 needs the discriminator
  between "delete the line" and "keep the row empty" named.
- **§2's causes have three originator classes, not two**: human-only, the machine default
  `NOT_ESTABLISHED`, and **ingestion-owned** `INGESTION_TRUNCATED` vs `ENTITY_TYPE_UNHANDLED` —
  *opposite remedies* (a cap you raise / code nobody wrote). A rail may not be able to reach any
  of the three.
- **§7: the signed object is the boundary plus the rule set in force, not the values.** Whatever
  the gate emits must be identifiable finely enough that an authored rule change can void the
  signatures it moves.

### Prior art with no standing

This ticket was ruled once already, by an unattended session, and the artifact was removed.
#44 (`fcfd403`) landed 299 lines answering all five decisions plus a sixth, **and amended
`measurement-rules` §8 and `quantity-contract` §2/§4**. #46 reverted the effort but left the
ruling and both amendments on `main`; #52 (`c1373ba`) finished the revert. ADR-0015 records the
whole failure and rules the boundary this session is obeying.

**#52's grounds were procedural, and it says so explicitly**: *"takes no position on the six
rulings themselves… They remain readable in #44's commit message if the ticket is re-run
through the flow that was supposed to produce them."* So `git log -1 fcfd403` is available to an
attended session as **prior art to accept, vary or reject** — it is not a decision, and the
domain-law amendments it made are not on `main`.

Two facts from it that are findings rather than rulings, and survive independently:
`DISCIPLINE_NOT_AUTHORITATIVE` is dead code (confirmed above), and the guardrail's acceptance
test — *"if the face rail needs the gate changed, the lift failed"* — is a retrospective
judgement that **fails no build**.

### Who is waiting

18 (signature) and 21 (run graph) are blocked on this. 23 (lane fidelity) decision 2 asks
whether an absent channel makes a stage *refuse by name* or *unavailable to call* — the same
one-way-valve question as decision 3 here, and the two must not rule it twice. Two MAP fog
entries graduate on this ticket: the architectural element vocabulary, and what a raster arc
owes the register when it can be seen but not measured.

### The questions, sharpened

1. **Decision 1 — is the enumerated list seven, or eight?** §3's table plus 03's corroboration
   gate. And of that list, which entries are **gate-derived** rather than rail-supplied? §1
   declares attribute roles per algebra, never per row, and §3 derives attribution from the act
   log — so at least attribution and the coverage roll-up look underivable by a rail.
2. **Decision 2 — is the scope register a table or a query?** If a machine INSERTs a row into a
   scope table, that is 01's rejected shape (a filter with no actor) one level down. If it is a
   query, *"a rail contributes candidate absences"* resolves to a rail contributing by **not
   offering**, and the open question becomes what a non-offer must carry instead of a cause.
3. **Decision 3 — is the valve ingestion's fidelity block?** Counters are already written
   verbatim from the artifact and never re-derived, so a missing channel is structurally
   incapable of asserting absence. If that is the valve, it is a property of the data rather
   than a guard a rail could forget — and it must be reconciled with ticket 23 before either
   closes.
4. **Decision 4 — what carries the kind axis?** It cannot enter the identity key. `(class × kind)`
   is §2's scope row key *and* §8's dip-sample draw unit, so whatever answers this answers both.
   Note the ticket's own example is **one discipline bearing two algebras**, so kind→discipline
   and kind→algebra cannot be one map.
5. **Decision 5 — name the discriminator** between §4's hard block and §6's row-with-no-quantity.
   Both are law; the gate is the single site that has to choose between them.
6. **Unasked by the ticket, and the guardrail depends on it: how is the acceptance test made
   falsifiable before the face rail exists?** As written it is a judgement no build can fail.
   Either the gate ships with something face-shaped to assert against, or the ticket should say
   plainly that the lift is unenforced until the face rail lands.

Stopping here: every remaining item is a decision, and this session is unattended.

## Resolution

Ruled 2026-08-15 in an attended `/grilling` session — the findings above were the AFK half, and
attendance was discovered by asking, per ADR-0015. Eight questions put, eight ruled. #44's
prior art (`fcfd403`) was read first and put as an alternative at every fork; where this ruling
agrees with it, it agrees having been re-derived from the clauses, not adopted.

### 1. A rail returns offers; the gate is the spine's sole writer

The ticket's own objective said *"a rail hands the spine a set of quantity lines"*, and that noun
is wrong. A rail that produces **lines** has already published in its own head: it authored the
values the gate then reads, so every check is advisory in the only sense that matters. §1 says
both roll-ups are derived, weakest-wins, **neither stored** — a rail supplying one is a rail
authoring done, and it can launder a `DEFAULTED` attribute into a `MEASURED` line.

So the seam carries **offers**: geometry, attributes each with its own basis, the rule id, the
(drawing, view), the register-row reference. The line does not exist until the spine builds it.
Done is expressed as the gate's **return type**, not as a checklist.

The enforceable form is already proven one level down: `register.ts` exports
`insertRegisterObject` for composition, but the double-count guard is a **constraint**, not a
call site — `registerSightings` (`src/core/register.ts:644`) is the door and nothing else writes.

**Put and rejected:** a `validateLine(line)` helper each rail calls. The rail chooses whether to
call it and what to write afterwards — rail-authored done in a spine-shaped hat, which is exactly
what `measurement-rules.md` §8 forbids.

**Cost accepted:** the gate must know enough to build a line from an offer, so it grows real
logic rather than being a thin assertion pass, and §1's per-algebra attribute-role declarations
live in the spine.

### 2. Done is three tiers and nine checks, closed and total

§3's table is seven rows, not the objective's six — it dropped *vectorizer id + version + render
DPI wherever basis is `INTERPRETED`* (`quantity-contract.md:99`). Ticket 03's corroboration gate
is an eighth requirement living in §4's table. But "seven or eight" is the wrong count either
way: under ruling 1 several entries stop being checks and become shapes.

**Tier 0 — unrepresentable.** No check runs because there is nothing to say: `PARTIAL_UNDECLARED`
is not a constructible coverage value, the calibration reference is non-optional (§5:
*"NOT NULL — unrepresentable without"*), provenance is a register-row reference so a prose string
does not typecheck.

**Tier 1 — gate-derived.** An offer has no field for these at all: `quantityBasis`,
`selectionBasis`, coverage, per-line attribution (§3: derived from the act log, never stamped on
rows, `INTERPRETED` excluded), the selected algebra, and the refusal cause on a non-offer.

**Tier 2 — gate-checked, nine, once for all rails.**

| # | check | clause |
|---|---|---|
| 1 | provenance resolves to a register row in this project | §3 |
| 2 | the (drawing, view) resolves and sits in the campaign's pinned revision manifest | §3, §8 |
| 3 | rule id + version resolvable wherever any contributing attribute is `DERIVED` | §3 |
| 4 | vectorizer id + version + render DPI wherever any is `INTERPRETED` | §3 |
| 5 | the calibration reference is **affirmed**, not merely present | §5 |
| 6 | corroboration is `AGREED` wherever the line is `INTERPRETED` | §4, ticket 03 |
| 7 | every offered attribute carries a role the algebra declared — an undeclared attribute hard-blocks rather than passing through | §1 |
| 8 | `DEFAULTED` on a quantity-determining attribute hard-blocks | §6 |
| 9 | scope attribution (see ruling 7) | §4 |

**The list is closed and total.** A rail may not add a check; adding one is a spine edit under
review. Otherwise "spine-owned" decays into "spine-owned plus whatever the rail appends".

**Named rather than hidden:** two defects no gate can catch — a false `COMPLETE`, and a right
number measured over the wrong scope. Both are §8 Part A strata (*"every machine-enumerable
suspect class… checked in full"*), not gate checks pretending to cover them.

### 3. The gate evaluates the number; the rail owns only geometry

§2 requires the deducted sum, the ignored sum, the counts and the threshold in force to land in
the line's variables, and nothing in the law reads them back. Unchecked, that clause buys a
decorative string — and §3 already bans this defect in prose form, the legacy census having found
`why` strings *"citing row values the source sheet did not contain"*. Numeric variables that do
not reconcile are the same defect better camouflaged.

The line is drawn at **geometry versus arithmetic**. The rail derives inputs from the drawing —
section × run, the closed outline, runs by diameter — which is what makes four algebras necessary
at all. The offer carries those inputs *and* the expression combining them, and **the gate
evaluates it**. There is nothing to re-check: the rail never authored the number, exactly as it
never authored a roll-up.

**Arithmetic is BigInt scaled to the kind's precision — no new dependency.** `package.json` has
no decimal library and the only decimal code in the tree is ticket 10's `format.ts`, which
formats and refuses floats but does no arithmetic. §6 already fixes a per-kind precision
(*"documents round the quantity before extension at a per-kind fixed precision; the register
keeps full precision"*), so the scale factor has a home it needed anyway. `CLAUDE.md`'s float ban
lands at one site instead of four.

**Explicitly out of scope for the gate:** whether the expression is the *right* one. Choosing the
formula is a rule-set question (§1's methods, CI-hashed against a content hash), not a gate
question. The gate checks only that the number is what the stated expression yields.

**Put and rejected:** trust the rail's number, treat variables as advisory, let §8 Part B's blind
re-derivation be the check on quantities. Part B *is* the law's named instrument for numbers, but
it is a **sample** — `N = quantity-bearing cells × 2` — and this check is per-line and free once
written. A sample is the wrong instrument for a defect you can make unrepresentable.

**Cost accepted:** a closed expression grammar and a small evaluator in the spine.

### 4. The scope register is a query; nothing writes `NOT_ESTABLISHED`

A machine `INSERT` into a `scope_rows` table is *a filter with no actor* — the shape ticket 01
rejected the per-project pin for, one level down. Whoever wrote the row is the actor, and nobody
wrote it.

Denominator: element classes ingestion sighted × the kinds they bear. Numerator: cells with
published lines. Cause: a `CASE` over joins in which **`NOT_ESTABLISHED` is the fall-through
arm**. It is never stored, so it cannot be forged, and §8's *"name the evidence or lose the
cause"* degradation becomes automatic — an act that loses its evidence stops matching its arm and
the cell falls through to the residue, which §8 says never blocks.

The clincher is §2's *"a contradicted act suspends pending re-affirmation."* Under a query that is
derivable with no state written: a QS declares `pile_cap × rebar` out of project scope, a later
ingestion publishes a pile-cap rebar line, the cell is covered while an act says it is absent —
`suspended` is another `CASE` arm. Under a table it is a status column someone must remember to
update on every re-ingest, and forgetting it is silent. *"Rows are recomputed per ingestion"* is
free for a query and is a standing job for a table.

**Three originator classes, three mechanisms, none reachable by a rail:**

| originator | mechanism |
|---|---|
| human-only (`NOT_IN_PROJECT_SCOPE`, `NOT_IN_THIS_BILL`) | the act seam — `withAct` (`src/core/acts.ts:38`) refuses a non-member, non-human actor. It is the **only** construct in the repo that refuses a non-human, so this is not one option among several |
| machine default (`NOT_ESTABLISHED`) | the query's fall-through — no writer exists |
| ingestion-owned (`INGESTION_TRUNCATED` vs `ENTITY_TYPE_UNHANDLED`) | read off the artifact's fidelity counters, which `completeIngest` (`src/core/register.ts:369`) writes verbatim and never re-derives — so a rail cannot dress *code nobody wrote* as *a cap you raise*, §2's opposite remedies |

**A rail contributes candidate absences by not offering.** Its non-offer carries a reason **in the
rail's own vocabulary, never a `refusalCause`** — that enum is the taxonomy with originator
legality attached, and letting a rail write into it *is* the bypass. The rail's reason rides the
queue item (§4's *declared exclusion + queue item*) as evidence a QS reads before filing an act;
it never sets the cause. A rail's deferral type therefore has **no cause field**.

**Cost accepted:** `actTypes` has four values and none files a scope cause — `DEFERRAL_FILED` is
*known scope, not measured*, a different fact from *not in this project*. A new value is a schema
change riding a migration (ADR-0002).

### 5. The one-way valve is the output type's shape

§2: *"A presence recogniser runs strictly one-way: it can say seen, never absent."* The valve is
not a guard anywhere — **there is no `absent()` constructor to call**. A recogniser returns a list
of sightings; finding nothing returns an empty list, which says nothing rather than denying
something. It cannot be forgotten because there is no code path to forget.

This exists in embryonic form already: `registerSightings` (`src/core/register.ts:644`) takes
sightings, and an empty array registers nothing and denies nothing. Ruling 4 closed the only other
channel, so **no component in the system has any way to state absence**. The valve is a property
of the data, not a rail-side check.

**One distinction the valve must keep representable**, or §2's opposite remedies collapse: *a
channel ran and yielded zero* is not *no channel ran*. The first is `NOT_ESTABLISHED` — somebody
looked and did not see, still not a claim of absence. The second is `ENTITY_TYPE_UNHANDLED` — code
nobody wrote. `completeIngest` writing counters verbatim and CHECK-refusing a counterless success
is what keeps them apart, and it is already built.

**The seam with ticket 23**, so neither ticket rules the other's question: **13 rules the
invariant** — no component anywhere may assert absence, the type has no constructor for it, and
that binds every lane including ones this map has not charted. **23 rules the mechanism** —
whether a stage with a missing input channel *refuses by name* or is *unavailable to call*. Both
satisfy this invariant (a named refusal is a statement about the stage, not about the scope), so
23 chooses on its own grounds and inherits rather than re-opens.

### 6. Four code-owned artifacts carry the kind axis; the register row stores none

`identity.md` §2 bars a mutable attribute from the key, and the key ends at `elementType`
(`src/core/register.ts:747`, `src/core/enums.ts:23`). Yet `(class × kind)` is §2's scope-row key
*and* §8's dip-sample stratum, so one answer serves both.

1. **`quantityKinds`** — a closed code-owned enum, `kind = (chapter × dimension), named for the
   trade` (§4). Dimension-named kinds illegal to emit; CI asserts totality both ways. Exists
   nowhere yet.
2. **`kind → authoritative discipline`** — total (`identity.md` §2: exactly one).
3. **`kind → algebra`** — total, into member / face / network / topology.
4. **`bears`**, a relation on `(element class × kind)`.

**Maps 2 and 3 are independent.** Collapsing them yields discipline → algebra, which is
per-discipline selection — §8's banned per-drawing selection spelled differently. The ticket's own
example is the proof: one architectural sheet, brick volume on **member** and finish area on
**face**.

`bears` is how the kind axis exists without touching identity: the class is in the key, the kind
is not, and the kinds a class bears are **looked up, never stored on the row**.

**Ticket 01's objection, put against this answer and answered.** `bears` is not a filter on the
catalogue, because §2 says the two sources **divide the work** — the catalogue catches the
*missing sheet*, the `(class × kind)` rows catch the *missing rule*. The whole catalogue remains
every project's denominator exactly as 01 ruled; `bears` **adds** the finer instrument beside it,
and a kind no sighted class bears is still absent against the catalogue. Unlike a per-project pin,
`bears` is identical for every project and changes only by migration behind a CI assert, so there
is no per-project actor to be missing.

**Revived in passing:** `DISCIPLINE_NOT_AUTHORITATIVE` (`src/core/enums.ts:66`) is emitted nowhere
because *the door never sees a kind*. With maps 2 and 4 it becomes computable at the door with no
kind on the row — class → kinds borne → their authoritative disciplines; a sighting from a drawing
outside that set refuses. An architectural sheet sighting a `column` is the case. The enum becomes
live; **when the door starts emitting it belongs to the slice that needs it**, not to this ticket,
which is not a door change.

### 7. The discriminator is what the defect impugns

§4 and §6 appear to point opposite ways only if §4's *"mandatory publishable attribute"* is read to
cover domain attributes, which §3's table does not: §3 lists **metadata about the reading**
(provenance, calibration, the view, rule id), §6 governs **domain attributes** (the height, the
grade, the section). Different categories. The discriminator is stated once, in the gate:

| the defect impugns | outcome | clause |
|---|---|---|
| rate selection — an item-selecting attribute missing | publish the quantity **unpriced**, empty rate cell the arithmetic shows | §6 |
| the number — a quantity-determining attribute missing | keep the **row with no quantity** | §6 (*no line is the most expensive defect*) |
| the reading's admissibility — a §3 attribute missing | **hard block** | §4 |
| the scope's existence — over-measurement | **hard block**, object severed from bill reach | §4 |

**A hard block is not silence.** §4's *"nothing publishes"* would be the condemned state if a
blocked line simply vanished. Under ruling 4 it cannot: the query derives absence from published
lines, so a hard-blocked line leaves a cell with no line, and the cell reports as an absence with
a cause. **The block discloses itself** — which is what makes hard-blocking safe enough to use as
freely as §4 asks.

**The severance objection, answered on §4's own reasoning.** Severance makes a cell read as an
absence, and an absence is a declared exclusion — the shape §4 says over-measurement must never
take. It dissolves because the ban is on telling a reader to **subtract**, and severance leaves
nothing to subtract. Where severance removes something real, it converts an over-measurement into
a *disclosed* under-measurement, which is the governing sentence exactly.

**Check #9 is scope attribution, not magnitude.** The gate cannot know a number is too big — that
is §5's band against a manual takeoff and §8's dip sample, neither of which the gate has. §4's
actual words are *"where the system cannot establish that an element belongs to the class and
drawing it is measuring under"*. So the check is: can the offer establish its object belongs to
the class and drawing it measures under? No → refuse to emit.

### 8. The guardrail is made falsifiable — as a floor, not a proof

*"If the face rail needs the gate changed, the lift failed"* is a retrospective judgement and no
build fails on it. The gate therefore **ships with a synthetic face-shaped rail in its own suite**,
asserting six member-shaped assumptions the gate may not make. Each is derived from the law today
— a reading of §8 and §2–§3, not a guess at the real face rail's implementation:

1. **Offer ↔ register object is not 1:1** — a face is *a face of a space* (§8), so a surface group
   spans objects, or one object bears many faces.
2. **The offer's subject need not be a single object** — the provenance check accepts whatever the
   register holds as a subject.
3. **The expression is not a product** — member is section × run; face is
   `net = gross − Σ(deducted openings)`, an n-ary sum with a variable-length term.
4. **Variables carry variable-length lists** — §2 requires the deducted sum, the **ignored** sum,
   the counts and the threshold; a member offer with no deductions must not be the shape the
   variables block was built for.
5. **Object → kind is not 1:1** — a wall bears brick volume and finish area off the same sheet.
6. **A selected rail may lawfully offer nothing** — *"a face with no schedule is not measured at
   all"* (§2), *"a surface that is not a closed outline defers with a reason — never
   bounding-boxed"* (§3). Zero offers and N reasons is not failure.

**Stated in the ruling rather than discovered later: this is a floor, not a proof.** A synthetic
face rail is one reading of what the face rail will need; if the reading is wrong the suite is
green and the real face rail still forces a change. Its whole value is converting *no failing
state* into *some failing states*. The real acceptance test still runs when the face rail lands.

**Put and rejected:** build the gate member-shaped and lift it when the face rail arrives — the
*"refactor that happens by accident"* the objective names, with no failing state at any point.
**Also put:** say plainly the lift is unenforced until the face rail lands and ship nothing
face-shaped. Cheaper and it does not pretend, but a floor beats a promise.

### Consequences filed

- **Domain law amended**, this ticket being MAP's named vehicle: `measurement-rules.md` §8
  (offers, sole writer, the four artifacts), `quantity-contract.md` §2 (the scope register is a
  query, `NOT_ESTABLISHED` has no writer, a rail contributes by not offering) and §4
  (over-measurement is a scope-attribution refusal; a hard block discloses itself).
- **Fog graduated.** The raster arc is answered outright — *a sighting with no offer*: the
  register row exists and carries the evidence, no line is written, the cell falls through to
  `NOT_ESTABLISHED`, the rail's reason rides the queue item. It leaves the fog as a closed
  question, not a ticket. The architectural element vocabulary graduates to an inbox ticket.
- **Corpus cases are named, not filed.** 09's index directory is not built — `undecided` appears
  nowhere in the tree — so there is nothing to append to and no entry to expire. The six
  assertions above are the cases 13 owes when the index lands.
- **Migrations owed by whoever builds this**, both ADR-0002 schema changes: a new `actTypes` value
  for filing a scope cause, and the `quantityKinds` enum.
- **Unblocks** 18 (signature and dip sample) and 21 (the run graph). 23's decision 2 inherits
  ruling 5's invariant and rules only the lane mechanism.
