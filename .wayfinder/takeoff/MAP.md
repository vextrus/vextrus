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

## Decisions so far

*(appended one line per closed ticket)*

- **Destination, ruled in charting (2026-08-13).** Takeoff terminates in a signed **unpriced**
  Quantity Bill + Certificate of Measured Coverage. The book's two jobs split: the *enumeration*
  (work items, kind, description, unit — the coverage denominator) is **spine-owned**; the
  *pricing* (zone rates, editions, rate analysis) stays in `book/` and out of scope. Rejected:
  register-terminal (leaves differentiator #2 unproven) and pulling `book/` in (conflates two
  modules).
- **Breadth, ruled in charting.** All four algebras land with the depth ladder above. Rejected
  member-deep-only: the spine owns the gate's shape, so a gate built against one rail encodes
  that rail's assumptions and every later rail retrofits — legacy fault F1/F8.
- **Formats, ruled in charting.** DWG, vector PDF **and raster PDF** are all first-class; the
  **EntityGraph is the one interface** and no downstream stage learns a second source format
  exists. Raster was initially deferred and the CEO reversed it: BD clients send scans often, and
  a module that refuses them gets returned.
- **AI's constitution, ruled in charting.** Adversarial-first: AI's flagship job is finding
  *absence and contradiction*, output being a refusal reason or a question — structurally
  incapable of inventing a quantity. Recognition/automation is admitted only as verified
  proposals. Rejected automation-first: it is the axis every competitor races on, where accuracy
  claims are all self-reported and unprovable, and it needs a guardrail at every site.
- **Frontend posture, ruled in charting.** Disposition-first as primary (the domain law is full
  of propose/dispose pairs already awaiting a surface, and `quantity-contract.md` §7 warns that
  a canvas structurally cannot show the row that is not there) — with **canvas-first as a
  first-class secondary**, built to a standard that stands next to anyone's. Legacy's
  disposition surface *felt mechanical*; the canvas is what prevents that, and it is a stated
  requirement, not a nice-to-have.
- **Scale/architecture, ruled in charting.** The JSON artifact stays the immutable, hashable
  **evidence of record**; a **derived, rebuildable Postgres entity index** serves queries and
  the viewer. The CLI stays pure — ADR-0001 untouched.
- **Deployment, ruled in charting.** A deployed environment sufficient for bar (c): real URL,
  real auth, real tenancy, invite-only. No billing, no signup funnel, no SLA — those are
  surfaces for customers who do not exist yet (legacy fault F8 in miniature).

- **[The work-item catalogue](tickets/01-the-work-item-catalogue.md) (2026-08-13).** The
  enumeration is `work_item_catalogue` — **platform-owned, code-derived, at quantity-kind
  grain, primary-keyed on the kind value** (the codebase's first non-tenant table). The **whole
  catalogue is every project's denominator**, narrowed only by an attributed act (§6 bans a
  coverage percentage, so over-breadth costs reading length while under-breadth hides the
  money). `RATE_MODIFIER` is a **pricing role in `book/`**, never a kind — it names no trade,
  and a modifier inherits rather than originates. `book/` joins on `kind` with unit as the
  dimension veto: no re-key. Safe only because **scope rows key `(class × kind)`** — at class
  grain a beam's unmeasured formwork hides behind its concrete line. Amends
  `measurement-rules.md` §4 and `quantity-contract.md` §2/§6/§7. Rejected: SoR-item grain
  (needs editions to be coherent — it *is* `book/`) and per-tenant copy-down (§8's precondition
  is human authorship, which is absent, and a tenant-scoped key breaks the national book's
  join).

## Not yet specified

<!-- in-scope fog: real, but not yet phraseable as a sharp question -->

- **The architectural rail's element vocabulary.** `enums.ts` carries nine *structural* element
  types. Brick walls measure on the member algebra and finishes on the face algebra off the same
  sheet — but which element classes the architectural set registers, and whether a wall is one
  object bearing both kinds or two, is not yet a sharp question. Graduates once ticket 13 rules
  what a rail owes the spine.
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
- **Multi-user concurrency on one campaign.** Two QSs disposing the same queue. Acts are
  append-only so the substrate is sound, but the contention model is unexplored.
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
