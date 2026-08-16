# Genesis II — the founding spec, second founding

**Status:** executed 2026-08-16 on WSL2 Ubuntu 24.04 · Node v24.19.0 · pnpm 9.15.1 · uv 0.12.5
/ CPython 3.13 · Postgres 16.14 native on 5544, `C.UTF-8`. `pnpm verify` was green in 3.9 s at
founding; **the current wall time is the one in §7**, re-measured whenever the lane changes.
Live seam test (`pnpm test:db`) green at founding: scoped read, RLS refusal, composite-FK
refusal, append-only ledger grant.
**Supersedes:** `docs/specs/genesis.md` on `main` (2026-08-12), whose §1 thesis and §2 autopsy
largely survive and are restated here; whose §6–§8 are stale.
**Reader:** someone who knows the trade and nothing about us. This is why the system is shaped
as it is.

---

## 1. Product thesis

**Vextrus reads construction drawings and produces an estimate a professional can sign — then a
bid that can win.** Takeoff, cost database, estimation and bidding in one traced chain:
drawing → quantity → rate → estimate → bid. Bangladesh first, B2B and B2C, built to travel.

**Who buys.** B2B: contractors and developers preparing tenders (Excel is the incumbent; RIB
Candy is the only local muscle memory and has no AI); QS practices; Tier-2/3 firms with no
software at all. B2C: small builders and homeowners who need a priced, honest estimate from a
drawing. Priced on projects and value, never per seat; the global AI-takeoff envelope is
$175–299/user/month and Bangladesh is a learning market priced locally.

**What this is not.** Not an ERP. Not a BIM tool (say *model-derived*, never BIM). No live
customer may be claimed; "Edison" is a competitor and internal benchmark only. Future modules
are addable *around* the register because the core is small — preparing for them means keeping
the core small, never building for them.

**The governing sentence:** *a partial faulty estimate is more harmful than no estimate.*
Measure less, completely, and say so; over-measurement is a hard block; every refusal carries a
named reason; AI proposes, code resolves, a human disposes.

## 2. The differentiators, stress-tested (August 2026)

Each was re-examined against vendor primary sources on 2026-08-16
(`docs/research/market-2026-08.md`). For each: the one sentence a competitor's sales engineer
says to kill it in front of a QS, whether we survive it, and the ruling.

### 2.1 Revision-stable quantity identity — **narrowed**

*The kill sentence (RIB CostX):* "We've re-linked measurements across revisions since 2019 —
load your dimensions onto the new drawing, Best Match All, review the flagged groups. You are
describing Auto-Revisioning."

*Do we survive it?* Not as "we re-link measurements across revisions" — that claim is dead and
must never be made. What survives is narrower and is the part that matters in Bangladesh
practice: our key is derived from the domain, `(project, discipline, level, element type, mark,
ordinal)`, no coordinates, ordinal frozen at first registration (`docs/domain/identity.md` §2),
so the delta survives a **re-origined**, **re-authored** or **scanned** re-issue — the three
cases CostX's own documentation concedes ("if the drawing has been offset by the designer… no
lines will match"; object IDs come from the CAD file), Countfire's own help concedes ("the size
& orientation of the PDF needs to be the same"), and Autodesk answers with "move or discard".
CostX 7.4 (3 Aug 2026) ships zero change here; Bluebeam Max's Smart Overlay is a visual diff with
no quantity involvement; nobody below sheet level uses a domain identity.

*Ruling: **narrowed**, to two claims:* (1) the revision delta survives re-origining,
re-authoring and a raster re-issue; (2) the delta propagates **priced** through estimate and
bid, which no vendor claims either. It is not "held", because the narrow claim survives on the
field's documented failure modes rather than on a competitor's tested attack: the day CostX
matches by mark and level instead of by line, (1) is table stakes and only (2) remains. Build
(1) first — it is the register's spine — and speak of it as "your revision three does not reset
the bill", never as re-linking.

### 2.2 Trust as the product — **holds**

*The kill sentence (Beam AI / Togal):* "Every quantity in our tool is one click from the drawing
region it came from, and our estimators QA every takeoff before you see it — what does a
'basis' label buy you that a click and a human check don't?"

