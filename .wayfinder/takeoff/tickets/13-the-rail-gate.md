# The rail gate — what a rail owes the spine

wayfinder:grilling
Status: open
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
