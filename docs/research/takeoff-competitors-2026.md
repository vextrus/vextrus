# Takeoff competitor landscape, 2026

**Researched:** 13 August 2026 · **Method:** vendor primary sources (product pages, help
documentation, release notes, press releases, pricing pages) except where explicitly labelled
`[SECONDARY]`. Every claim carries a URL and the date the source states or the date it was
retrieved (13 Aug 2026 where the page carries no date).

**Purpose:** stress-test three claimed differentiators — (1) revision-stable quantity identity,
(2) trust as the product, (3) Schedule-of-Rates-native cost intelligence.

**Headline finding, stated up front because it is the expensive one:** differentiator (1) is
**PARTIALLY OCCUPIED and closer to occupied than the repo assumes.** RIB CostX has shipped
"Auto-Revisioning" — a feature that loads *existing dimensions* onto a *revised* drawing,
re-matches them to the new geometry, and flags un-reviewed dimension groups with a warning. That
is a persistent measurement object surviving a revision. It is geometry-matching, not identity-key
based, and it fails in named cases — but it is not a green field. See
[Differentiator 1](#differentiator-1--revision-stable-quantity-identity) for the evidence and for
what remains genuinely unoccupied.

---

## 1. Vendor capability matrix

Legend: **Y** shipped and documented · **P** partial / preview / caveated · **N** no evidence found
· **?** not documented publicly (treat as unknown, not as absent).

| Vendor / product | Auto-count symbols | Auto-measure areas | Full-sheet understanding | Revision re-link | Stated accuracy (self-reported unless noted) | Price (published) | Geography |
|---|---|---|---|---|---|---|---|
| **Bluebeam Revu / Max** | Y (VisualSearch) | P (Dynamic Fill — algorithmic flood-fill, not ML) | P (Smart Review, preview, US commercial only) | P (Batch Slip Sheet transfers markups; Smart Overlay compares) | None published | $260 / $330 / $440 / $590 per user/yr (Basics/Core/Complete/Max) | Global; Smart Review "optimized for US vertical commercial" |
| **Autodesk Forma Takeoff** | Y (Automated Symbol Detection) | N (documented as symbol detection only) | P (spec parsing via Autodesk Assistant) | P (yellow indicator when a taken-off sheet gets a new version; copy/paste takeoff between sheets) | "25%+" / "up to 30%" time reduction (customer case studies) | Not published on product page | Global (ACC) |
| **Trimble Accubid Anywhere / MEP** | Y | Y (auto-routing length takeoff) | P (auto scale + sheet-name identification) | ? (AI Smart Assistant compares *estimate versions*, not drawings) | "up to 60%" task time cut; ">50%" symbol recognition; "3 million symbols detected" | Not published | North America + UK only |
| **Procore Estimating** | Y (Auto Count) | Y (Automated Area Takeoff, ML room detection) | N | ? | "up to 50%" takeoff time reduction | Not published | Global |
| **PlanSwift + Takeoff Boost** | Y (Auto Count, ≤10 pages/run) | Y (Auto Takeoff — areas, linears, counts) | P (Auto Scale, Auto Bookmark) | ? | None found | Not published | US-centric |
| **STACK** | Y | Y | N | P (Plan Overlay to spot changes *before* updating takeoffs — takeoff update is manual) | None published | Not published (12-mo terms) | US-centric |
| **Togal.AI** | Y | Y | P (Togal.CHAT over plans) | **Y-claimed** (one-click compare + quantify changes) | **"98% accuracy on floor plans"**, "5x faster"; vendor-hosted study claims ~70% time saving, within 5% of On-Screen Takeoff | Not published | US-primary (Miami HQ) |
| **Kreo** | Y (Auto Count, cross-page) | Y (Auto Measure, One-Click Area) | P (cross-references data across sheets) | P (Drawing Comparison highlights added/removed/modified) | None published | $35 / $70 / $175 per user/mo annual (Lite/Plus/**Pro = AI tier**); pay-per-page option | UK/EU + global |
| **Beam AI (ibeam.ai)** | Y | Y | Y-claimed (reads legends) | Y-claimed ("tracks revisions") | "99%+", "±1% of in-house" — **but every takeoff is human-QA'd before delivery** | Not published | US |
| **Handoff (H1)** | Y | Y | Y-claimed (residential ≤5,000 sqft) | ? | **81.6% on own "TakeoffBench-V1"** vs human estimators 77–78%, other models 50–56% | From $239/mo | US residential |
| **Countfire** | Y (electrical symbols) | N (count-only by design) | N | **Y-partial** — new revisions "automatically counted using the work you have already done" | None published; documents a 4-stage checking process | Not published | UK-primary |
| **RIB CostX / CostX Takeoff** | Y | Y | N | **Y — strongest in market** (Auto-Revisioning + Revise Dimensions + Best Match All) | None published | Not published (quote-based) | 100+ countries |
| **RIB Candy** | ? | ? | N | ? | None published | Not published | Africa / Middle East / Australia strong |
| **Glodon Cubicost (TAS/TRB/TME/TBQ)** | Model-based, not 2D-CV | Model-based | N (BIM-driven) | ? | None published | Not published | China-primary, SE Asia (asia.glodon.com) |
| **ACCA PriMus** | ? | ? | N | ? | None published | Free price-list distribution; software licensed | Italy |
| **Nomitech CostOS** | P (2D + BIM + GIS takeoff) | P | N | ? | None published | Not published | Global, strong Middle East / oil & gas |
| **Buildxact** | Y | Y | P ("Blu" AI assistant) | ? | None published | Not published | AU / NZ / UK / NA, residential |
| **Cubit (Buildsoft)** | ? | Y | N | ? | None published | Not published | AU / NZ |
| **Causeway, Bidtracer** | ? | ? | ? | ? | Not researched to primary sources — **see unverified list** | — | UK / US |

Sources for the matrix rows are cited inline in the sections below.

### What is actually automated — the honest reading

Across every vendor with published documentation, "AI takeoff" in 2026 means one or more of four
things, in descending order of how commonly it ships:

1. **Count-by-example symbol detection.** Trace/box one symbol, find the rest. Bluebeam
   VisualSearch, Autodesk Automated Symbol Detection, Procore symbol recognition, PlanSwift Auto
   Count, Kreo Auto Count, Countfire. This is **table stakes**, not a differentiator.
2. **Region/area detection.** Click inside a room, get the boundary. Procore Automated Area
   Takeoff, Kreo One-Click Area / Auto Measure, Togal, PlanSwift Auto Takeoff.
3. **Pre-takeoff setup automation.** Auto-scale, auto-sheet-naming, auto-bookmark, sheet
   stitching. Trimble (June 2026), PlanSwift (May 2026), Bluebeam Max stitching.
4. **Document-level LLM assist.** Spec search, chat-over-plans, markup summarisation. Autodesk
   Assistant, Bluebeam Revu + AI MCP, Togal.CHAT, Kreo agentic workflow, Trimble AI Smart Assistant.

**Nobody publicly documents "full sheet understanding" that produces a complete, discipline-aware
BOQ unattended.** The two vendors that come closest to claiming it — Beam AI and Handoff — do so
with material qualifications: Beam AI routes every output through a human estimator QA step with a
24–72 hour turnaround, and Handoff's 81.6% benchmark is on 10 residential blueprint sets ≤5,000 sqft.

---

## 2. Differentiator 1 — Revision-stable quantity identity

### Verdict: **PARTIALLY OCCUPIED** — and materially more occupied than assumed

#### The occupying evidence: RIB CostX Auto-Revisioning

This is the finding that should change planning. RIB's own tips blog describes a workflow in which
*existing measurements are carried onto a revised drawing and re-matched*, not re-created:

> "The feature allows users to overlay revised DWG drawings on top of older revisions to clearly
> see what has changed." … "The Auto-Revisioning feature then allows users to **load the initial
> measurements into the revised drawings**. These matches can be generated quickly with the **Best
> Match All** feature, which can be found within the **Revise Dimensions** section of the ribbon
> menu. CostX will then automatically detect and match the lines in question – if for any reason
> unwanted lines are chosen, users can quickly amend the lines."
>
> "From here, it's just a matter of reviewing and confirming all necessary dimensions. A good way
> to ensure that everything has been covered is by checking your **Dimension Groups** – if you've
> **overlooked any reviews, a warning sign will show up** against that selection."
>
> — https://www.rib-software.com/en/blogs/rib-costx-auto-drawing-revisioning (retrieved 13 Aug 2026)

Read carefully, that is four of the things we claimed as ours:

- a **measurement object that persists** across a drawing revision (the "dimension", live-linked
  to a workbook row);
- **automatic re-attachment** of that object to new drawing geometry;
- an explicit **unreviewed state** with a warning — i.e. the system will not silently pretend a
  dimension is confirmed;
- a **delta-shaped output**: CostX 6.5 added a Measure button inside Comparison Mode specifically
  "for those wanting to measure variations – for example, adds & omits"
  (https://www.rib-software.com/en/blogs/rib-costx-drawing-comparison-tool, retrieved 13 Aug 2026).

CostX also documents three comparison modes, the third of which is closest to identity-based:

> "**Comparing by Object** … the most intelligent of the three … recognises unique object IDs and
> identifies whether objects have been added, removed, changed or remained the same."
> — same source

#### Where CostX stops, and where the unoccupied ground actually is

The documentation names its own failure modes, and they are exactly the ones a geometry-matching
approach must have:

> "if the drawing has been offset by the designer, for example, then **no lines will match**"
> — https://www.rib-software.com/en/blogs/rib-costx-drawing-comparison-tool

Object-ID comparison is described in the context of **CAD/DWG and 3D BIM** — the object IDs come
from the source CAD file, not from CostX. On a re-exported or re-authored drawing, or on a raster
PDF, those IDs are not stable and the system falls back to line matching. And the whole flow is
**operator-initiated and operator-confirmed**: a human loads measurements forward, runs Best Match
All, and reviews each dimension group.

So the precise, defensible statement of what remains unoccupied is narrower than "revision-stable
identity" and should be re-scoped to:

- **Identity derived from the domain, not the drawing.** CostX's persistence key is *drawing
  geometry* (lines, CAD object IDs). Our claimed key is
  `(project, discipline, level, element type, mark, ordinal)` with ordinal frozen at first
  registration and no coordinate or label in the key. That survives re-authoring, offset, rescale,
  raster re-issue, and a change of CAD tool — cases in which CostX explicitly does not.
- **Downstream link survival as a system property.** CostX preserves the dimension→workbook link.
  Nothing found preserves *estimate line → rate application → bid line* identity across a revision
  such that a revision produces a priced delta rather than a re-priced estimate. This is unclaimed
  in every vendor's documentation reviewed.
- **Revision as a first-class artefact.** No vendor publishes a *revision delta document* — a
  signed statement of what changed, by how much, and with what confidence, as an output. CostX
  produces "comparison reporting"; that is the nearest, and it is a report, not a register entry.

#### Everyone else — a spectrum from "re-run" to "re-do"

**Countfire** is second-closest, and its mechanism is different and instructive — it persists the
*symbol definition*, not the *instance*:

> "you upload the new drawings and they are automatically counted using the work you have already
> done. Countfire's matching algorithm automatically works to find symbols on revised drawings, but
> **those symbols must be fundamentally the same and made up of the same elements, and the drawing
> should be at the same scale as the original**."
> — https://www.countfire.com/product/takeoff-software (retrieved 13 Aug 2026)

That is re-derivation with cached rules, not delta with identity. A count of 42 becoming 44 tells
you the total moved; it does not tell you *which two* were added, and no downstream link to a
specific fitting survives.

**Bluebeam** transfers markups by page, positionally:

> "Your markups from the revised pages will appear on the current version."
> — https://support.bluebeam.com/revu/how-to/transfer-markups-with-batch-slip-sheet.html
> (retrieved 13 Aug 2026)

This is Batch Slip Sheet: it moves a markup object to the same **page coordinates** on the new
sheet. If the wall moved, the measurement does not follow it — it now measures the wrong thing,
silently. This is the single most important failure mode in the market and Bluebeam's own docs do
not warn about it (the only caveat given is page-count mismatch). Bluebeam's marketing concedes
the underlying pain in careful language:

> "When drawings change, comparison tools and organized markups mean estimators **revise only what
> changed instead of redoing entire scopes**." … "**revisions become adjustments, not rebuilds**."
> … "This wastes time and increases the risk of new errors."
> — https://www.bluebeam.com/resources/construction-takeoffs-guide-2026/ (2026)

Note what that sentence actually promises: it is a claim about *the estimator's workflow discipline*
("organized markups"), not about *the software maintaining a link*. The burden is on the human.

**Autodesk Forma Takeoff** is the weakest of the majors on this axis and is candid about it by
omission. The November 2025 release note ships only a *notification*:

> "The indicator highlights documents with takeoff and changes from **gray to yellow** when a new
> version of a taken-off document is uploaded to the project."
> — https://help.autodesk.com/cloudhelp/ENU/Docs-Whats-New/files/november-25/Takeoff_Whats_New_November_25.html
> (Nov 2025; page returned 503/404 to direct fetch — content confirmed via Autodesk-indexed search
> result, **flagged as second-hand for the exact wording**)

The remedy is manual copy/paste of takeoff between sheets, and Autodesk's own community idea board
carries user requests that takeoff **not be deleted from previous versions** when updating to the
newest, so old and new can be compared — i.e. today updating to a new version can destroy the prior
takeoff. `[SECONDARY — Autodesk Community ideas board, forums.autodesk.com/t5/acc-ideas, takeoff
label, retrieved 13 Aug 2026]` This is a live, unfixed complaint from paying Autodesk customers and
it is the clearest signal in this whole document that the problem is real and unsolved at the top
of the market.

**STACK** positions overlay as a *pre-check* before manual re-takeoff:

> "Use Overlay to review plan revisions **before updating takeoffs** to avoid missing changes."
> — https://www.stackct.com/takeoff/ (retrieved 13 Aug 2026)

STACK does, notably, ship strong measurement-level audit history (below, §3).

**Togal.AI** claims a one-click compare-and-quantify:

> "Quickly compare drawing sets and quantify changes with a single click"
> — https://www.togal.ai/ (retrieved 13 Aug 2026)

Because Togal re-runs detection on each set, this is almost certainly a *set-to-set diff of two
independently generated results*, not a re-linked identity. **Unverified** — Togal publishes no
help documentation on the mechanism. If the mechanism turns out to be identity-preserving this
verdict moves toward OCCUPIED; it is the single highest-value follow-up in this report.

**Kreo** ships Drawing Comparison highlighting "added, removed, and modified elements"
(https://www.kreo.net/, retrieved 13 Aug 2026) with no documented statement about measurement
re-linking.

#### Is there any product that assigns persistent identity to a measured element surviving a revision?

**Yes — RIB CostX, at the level of a dimension bound to drawing geometry, with human confirmation.**
No product found assigns a *domain* identity independent of drawing geometry, and no product found
carries that identity through to pricing and bid so that a revision yields a priced delta.

**Actionable consequence:** the moat should be re-stated. "We re-link measurements across a
revision" is **occupied by RIB since at least CostX 6.5**. "Element identity is deterministic and
domain-derived, survives re-authoring and raster re-issue, and propagates a *priced* delta to the
bid" is, on the evidence gathered, **unoccupied** — and it is a harder and more defensible claim.
Marketing that says the former will be met with "CostX does that."

---

## 3. Differentiator 2 — Trust as the product

### Verdict: **PARTIALLY OCCUPIED on audit trail; UNOCCUPIED on basis taxonomy, coverage declaration, and refusal**

#### What is occupied

**Audit trail and change history — occupied, and by a serious implementation.** STACK:

> "See exactly who changed what, when, and what the values were before with full activity history
> at the project, takeoff, and **measurement level**. Deletions, scale changes, and batch edits get
> **flagged automatically**."
> — https://www.stackct.com/takeoff/ (retrieved 13 Aug 2026)

That is a real, per-measurement provenance-of-edits log, and it flags exactly the two silent-corruption
vectors we care about (scale changes and batch edits). Treat measurement-level change history as
**table stakes**, not a differentiator.

**Measurement → drawing traceability — occupied.** Bluebeam:

> "Every measurement is tied to both a visible markup on the drawing and a corresponding data
> record" … teams should be able to "trace a quantity back to a specific location on a sheet."
> — https://www.bluebeam.com/resources/construction-takeoffs-guide-2026/ (2026)

RIB CostX dimensions are "live-linked to workbooks"
(https://www.rib-software.com/en/blogs/rib-costx-auto-drawing-revisioning). Per-quantity provenance
*to a drawing location* is therefore **table stakes**, not a differentiator. Our differentiator has
to be provenance to *geometry with a declared basis*, which is a different and stronger thing.

**Confidence flagging — partially occupied, but I could not verify it from vendor primary sources.**
The pattern is widely described — detection results carry a confidence, low-confidence items are
flagged rather than finalised, the estimator reviews flagged items in a review mode. But every
description of it I could locate is on **third-party or agency blogs**, not on the help docs of
Bluebeam, Autodesk, Procore, Trimble, STACK, PlanSwift, Togal, or Kreo.
`[SECONDARY: nedesestimating.com, drawer.ai/blog/11-accuracy-checks-for-automated-electrical-takeoff,
aitakeoffbuilder.com — all vendor-adjacent content marketing, retrieved 13 Aug 2026]` **Flagged as
unverified against primary sources.** It is plausible that confidence UI exists in-product and is
simply undocumented publicly; assume it exists rather than assuming it does not.

#### What is unoccupied — and this is the real ground

Searching vendor documentation for the specific artefacts we claim:

- **A basis taxonomy per line** (measured / transcribed / derived / entered / defaulted): **no
  vendor found publishes one.** Not Bluebeam, Autodesk, Procore, Trimble, STACK, PlanSwift, Togal,
  Kreo, Countfire, RIB, Nomitech, Glodon. Confidence *scores* are a different object from a *basis*
  — a score says "how sure the model is", a basis says "what kind of fact this is". The second is
  auditable by a human who does not trust the model; the first is not.
- **A coverage/completeness declaration** ("this takeoff covers X of the scope; here is what it does
  not cover"): **no vendor found publishes one.** Every product reviewed reports what it *did*
  measure. None reports the complement.
- **Refusal as a first-class output** — "we could not measure this, here is the named reason":
  **no vendor found does this.** The closest artefacts in the market are (a) CostX's unreviewed-
  dimension-group warning, which is a *workflow state*, not an output, and (b) the industry-standard
  flag-for-review pattern, which defers to a human but still emits a number. Nobody publishes a
  product that will decline to produce a quantity.
- **A Certificate of Measured Coverage** or equivalent signed artefact: **no equivalent found.**

**These three are genuinely unoccupied and they are strongly aligned with the RICS standard now in
force (§5).** That alignment is the most commercially valuable thing in this report: the regulatory
obligation to produce a *written reliability decision* creates demand for exactly the artefact
nobody ships.

#### What the market actually complains about `[SECONDARY throughout this subsection]`

Direct forum/Reddit sourcing was not obtainable — reddit.com is blocked to this user agent, and I
could not retrieve r/estimators threads. The following are from industry and vendor-adjacent press
and should be weighted accordingly:

- **Black-box outputs defeat audit.** "When algorithms operate in 'black box' environments without
  transparency, evidence loses its foundation… you might find yourself reviewing a summary that
  looks flawless yet cannot trace exactly how the AI reached its conclusion."
  `[SECONDARY: securityscientist.net, 2026]`
- **Manual re-measurement variance is itself 8–12%**, and a moderately complex PDF set takes 3–5
  hours to take off manually. `[SECONDARY: helium42.com/blog/ai-for-quantity-surveying, retrieved
  13 Aug 2026]` If accurate, this is a useful and uncomfortable benchmark: it means "98% accuracy"
  claims are inside the noise floor of the human baseline they are measured against.
- **AI reliability lags AI capability**, and most vendors do not benchmark for reliability.
  `[SECONDARY: general AI commentary, 2026]`
- **Semantic gap.** Togal.AI is described as strong on geometric detection but as not deeply
  interpreting "specs, annotations or complex trade logic", so estimators "often need to manually
  refine or complete results." `[SECONDARY: multiple review sites, retrieved 13 Aug 2026]` This is
  the recurring shape of the complaint — the geometry is fine, the *meaning* is not.
- **Destructive version updates.** Autodesk customers asking that takeoff not be deleted from prior
  versions on update. `[SECONDARY: forums.autodesk.com ACC Ideas]`

The complaint pattern is consistent and it favours us: **the market's problem is not that AI can't
count. It is that nobody can tell you what the AI didn't count, or defend the number afterwards.**

---

## 4. Differentiator 3 — Schedule-of-Rates-native cost intelligence

### Verdict: **OCCUPIED outside the BOQ Belt; UNOCCUPIED inside it**

This is the differentiator that survives least well as stated. Effective-dated, zone-aware,
government-published rate books as structured product data is a **mature, twenty-year-old pattern**
in at least two markets.

#### Italy — ACCA PriMus: fully occupied, and the reference implementation

ACCA distributes official regional *prezzari* (price books) free, in a standard interchange format:

- Organised **by region** — all 20 Italian regions plus Chambers of Commerce
  (https://www.acca.it/prezzari-regionali, retrieved 13 Aug 2026). That is zone-awareness.
- Organised **by year/edition** — 2026, 2025, 2024, 2023 editions of the same regional book are all
  published and retained side by side (e.g. `Prezzario Emilia Romagna 2026 Opere Pubbliche` and its
  2025, 2024, 2023 predecessors, each a separate catalogue entry). That is effective-dating with
  history retention.
- Distributed in a **standard structured format (DCF)** with conversion tooling (PW-CONV), read by
  PriMus-DCF and PriMus online.

This is precisely the architecture we describe. It is shipping, free, and has been for years. Any
claim of novelty for "SoR as effective-dated zone-aware structured data" is falsifiable in one
search.

#### China — Glodon: occupied, via the *quota* system

Glodon's Cubicost embeds "intelligently **built-in local measurement rules**" and its commercial
core is the Chinese *quota* (定额) system:

> A "quota" is "the standard for allowable consumption of labor, materials, and machinery to
> complete a unit of work… an industry-wide unified standard for workload and resource consumption,
> comprising consumption standards and benchmark unit prices."
> `[SECONDARY: medium.com/asiancityscope, May 2025]` — but the built-in-local-rules claim is
> primary: https://asia.glodon.com/cubicost (retrieved 13 Aug 2026)

Two things follow that matter to us. First, **government rate books as the product's spine is a
proven route to market dominance** — this is the best available evidence that the strategy works.
Second, **measurement *rules* localised per jurisdiction** (not just rates) is a Glodon capability
we should assume is expected in any market that has a national measurement standard.

#### Commercial rate-book ingestion — occupied by every serious estimating vendor

- **RIB CostX**: "Subscribers to the BCIS may download an abstract Schedule of Rates as a CSV file
  which can be **directly imported into RIB CostX as a Phraseology or Rate Library**. This also
  applies to other international rate library standards, such as CostWeb or RS Means."
  (https://www.rib-software.com/en/blogs/rib-costx-database-rate-libraries, retrieved 13 Aug 2026).
  Rates are built up from material / labour / plant / machinery components.
- **Nomitech CostOS**: subscribable knowledgebases including RSMeans, Spon's, PipeBase; "location
  factors with built-in regional adjustments"; documented Middle East project experience
  (https://www.nomitech.com/costos/databases, https://www.nomitech.com/costos, retrieved 13 Aug 2026).
- **RIB Candy**: Master Libraries for reusable estimate data (https://www.rib-software.com/en/rib-candy).

#### What is actually unoccupied

The gap is **not the pattern — it is the coverage.**

- **Bangladesh.** The PWD Schedule of Rates is published as **PDF**, most recently *PWD Schedule of
  Rates 2022 (Revised), Sixteenth Edition* (https://ss.pwd.gov.bd/document/sor/PWDSoR2022-Revised-2.3.23-Website.pdf;
  index at https://ss.pwd.gov.bd/sor). PWD's own site states SoRs are "usually published every two
  years" based on market rate survey. Critically, PWD states that "a software to automate the whole
  process of preparation of schedule of rate, estimate of work and BOQ **is under preparation and
  would be completed soon**" (pwd.gov.bd design units page, retrieved 13 Aug 2026 — **note: this
  text is undated and may be years old; treat the "soon" as unverifiable**). There is **no
  structured, effective-dated, machine-readable BD SoR product** found. RHD (Roads & Highways)
  publishes its own separate SoR, also as PDF, also per-zone (Chittagong zone example found).
- **India.** CPWD DSR is published free as PDF on cpwd.gov.in with correction slips applied over
  time — an effective-dated structure in practice, distributed in an unstructured format. Small
  local vendors claim DSR-2025-loaded estimating at ₹500–₹10k/month with "95%+ accuracy"
  `[SECONDARY: constructionestimatorindia.com — a marketing site; treat all figures as unverified]`.
  No major international vendor found ships CPWD DSR as a first-class rate library.
- **Pakistan / Gulf.** No primary evidence found of any product ingesting Pakistani MES rates,
  Saudi, or UAE government rate books as structured effective-dated data. **Unverified — absence of
  evidence only.**

**Actionable consequence:** re-state this differentiator as *coverage and correctness in the BOQ
Belt*, not as *architecture*. "We model government SoRs as effective-dated zone-aware data" invites
"so does ACCA, for free, since before you existed." "We have BD PWD 2022-Rev and RHD zonal rates
structured, versioned, and traceable to the published PDF clause — and nobody else does" is true
and checkable. Also: **the correction-slip problem** (CPWD DSR is amended by slips between editions;
BD PWD by revisions) is a real modelling problem that maps exactly onto effective-dating, and no
vendor found addresses it publicly. That is a small, sharp, defensible wedge.

---

## 5. RICS AI standard — verification

### The repo's assertion is **substantially CORRECT**, with one element unverified

**Exact title:** *Responsible use of artificial intelligence in surveying practice*
**Edition:** 1st edition (page carries "September 2025")
**Published:** 17 November 2025 · **Effective:** **9 March 2026** — confirmed twice
- https://www.rics.org/profession-standards/rics-standards-and-guidance/conduct-competence/responsible-use-of-ai
- https://www.rics.org/news-insights/rics-first-ever-standard-on-responsible-ai-use-now-in-effect
  (18 March 2026): *"RICS' first global professional standard for the responsible use of artificial
  intelligence (AI) in surveying practice is now in effect for all members and regulated firms from
  9 March 2026."*

**Named surveyor + written reliability decision — CONFIRMED, and the wording is close to ours:**

> "A **written decision about the reliability** of any given output [must be] prepared by or under
> the supervision of an appropriately qualified and **named surveyor**."
> — rics.org standard page, retrieved 13 Aug 2026

RICS states this requirement exists to secure "accountability and also explainability."

**AI disclosure — CONFIRMED:** members must cover "the use of AI in [their] Terms of Engagement" and
"be able to explain [their] use of AI to [their] client," including "options for redress or opting
out."

**Scope gate — CONFIRMED and important:** the standard "applies **only** to use of AI systems that
have a **material impact** on the delivery of surveying services because use of AI in that context
is generally high-risk." Materiality is determined by "informed professional judgement." An AI
takeoff feeding a signed BOQ is squarely inside this.

**Other confirmed obligations:** governance and risk management including **risk registers** and
responsible-use policies; **AI procurement and due diligence** — firms must seek specified
information from providers *before* deployment; professional scepticism and continuing accountability.

### The one correction

**"Dip samples on automated output" — NOT VERIFIED.** I could not find that phrase or an explicit
sampling obligation in the RICS pages retrieved. It may exist in the full standard PDF (which I did
not obtain) or it may be an over-reading of the general "assess the reliability of AI outputs"
duty. **The repo should soften this claim to "assess the reliability of AI outputs" until the full
standard text is read.**

### Commercial implication — the strongest strategic finding in this document

The **procurement due diligence** clause makes RICS-regulated firms *obliged to demand from vendors*
the very artefacts nobody ships. A product that emits a per-line basis, a coverage declaration, and
a signed Certificate of Measured Coverage is not selling a nice-to-have to a RICS firm after
9 March 2026 — it is selling the evidence pack for their mandatory written reliability decision.
That is the sharpest wedge identified in this research, and it is time-boxed: competitors will
notice.

### Adjacent regimes

- **RICS valuation-specific guidance:** *Artificial intelligence in real estate valuation* (global
  practice guidance, 1st edition) — public consultation Q2 2026, publication expected later in 2026.
  https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/ai-in-real-estate-valuation
  **Not yet in force.**
- **AIQS (Australia):** AIQS publishes Practice Standards, Guidance Notes and Information Papers
  (https://www.aiqs.com.au/standards) and has surveyed AI themes, but **no dedicated AI practice
  standard was found**. **Unverified — could not confirm absence; the standards catalogue was not
  enumerable from search.**
- **ICES, PAQS:** **not verified. No primary sources retrieved.** Open item.
- **EU AI Act:** construction estimating is **not** an Annex III high-risk category on any reading
  found, so the heavy high-risk obligations likely do not bite directly. Two things still might:
  Article 50 **transparency obligations** for AI systems interacting with people / producing
  AI-generated content, applying **from 2 August 2026**; and GPAI provider obligations if we ever
  distribute a model. Note the timeline moved: under the Digital Omnibus provisional agreement of
  **7 May 2026**, the Annex III high-risk deadline was **deferred from 2 August 2026 to 2 December
  2027**. `[SECONDARY: artificialintelligenceact.eu, legalnodes.com, euaiactguide.com — retrieved
  13 Aug 2026; the Digital Omnibus deferral was NOT verified against an EU primary source and
  should be before it is relied on.]`

---

## 6. Table stakes we must ship

Derived from what multiple vendors document as shipped. **Not shipping these means losing demos on
mechanics, regardless of how good the trust story is.**

### Tier 1 — absence is disqualifying

1. **Count-by-example symbol detection across a whole sheet set**, with a similarity threshold the
   user can tune and a visual review pass. *(Bluebeam VisualSearch, Autodesk, Procore, PlanSwift,
   Kreo Auto Count with similarity slider, Countfire.)*
2. **Click-inside-a-room area detection.** *(Procore Automated Area Takeoff, Kreo One-Click Area,
   Bluebeam Dynamic Fill, Togal.)*
3. **Auto-scale detection per page**, including from title-block scale text. *(PlanSwift Auto Scale,
   Trimble automated pre-takeoff setup.)* — note this is the one place where our "never guess an
   unaffirmed scale" rule and the market's expectation collide. **Detect and propose; require
   affirmation. Do not silently apply.**
4. **Overlay / drawing comparison** with added/removed/unchanged colour coding. *(CostX three modes,
   STACK Plan Overlay, Kreo Drawing Comparison, Bluebeam Smart Overlay, Togal.)*
5. **Measurement-level audit history** — who changed what, when, prior value, with automatic flags
   on deletions, scale changes and batch edits. *(STACK, explicitly.)*
6. **Excel round-trip.** Bluebeam gates Quantity Link with Excel at the $440 Complete tier; RIB
   documents CSV import into rate libraries. Estimators live in Excel; a one-way export is not
   enough.
7. **Every quantity clickable back to its location on a sheet.** *(Bluebeam, CostX live-linking.)*
8. **Assemblies / conditions** — one takeoff object yielding multiple materials via formulas.
   *(Togal "assembly building integrated into the takeoff workflow"; Kreo "breaks assemblies into
   individual materials"; CostX built-up rates over material/labour/plant/machinery.)*
9. **Cloud multi-user collaboration on the same drawing set.** *(Togal, STACK, Autodesk ACC, Kreo.)*
10. **Rate libraries with build-ups**, importable from CSV. *(CostX, Candy Master Libraries,
    Nomitech.)*

### Tier 2 — expected by 2026, absence is a visible gap

11. **Auto-bookmarking / sheet indexing and auto sheet-name extraction.** *(PlanSwift Auto Bookmark,
    Trimble sheet-name identification.)*
12. **Sheet stitching** — combining tiled/multi-part drawings into one continuous measurable view.
    *(Bluebeam Max.)*
13. **OCR over raster/scanned PDFs** to make them searchable and measurable. *(Bluebeam since 2015.)*
14. **Spec-book parsing and search** alongside drawings — the drawings are half the scope.
    *(Autodesk Specifications tool + Assistant; this is a real capability gap in most 2D-only tools
    and it is exactly where the "semantic gap" complaints land.)*
15. **Chat-over-drawings** natural-language query of the plan set and the takeoff.
    *(Togal.CHAT, Autodesk Assistant, Trimble AI Smart Assistant, Bluebeam Revu + AI via MCP —
    Bluebeam notably exposes this over **Anthropic's Claude / MCP**, which is a distribution channel
    worth studying.)*

### Tier 3 — differentiators in 2026, worth deliberate choice

16. **Auto-routing linear takeoff** including vertical rises and drops for conduit/pipe.
    *(Trimble, June 2026 — MEP-specific and hard.)*
17. **Localised measurement *rules*, not just rates**, per jurisdiction. *(Glodon "built-in local
    measurement rules". For the BOQ Belt this is the analogue of a national method of measurement
    and it is a serious moat if done properly.)*
18. **Pay-per-page pricing** alongside seats. *(Kreo — removes the seat barrier for occasional
    estimators, which matters enormously in a price-sensitive first market like Bangladesh.)*
19. **Human-QA'd delivery as a service tier.** *(Beam AI's 24–72h QA'd output at claimed ±1%.)*
    This is how the market currently reconciles "AI speed" with "signable number" — and it is a
    direct competitor to our Certificate of Measured Coverage as a trust mechanism. Ours is cheaper
    and instant; theirs is proven. Expect the comparison.
20. **BIM/IFC bridging** — 2D and 3D quantities aggregated in one register with rollups.
    *(Autodesk Forma Takeoff, CostX, Nomitech, Glodon.)* Explicitly out of scope for us per the
    commercial guardrail; noted so the gap is a decision, not an oversight.

---

## 7. Unverified claims and open items

Ordered by how much a wrong answer would cost.

1. **Togal.AI's compare-and-quantify mechanism.** Highest-value unknown in this report. If Togal
   preserves element identity across sets rather than diffing two independent runs, Differentiator 1
   moves from PARTIALLY OCCUPIED toward OCCUPIED. Togal publishes no help documentation. **Resolve
   by trial or by direct question.**
2. **The full text of the RICS AI standard.** I read RICS' own summary pages, not the standard PDF.
   The "dip samples on automated output" claim in our repo is **unconfirmed** and should be softened
   until the PDF is read. Everything else in our assertion checked out.
3. **Confidence scoring in shipping products.** Widely described, but only on secondary content-
   marketing sources. Not found in the help docs of any major vendor. If it is in fact standard
   in-product, part of our trust story is less novel than stated.
4. **Autodesk's exact behaviour on version update.** Both Autodesk help URLs
   (`help.autodesk.com/view/PRECON/...guid=Updating_Outdated` and `.../TAKEOFF/...guid=Version_in_Sheets_Models`)
   returned HTTP 503 to direct fetch; the November 2025 what's-new page returned 404 at its static
   path. The claim that updating destroys prior takeoff comes from a **community ideas board**, not
   Autodesk documentation. **Verify before using in any competitive material.**
5. **CostX Auto-Revisioning limitations.** The RIB knowledge-base article (`confluence.itwocx.com`,
   now `ribcx.atlassian.net`) 404'd. Unknown: whether Auto-Revisioning works on **raster** PDFs at
   all, what happens to dimensions with no match, and whether object-ID comparison depends on
   CAD-supplied IDs. These determine exactly how much room our identity model has. **Highest-value
   technical follow-up.**
6. **PlanSwift Takeoff Boost detail.** ConstructConnect release notes returned HTTP 403. Feature
   list is second-hand.
7. **RICS "dip sample", AIQS AI standard, ICES, PAQS.** ICES and PAQS were **not researched to
   primary sources at all**. AIQS AI standard: searched, not found, absence not confirmed.
8. **EU Digital Omnibus deferral (7 May 2026, Annex III to 2 Dec 2027).** Secondary sources only.
   Not confirmed against an EU primary source.
9. **All vendor accuracy claims are self-reported.** Specifically:
   - Togal "98% accuracy on floor plans" — no methodology published. The associated study (Marulanda
     et al., University of Kansas + Simplar Foundation + UNC Charlotte + ASU, research conducted
     March 2025, labelled "peer reviewed") **does not state a publication venue or date, does not
     disclose funding, and is hosted on Togal's own website.** Its actual findings are more modest
     than the marketing: ~70% time saving, accuracy "within a 5% margin" of On-Screen Takeoff —
     i.e. it measures *agreement with another tool*, not correctness.
     (https://www.togal.ai/case-study/peer-reviewed-study-togal-ai-vs-on-screen-takeoff)
   - Handoff H1 "81.6%" is on **its own benchmark, TakeoffBench-V1**, over **10 residential
     blueprint sets ≤5,000 sqft**, published 21 July 2026, with no stated caveats or limitations.
     A vendor-authored benchmark on ten documents is not an accuracy claim.
     (https://www.handoff.ai/blog/handoff-h1-ai-takeoffs)
   - Beam AI "99%+" / "±1%" is achieved **with a human estimator QA step**, not autonomously
     (https://www.ibeam.ai/, retrieved 13 Aug 2026).
   - Trimble "up to 60%" is explicitly "data from contractors using these AI features in 2026" —
     customer self-report (https://news.trimble.com/New-Trimble-AI-Takeoff-Capabilities-Cut-MEP-Estimating-Time-and-Increase-Accuracy,
     30 June 2026).
   - **No independent, third-party, methodologically disclosed accuracy benchmark for AI takeoff
     was found to exist.** This is itself an opportunity and a hazard: we cannot cite one against
     competitors, and we will not be able to cite one for ourselves.
10. **Causeway and Bidtracer** — not researched to primary sources. Open.
11. **Pakistani MES / Saudi / UAE rate books in any product** — searched, nothing found. Absence of
    evidence only.
12. **Bangladesh PWD's own BOQ automation software** — PWD's site says one "is under preparation".
    The page is undated. If a government tool is imminent this affects positioning materially.
    **Worth a direct check.**
13. **Bluebeam Smart Review / Smart Overlay are in preview**, and Smart Review is "optimized for US
    vertical commercial construction" (bluebeam.com/product/ai-and-innovation, retrieved 13 Aug
    2026). Their eventual scope is unknown; Bluebeam is the most-installed tool in the market and
    where it goes, the baseline goes.

---

## 8. Net assessment

| Claimed differentiator | Verdict | One-line reason |
|---|---|---|
| Revision-stable quantity identity | **PARTIALLY OCCUPIED** | RIB CostX Auto-Revisioning already carries measurements forward onto a revised drawing, re-matches them to geometry, and warns on unreviewed dimension groups. Unoccupied ground is narrower: *domain-derived* identity that survives re-authoring and raster re-issue, and that propagates a **priced** delta downstream. |
| Trust as the product | **PARTIALLY OCCUPIED** — but the valuable half is free | Per-quantity drawing traceability and measurement-level audit history are table stakes (Bluebeam, CostX, STACK). **Basis taxonomy, coverage declaration, and refusal-with-reason are unoccupied across every vendor reviewed** — and RICS' 9 March 2026 standard creates procurement pressure for exactly these. |
| SoR-native cost intelligence | **OCCUPIED as architecture; UNOCCUPIED as coverage** | ACCA PriMus has shipped region-scoped, year-versioned official Italian price books in a structured format for years; Glodon built a market-leading company on China's quota system. The novelty is not the model — it is that **no one has done it for BD/India/Pakistan/Gulf government SoRs**, and no one addresses the correction-slip problem. |

**The single most expensive assumption to leave uncorrected:** that "we re-link measurements across
a revision" is novel. It is not — RIB ships it, documents it, and blogs about it. The claim must be
restated at the level of *identity semantics and downstream propagation*, or it will be defeated in
the first competitive conversation with a CostX user.

**The single most under-exploited finding:** the RICS standard's **procurement due diligence** and
**written reliability decision** obligations, in force since 9 March 2026, oblige regulated firms to
obtain from vendors evidence that no vendor currently produces. That is a real, dated, checkable
market opening, and it is the strongest support in this document for "trust as the product."
