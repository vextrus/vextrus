# Genesis — the Founding Spec

**Status:** executed 2026-08-12 — CEO sign-off received; foundation landed per §7.
Measured at founding: `pnpm verify` green in **4.0s** (tsc 1.1 · eslint 0.9 · vitest 1.3 ·
ruff 0.1 · pytest 0.6) against the <60s exit bar; tenant seam proven live (`pnpm test:db`:
scoped reads, RLS refusal of a cross-tenant write); Postgres on **5544** (5433 was inside a
Windows reserved range — recorded in TRAPS.md).
**Author:** founding session, 2026-08-12
**Scope:** everything this repository is, until superseded by a dated ADR.

This spec was produced by a one-shot founding session that autopsied the legacy repo
(`vextrus-erp`, one year, 1.33M LOC, pre-first-customer), researched the 2026 market and
agentic-engineering state of the art, and decided the foundation. The legacy repo is executable
domain documentation — a reference and a catalogue of mistakes, not a codebase to port.

---

## 1. Product thesis

**Vextrus reads construction drawings and produces an estimate a professional can sign — then a
bid that can win.** Takeoff, cost database, estimation, and bidding, in one traced chain:
drawing → quantity → rate → estimate → bid. Bangladesh first (B2C and B2B), built to travel
across the BOQ Belt.

Three differentiators, each verified against the 2026 market as **unoccupied ground** — with
differentiator 1 corrected on 2026-08-13, see the note below:

1. **Revision-stable quantity identity.** ~~No shipping product survives a drawing revision~~ —
   **corrected: one partially does (see the correction note).** Where the field re-matches
   measurements to revised drawings *by geometry*, our Quantity Register gives every element a
   deterministic identity **derived from the domain and carrying no coordinates** — `(project,
   discipline, level, element type, mark, ordinal)`, ordinal frozen at first registration — so a
   new revision produces a *delta*, not a do-over, **even when the drawing has been re-origined,
   re-authored, or re-issued as a scan.** This is the deepest moat available and it must be right
   from the first migration.
2. **Trust as the product.** The market's core objection to AI takeoff is "a locked number with
   no visible assumptions" — every vendor's accuracy claim is self-reported and failure is
   systematic, not random. We ship the opposite: per-quantity provenance to drawing geometry,
   an honest basis (measured / transcribed / derived / entered / defaulted) and coverage
   declaration on every line, a Certificate of Measured Coverage on every issued bill, and
   refusal instead of silence. The governing sentence, carried from the legacy effort:
   **a partial faulty estimate is more harmful than no estimate.**
3. **SoR-native cost intelligence.** Bangladesh runs on the PWD/LGED Schedules of Rates —
   published only as scan-quality PDFs, consumed via printed books and Excel. A structured,
   effective-dated, zone-aware rate database with real rate analysis underneath is a product
   wedge by itself. It generalizes: PWD chapters, NRM2, CESMM, MasterFormat are all just output
   groupings over the same register. For B2B bidding, e-GP's PPR-2025 rules auto-eliminate bids
   >10% above the SoR-derived Official Cost Estimate — reconstructing the OCE and pricing into
   the winning band is a directly monetizable feature with 143,000+ registered tenderers as the
   countable market.

### Correction — 2026-08-13: differentiator 1 is *partially* occupied

The founding session's claim that **"no shipping product survives a drawing revision"** was
checked against vendor primary sources during the takeoff wayfinder session and is **false as
written** (`docs/research/takeoff-competitors-2026.md`).

**RIB CostX ships "Auto-Revisioning":** it loads existing dimensions onto a revised drawing,
re-matches them to the new geometry via "Best Match All", and puts a warning flag on unreviewed
Dimension Groups; CostX 6.5 added a Measure button inside Comparison Mode explicitly for "adds &
omits". That is a persisting measurement object, a delta output, and a non-silent unreviewed
state — three things this section claimed as unoccupied.

