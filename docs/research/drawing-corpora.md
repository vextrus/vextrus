# Real drawing corpora: what we may legally use, and what we may commit

Research date: 2026-08-13. Investigator: research agent. Not a legal opinion.

**Purpose.** Development to date uses synthetic DXF fixtures
(`cad/tests/fixtures/gen_structural.py`). We want real, high-complexity drawing sets to
harden the extractor. The repo guardrail is absolute: competitor-derived or
client-confidential drawings never enter this repo. This document establishes, per
candidate corpus, whether commercial use is permitted and whether the files may be
*committed* versus only *downloaded to a scratch directory*.

**Two distinct permissions.** Keep them apart:

1. **Commercial use** — may we run the file through our product's test suite as a
   company that sells software? (CC BY-NC forbids this. CC BY, CC BY-SA, public domain
   allow it.)
2. **Redistribution** — may we commit the bytes to a git repo that is (or may become)
   distributed? A file may be lawfully *usable* and still not *committable* (no licence
   at all; NC clause; share-alike that would infect; ambiguous provenance).

The honest default for anything below marked UNVERIFIED is: **download to `.data/` or a
scratch directory, never commit.**

---

## Headline findings

- **There is no openly-licensed, full multi-discipline (arch + struct + MEP) real
  building drawing set in DWG or DXF that is clearly committable.** Not one candidate
  cleared both bars with a licence stated on the publisher's own page. The nearest
  misses are documented below.