*Do we survive it?* Yes, on three grounds a QS recognises. A **basis** is a claim about
recourse — a measured number is rechecked by re-measuring, a transcribed one by re-reading, an
interpreted one has no second reading — and independent benchmarks put transcription at 0.95 and
symbol geometry at 0.40–0.55 (AECV-Bench, Jan 2026), a 40-point gap every vendor merges into one
number. A **coverage declaration** states what was *not* measured with a named cause; a
click-through can only show presence, and Bluebeam's own guidance assigns "what didn't [get
counted]" to the human eye. **Refusal with a named reason** is, since 9 March 2026, a mandatory
duty under the RICS professional standard (named responsible surveyor, randomised dip samples in
§4.2, written refusal with reasoning), which no takeoff product helps a firm discharge — while
Trimble and PlanSwift auto-set scale with no failure state and Beam explicitly declines to
refuse. The nearest occupations are a two-way measured/transcribed display (Beam) and a 60%
confidence gate on aerial roofs (STACK). Nobody ships a typed basis, a coverage certificate or a
closed refusal taxonomy, and the vendor accuracy claims that would substitute for them are
unsubstantiated in exactly the way the FTC has now enforced against.

*Ruling: **holds**.* Two conditions attach. Basis is defensible only while it is checkable
(recourse), never a confidence label; and the certificate must be a query over data the
register holds, never prose (`quantity-contract.md` §6) — prose provenance was the legacy
census's own failure. Strongest of the three; lead with it.

### 2.3 SoR-native cost intelligence — **narrowed**

*The kill sentence (a Candy reseller in Dhaka):* "Any estimator loads the PWD schedule into a
Candy rate library in a week — and the government is about to publish a unified national
schedule on a web platform, so your database is a free download."

*Do we survive it?* The first half we survive: a Candy library is per-firm, unversioned and
rate-only; the product is a structured, **effective-dated, edition-versioned** book ("SoR 2022"
is three rate sets; embedded VAT moved 7.5%→10% between them), zoned **per book** (PWD's four
district-group columns, lettered only in the original edition; LGED's A–D with C and D swapped
against PWD's), with rate analysis underneath and every item bound to a register quantity kind —
a week of data entry buys none of that, and India, further along, still holds it as two
half-products (Arched: 15 state SoRs as tables, no rate analysis; Costimator: CPWD with rate
analysis, one schedule). The second half narrows us: the unified Bangladesh Schedule of Rates
(ECNEC decision 13 May 2026; committee "examining the feasibility of a web-based platform", 5 Jul
2026; nothing published as of 16 Aug 2026) would be a *source*, and the schema already treats a
new book as one more dataset — but if it ships digitally, "nobody structures the SoR" stops
being true and the moat moves. The e-GP anchor survived an adversarial check against the gazetted
PPR 2025: bids above 1.10 × OCE are non-responsive, and the low side is now a weighted threshold
of rival bids, the OCE and e-GP market history (`bd-authority.md` §10) — a bracket that is harder
to price into than a band, and unserved.

*Ruling: **narrowed**, to:* the binding of an effective-dated, edition-versioned, per-book-zoned
schedule with rate analysis to register quantities by kind — the part no download replaces —
plus reconstruction of the procuring entity's estimate and the PPR-2025 ceiling-and-threshold
model, which nobody serves. Data entry is not the moat; the join to the register and the
threshold model are.

## 3. What the first founding taught, and what binds here

Two root causes ate the four days between foundings, and the rebuild is shaped not to
reproduce them.

**Mutable concurrent state was stored in git.** Tickets, claims, numbers and decisions in
tracked markdown conflicted on every parallel merge, minted duplicate numbers, and bought a new
mechanism per symptom. **The seam:** versioned and immutable goes in git — domain law, ADRs,
specs, lessons; mutable and concurrent goes in GitHub Issues — tickets, claims (assignee), state
(open/closed), blocking (sub-issues and dependencies), priority. `docs/tracker.md` is the whole
of that workflow, expressed in `gh`.

**The harness was built before the product.** Nine of sixteen ADRs and 4,349 lines of scripts
were the repo building itself, and the planning apparatus emitted zero build tickets. **The
rule:** an ADR records a decision that constrains product code; how sessions are dispatched,
claimed, reviewed or merged is workflow and belongs in the tracker doc or nowhere. Zero custom
agents, zero hooks beyond one `SessionStart` checkup, no script that runs Claude. Nothing may be
justified by a workflow it would enable later.

The legacy autopsy's counter-decisions (one app, one schema lane, no codegen, typed tenancy,
register-centred schema, thin harness) all survive and are re-derived in `docs/adr/0001–0007`.

