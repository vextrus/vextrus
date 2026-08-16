# Bangladesh measurement & pricing authority

Re-derived 2026-08-12 from primary-sourced legacy research plus fresh 2026 web research.
Statute and book structure — the facts that must be data, and the few that are law.

## 1. There is no Bangladeshi method of measurement

No national SMM exists — not NRM, not SMM7, not IS 1200, not CESMM. Operative precedence:
(1) the contract; (2) BPPA standard tender document BOQ notes; (3) the procuring agency's SoR
item descriptions, which carry measurement conventions inline; (4) the Engineer's
determination. **Design consequence: the item description is the method of measurement — bind
every quantity to the description that produced it.** Opening-deduction thresholds are
**Indian (IS 1200) convention: customary, imported, unratified** — per-project config, never
labeled Bangladeshi.

## 2. Net from drawings

BPPA e-PW2B: quantities are computed **net from the drawings** — no allowance for bulking,
shrinkage, or waste. Payment is actual measured quantities, joint measurement binding under
the GCC. This is why a rebar lap is bar-in-place, not waste (§5).

## 3. Units are statute

Standards of Weights and Measures Act 2018 (it **repealed** the 1982 Ordinance everyone still
cites): §4(1) SI is the standard; §67 bars non-standard units on any price document; **§68(1)
bars them in any contract or document; §68(2) bars keeping any written measurement record in a
non-standard unit.** Store and compute SI; imperial is legal **only as an input read off a
sheet**, retained as provenance; no dual display on a quantity. **§30: a builder must build to
the measurement declared in a schedule or brochure** — brochure area is legally binding on
as-built (a sales-side exposure recorded here so it is not lost).

The market reality is dual-system: government documents are metric; the private market prices
in sft/cft/rft; land uses katha/bigha/decimal. Documents own presentation; the register never
does.

## 4. The Schedules of Rates (the rate-book model)

- **PWD SoR** is the master schedule: 33 chapters + annexures, dotted item codes
  (`07 → 07.12 → 07.12.7`), front-matter with labour/material/carriage rates and a district
  distance matrix. **Every rate is quoted in four zone columns**; a rate without a zone is not
  a PWD rate. **"SoR 2022" denotes three distinct rate sets** (2022 · Revised eff. 2023-02-23 ·
  2nd Revised eff. 2026-01) — a stored rate must carry **edition + effective date** or the BOQ
  cannot be reproduced. Rates are **VAT-inclusive as printed**, and the embedded VAT moved
  7.5% → 10% between editions: an edition mismatch is a pricing error.
- **Zone letters are per-book**: PWD C = Khulna/Barisal/Gopalgonj; LGED C = Rajshahi/Rangpur;
  RHD has five zones. Zone→district mapping is per-schedule config.
- **LGED SoR** excludes PWD-common items and cross-references them — a book may cite another
  book. The books also disagree substantively (PWD prices dewatering per hour; LGED absorbs it
  in one item and bands it on foundation depth in another) — **scope rulings are book-scoped,
  never absolute**.
- **Added-rate items modify a base item and bill as separate lines**, never a computed
  composite: extra height per metre, extra floor, extra excavation depth per 0.5 m band,
  Ch. 33 inaccessible-area uplifts (5/10/15% by upazila, multiplying the whole book).
- A **chapter reference is (book, chapter), never a bare code** — `03` is RCC on one axis and
  brick soling on PWD's. No fallback names ("Chapter 03" is a guess wearing a label).
- **A leaf-only sweep of the ingest is not a sweep of the book** — headings and rate-tables
  hide items (legacy: PWD `02.2` classed as heading; Ch. 33 is a table with zero leaves).
- **A unified national "Bangladesh Schedule of Rates" is imminent** (Planning Ministry,
  ECNEC ~Aug 2026): market-oriented, more frequently updated. The schedule registry treats it
  as one more dataset — zero code.

### What a PWD base item includes (quantity-bearing, mandatory)

- **RCC (07.1–07.11): measured on gross concrete section** — no deduction for reinforcement.
  Rebar is a separate chapter; formwork is a separate item even where the concrete description
  narrates shuttering.