**What survives, and it is the part that matters.** CostX re-matches by *geometry*, and RIB's own
documentation concedes the limit: *"if the drawing has been offset by the designer… no lines will
match"*, and object-ID comparison depends on IDs the CAD file supplies. Our key is **derived from
the domain, not from the drawing** — no coordinates, no labels, no correctable attribute
(`identity.md` §2) — so it survives re-origining, re-authoring, and a raster re-issue, none of
which geometry matching survives. No vendor reviewed claims that.

**Consequences for how we speak and what we build.** "We re-link measurements across revisions"
is a claim a CostX user beats in one sentence and must not be made. The defensible claim is
*domain-derived identity*, plus priced delta propagation downstream once `estimate/` and `bid/`
exist — which no vendor claims either. The other vendors are further back: Bluebeam's Batch Slip
Sheet moves markups to the same **page coordinates** (silently wrong if a wall moved), Autodesk
ships a gray→yellow indicator with customers publicly asking that updating a version stop
deleting prior takeoff, and Countfire persists the *symbol definition*, not the instance.

**Differentiators 2 and 3 were also re-checked.** Differentiator 2 holds and is the strongest of
the three: per-quantity drawing traceability is table stakes, but **basis taxonomy, coverage
declaration, and refusal-with-reason are unoccupied across every vendor reviewed**. Differentiator
3 is *occupied as architecture, unoccupied as coverage* — ACCA PriMus has distributed all 20
Italian regions' official price books, year-versioned and structured, for years; the wedge is that
the BD PWD SoR and CPWD DSR exist only as PDFs, nobody structures them, and nobody handles the
correction-slip problem.

**Who buys.** B2B: contractors and developers preparing tenders (Excel is the incumbent; RIB
Candy is the only local muscle memory and has no AI); QS practices; Tier-2/3 firms with no
software at all. B2C: small builders and homeowners who need a priced, honest estimate from a
drawing. Global AI-takeoff pricing sits at $175–299/user/month; Bangladesh is a learning
market priced locally, on projects and value, never per seat.

**What this is not.** Not an ERP. The six-verb spine (plan/buy/build/bill/book) died with the
legacy repo. Future modules must be addable *around* the register without rework — that means a
small, clean core, not extension points. Nothing speculative is built.

---

## 2. What the legacy autopsy decided

Root-cause faults (measured, file-level evidence in the founding session record) and the
counter-decision each one forces:

| # | Legacy fault | Counter-decision |
|---|---|---|
| F1 | One Prisma client over 343 models was the real (absent) module boundary; invariants lived in prose and lexical test fences | Small schema, register-centered; boundaries as ESLint rules the compiler path enforces; invariants in types and constraints wherever expressible |
| F2 | The unit of change was never a module: one new entity = 22 files across 4 packages and 4 generated artifacts; 12–49-file ticket floor caused the A1–A5 grind (12 "too big" halts, $613/5 arcs) | Single app, zero codegen, zero workspace packages: a one-concept change is a one-folder diff plus one schema file |
| F3 | Three schema writers (migrations, db:push, hand-edited generated SDL) and a gitignored codegen layer that went stale on every merge | One schema source (Drizzle TS), one migration lane, nothing generated is gitignored, nothing generated is hand-edited — because nothing is generated |
| F4 | Turbo/incremental caches lied (FULL TURBO on live type errors, poisoned dist replays, tsbuildinfo corruption) | No build orchestrator, no incremental builds, no dist: `tsc --noEmit` over one graph; staleness is unrepresentable |
| F5 | CQRS/NestJS ceremony: 6–8 files per verb, silent handler non-registration, 77-handler wiring arrays named after work batches | No CQRS buses, no DI framework: a module is functions behind one exported interface; tRPC procedures call them directly |
| F6 | Domain vocabulary re-declared in 19 places (Prisma enum + zod + GQL + i18n + …) | Every domain enum is one TS const in `src/core/`; DB CHECK constraints and UI labels derive from it |
| F7 | Python CAD service outside the verify contract, resident HTTP service with stale-lane traps, load-bearing constants invisible to review | CAD ingestion is a CLI pipeline (file in → JSON out), pure, fixture-tested, inside `pnpm verify`; no resident service |
| F8 | 22 modules / 635 routes / 1.33M LOC before one customer; the most expensive arc was spent deleting speculative surfaces | Scope fence (§5): four modules and a minimal spine; the named-customer test for anything new |
| F9 | Tenancy as runtime convention (CLS interceptor + undocumented Prisma internals + 46 loose RLS SQL files) policed by NEVER rules | A typed tenant seam: you cannot obtain a query handle without tenant context; RLS as backstop, generated in the same migration lane |

