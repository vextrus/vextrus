# Context — what the code cannot tell you

Read this when working on anything user-facing, commercial, or domain-specific. Only what is
**not derivable from the codebase** lives here.

## Commercial truth

- **No paying customer.** Pre-first-customer, pre-revenue. No asset may claim a live customer.
- **"Edison" is a competitor, never a client.** One pitch meeting; they build in-house via a
  sister concern. Their drawings/workbook are internal benchmark data in the *legacy* repo only
  — they never enter this repo, never appear in demos or marketing.
- **The beachhead:** Tier-2/3 Bangladesh construction and real-estate firms running no software
  at all (Excel + WhatsApp + a trusted accountant). Greenfield adoption is the wedge. B2C:
  small builders and homeowners wanting a priced, honest estimate from a drawing.
- **The B2B bidding hook:** e-GP auto-eliminates bids >10% above the SoR-derived Official Cost
  Estimate (PPR 2025) and auto-eliminates significantly-low bids by formula. Reconstructing the
  OCE and pricing into the band is the bid module's anchor feature.
- **Language discipline:** never claim BIM (say *model-derived*), never open with a module or
  agent count, be specific ("we reconcile 470 m³ of unexplained concrete", not "we improve
  efficiency"). Practitioner vocabulary — BOQ, BBS, IPC, retention — used correctly.
- **Pricing posture:** on projects and value, never per seat. Global AI-takeoff envelope is
  $175–299/user/mo; Bangladesh is a learning market priced locally.

## The governing sentence

**A partial faulty estimate is more harmful than no estimate.** Corollaries: measure less,
completely, and say so; over-measurement is the same defect class as under-measurement and
harder to spot, so it hard-blocks. Silence is the only condemned state — refusals and
deferrals always carry a named reason.

## Domain glossary

| Term | Meaning |
|---|---|
| **Takeoff** | Reading a 2D CAD drawing to extract quantities of physical work. |
| **Quantity Register** | System of record for physical scope; every figure traces to a row here. |
| **BOQ** | Bill of Quantities — priced, structured list of work items; *generated*, never typed. |
| **BBS** | Bar Bending Schedule — rebar cutting/bending list derived from detailing rules. |
| **SoR** | Schedule of Rates — PWD/LGED/RHD government rate books; the BD pricing authority. |
| **OCE** | Official Cost Estimate — the procuring entity's SoR-derived estimate on e-GP. |
| **e-GP** | The national e-procurement portal (BPPA); ~143K registered tenderers. |
| **Rate analysis** | Per-item cost build-up: materials + labour + equipment + overhead + profit. |
| **QS** | Quantity Surveyor. **IPC/RA bill** — interim payment certificate (out of scope, vocabulary only). |
| **Mouza / katha / bigha** | Revenue village; BD land-area units. Floor area is sft. |
| **RAJUK / CDA** | Dhaka / Chattogram development authorities. **NBR** — tax authority. **BNBC** — building code. |
| **VAT / VDS / TDS / AIT** | Output VAT · VAT deducted at source · tax deducted at source · advance income tax. |

## Bangladesh rules

- **Fiscal year 1 July – 30 June.** Display dates `DD MMM YYYY`. Build date strings from local
  parts — `toISOString()` renders yesterday for a Dhaka morning.
- **Currency BDT, lakh/crore grouping** (`1,00,000` / `1,00,00,000`), quantities too — Indian
  grouping is a property of the document. Compact `L`/`Cr` never on a document.
- **SI storage is statute** (Weights & Measures Act 2018 §68): the register is SI-singular,
  full precision; imperial only as an input read off a sheet, retained as provenance. §30:
  brochure area is legally binding on as-built (sales-side exposure, not ours yet).
- **Tax rates are config, never constants.** FY2025-26 sanity values only: standard VAT 15%,
  construction services (S004) 10%, resident contractor TDS 5% flat (7.5% is *non-resident* —
  never apply to a resident). Material VAT is often fixed-taka-per-unit, not a percentage.
- **Zone letters are per-book**: PWD zone C = Khulna/Barisal/Gopalgonj; LGED zone C =
  Rajshahi/Rangpur. Never share a zone mapping across books.
- **Bangladesh has no national method of measurement** — the item description *is* the method
  of measurement; deduction thresholds are imported IS 1200 (Indian) convention, labeled so,
  per-project config.
- **Validation:** TIN 12 digits, BIN 9–13, phone `01[3-9]XXXXXXXX`. No public NBR checksum
  exists — do not invent one.
- **Bangla:** every client-facing string ships en+bn; a native reviewer reads Bengali strings
  before first client issue.

## Workflow vocabulary

- **Wayfinder** — work larger than a session lives at `.wayfinder/<effort>/MAP.md` + tickets;
  the frontier (open, unclaimed, blockers closed) is the scheduler. See `.wayfinder/TRACKER.md`.
- A ticket resolution states the ruling, the measurement that forced it, and the alternative
  that was put and rejected. Decisions accrete on the map, one line each.