## 4. Architecture

Boring, mainstream, strongly typed, locally runnable, one obvious place for everything,
verification in seconds. Each line is an ADR.

- **ADR-0001** — one Next.js (App Router) TypeScript application: UI, tRPC, four module folders
  behind one `index.ts` each, over `src/core/`. Python 3.13 in `cad/` as a CLI: drawing in,
  versioned EntityGraph JSON out, Zod-mirrored, inside verify. No workspaces, no DI, no CQRS.
- **ADR-0002** — Postgres 16 native on 5544 (no Docker: a container publishes through the
  Windows port proxy, which is what put three ports inside reserved ranges), Drizzle schema in
  TS, `pnpm db:migrate` the only writer, RLS declared in the schema, enums as TS consts with
  derived CHECKs, `numeric` + decimal.js for every quantity and taka.
- **ADR-0003** — tRPC, Zod on every input, zero codegen anywhere.
- **ADR-0004** — tenancy as a typed seam (`forTenant`/`runAsSystem`, branded `TenantCtx`, no
  bare handle; driver and schema imports lint-banned outside `src/core/db.ts`) with RLS and
  composite tenant FKs as backstop, proven live.
- **ADR-0005** — the Quantity Register is the schema centre; `docs/domain/` is the law; locality
  is effective-dated data, never code.
- **ADR-0006** — the model seam: `callModel` is the only path to a model — pinned id, tenant
  attribution, ledger record, fixture replay inside verify, and a `Proposal` whose source keys
  code resolves before anyone sees it, or a named refusal. AI proposes; code resolves; a human
  disposes. Nothing in the schema accepts a proposal.
- **ADR-0007** — `pnpm verify`: tsc → eslint → vitest → ruff → pytest, fail-fast, uncached;
  stack-dependent tests outside; guardrails fail closed; `pnpm checkup` is the machine's report.

## 5. The domain core

`docs/domain/` — six files, carried verbatim from the first founding — is the law: the quantity
contract (basis × coverage, over-measurement hard block, the certificate as a query), identity
(the key, pairing, the act log, the drawing-set revision), measurement rules (rules as data,
scale fail-closed, the gate as the spine's sole writer), Bangladesh authority (no SMM, SI by
statute, the books, e-GP), formulas (fan-out, BBS, unit canon, rate analysis), CAD ingestion
(source keys, the extractor invariant, the view law). Code implements a clause and cites it;
an issue names the clause it builds. A change to the law is a dated amendment in the same PR;
this founding added one (`bd-authority.md` §10: the PWD zone columns and the e-GP gates, both
confirmed against the primary documents after a first pass had contradicted them).

**Skeleton grade at founding:** tenants, users, memberships, projects (with pins as opaque
references), the model call ledger; the tenant and model seams; the EntityGraph contract. The
register lands in the first takeoff issue, from `identity.md` and `quantity-contract.md`, and it
is deliberately demanding: refusal and deferral are first-class states, which is the thesis, not
overhead. *Landed 2026-08-16 (issues #64–#68):* the register's identity tables (levels,
drawings, drawing revisions, content-addressed drawing-set revisions, register objects with the
identity as a unique constraint, refused sightings with no bill join, the append-only human-only
act log), the ingest record with verbatim fidelity counters, the model seam's live transport and
ledger writer, better-auth as its own constrained role with the tRPC root minting the tenant
context, and CI running the contract on every push.

## 6. Scope fence

**In:** the four modules; the spine (auth, tenancy, projects, drawings, register, acts, model
ledger); Bangla + English; server PDF generation; the SoR digitisation pipeline; a Postgres job
queue when ingestion needs one.

**Out, until a named customer forces it:** scheduling, procurement, site progress, billing / RA
bills, ledger, HR, real-estate / CRM, WhatsApp capture, notification hub, workflow engine,
AI-agent platform, plugin systems, public API, mobile apps, IFC / BIM, MEP fitting takeoff (runs
only, until ingestion fidelity is proven), 3D anything — and, in this repository, any script
that runs Claude.

## 7. Verification and environment

- **Layout:** one `package.json`; `src/app` · `src/core` · `src/modules/{takeoff,book,estimate,bid}`
  · `db/{schema,migrations,__tests__}` · `cad/` (uv package) · `scripts/` (verify, checkup,
  db-migrate, db-drift — four files, ~330 lines) · `docs/`.