**What carries forward** (re-derived, never copied): the Quantity Register invariant and the
whole decision corpus of the legacy takeoff map — the quantity contract (basis × coverage,
over-measurement hard block, no grand total under incomplete coverage), the identity key and
pairing rules, SI-singular storage under the Weights & Measures Act 2018, `kind = chapter ×
dimension`, the book as coverage denominator, the act log and signature model, per-region
fail-closed scale, measurement rules as versioned cited data, the BBS/detailing math, the unit
canon, the rate-analysis composition, the CAD extraction laws, and the Bangladesh rules. These
are written into `docs/domain/` in Phase 5 as the new repo's domain law. The harness lessons
(150K sessions, thin harness, one verify command, wayfinder tickets) become the working method
from day one instead of being learned in month eleven.

---

## 3. Architectural decisions

Each decision below is recorded as an ADR in `docs/adr/`. Agent legibility is a first-class
criterion throughout: boring, mainstream, strongly typed, locally runnable, one obvious place
for everything, verification in seconds.

### D1 — TypeScript strict, single application; Python for CAD ingestion only (ADR-0001)

One Next.js (App Router) application: UI, tRPC API, and domain logic in one typed graph.
No workspace packages, no Turborepo, no NestJS, no DI container. Modules are folders under
`src/` with ESLint-enforced import boundaries; each exposes exactly one public `index.ts`.
A background worker (`src/server/worker.ts`, run with tsx) processes ingestion jobs from a
Postgres queue — no Redis, no message broker.

Python (3.13, uv-managed) exists for one job: `cad/` converts DWG/DXF into a versioned
EntityGraph JSON artifact, as a CLI subprocess — never a resident service. Zod validates the
artifact at the TS boundary. `ruff` + `pytest` run inside `pnpm verify`. LibreDWG (`dwg2dxf`,
subprocess-only) is the production DWG lane; ODA File Converter is dev-only and banned from
shipped artifacts; AGPL PDF libraries are banned outright (a license test enforces this).

*Why:* TS has the largest training corpus and the compiler is the guardrail; the 2026 field
converges on exactly this stack for agent-built products. Python keeps ezdxf — the only
credible DXF ecosystem — but caged as a pure pipeline inside the verification contract, which
deletes the entire stale-service trap class the legacy repo documented.

### D2 — Postgres 16 + Drizzle ORM; one schema source, one migration lane (ADR-0002)

Schema is TypeScript in `db/schema/*.ts` (one file per module, composed once). Migrations are
generated by drizzle-kit and applied by one command to every environment — dev included. There
is no `db:push` lane, no hand-applied SQL, no schema file a dev server rewrites. RLS policies
and audit triggers are emitted into the same migrations by a helper. Domain enums are TS consts
in `src/core/enums.ts`; the DB stores text with CHECK constraints derived from the same const.
Quantities are `numeric` columns handled through decimal.js at the seam — never floats. JSON
columns get typed wrappers that make the JS-null/SQL-NULL confusion unrepresentable.

*Why:* Drizzle is SQL-transparent and codegen-free — types flow from source, so the
merge-then-stale-types trap cannot exist. The legacy repo's worst environment faults (dev-DB
rot, drift invisible to privileged introspection, three writers) were all consequences of
having more than one schema lane.

