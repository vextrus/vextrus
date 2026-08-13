# The run graph — network thin, topology as a refusal

wayfinder:grilling
Status: open
Blocked by: 04-the-drawing-set-revision.md, 13-the-rail-gate.md
Claimed by:

## Objective

The depth ladder puts **network** in thin but honest (runs by diameter, one kind) and
**topology** in as **the refusal, not the measurement** — a tee is identified in the run graph
and declared unmeasured with a named cause. This is the cheapest entry in the ladder and the one
that most directly demonstrates the governing sentence, so it must be done exactly right.

## What is already ruled and not reopened

- **MEP publishes runs only** until ingestion fidelity is proven (genesis §5,
  `measurement-rules.md` §8). Fitting *counts* are out of scope.
- **MEP fittings: derive, never count** — *"a pipe tee is a junction in the run graph, not a
  symbol anyone drew"* (§8). So topology is not a symbol-recognition problem, and any proposal
  that makes it one has misread the law.

## The decision

1. **What a run *is*, as a register object.** `identity.md` §2's key is
   `(project, discipline, level, element type, mark, ordinal)` — and a pipe run may carry no
   mark at all. Rule what occupies the mark slot without putting geometry in an identity key.
   This is the hardest question in the ticket.
2. **The graph.** Runs by diameter, junctions derived from connectivity. Rule the connectivity
   tolerance as a **content-scaled share**, never an absolute (`cad-ingestion.md` §9's law).
3. **The declared refusal, precisely.** A junction is *identified* and declared unmeasured with a
   cause from the shared taxonomy. Rule which cause — `NOT_ESTABLISHED` is the machine's default
   but a fitting we can see and deliberately do not measure may deserve its own, and a new enum
   value is a migration with a reason (`enums.ts`).
4. **Authority under partial re-issue.** Ticket 04 rules set-to-set deltas; the MEP-authority fog
   sits here. When only the plumbing sheets re-issue, what re-presents?
5. **Discipline exclusivity.** §2: each quantity kind has exactly **one** authoritative
   discipline. Plumbing and electrical are both in `disciplines` already. Rule the kind→discipline
   assignment for runs before two sheets both claim a conduit.

## Guardrails

- **Identity is a double-count guard, not a recognition engine.** A second sighting of the same
  physical scope is refused at the door and kept as unpriceable evidence in a **separate table
  with no join from any bill** — a status flag was disqualified because one forgotten `WHERE` is
  over-measurement (§2).
- A matcher was **rejected** in the legacy because a wrong merge *silently deletes* quantity.
  Do not reintroduce one here under the name "connectivity".