- **Wikimedia Commons cannot host DWG or DXF at all.** Verified against the live API:
  the permitted upload extensions are `tiff, tif, png, gif, jpg, jpeg, webp, xcf, pdf,
  mid, ogg, ogv, svg, djvu, stl, oga, flac, opus, wav, webm, mp3, midi, mpg, mpeg`
  ([Commons siteinfo API, `siprop=fileextensions`](https://commons.wikimedia.org/w/api.php?action=query&meta=siteinfo&siprop=fileextensions&format=json)).
  Commons is a source of PDF/SVG drawings only. Rule out as a CAD source.
- **The ML floor-plan datasets that are vector and real are almost all CC BY-NC** —
  unusable for us. The one 2025 exception (ResPlan) is CC BY 4.0 but ships *derived
  polygon geometry in a pickle*, not CAD files, so it exercises nothing in a DXF parser.
- **Bangladesh: nothing usable exists publicly.** e-GP requires verified company
  registration to reach tender documents and asserts "All Rights Reserved"; Bangladesh
  has no §105-equivalent — government works are copyrighted and vest in the Government
  for 60 years. The DWG files circulating on CAD-blocks sites labelled "RAJUK approval
  sheet" have no provenance and are exactly the trap that sank the legacy effort.
- **The most defensible real-drawing sources are US federal**, and they are PDF/raster,
  not vector: HABS/HAER measured drawings (verified "No known restrictions on images
  made by the U.S. Government") and the USACE ERDC Common BIM Files (Clinic redacted
  drawings, Barracks 101 design drawings) — the latter with **no licence statement
  anywhere on the publishing page**, which is a real gap.
- **Even the reference DXF library cannot publish real drawings.** ezdxf's own
  documentation states: *"Data to run the stress and audit test can not be provided,
  because I don't have the rights for publishing these DXF files."*
  ([ezdxf Introduction](https://ezdxf.readthedocs.io/en/stable/introduction.html)).
  That single sentence is the strongest available evidence that our synthetic-fixture
  strategy is the industry-normal one, not a shortcut.

---

## Candidate table

Committable = may the bytes be committed to this repo. "Scratch only" = fetch at test
time into an ignored directory; never `git add`.

| # | Source | Disciplines | Formats | Sheet count | Licence | Commercial OK? | Committable? | URL |
|---|--------|-------------|---------|-------------|---------|----------------|--------------|-----|
| 1 | LibreDWG `test/test-data` (in-tree, GNU/FSF) | none — synthetic parser fixtures | DWG + matching DXF, all versions R11→R2018 | n/a (entity-level files) | **GPL-3.0** (repo-level; no per-directory licence file — probed `test/test-data/{README,COPYING,LICENSE}` → all 404) | Yes (GPL permits commercial use) | **No** — copyleft; do not vendor into a proprietary repo. Scratch only, fetched by hash | [repo](https://github.com/LibreDWG/libredwg) · [sample](https://raw.githubusercontent.com/LibreDWG/libredwg/master/test/test-data/example_2000.dwg) (HTTP 200, 582,572 bytes) |
| 2 | HABS / HAER / HALS, Library of Congress | Architectural + structural measured drawings; site plans, sections, details | TIFF, PDF (raster; **no vector**) | Tens of thousands of sheets across ~40k surveys | **"No known restrictions on images made by the U.S. Government"** — verbatim `rights_advisory` from the LoC item API | Yes | **Yes**, for a small curated subset (raster PDF) | [collection](https://www.loc.gov/collections/historic-american-buildings-landscapes-and-engineering-records/) · [rights](https://www.loc.gov/rr/print/res/114_habs.html) · [example item JSON](https://www.loc.gov/item/tx0037/?fo=json) |
| 3 | USACE ERDC CERL "Common BIM Files" (Clinic, Duplex, Office, Barracks 101) | Arch + struct + MEP; incl. Sparkie (electrical), HVACie, WSie exchanges | PDF drawing sets, RVT, IFC 2x3, COBie XLSX. **No DWG/DXF** | Clinic "redacted design drawings" and Barracks 101 design drawings — full sets, count not stated | **UNVERIFIED — no licence, copyright or terms statement appears anywhere on the publishing page.** Authored "by U.S. ARMY Corps of Engineers, ERDC, CERL", which points at 17 U.S.C. §105, but the page also says the Duplex "was originally created by a student" and the Clinic "is based on a medical and dental clinic building at a location in the South-West United States" — mixed authorship, so §105 cannot be asserted for the whole package | Probably, unverified | **No** until a licence is obtained in writing. Scratch only | [WBDG page](https://www.wbdg.org/bim/cobie/common-bim-files) (JS-rendered; text read via [2023 archive snapshot](https://web.archive.org/web/20231003143403/https://www.wbdg.org/bim/cobie/common-bim-files)) |
| 4 | ELEMENTAL (Aravena) — 4 incremental-housing projects | Architectural: plans, sections, elevations, site plans, details | **DWG** | 4 projects, sheet count not stated | **UNVERIFIED.** Publicly described as "open source"; the firm's own statement quoted by ArchDaily is *"From now on they are public knowledge, an open source…"* — no licence name, no terms page found. elementalchile.cl is now a JS SPA and the 2016 download path 404s | Unknown | **No** | [ArchDaily coverage](https://www.archdaily.com/785023/elemental-releases-plans-of-4-housing-projects-for-open-source-use) · [elementalchile.cl](https://www.elementalchile.cl/) (HTTP 200, SPA) |
| 5 | Stanford University Facilities Design Guidelines | Architectural, Civil, Communications, Electrical, Irrigation, Mechanical, Utilities Interface, Planting, Building Controls | **DWG** + PDF; also a bulk "FDG 2026 – Editable" package (.doc/.xlsx/.dwg) | Hundreds of standard details, MA-/ME-/ML- series | **UNVERIFIED — no licence stated.** Page says only *"Contractors are responsible for customizing drawings so that they apply to individual projects. Stanford Title Blocks should be removed when FDG drawings are used."* Private university → default all-rights-reserved | Unknown; the "remove title blocks" note implies use-in-project is contemplated, not redistribution | **No** | [FDG drawings index](https://mapsandrecords.stanford.edu/facilities-design-guidelines/available-drawings) |
| 6 | US VA Office of Construction & Facilities Management, TIL — Standard Details (PG-18-4) | Standard construction details organised by discipline (all divisions) | ZIP containing **CTB, LIN, DWG**, plus PDF | Large detail library, count not enumerable (JS portal) | **Likely public domain under 17 U.S.C. §105** (federal agency work) but the agency states no licence on the page | Yes, if §105 holds | **Probably yes** for a curated subset — but confirm authorship is VA, not a contracted A/E, before committing | [TIL](https://www.cfm.va.gov/til/) · [PG-18-4 (JS app)](https://vatilms.va.gov/vatilms/reports/PG-18-4) · [VA drawing deliverable rqmts](https://www.cfm.va.gov/til/bim/DwgDelivRqmts.pdf) · [17 U.S.C. §105](https://www.copyright.gov/title17/92chap1.html#105) |
| 7 | State DOT standard plans (Caltrans, MnDOT, TxDOT, MassDOT, NJDOT, MDOT) | Civil/structural (bridges, drainage, barriers) — **no building MEP** | DGN (MicroStation) mostly; DWG at MassDOT | Hundreds of standard plan sheets per state | **UNVERIFIED.** §105 does **not** apply — it covers *federal* works only. State law varies (California in particular asserts rights in software/data under Gov. Code §6254.9) | Unknown per state | **No** without per-state confirmation | [Caltrans 2018 std plans in DGN](https://dot.ca.gov/programs/design/2018-ccs-standard-plans-and-standard-specifications/individual-2018-standard-plans-in-dgn-format) · [TxDOT](https://www.dot.state.tx.us/business/standardplanfiles.htm) · [MnDOT CADD](http://www.dot.state.mn.us/caes/cadd/) · [MassDOT](https://www.mass.gov/how-to/get-the-latest-cad-standards-download-package) |
| 8 | Open Building Institute | Building modules and structures (arch-led, some utilities) | SketchUp-centric library; DXF availability **unverified** | Module library | **CC-BY-SA**, stated on their own licence page: *"All module and structure designs on this website, as well as instructionals, are publicly available under a CC-BY-SA license."* | **Yes** — explicitly *"allow replication, modification, derivatives and sales without requiring royalties"* and *"do not discriminate against fields of endeavor"* | **Yes**, with attribution + share-alike compliance on the files themselves. Note the viral clause: keep them in a clearly-marked, isolated fixture directory | [OBI licence](https://www.openbuildinginstitute.org/license/) |
| 9 | Open Source Ecology | Machine/equipment CAD, not buildings | DXF | n/a | CC BY-SA 4.0 (site-wide) | Yes | Yes, but **irrelevant** — mechanical parts, not building sheets | [OSE CAD](https://www.opensourceecology.org/category/cad/) |
| 10 | WikiHouse (Skylark) | Structural chassis blocks (arch/struct hybrid); **no MEP, no sheets** | **DXF** cutting files, plus IFC/DWG/SKP/3dm models | Per-block files, not a sheeted set | Creative Commons Share-Alike, per their manufacturing guide; described as free to use *"including commercially"* | Yes | Yes with share-alike compliance — but these are CNC cutting files, not construction documents. Low takeoff value | [WikiHouse blocks](https://www.wikihouse.cc/design/wikihouse-blocks) · [manufacturing guide](https://www.wikihouse.cc/guides/manufacturing) |
| 11 | FloorPlanCAD (ICCV 2021) | Architectural floor plans, 15k+ drawings, residential/commercial/school/hospital | **SVG** (vector, CAD-derived) + PNG | >15,000 plans | **CC BY-NC 4.0.** Their page: *"The annotations in this dataset along with this website belong to us and are licensed under a Creative Commons Attribution-NonCommercial 4.0 License."* Note the underlying drawings are **not** licensed at all — users *"comply with copyright terms for the underlying drawings themselves"* | **No** | **No** | [floorplancad.github.io](https://floorplancad.github.io/) |
| 12 | ArchCAD-400k (arXiv 2503.22346, v3 Nov 2025) | Architectural CAD, 5,538 standardised drawings / 413,062 chunks, only 14% residential | Raster + vector | 11,917 industry-standard source drawings | **UNVERIFIED.** The arXiv *paper* is CC BY 4.0; that says nothing about the data. Drawings come from "leading architectural design institutions"; the paper describes anonymisation before release and mentions a "publicly available subset". **No dataset repo found** — GitHub search for `ArchCAD-400k` returns 0 repositories | Unknown | **No** | [arXiv HTML](https://arxiv.org/html/2503.22346v3) |
| 13 | ResPlan (arXiv 2508.14006, Aug 2025) | Residential floor plans — walls, doors, windows, balconies, rooms | Pickle of **polygon geometry + graphs**; not DXF, not SVG, not raster | 17,000 plans | **CC BY 4.0 (data) / MIT (code)** — verified against the repo's own LICENSE file. It carefully scopes the grant to *"the annotations, the semantic taxonomy, the room-connectivity graph construction, the metric-scale conversion, the curation and filtering decisions, and the canonical splits"*, and asserts *"No source images, drawings, listing text, prices, addresses, geolocation, or personally identifying information are contained in this release"* | **Yes** | **Yes** (small; and a `TAKEDOWN.md` policy exists — track it) | [repo](https://github.com/m-agour/ResPlan) · [LICENSE](https://raw.githubusercontent.com/m-agour/ResPlan/main/LICENSE) · [paper](https://arxiv.org/abs/2508.14006) |
| 14 | CubiCasa5K | Residential floor plans, 80+ object categories | Raster + SVG annotations | 5,000 | **CC BY-NC 4.0** — verified from the repo LICENSE | **No** | **No** | [LICENSE](https://raw.githubusercontent.com/CubiCasa/CubiCasa5k/master/LICENSE) |
| 15 | ezdxf | n/a — MIT library, but **no real-drawing corpus published** | n/a | n/a | MIT (code). Test data for stress/audit tests is *withheld for rights reasons* | n/a | n/a | [introduction](https://ezdxf.readthedocs.io/en/stable/introduction.html) · [LICENSE](https://raw.githubusercontent.com/mozman/ezdxf/master/LICENSE) |
| 16 | Open Design Alliance (ODA) | n/a | DWG/DGN SDK + members-only downloads | n/a | Membership agreement only; *"software may only be incorporated into application programs owned by current members"*; fees to $25,000+ | Members only | **No** | [ODA membership FAQ](https://www.opendesign.com/faq/membership) |
| 17 | Bangladesh e-GP (BPPA/IMED) tender packages | Whatever the procuring entity uploads — real BD conventions | PDF, sometimes DWG | n/a | **Closed.** *"Copyright © 2011 Bangladesh Public Procurement Authority (BPPA). All Rights Reserved."* Access requires registration with verified Company Registration Certificate, Tax/VAT clearance, Trade Licence and NID, verified in person or by registered post ("one day to two weeks") | **No open grant** | **No** | [portal](https://www.eprocure.gov.bd/) · [Terms & Conditions](https://www.eprocure.gov.bd/TermsNConditions.jsp) |
| 18 | LGED / PWD / RHD / RAJUK published documents | Specs, road design standards, technical specifications — **not drawing sets** | PDF | n/a | Bangladesh Copyright Act 2000: copyright in a Government work vests in Government and subsists 60 years from publication. **No §105 equivalent, no open licence** | **No** | **No** | [LGED technical specs for buildings (PDF)](https://oldweb.lged.gov.bd/UploadedDocument/UnitPublication/4/12/2005_Technical%20Specifications%20for%20Buildings.pdf) · [LGED road design standard (PDF)](https://oldweb.lged.gov.bd/uploadeddocument/unitpublication/4/1226/Road%20Design%20Standard_LGED.pdf) · [Copyright Act 2000](http://bdlaws.minlaw.gov.bd/upload/act/2021-11-17-10-44-05-32.-The-Copyright-Act-2000.pdf) |
| 19 | Wikimedia Commons | — | **DWG/DXF cannot be uploaded** (verified) | — | n/a | n/a | n/a | [siteinfo API](https://commons.wikimedia.org/w/api.php?action=query&meta=siteinfo&siprop=fileextensions&format=json) |
| 20 | CAD-blocks aggregators (cadbull, dwgmodels, bibliocad, freecadworld, cadblocksfree, dwgdownload, planndesign) | Mixed | DWG | Thousands | **None.** User-uploaded, no provenance, no rights chain. cadblocksfree hosts a "Six Stored Residential Rajuk approval sheet dwg" — a real BD project's approval set, uploaded by an unidentified party | **No** | **No — hard block** | (deliberately not linked as sources) |

---

## Top 5 to actually acquire

Ranked by *(value to the extractor) × (defensibility of the licence)*.

### 1. LibreDWG `test/test-data` — scratch-only, fetched by content hash

This is the only corpus that directly attacks question 4: parser edge cases. It ships
DWG and matching DXF pairs across every version from R11 to R2018, which gives us
differential testing for free (parse the DWG, parse the DXF, assert the entity graphs
agree). The `HACKING` file confirms the workflow the maintainers themselves use —
*"you need DWG/DXF pairs of unknown entities or objects and put them into
test/test-data/"* — so the directory is explicitly a per-entity edge-case zoo, which is
exactly the shape we want for nested blocks, proxy entities, MTEXT and dimension styles.

**But do not commit it.** The repository is GPL-3.0 and there is no separate licence
file scoping the data directory (verified: `README`, `COPYING`, `LICENSE` under
`test/test-data/` all return 404). Whether data files in a GPL repo are "mere
aggregation" is arguable, and we should not be the ones arguing it. Fetch at test time
into `.data/corpora/libredwg/`, pin by SHA-256, `.gitignore` the directory, and make the
CAD test lane skip cleanly when the corpus is absent so `pnpm verify` stays green on a
fresh container.

Reasoning for rank 1: highest signal per byte, zero confidentiality risk (these are
synthetic parser fixtures, not anyone's building), and the only licence question is a
redistribution question we can sidestep entirely by not redistributing.

### 2. HABS/HAER measured drawings — a small curated set, committable

The rights position is the cleanest of anything found: the Library of Congress item API
returns, per item, `rights_advisory: "No known restrictions on images made by the U.S.
Government; images copied from other sources may be restricted."` That is a
publisher-stated position on the item itself, not an inference.

Value: real dimensioned architectural and structural sheets, with title blocks, sheet
indices, imperial feet-inch dimension strings, hand and CAD lettering, and section marks
— the messy typography and annotation conventions our PDF path must survive. Limitation:
**raster only**. Nothing here exercises DXF entity handling. Treat it as a *PDF-lane*
corpus.

Acquisition note: check `rights_advisory` per item via `?fo=json` before taking any
sheet — the advisory itself warns that copied-in material may be restricted.

### 3. ResPlan — committable, but for the register/geometry lane only

CC BY 4.0 with an unusually careful, self-aware licence that separates the authors'
annotation rights from the (uncopyrightable) spatial facts. 17,000 plans with
metric-scale coordinates and typed room-connectivity edges.

Be clear-eyed about what it does and does not test: it will not exercise one line of DXF
parsing. Its use is downstream — checking that our area/perimeter computations and
identity assignment behave over 17,000 real-world room topologies rather than the handful
in `gen_structural.py`. That is genuine value for the Quantity Register invariants, and
it is cheap to acquire and lawful to commit. Honour the `TAKEDOWN.md` policy: record the
release version so removed identifiers can be dropped.

### 4. USACE ERDC Common BIM Files — scratch-only, and open a licence question

The Medical Clinic package ("The model also comes with a set of redacted design
drawings") and Barracks 101 ("As this model includes drawings, it would be very good for
use by students and those conducting initial testing of their software") are the closest
thing found to a real, coordinated, multi-discipline set with drawings *and* a
machine-readable ground truth (IFC + COBie) to check quantities against. The separate
Sparkie/HVACie/WSie exchanges mean electrical, HVAC and water systems are each modelled —
this is the only candidate that covers MEP at all.

The blocker is that **there is no licence statement on the page**, and the provenance is
mixed (student-authored Duplex; a real South-West US clinic behind the Clinic model,
which is why its drawings are *redacted*). We should not assume §105 across a package
whose own publisher describes non-federal authorship for part of it.

Action: email `wbdg@nibs.org` (the contact on the page) and ask for an explicit written
statement of the licence/rights status of the Clinic and Barracks 101 drawing packages.
Until that arrives: scratch only. Also note the download links resolve through
`portal.nibs.org/files/wl/?id=…`; those URLs were readable in the 2023 archive snapshot
but **could not be reached from this container** (connection reset) — verify liveness
before planning around them.

### 5. VA TIL Standard Details (PG-18-4) — the only realistic committable *DWG* source

This is the one place where a US federal agency publishes actual **DWG** files (the VA
CAD standards describe deliverables in "compressed ZIP CAD (CTB, LIN, DWG)"), organised
by discipline, in volume. If they are VA works, 17 U.S.C. §105(a) applies —
*"Copyright protection under this title is not available for any work of the United
States Government"* — and they are public domain and committable.

Two caveats, both material:

- §105 attaches to works *of* the Government, meaning works prepared by federal officers
  and employees within their duties. A detail library drafted by a contracted A/E firm
  and delivered to the VA is not automatically a §105 work; the VA may hold only a
  licence. Confirm authorship before committing.
- The current PG-18-4 index is a JavaScript application (`vatilms.va.gov`) that did not
  render server-side here, so the actual file inventory and download URLs were not
  enumerated. Someone with a browser needs to pull the index and record the ZIP URLs.

Value if it clears: standard details are dense with exactly the constructs that break
extractors — hatch patterns, dimension styles, leaders, nested blocks, layer conventions
— in real, professionally-drafted DWG, and they carry no client confidentiality at all
because they depict no specific building.

**Not in the top 5, but take it if it is cheap:** Open Building Institute (#8) is the
only source with an unambiguous, publisher-stated, commercially-permissive, committable
licence for building designs. It is ranked out only because the format is
SketchUp-centric and DXF availability is unverified. Ten minutes checking whether their
library actually emits DXF would settle it.

---

## Rejected, and why

**Anything with a `-NC` clause.** FloorPlanCAD and CubiCasa5K are the two most-cited
vector/annotated floor-plan datasets in the literature and both are CC BY-NC 4.0. We are
a commercial product; running them in our test corpus is precisely what NC forbids. No
amount of "it's only for testing" changes that. FloorPlanCAD additionally warns that the
NC grant covers only *their annotations* — the underlying drawings carry no licence at
all, so even a non-commercial user is on their own.

**CAD-blocks aggregator sites.** cadbull, dwgmodels, bibliocad, freecadworld,
cadblocksfree, dwgdownload, planndesign, freecads, dwgshare. These are the single largest
apparent source of "free" real DWG building sets and every one of them is a rights
vacuum: user-uploaded, no provenance, no takedown discipline, no rights chain. The
concrete example found in this research is decisive — cadblocksfree hosts a file
described as a "Six Stored Residential Rajuk approval sheet dwg" in AutoCAD 2007 format.
That is a real Dhaka project's statutory approval set, uploaded by an unidentified party,
almost certainly without the architect's or owner's consent. Downloading it would
reproduce the exact failure mode the legacy effort suffered, with the added twist that we
would not even know whose building it was. **Hard block. Do not download, do not
evaluate, do not link.**

**Wikimedia Commons and archive.org as CAD sources.** Commons is ruled out on a verified
technical fact: DWG and DXF are not in the permitted upload extension list, so no CAD
file has ever been hosted there. It remains viable for PD architectural *PDFs*.
archive.org was not separately investigated to a citable standard; it is a host, not a
publisher, and its per-item rights vary item by item, so it would need the same per-item
rights check as HABS with none of HABS's uniformity. Not recommended as a systematic
source.

**Open Design Alliance.** Members-only distribution under a signed Membership Agreement,
with the SDK licensed only for incorporation into member-owned applications, and fees
reported into the $25,000+ range for corporate use. There is no public sample corpus.
Rejected on access, not on licence.

**Bangladesh e-GP, PWD, LGED, RHD, RAJUK, BUET.** This is the section where the honest
answer is the useful one: **nothing usable exists publicly.**

- e-GP holds the actual tender drawing packages, but reaching them requires an account
  created only after physical or postal verification of Company Registration Certificate,
  Tax and VAT clearance, Trade Licence and the contact person's National ID — a process
  the portal itself says "may take one day to two weeks". The site footer asserts
  "Copyright © 2011 Bangladesh Public Procurement Authority (BPPA). All Rights Reserved."
  There is no open-data grant, no re-use licence, and the Terms and Conditions are a user
  agreement about account conduct, not a content licence.
- LGED and PWD publish *specifications and design standards* as PDFs (Technical
  Specifications for Buildings, Road Design Standard) — not drawing sets.
- No published RAJUK, BUET or RHD drawing set was found.
- **There is no §105 equivalent.** Under the Copyright Act 2000, copyright in a
  Government work vests in the Government and subsists for 60 years from the year
  following publication. Bangladeshi government drawings are therefore copyrighted, not
  public domain, and nothing found grants a re-use licence.

Consequence for the extractor: **the BD-specific conventions we must handle — imperial
dimension strings on metric sheets, `%%C` diameter escapes, feet-inch notation, Bangla
text in title blocks and notes — cannot be sourced from a public corpus.** They must be
encoded in synthetic fixtures. This is not a workaround; given the above it is the only
lawful path. Extend `gen_structural.py` with a BD-convention profile and treat the
convention rules themselves (not example files) as the thing to get right, sourced from
`docs/domain/`.

**State DOT standard plans.** Not rejected outright, but deprioritised: they are civil
and bridge work with no building MEP, mostly in DGN rather than DXF/DWG, and — the
common misconception worth naming — **17 U.S.C. §105 does not cover them**. §105 reaches
works of the *United States* Government. State works are governed by state law, which
varies and in California specifically is restrictive. Each state would need its own
verification for marginal corpus value.

**Synthetic-CAD generation research as a substitute.** Searched and found not applicable.
The 2020–2026 synthetic CAD literature (Fusion 360 Gallery, Sketch2CAD, Drawing2CAD,
Zero-to-CAD, CADFS) is about *parametric mechanical* CAD — sketch-and-extrude command
sequences for machined parts. None of it generates architectural or structural
construction *sheets* with title blocks, dimension strings, schedules and annotation.
There is no off-the-shelf generator to adopt. `gen_structural.py` remains the right tool
and should be invested in rather than replaced.

---

## The confidentiality question (Q6)

What could be verified:

- **The reference implementation cannot publish its own real test data.** ezdxf, the
  most widely used DXF library, states in its published documentation: *"Data to run the
  stress and audit test can not be provided, because I don't have the rights for
  publishing these DXF files."* The maintainer evidently *has* real DXF files, uses them
  for stress and audit testing, and cannot redistribute them. That is the industry
  pattern in one sentence: **private corpus, public synthetic fixtures.**
- **The federal example of the same pattern**: the USACE Clinic model's drawings are
  distributed as *"a set of redacted design drawings"*. Even a government-sponsored
  reference dataset built from a real building had to be redacted before public release.
- **Datasets built from real drawings adopt takedown regimes rather than claiming clean
  rights.** ResPlan ships a `TAKEDOWN.md` and commits to acknowledging removal requests
  within 7 days; ArchCAD-400k describes *"strict data anonymization before training or
  release, including removal of identifiable text"*. Neither claims the source drawings
  were licensed to them.

What could **not** be verified, and should not be asserted: no primary source was found
documenting the specific NDA terms under which takeoff SaaS vendors obtain customer
drawings for testing. Searches for Togal, STACK and Bluebeam terms-of-service language on
customer-drawing use and model training returned only marketing and comparison content.
**UNVERIFIED** — if this matters commercially, read the vendors' actual DPAs and terms
directly rather than relying on search summaries.

Defensible reading for vextrus, stated as an assumption: the normal practice is a private
corpus obtained under NDA from design partners, kept entirely outside version control,
paired with a public synthetic fixture suite that encodes the conventions rather than the
buildings. Our current position — synthetic fixtures in `cad/tests/fixtures/` — is already
the public half of that pattern and is correct. The gap to close is the private half, and
the safe way to close it is a written drawing-sharing agreement with a design partner
plus a scratch-only, gitignored corpus directory, **not** by acquiring drawings whose
provenance we cannot state.

---

## Recommended posture

1. Add `.data/corpora/` to `.gitignore` (if not already covered) and build a corpus
   fetcher that pins each artefact by SHA-256 and records source URL + licence + fetch
   date in a manifest that *is* committed. The manifest is the audit trail; the bytes are
   not.
2. Commit only: HABS PDFs (curated, per-item rights checked), ResPlan, and — once
   authorship is confirmed — VA PG-18-4 DWG details. Everything else is scratch.
3. Make the CAD test lane skip cleanly when a scratch corpus is absent, so `pnpm verify`
   is green on a fresh container. The exit code is the contract; it must not depend on
   files that cannot be committed.
4. Send two emails: `wbdg@nibs.org` for the Common BIM Files licence status, and the VA
   TIL contact for PG-18-4 authorship. Both are cheap and both unblock a top-5 candidate.
5. Extend `gen_structural.py` with a Bangladesh convention profile. Given the findings in
   Q3, synthetic is not a fallback here — it is the only lawful source for BD drawing
   conventions.

## Verification notes

- Claims are cited to the page that states them. Where a page is JavaScript-rendered and
  could not be read server-side (WBDG, VA TILMS, elementalchile.cl, freefarmhouse.com),
  this is stated inline and the substitute source is named.
- Every "UNVERIFIED" in this document means: no licence statement was found on the
  publisher's own page. It does not mean the corpus is unusable — it means someone must
  obtain the statement before we rely on it.
- Not verified from this container: `portal.nibs.org` download links (connection reset),
  Wikimedia Commons MIME search (disabled in miser mode — the extension list was used
  instead), data.gov package API (returned no results for the VA TIL dataset), the
  Savannah cgit `test-data` repository referenced by the LibreDWG wiki (cgit reported
  "No repositories found"; the test data was instead located in-tree at
  `test/test-data/` in the GitHub mirror and confirmed by fetching a file).