### D3 — tRPC; no GraphQL, zero codegen anywhere (ADR-0003)

Module routers compose into one appRouter; Zod on every input; TanStack Query on the client
through tRPC's own integration. No generated directories exist in the repo. A public REST API
is added later only when a named customer needs one.

*Why:* the legacy GraphQL chain (SDL → codegen → 101K generated LOC → hand-written hooks
mirror) was measured as the single largest contributor to ticket size and stale-artifact traps.
Untyped or generated API boundaries are where agent errors survive to production; tRPC deletes
the layer instead of guarding it.

### D4 — Tenancy: typed seam + RLS backstop (ADR-0004)

Every tenant-owned table carries `tenant_id`. The only way to query is through
`db.forTenant(ctx)` — a function requiring a `TenantCtx` that only auth middleware can mint —
which opens a transaction and sets the tenant GUC; RLS policies (generated per table in
migrations, `NOBYPASSRLS` app role) backstop the seam. Raw SQL is available only *inside* the
seam. System-lane work (seeds, jobs) uses an explicit `runAsSystem` with its own audit trail.
Auth is better-auth (email/password + organizations) — extended, never hand-rolled. B2C users
are single-member tenants; one model, no special cases.

*Why:* tenant isolation is absolute (a founding guardrail), but the legacy enforced it with
runtime convention + prose + 46 loose SQL files. Here the type system makes the unscoped query
inexpressible and RLS catches what types cannot.

### D5 — The Quantity Register is the schema center (ADR-0005)

The spine (`src/core/`) owns: project record, drawings + revisions + ingest fidelity, the level
stack, scale families/calibrations, the register (objects, attributes, observations, quantity
lines, refused sightings, scope rows), the act log, and the closed quantity-kind enum. The four
modules enrich the spine; **no module may originate a quantity**. Element identity is
`(project, discipline, level, element type, mark, ordinal)` — ordinal frozen at first
registration; no coordinates, no labels, no mutable attribute in any identity key. The full
domain law lives in `docs/domain/` (see §4) and binds from the first migration: the legacy repo
retrofitted the register in month ten; here everything derives from it on day one.

### D6 — Locality is data, never code (ADR-0006)

Rate books (PWD/LGED/unified-future) are effective-dated datasets with per-book zone→district
mappings and verbatim published rates. Tax rules are effective-dated config supporting both
percentage and fixed-taka-per-unit modes. Measurement rule sets are versioned data with clause
citations (the seed deduction thresholds are labeled Indian — IS 1200 — because Bangladesh has
no SMM, and mislabeling them was a named legacy defect). Formats — lakh/crore grouping,
`DD MMM YYYY`, July–June fiscal year, Bangla strings — are document/locale concerns. The
register stores SI-singular full-precision values (Weights and Measures Act 2018 §68);
imperial is legal only as an input read off a sheet, and documents own all presentation.

### D7 — Verification: one command, seconds, no cache to lie (ADR-0007)

```
pnpm verify        # tsc --noEmit → eslint → vitest → cad (ruff + pytest); fail-fast
```

Exit code is the whole contract. Target: <60s on the skeleton, <90s at product scale — slower
is a defect to fix. Playwright e2e lives outside the verify lane, run on demand and in CI.
Boundary lint must **fail closed**: a fixture violation asserts the rule fires (the legacy
learned eslint-plugin-boundaries fails silently open when misconfigured). "Never weaken a
check" is enforced mechanically in review, not by prompt text.

### D8 — Thin harness, wayfinder workflow (ADR-0007)

`CLAUDE.md` ≤6,000 chars: invariant, guardrails, NEVERs (only typecheck-invisible +
damage-causing), the feedback loop, pointers. `docs/CONTEXT.md` and `docs/TRAPS.md` read on
demand, never auto-loaded. ADRs for decisions. `.wayfinder/` local-markdown tracker; one
ticket per session; never `/compact`; sessions end inside 150K. Zero custom agents, zero hooks
at founding — anything restored must earn its place with a measurement.

