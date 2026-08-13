# The rail gate — what a rail owes the spine

wayfinder:grilling
Status: open
Blocked by: 01-the-work-item-catalogue.md
Claimed by: dispatched 2026-08-13

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