- **Formwork: sqm of contact area, priced by structural member** (12 sub-items by member type,
  height bands above 4 m, arches by number of reuses). A single "formwork m²" total is **not a
  PWD-billable quantity**.
- **Brickwork: nominal declared thickness** (250 mm one-brick, 375 mm one-and-a-half),
  measured in cum, regardless of laid thickness.
- **Excavation: cum banded by depth (per 0.5 m over 1.5 m) and lead (per 1 m over 10 m)** —
  one physical object, several bill lines, all inheriting. Dewatering per hour.
- **Plaster: sqm** by thickness, mix, face, and floor.

## 5. Rebar law

- **Payment is on nominal mass, never weighed mass** — the billable kg is length × the
  standard kg/m table (`d²/162` with a verified lookup). Never a supplier's weighbridge.
- **Laps are billable**: PWD prices rebar "(excluding splices or laps)" with no absorption
  clause; net-from-drawings makes a detailed lap bar-in-place. Lap length must be a
  **first-class, separately attributable component** of the register row (net-of-laps and
  gross-of-laps both showable). Mechanical couplers and welded splices are **separate BOQ
  items** with their own units and testing obligations — a takeoff emitting only kilograms
  cannot produce a compliant PWD bill for a coupler job.
- **BNBC 2020 determines lap length; PWD determines payability.** BNBC Part 6 Ch. 8: tension
  lap Class A `1.0 ℓd` / Class B `1.3 ℓd`, floor 300 mm, **Class B default** (A only when
  As,prov/As,req ≥ 2 and ≤50% spliced within the lap); **≥36 mm bars cannot be lap-spliced**;
  mixed-diameter laps take the larger of ℓd(larger) and lap(smaller); a drawing's own general
  note (e.g. `50d`) overrides the computed table **verbatim**, and the applied note re-versions
  the rule set. Values live in `formulas.md`.

## 6. Tax shape (config, never constants)

Every rate below changes by Finance Act/Ordinance and mid-year SRO — model as effective-dated
(code, category, payee-type, fiscal-year) tables. FY2025-26 headline values for seed sanity
only: standard VAT 15%; construction services (S004) **10%**; procurement provider (S037)
7.5%; land developer VAT 3%; flat sale 2%/4.5% by size. **Material VAT is often specific
(fixed taka per unit)** — bricks per thousand, MS products per MT — so the tax engine supports
both percentage and per-unit modes. AIT/TDS §89 civil works **5%** (changed twice in three
years); resident vs non-resident rates differ — never apply a non-resident rate to a resident.
Construction VAT period is semiannual. TIN 12 digits, BIN 9–13, phone `01[3-9]XXXXXXXX`, no
public NBR checksum.

## 7. e-GP bidding mechanics (the bid module's ground)

- PPR 2025 (eff. 2025-09-28) makes e-GP mandatory for all public procurement. ~143K registered
  tenderers; ~14K procuring entities.
- A works bid = submission letter + capacity forms + **priced BOQ keyed into the portal** +
  tender security (1–3%) + registration documents. Missing priced BOQ = automatic rejection.
  Bidders do **not** submit rate analyses under national STDs — rate analysis is the procuring
  entity's side, which builds an approved **Official Cost Estimate (OCE)** from the SoRs.
- **Two automated price gates:** bids **>10% above the OCE are auto-eliminated**; significantly
  low tenders are auto-eliminated by the Schedule-18 formula. The winning zone is a band around
  the SoR-derived OCE — **reconstructing the OCE and pricing into the band is the product's
  B2B anchor.**
- Tender BOQ shape: Item No / Item Code / Description / Unit / Quantity / Unit Price (figures
  and words) / Total; all taxes included in unit rates; BDT only; provisional sums and daywork
  excluded from comparison; unpriced items deemed covered.

## 8. SoR digitisation (the pipeline's law)

