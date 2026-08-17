# Context — what the code cannot tell you

Read this when working on anything user-facing, commercial, or domain-specific. Only what is
**not derivable from the codebase** lives here. The domain law is `docs/domain/`; the founding
spec is `docs/specs/genesis-ii.md`; the market is `docs/research/market-2026-08.md`.

## Commercial truth

- **No paying customer.** Pre-first-customer, pre-revenue. No asset may claim a live customer.
- **"Edison" is a competitor, never a client.** One pitch meeting; they build in-house via a
  sister concern. Their drawings and workbook were benchmark data in the *legacy* repo only —
  they never enter this repo, never appear in demos or marketing.
- **The beachhead:** Tier-2/3 Bangladesh construction and real-estate firms running no software
  at all (Excel + WhatsApp + a trusted accountant). Greenfield adoption is the wedge. B2C: small
  builders and homeowners wanting a priced, honest estimate from a drawing.
- **The B2B bidding hook:** under PPR 2025 (effective 28 Sep 2025) a domestic works bid more
  than 10% above the SoR-derived Official Cost Estimate is non-responsive, and a bid below the
  Schedule-18 threshold (weighted over rival bids, the OCE and e-GP market history) is
  significantly low (`docs/domain/bd-authority.md` §7, §10). Reconstructing the OCE and pricing
  into that bracket is the bid module's anchor feature. e-GP itself offers bidders no pricing aid.