- **Ports:** web 3210, Postgres 5544 native. `pnpm checkup` binds 3210 to prove it bindable, not
  merely unlistened.
- **Verify:** 3.9 s at founding; 13.7 s once `next build` joined the lane on 2026-08-16 with
  #64–#68 merged (cold, into its own `distDir` `.next-verify`, no env, no daemon — the day a route
  could throw during prerender, ADR-0007). **Re-measured 2026-08-16 after the foundation session
  (#76–#80, #85): 13.5–14.7 s** across the session's runs (typecheck 2.4 · lint 0.9 · test 2.7–4.1
  · **schema-drift 0.6** · ruff 0.0 · pytest 0.4 · build 6.2–7.6), the drift probe (#78) being the
  one stage added: `drizzle-kit generate` into a scratch `out`, no database, tree untouched. `pnpm
  test:db`: 25 tests, 6 files, ~3.9 s. On the CI runner (`.github/workflows/ci.yml`, ubuntu-latest,
  cold) `pnpm verify` is 24.2 s and the whole job — checkout, the landed-migration guard (#85),
  install, verify, migrate, `test:db` against a `postgres:16` service — 77 s. Playwright, if
  ever, outside the lane.
- **Guardrails, all lint-enforced with a fail-closed fixture test:** module boundaries; the two
  seams; `localeCompare` (identity sorts by code units); bare `toLocaleString` (lakh/crore, stated
  locale). CLAUDE.md's NEVER list names each rule's enforcement; a NEVER that cannot be enforced
  mechanically is not in the list.
- **Harness:** `CLAUDE.md` 97 lines / 5.4 KB (the docs' target is under 200 lines);
  `.claude/settings.json` denies by bare name the tools this project never calls (the measured
  lever — a bare-name `deny` removes the tool schema from context, 29.8k → 22.8k on the first
  founding's cloud measurement; the server-level MCP names are the documented pruning form), turns
  off irrelevant bundled skills, sets bash timeouts, keeps auto memory **off** (`docs/lessons/` is
  the memory surface — dated, reviewed, in git), and keeps the one `SessionStart` checkup hook
  (0.27 s, one line, ~15 tokens); `docs/CONTEXT.md` commercial truth, glossary, BD rules.
  Re-examined against Anthropic's August 2026 documentation in `docs/research/harness-2026-08.md`;
  the session's startup context (`/context all`) is the one number a session cannot take of
  itself and is recorded here by the founder when next measured.
- **Tests:** Vitest at seams; golden vectors for construction math; synthetic drawing fixtures
  including a revision pair; competitor-derived drawings never enter this repo.

## 8. How work proceeds from here

- **The tracker is GitHub Issues** (`docs/tracker.md`): frontier = open, unblocked, unassigned,
  in map order; claim = assignee; blocking = native dependencies; tickets = sub-issues of a map.
- **ADR discipline:** at most one new ADR per decision that constrains product code; superseded
  by a dated ADR, never edited. Workflow never becomes an ADR.
- **The map rule:** *a map that resolves more than five decisions without emitting a build arc is
  charted too wide — narrow it and build.* Charting starts by naming the destination, which is a
  conversation with the founder; no session charts alone.
- **The first vertical slice is ruled and survives: RCC column concrete** — columns are placed
  and identified earliest and it is the shortest path to a signed certificate. Its arc: project +
  drawings + drawing-set revision → ingest (DXF via `cad/`) → view partition + grid + column
  placement (identity) → member-type registry from the schedule → column concrete lines with
  basis, coverage, calibration → the bill and its certificate → the signature and dip sample.
  Pricing follows through the book (PWD 07.x) once the register holds lines.
- **Assumptions named at this founding** (each the most defensible reading of an ambiguity):
  the model call ledger is beside, not inside, the human-only act log (ADR-0006); `next build`
  is outside verify until a route earns it (ADR-0007); the PWD district→column map has no
  published authority and is an authored dataset row (`bd-authority.md` §10); the skeleton
  carries no tRPC root or auth because no procedure exists to expose (ADR-0003, ADR-0004) —
  both are open issues.

## 9. Exit criteria

A brand-new session opened in this repo, told only "read `CLAUDE.md`, then run the frontier
query in `docs/tracker.md` and take the first row", can start building the takeoff spine at
production quality with no reference to the founding conversation — and `pnpm verify` runs green
in seconds on the skeleton.
