# Map — The takeoff module

## Destination

**A real drawing set measures into a signed, unpriced Quantity Bill bound to a Certificate of
Measured Coverage — and survives a set revision as a delta.** A QS uploads a DWG/PDF set
(structural, architectural, MEP), disposes what the machine could not establish, signs a
boundary, and receives a bill that states what was measured, what was not, and why — every
figure tracing to a register row. Re-issue the set and the register reports a delta, not a
do-over.

Done when all three bars hold:

1. **The gate** — a committed synthetic *torture corpus* passes inside `pnpm verify`, every
   fixture asserting either a correct measurement or a **named refusal**. Never a wrong number,
   never silence. `pnpm verify` stays under 90s.
2. **The proof** — a practising Bangladeshi QS hand-takes-off one real building; we compare per
   class per `quantity-contract.md` §5 (±3% under, +0% over, no netting inside a pass, ground
   truth is row sums).
3. **The deployment** — that QS used it alone, from their own office, on a real URL.

We do not promise "handles every drawing" — that is unfalsifiable. We promise **never silently
fails on any drawing**, which is testable and is the governing sentence turned into a suite.

## Notes

- **The domain law binds and tickets cite clauses, not vibes**: `quantity-contract.md`
  (basis × coverage, refusal shapes, tolerance, gates, dip sample), `identity.md` (the key,
  ordinal freeze, pairing, act log), `measurement-rules.md` (rules as data, scale, kinds,
  algebras), `formulas.md` (geometry, BBS, unit canon), `cad-ingestion.md` (extractor invariant,
  view law, grid, convention profile), `bd-authority.md` (statute, SoR, e-GP).
- **Five domain-law amendments are forced by this map's destination** and each has its own
  ticket — none may be made in passing: the source key (02), the `INTERPRETED` basis (03), the
  drawing-set revision (04), the work-item catalogue's home (01), the rail gate (13).
- **Builds on the closed [takeoff-core](../takeoff-core/MAP.md) map** — DXF → EntityGraph →
  views → grid → placement → register identity → revision delta all landed and stay landed.
  Where this map extends that work it says so by name.
- **Competitor and client data never enter this repo** (`CLAUDE.md`). The Edison corpus is a
  local-machine-only hardening lane (08), never a fixture, never committed, never in a cloud
  container. What crosses back is the *defect class*, reproduced synthetically.
- **AI proposes; it never concludes.** No AI in the fan-out (`formulas.md`). Every AI proposal
  cites source keys that code verifies resolve *before* a human sees it; abstention is never the
  model's decision.
- Schema changes ride `pnpm db:generate` → migration → `pnpm db:migrate`; every tenant table
  gets the `db/rls.ts` block (ADR-0004). `pnpm db:replay` before committing a migration.
- **Every rail ticket owes the corpus.** Ticket 09 frames it; no rail is done until it has added
  its cases to the index and expired every `undecided` entry its ruling settles. The meta-test
  goes red on an `undecided` entry whose blocking ticket has closed — that is the enforcement.
- One ticket per session; `/clear` at the boundary (`.wayfinder/TRACKER.md`). The dispatcher
  claims, never the session (ADR-0010).

### The non-functional bar (tickets cite these figures)