- **Language discipline:** never claim BIM (say *model-derived*), never open with a module or
  agent count, be specific ("we reconcile 470 m³ of unexplained concrete", not "we improve
  efficiency"). Practitioner vocabulary — BOQ, BBS, IPC, retention — used correctly.
- **Pricing posture:** on projects and value, never per seat. The global AI-takeoff envelope is
  roughly $175–299/user/month; Bangladesh is a learning market priced locally.

## The governing sentence

**A partial faulty estimate is more harmful than no estimate.** Corollaries: measure less,
completely, and say so; over-measurement is the same defect class as under-measurement and
harder to spot, so it hard-blocks. Silence is the only condemned state — refusals and deferrals
always carry a named reason. AI proposes; code resolves; a human disposes.

## Domain glossary

| Term | Meaning |
|---|---|
| **Takeoff** | Reading a 2D drawing to extract quantities of physical work. |
| **Quantity Register** | System of record for physical scope; every figure traces to a row here. |
| **Campaign** | One measurement effort against a pinned drawing-set revision, producing at most one issued bill. |
| **Basis** | Where a number came from: `MEASURED · TRANSCRIBED · DERIVED · IMPORTED · ENTERED · INTERPRETED · DEFAULTED`. |
| **Coverage** | What fraction of the scope a line claims: `COMPLETE` or `PARTIAL_DECLARED`; never undeclared. |
| **Storey height** | Floor-to-floor, in metres, authored per level as a set of readings; *clear height* is a different fact and never a level's. |
| **Certificate of Measured Coverage** | The bill's boundary statement — a query over catalogue × scope register, bound into the bill PDF. |
| **Quantity kind** | What trade of work a quantity is — trade and material only, never a class, dimension, pricing role or book code. |
| **Work-item catalogue** | The rate-free, code-derived enumeration of kinds; the certificate's coverage denominator. |
| **`bears`** | Which kinds an element class lawfully carries — the kind axis held outside the identity key. |
| **Borne cell** | A `(class × kind)` cell whose class ingestion sighted; the residue's denominator. |
| **Quantity-bearing cell** | A borne cell that published a line; the dip sample's stratum. Borne minus quantity-bearing is the residue. |
| **Act** | A human write that changes what the machine would derive; the act log is append-only and human-only. |
| **Act rendering** | What a surface must put on screen for an act to be lawful rather than ceremonial: the consequence shown, the subject set named, every refusal it can return rendered. |
| **Consequence** | The typed statement of what an act will do, computed by the code that commits it and digested; a commit not carrying the current digest refuses. |
| **Offered group** | A subject set the machine assembles from the fact being judged; a bulk act takes one, and no interface offers a freeform selection. |
| **Render manifest** | The per-view payload a viewer paints without resolving anything: colour already resolved, text at world height, every source key resolving to exactly one entity. |
| **Directed review queue** | The suspect inputs a signature requires checked in full (*Part A*); one query, one row per `(subject, disjunct)`, never deferrable. |
| **Disposition** | The act by which a QS clears a directed-review-queue row — outcome `NO_EXCEPTION` or `EXCEPTION_TAKEN`; never over a row its own act created. |
| **Proposal** | What a model may return: a payload plus resolvable source keys; never a conclusion or a quantity. |
| **Source key** | `scheme:key` citing one original drawing entity (`DXF_HANDLE`, `PDF_OBJECT`, `RASTER_TRACE`). |
| **Document convention** | The named record fixing grouping, digit set, currency placement and date form for one market; every deviation from CLDR stated beside its reason. |
| **Document formatter** | The spine's sole renderer of a number, date or unit into a human-readable string, and the tree's only caller of `Intl`. |
| **Scale group** | The views one affirmation act names as sharing a scale; not an object of its own. |
| **Affirmation** | The act by which a QS establishes a scale over a group; membership is positive, never residual. |
| **Calibration** | The factor pair taking a view's drawing units to SI metres; X and Y independent, averaged as nothing. |
| **BOQ** | Bill of Quantities — priced, structured list of work items; *generated*, never typed. |
| **BBS** | Bar Bending Schedule — rebar cutting/bending list derived from detailing rules. |
| **SoR** | Schedule of Rates — PWD/LGED/RHD government rate books; the Bangladesh pricing authority. |
| **OCE** | Official Cost Estimate — the procuring entity's SoR-derived estimate on e-GP. |
| **e-GP** | The national e-procurement portal (BPPA); ~143K registered tenderers. |
| **Rate analysis** | Per-item cost build-up: materials + labour + equipment + overhead + profit. |
| **QS** | Quantity Surveyor. **IPC / RA bill** — interim payment certificate (out of scope, vocabulary only). |
| **Mouza / katha / bigha** | Revenue village; BD land-area units. Floor area is sft in the market, m² in the register. |
| **RAJUK / CDA** | Dhaka / Chattogram development authorities. **NBR** tax authority. **BNBC** building code. |
| **VAT / VDS / TDS / AIT** | Output VAT · VAT deducted at source · tax deducted at source · advance income tax. |

## Bangladesh rules

- **Fiscal year 1 July – 30 June.** Display dates `DD MMM YYYY`. Build date strings from local
  parts — `toISOString()` renders yesterday for a Dhaka morning.
- **Currency BDT, lakh/crore grouping** (`1,00,000` / `1,00,00,000`), quantities too — Indian
  grouping is a property of the document. Compact `L`/`Cr` never on a document.
- **SI storage is statute** (Weights & Measures Act 2018 §68): the register is SI-singular, full
  precision; imperial only as an input read off a sheet, retained as provenance. §30: brochure
  area is legally binding on as-built (a sales-side exposure, not ours yet).
- **Tax rates are config, never constants.** FY2025-26 sanity values only: standard VAT 15%,
  construction services (S004) 10%, resident contractor TDS 5% (never apply a non-resident rate
  to a resident). Material VAT is often fixed-taka-per-unit, not a percentage.
- **Zone columns are per-book and their letters are per-edition**: PWD SoR 2022 quotes four
  district-group columns (Dhaka/Mymensingh · Chattogram/Sylhet · Khulna/Barisal/Gopalgonj ·
  Rajshahi/Rangpur), lettered A–D only in the original edition; LGED SoR-2022 letters C and D the
  other way round. Never share a zone mapping across books; the district→column map is an
  authored dataset row (`bd-authority.md` §10).
- **Bangladesh has no national method of measurement** — the item description *is* the method
  of measurement; deduction thresholds are imported IS 1200 (Indian) convention, labelled so,
  per-project config.
- **A unified national "Bangladesh Schedule of Rates"** is being drafted (Planning Commission,
  ECNEC decision 13 May 2026; committee met 22 Jun 2026; nothing published as of 16 Aug 2026).
  It is one more dataset when it lands — zero code.
- **Validation:** TIN 12 digits, BIN 9–13, phone `01[3-9]XXXXXXXX`. No public NBR checksum
  exists — do not invent one.
- **Bangla:** every client-facing string ships en+bn; a native reviewer reads Bengali strings
  before first client issue.

## Professional standard that binds the signature

RICS *Responsible use of artificial intelligence in surveying practice* (Professional Standard,
1st ed., effective 9 March 2026): a written reliability decision by a **named** surveyor;
randomised **dip samples** of automated output (§4.2, in the standard text); written client
disclosure of AI use in advance; a written refusal with reasons where an output cannot be used.
The estimate module's signature, dip sample and certificate are shaped to discharge it.