- extract (tables-first, LLM assist only where table extraction found nothing) → QA sheet with
  plausibility bands → **build refuses any row still carrying a flag** → load. **Human QA gate
  mandatory**: 100% of flags reviewed, ≥10% spot-check per chapter; **no LLM output reaches
  the database unreviewed.** Cell-wrap normalization at extraction (embedded newlines must not
  survive into line-based processing). A fictional two-page fixture chapter proves the chain
  end-to-end, including that flagged rows block the build.
- Loading is **additive and id-preserving — never a wipe** (a wipe orphans every line
  selection). New books load **inactive**; activation is an attributed human act, never a
  loader side effect. Zone rates store the **published figure verbatim** (VAT-inclusive as
  printed); derivations (pre-VAT, direct) are computed on read, never stored as history.
  Source PDF hash + page citations ride with the dataset. Parse failures are listed, never
  fabricated, never dropped.
- Three-state item provenance: `SOURCED` · `NO_SOR_EQUIVALENT` (final, with reason) ·
  `NOT_YET_SOURCED` (admission of work) — a single NULL collapses two different claims.
- A market-sourced rate stores its quoted figure and unit as **write-once provenance** —
  imperial is a fact about a source document, never about our data.

## 9. BOQ presentation taxonomy

Six bills — Substructure · Superstructure · Finishes · Electrical · Plumbing · External — as
**swappable data** (en+bn names), resolved most-specific-first: element-type override (a
structural item is Substructure off a foundation member, Superstructure off a column — only
when all of a row's element types agree) → division/group → division → `UNCLASSIFIED`, kept,
labelled, reason stated, never dropped. The resolver records which row decided; the taxonomy
version stamps every document. No project-name conditionals, ever.

## 10. Amendments — 2026-08-16 (second founding, verified against the primary documents)

**§4, the PWD zone columns — confirmed, with a precision.** Every rate table in PWD SoR 2022
(2nd Revised, eff. 22 Jan 2026) and 2022 Revised (eff. 23 Feb 2023) carries four rate columns
labelled by district group — `[Dhaka, Mymensingh] [Chattogram, Sylhet] [Khulna, Barisal,
Gopalgonj] [Rajshahi, Rangpur]` — on all 319 rate pages; the letters `Zone-A…D` print only in
the original 2022 edition. So: **the zone letter is a per-book label the later editions do not
print**; the schema stores the column by its district-group key and treats the letter as a
display alias per edition, and a search for "Zone" in the PDF is not evidence of anything. No
front matter assigns the 64 districts to a column (the headers name nine): the district→column
map is per-book config with no published authority and must be an authored, cited dataset row,
never inferred. Ch. 33 inaccessible-area Categories A/B/C (5/10/15%) are a separate lettering.
The 2018 edition is no longer served by PWD and its column shape is unverified.

**§7, the e-GP price gates — confirmed, with the formula.** PPR 2025 (SRO 388-Law/2025, Bangladesh
Gazette extraordinary 28 Sep 2025), Schedule 18 under Rule 118(25)–(26): ¶7 — a tender more
than **10% above the official estimate is not considered and is non-responsive** at preliminary
evaluation (the worked example rejects +12.2% and passes +2.86%); the low side is the
**significantly-low formula** `x̄ = 0.5·mean(responsive bids) + 0.2·OCE + 0.3·NPPI`, NPPI being
the e-GP national price index over a 28-day window, with floor `x̄ − Sd` — below it, rejected.
Scope (¶9): domestic procurement; not international, not outsourced physical services (classic
abnormally-low test). LTM keeps ±5% (e-PW2B ITT 23.2/23.3/39.4); a 20% single-tender rule (¶8).
BPPA's Oct/Nov 2025 works STDs (e-PW2A/e-PW3) do not print the +10% ceiling — rules and tender
documents are out of step; the rules govern. Consequence for the bid module: the winning zone is
bracketed by a **hard ceiling** at 1.10 × OCE and a **soft floor** at `x̄ − Sd` that depends on
rival bids and e-GP market history — the OCE reconstruction stays the anchor, and the threshold
model needs an NPPI source. Press coverage of the *draft* ("removal of the ±10% limit") described
the low side only; it is not the gazetted rule.