| dimension | target |
|---|---|
| drawing set | 50 sheets, 500K original entities |
| ingest | under 10 min for the full set, per-sheet parallel, progress visible |
| viewer | 60 fps pan/zoom on the largest single sheet |
| disposition queue | under 200 ms per interaction |
| `pnpm verify` | under 90s (genesis D7's product-scale bar) |

### Sequencing (ruled, not open)

Vertical slices **by quantity kind**, not by stage. First slice is **RCC column concrete** —
columns are already placed and identified by `takeoff-core`, making it the shortest path to a
signed certificate. Then the **rail gate lifts into the spine** (13) and is *proven* by the face
rail's slice; network and topology ride it after. A rail may never author its own definition of
done (`measurement-rules.md` §8).

### The algebra depth ladder (ruled)

- **member** — deep. Concrete volume, formwork contact area, full BBS: `formulas.md` §2–§5.
- **face** — real. One closed-outline surface group with scheduled-opening deduction, proving
  `net = gross − Σ(deducted openings)` and the defer-never-bounding-box law.
- **network** — thin but honest. Runs by diameter, one kind.
- **topology** — **the refusal, not the measurement.** A tee is identified in the run graph and
  declared unmeasured with a named cause.

## Decisions

Every closed ticket's ruling is one file in [`decisions/`](decisions/), named for its ticket;
charting-time rulings are `decisions/00-charting.md`. The decision itself lives in exactly one
place — the ticket's `## Resolution` — and `decisions/` is this map's index, sharded so that two
sessions closing two tickets write two different files.

It used to be a bullet list here, and it was the single point of failure in the first parallel
wave: **six of seven session-side merges conflicted, every one of them in this section and
nothing else** (`decisions/README.md`, `docs/specs/cloud-campaign.md` §1). There is deliberately
no committed index file — that would be the same list one level down.

## Not yet specified

<!-- in-scope fog: real, but not yet phraseable as a sharp question -->

- **MEP's discipline authority.** `identity.md` §2 gives each kind exactly one authoritative
  discipline, and plumbing/electrical are already in `disciplines`. How a run graph's authority
  interacts with a set revision that re-issues only the plumbing sheets is unclear enough that
  the question cannot yet be stated. Graduates after 04 and 21.
- **Bangla in the product surface.** Genesis §5 puts Bangla+English in scope; `bd-authority.md`
  §9 has bn names on the bill taxonomy and `formulas.md` §6 says reason codes translate. Whether
  the *disposition queue* is bilingual at this destination or later is downstream of the design
  system (10).
- **Learned convention profiles.** `cad-ingestion.md` §10's resolver is pure with an ablation
  law. Whether a *tenant* accumulates profiles across projects — and what that means for the
  ablation law — is a real question we cannot phrase before 19 rules how schedules are read.
- **The notation parsers' shape.** `cad-ingestion.md` §6 rules only where they *live* — beside
  their consumer in the app, never in `cad/` — not what shape they take. Corpus cases 4 and 5
  (`%%C`/Ø-lookalikes/`@125m`/`@ 61/2"`, feet-inch on a metric sheet, `1ST TO TOP FLOOR`,
  `7th-Roof`) are unblocked but have no parser to assert against. Graduates after 19 rules how
  schedules are read, since the registry is the parsers' consumer.
- **Multi-user concurrency on one campaign.** Two QSs disposing the same queue. Acts are
  append-only so the substrate is sound, but the contention model is unexplored.
- **Bangladeshi drawings on the PDF lane.** Ticket 06 measured US/EU/AU sheets only; no BD
  drawing has been through this lane. Whether BD practice plots SHX (text as outlines) or
  TrueType, and whether Bangla labels survive at all, is a real gap — but it is a *corpus*
  problem before it is a question, and 08's private lane may be where it graduates. **07 sharpens
  the stakes without closing it**: Bangla OCR is refused on measured grounds there, so if BD
  practice also outlines its text, the PDF lane loses the same channel for a different reason.
- **Text/graphics separation.** 07 named it the biggest hole in the raster pipeline (dimension
  strings, hatching and title-block text all reach the line detector as spurious segments) and
  found no permissive implementation — a build, not a dependency. It is not yet a *decision*, so
  it is not a ticket; it graduates if the build turns out to need a ruling on what it may discard.
- **The estimate seam.** What exactly `estimate/` will consume from a signed bill. Out of scope
  to *build*, but the seam's shape should be visible before this map closes so we do not paint
  it into a corner.

## Out of scope

- **Pricing, rate books, rate analysis, estimates, bids** — `book/`, `estimate/`, `bid/`. The
  *enumeration* half of the book is spine-owned and in scope; every taka is not.
- **General availability** — billing, public signup, SLA, on-call, multi-region. Pre-first-customer
  (`CLAUDE.md`); these are easy to add later and the register is not.
- **MEP fitting counts** — genesis §5 and `measurement-rules.md` §8 already rule MEP publishes
  *runs only* until ingestion fidelity is proven. Topology is a declared refusal here, by design.
- **IFC/BIM, 3D, mobile apps, public REST API** — genesis §5's fence stands unamended.
- **Competitor-derived fixtures** — permanently, by `CLAUDE.md` guardrail.