---

## 4. The domain core — data model sketch

Entity-level sketch; the first tickets refine columns. Everything tenant-scoped unless marked.

**Spine (`src/core/`)**
- `tenants`, `users`, `memberships` — better-auth managed + tenant seam.
- `projects` — auto-created valid; pins: rate book edition, measurement rule set version,
  multiplier scheme. Project facts (attributes: fy, cover, mortar…) each with basis
  (`MEASURED|TRANSCRIBED|DERIVED|DEFAULTED|ENTERED|IMPORTED`) and corroboration; competing
  observations suspend, never overwrite.
- `levels` — surrogate id; label, ordinal, height all non-identifying; ordinal is physical.
- `drawings` / `drawing_revisions` — a campaign pins a revision. `ingests` — EntityGraph
  artifact ref + per-entity-type fidelity counters (truncation is surfaced, never silent).
- `scale_families` / `calibrations` — per-region fail-closed; membership positive; a quantity
  without an affirmed calibration is unrepresentable (`calibration_id NOT NULL`).
- `register_objects` — identity key above; unique constraint enforces the double-count guard.
  `refused_sightings` — separate table, no join from any bill.
- `quantity_lines` — kind (closed enum, chapter × dimension, named for the trade), SI value
  full precision, formula + variables (auditable), basis roll-ups, coverage
  (`COMPLETE|PARTIAL_DECLARED`; `PARTIAL_UNDECLARED` is unrepresentable), provenance refs
  (drawing, view, rule id + version), work-item selection beside the machine's derivation.
- `scope_rows` — coverage causes (human-only vs machine-legal members) + ingestion-fidelity
  species; the certificate is a query over book × scope, never prose.
- `acts` — append-only human act log; act + state change in one transaction; attribution is
  derived from the walk, never stamped on rows.

**takeoff (`src/modules/takeoff/`)** — ingestion orchestration, view graph, grid backbone,
member-type registry (schedule reading), instance placement, BBS synthesis (detailing rules as
versioned cited data), quantity fan-out. Populates the spine; owns no pricing.

**book (`src/modules/book/`)** — rate books (edition + effective date + zones), items (kind or
authored exclusion, `NOT NULL`; `RATE_MODIFIER` class), resources, rate analysis
(material/labour/equipment norms; overhead and profit additive on the same subtotal, never
compounded; VAT document-level only), floor multiplier schemes keyed by ordinal, the SoR
digitisation pipeline (extract → QA gate → refuse-on-flag → load).

**estimate (`src/modules/estimate/`)** — prices register lines against the pinned book through
the unit canon (conversion is the last term of the formula; rates convert inversely, once);
estimate = boundary + pinned rule set + signature (RICS *Responsible use of artificial
intelligence in surveying practice*, 1st ed., published 17 Nov 2025, **in force 9 March 2026** —
verified 2026-08-13: a written reliability decision by a **named** surveyor, AI in Terms of
Engagement, risk registers, procurement due diligence. *"Dip samples on automated output"* was
**not verifiable** at rics.org and is our own instrument until the full standard is read);
Certificate of Measured Coverage bound into one
server-generated PDF with the bill; no grand total under incomplete coverage.

**bid (`src/modules/bid/`)** — consumes an *issued* estimate: markup/OH&P, OCE reconstruction
and the e-GP ±band check, comparative statements, proposal documents. Smallest module at
founding; a boundary, not a build commitment.

**`docs/domain/`** (written in Phase 5, seeded from the founding session's re-derivation):
`quantity-contract.md` · `identity.md` · `measurement-rules.md` · `bd-authority.md` ·
`formulas.md` (fan-out, BBS, unit canon, rate analysis) · `cad-ingestion.md`. These are the
re-documented domain truth; code implements them, tickets cite them.

---

## 5. Scope fence

**In:** the four modules; the spine (auth, tenancy, projects, drawings, register, acts);
Bangla+English; server PDF generation; the SoR digitisation pipeline; a Postgres job queue.

**Out (until a named customer forces it):** scheduling, procurement, site progress, billing/RA
bills, ledger, HR, real-estate/CRM, WhatsApp capture, notification hub, workflow engine,
AI-agent platform, plugin/extension systems, public API, mobile apps, IFC/BIM, MEP fitting
takeoff (runs only, until ingestion fidelity is proven), 3D anything.

**The rule for future modules:** they are addable because the core is small and the register is
stable — every stage inherits an object, enriches it, emits it. Preparing for them means
keeping this true, never building for them.

---

## 6. Environment and verification design

- **Layout:** single package.json; `src/app` (routes) · `src/core` · `src/modules/{takeoff,book,estimate,bid}` ·
  `src/server` (trpc root, worker) · `db/{schema,migrations}` · `cad/` (uv package) · `e2e/` ·
  `docs/` · `.wayfinder/` · `scripts/`.
- **Ports:** web 3210, Postgres 5544 (compose-managed, volume-backed) — deliberately off the
  legacy repo's 3000/4000/5432 so both stacks can run, and clear of Windows dynamic-reservation
  ranges.
- **DB lanes:** `pnpm db:migrate` is the only writer; drift detector ships day one.
- **Verify:** `scripts/verify.mjs` runs tsc → eslint → vitest → ruff → pytest, fail-fast,
  no caching anywhere; `pnpm verify` is the contract, measured at founding and recorded.
- **Boundaries:** ESLint import rules — modules import `core` and their own subtree only;
  cross-module access goes through a module's public `index.ts`; a fixture test proves the rule
  fails closed.
- **Testing:** Vitest at module seams; golden vectors for construction math; synthetic VREL
  drawing fixtures (including a revision pair for identity-stability tests) rebuilt fresh —
  competitor-derived data (Edison) never enters this repo. Playwright e2e outside verify.
- **Windows facts** carried into TRAPS.md: port reservations, `\r` in psql output, WSL-vs-Git
  bash, `0xC0000142` under resource pressure, one writable checkout per branch.

---

## 7. Execution checklist (Phase 5 — after sign-off)

Logical commits, in order; each verifies green before the next:

1. **Toolchain skeleton** — package.json (pinned pnpm/node), tsconfig (strict), Next.js app
   shell, eslint flat config + boundary rules + fail-closed fixture test, vitest config,
   `.gitignore`, `.nvmrc`, compose.yaml (postgres 5544), README (thin).
2. **Verify loop** — `scripts/verify.mjs`, `pnpm verify` green, timing recorded in this spec.
3. **cad/ skeleton** — uv package, ruff+pytest wired into verify, EntityGraph artifact schema
   (versioned) + Zod mirror + one round-trip fixture test.
4. **DB foundation** — drizzle config, `db/schema/core.ts` (tenants/users/memberships only at
   skeleton grade), migration 0001, tenant seam (`db.forTenant`) with RLS helper + seam test,
   drift detector script.
5. **Harness** — CLAUDE.md, `.claude/settings.json` (permissions deny-list per legacy
   measurement), docs/CONTEXT.md (commercial truth + BD rules + glossary), docs/TRAPS.md
   (seeded), `.wayfinder/TRACKER.md` + first effort map.
6. **Domain law** — `docs/domain/*.md` re-documented from the founding session's derivation;
   ADRs 0001–0007; this spec updated to Status: executed.
7. **First tickets** — `.wayfinder/foundation/` map + the first module tickets (takeoff spine:
   project record, drawings, register identity), so the next session starts on a frontier.

Push to `origin main` at each logical unit. No module feature code in this session.

## 8. Exit criteria

A brand-new session opened in this repo, told only "read CLAUDE.md and docs/specs/genesis.md,
then pick up the first ticket," can start building the takeoff/cost-database core at production
quality with no reference to the founding conversation — and `pnpm verify` runs green in under
a minute on the skeleton.
