# DWG and PDF ingestion — licensing, cost, and capability

**Researched:** 2026-08-13 · **Status:** research, not a decision. ADR-0001 and
`docs/domain/cad-ingestion.md` §1 remain in force until superseded by a new ADR.

**Question put:** clients ship DWG and PDF, not DXF. Re-examine the ruling that LibreDWG
`dwg2dxf` is the production DWG lane and ODA File Converter is dev-only — and establish whether
ODA can be licensed for production, at what cost.

## How this was verified

Every claim below carries a URL. Primary sources were fetched directly where reachable:
vendor legal/pricing pages, licence texts in the projects' own repositories, the PDFium public
C headers, and Autodesk's investor-relations press release. Prices are quoted verbatim from the
vendor's own published page and are dated.

**Two environment caveats, stated so the evidence can be weighed:**

1. `gnu.org` is unreachable from this container (HTTP 503 / connection reset through the agent
   proxy, retried four times, including the Savannah `www.git` mirror, which is empty). The FSF
   GPL FAQ passages in §2 are therefore quoted from the search index of the primary page rather
   than fetched from it. The quotes are short and the anchors are named; **re-read them at
   `gnu.org` before they are relied on in a contract.** Marked `[FAQ-INDEX]` where this applies.
2. `github.com` HTML and the GitHub API are gated for out-of-scope repositories in this session;
   `raw.githubusercontent.com` is not. So licence texts, READMEs, `NEWS`, `TODO` and headers are
   **directly verified**, while GitHub *issue* bodies in §2 could not be opened and are marked
   `[ISSUE-UNOPENED]`.

Nothing here is legal advice. Clause readings are flagged where a lawyer should confirm.

---

## 1. ODA (Open Design Alliance) — can it be licensed for production?

**Yes. This is the headline finding: the ban on ODA in production is a licensing choice, not a
licensing necessity, and the tier that lifts it is cheap.**

ODA publishes its membership levels and fees openly. From ODA's own comparison table
(https://www.opendesign.com/oda-membership, fetched 2026-08-13), corroborated line-for-line by
the pricing/calculator page (https://www.opendesign.com/pricing):

| Level | Redistribution rights | Developer seats | **Web/SaaS use** | Source code | First-year | Renewal |
|---|---|---|---|---|---|---|
| **Commercial** | Limited (up to 100 copies) | Unlimited | **No** | No | **$3,000** | **$2,250** |
| **Sustaining** | Unlimited | Unlimited | **Yes** | No | **$7,500** | **$4,500** |
| **Founding** | Unlimited | Unlimited | **Yes** | Yes | **$37,500** | **$18,000** |
| Corporate | "Unlimited commercial use across multiple business units" | — | — | — | Contact us | Contact us |

The pricing page states the Sustaining tier as "**+ Unlimited commercial use / Web and SaaS
usage permitted / Everything in Commercial / Unlimited commercial distribution**", and the
Commercial tier as "Limited commercial use / Commercial distribution w/100 seat limit". The
membership table's `Web/SaaS use` row reads **No** for Commercial and **Yes** for Sustaining —
so for a hosted product the Commercial tier is not merely cheaper, it is **the wrong tier**.

### What each answer is, precisely

**Is the free ODA File Converter usable server-side in a commercial SaaS? No.** ODA's own FAQ
answers this in one sentence
(https://www.opendesign.com/faq/question/what-are-oda-viewer-and-oda-file-converter):

> "ODA Viewer and ODA File Converter are example projects that illustrate the possibilities of
> the ODA framework. They are free downloads that you can use to get an overview of ODA SDKs.
> **If you are not an ODA member, you can use them for non-commercial applications only.**"

**Is it redistributable? No.** The non-member click-through agreement
(https://www.opendesign.com/agreements/ODA%20Evaluation%20License%20Click%20Agreement%20-%20NonMembers.pdf)
grants a "limited, nonexclusive, revocable, royalty-free license, with no right to transfer or
sublicense, to use the Software **solely within Licensee's organization** (but not including
parent, subsidiaries, affiliates, business units, divisions or locations other than the single
location identified…), and solely for the Purpose, **for a term of 60 days**", and adds:
"**Licensee may not copy the Software or distribute the Software, directly or indirectly, by
itself or with or incorporated in any other software or product.**" The "Purpose" is defined as
evaluating whether to become a member — not production, and not indefinite dev use either.

**Which level grants production/commercial rights for DWG read/convert?** **Sustaining**,
$7,500 first year / $4,500 renewal, for a hosted backend. The Core Package at Commercial level
already includes the DWG SDK; what Sustaining buys on top is the unlimited-distribution and
Web/SaaS grant.

**Per-seat vs per-deployment vs royalty.** The published model is a **flat annual company
subscription with unlimited developer seats and no royalty**. The word "royalty" does not appear
in the Membership Rules and Policies
(https://www.opendesign.com/agreements/ODA%20Membership%20RULES%20and%20POLICIES.pdf — grepped;
no royalty clause). Two clauses shape the deployment count: Commercial is capped at "100 copies
of a Member Application"; Sustaining is uncapped. All tiers state "**No affiliate or subsidiary
usage**" — the licence is to one legal entity.

**Does a SaaS backend count as redistribution?** Under ODA's structure the question is answered
by the `Web/SaaS use` row rather than by construing "distribution": Sustaining says **Yes**
explicitly. Read alongside Membership Rules §17, which forbids a Member to "copy, relocate,
move, sublicense, rent, timeshare, **use in acting as a service bureau**, loan, lease or
otherwise distribute the Development Tools or Documentation, **except as expressly provided in
its Membership Agreement**" — i.e. hosted use is prohibited *by default* and permitted *by the
tier grant*. **Counsel should confirm on the actual Membership Agreement that the Sustaining
Web/SaaS grant is the express provision that satisfies §17**, since the Rules PDF is dated "As
of November 3, 2015" and the Web/SaaS tier is newer than it.

**Two further terms worth pricing in.** §9/§10: ODA "may use tracking tools" and a Member "must
furnish a copy of any Member Application to the ODA upon request" for compliance verification.
§15: exports are subject to US export-control regulation — relevant to a Bangladesh-operating
entity and a point for counsel; Bangladesh's status under those regulations was **not verified
here**. Subscriptions are annual and non-refundable, and the FAQ on the pricing page is blunt
about lapse: "In case of termination of the subscription **you lose the right to distribute the
ODA-based product, even if it was developed during the validity of the license.**" That is a
recurring, non-optional $4,500/yr obligation for as long as the product ships, not a one-time
purchase.

| Question | Answer | Source |
|---|---|---|
| ODA File Converter redistributable? | No — "may not copy… or distribute… directly or indirectly" | Eval Click Agreement §1.1 |
| ODA File Converter server-side in commercial SaaS? | No — non-members: "non-commercial applications only" | ODA FAQ |
| Tier for production DWG read/convert in a SaaS | **Sustaining** | ODA membership table |
| Cost | **$7,500 yr 1, $4,500/yr thereafter** | opendesign.com/pricing |
| Royalty | None published | Rules & Policies (absent) |
| Per-seat | No — unlimited developer seats | ODA membership table |
| Affiliates/subsidiaries | Not covered — one entity | Pricing page tier text |
| Resellers/discounts | None — "all members pay the same published prices" | Pricing page FAQ |

---

## 2. LibreDWG — version, licence, and how much DWG it really reads

**Version 0.14.1, released 2026-07-25.** The project's own `NEWS` heading reads
"LibreDWG version 0.14.1 - 2026-07-25 - **beta**"
(https://raw.githubusercontent.com/LibreDWG/libredwg/master/NEWS). Every release in `NEWS` back
to 0.12.1 (2021) carries the same "beta" tag. The project has never self-declared stable.

**Licence: GPL-3.0-or-later — confirmed.** `COPYING` is the GPLv3 text
(https://raw.githubusercontent.com/LibreDWG/libredwg/master/COPYING) and the `README` states it
is "licensed under the terms of the GNU General Public License version 3 (or at you option any
later version)" (https://raw.githubusercontent.com/LibreDWG/libredwg/master/README).

**DWG versions it reads.** The `README` claims broad read coverage with a named exception:

> "At the moment our decoder (i.e. reader) is done, **it can read all DWG versions, just some
> very advanced R2010+ objects fail to read and are skipped over.**"

An older `NEWS` entry is more measured: "It can read most r13-r2018 DWG files". The version enum
in `include/dwg.h` tops out at `R_2018 /* AC1032/0x21 AutoCAD Release 2018 - 2021 */` plus an
`R_2022b` beta placeholder; `AC1033/AC1034/AC1035` appear only as commented-out lines. The
`dwg2dxf` man page lists valid save targets as "r12, r14, r2000, r2004, r2007, r2010, r2013,
r2018".

**On AC1035/2025 specifically: it does not exist as a released AutoCAD DWG format.** ODA's own
Drawings SDK page lists supported DWG versions as "AutoCAD 12 (AC1009)–AutoCAD 2009 (AC1021) /
AutoCAD 2010 (AC1024) / AutoCAD 2013–2017 (AC1027) / **AutoCAD 2018–2025 (AC1032)**"
(https://www.opendesign.com/products/drawings). AC1032 is still the current format family.
**So LibreDWG's AC1032 support is, on paper, current-format support** — the risk is not the
container version, it is entity coverage inside it.

**Stated limitations, from the project's own `TODO`**
(https://raw.githubusercontent.com/LibreDWG/libredwg/master/TODO). This is the load-bearing
finding for Vextrus, because the unhandled list intersects construction drawings directly:

- "**Unhandled (fields spec'ed but broken/untested)**: … **TABLE / TABLECONTENT /
  CELLSTYLEMAP** / MATERIAL / DIMASSOC / ARC_DIMENSION / *OBJECTCONTEXTDATA / DATATABLE /
  DATALINK …"
- "**Unhandled (i.e. passed through, no DXF and fields)**: ACDSRECORD ACDSSCHEMA NPOCOLLECTION
  RAPIDRTRENDERENVIRONMENT XREFPANELOBJECT"
- "add API for more complex entities, like 3dsolids, **hatch**, ACSH solids, **dynblocks**" and
  "**PROXY subentities, PROXY_ENTITY**"
- missing test coverage named for: "BODY CAMERA DIMENSION_ANG3PT DIMENSION_DIAMETER
  DIMENSION_RADIUS … **IMAGE LEADER** MESH **MINSERT** OLE2FRAME **POLYLINE_2D** PROXY_ENTITY
  SHAPE TOLERANCE **VERTEX_2D** …"
- "check-dxf/outdxf: … **some objects even crash acad: VERTEX_3D, MLINE.**"

`configure --enable-release` exists precisely to disable "unstable DWG features or objects,
unknown DWG versions and objects", and `--enable-debug` "Activates support for unstable classes.
**For testing only.**" A packaged release build therefore *deliberately skips* the shaky classes.

Two of these matter more than the rest for this product. **`PROXY_ENTITY` is unhandled**, and
proxy entities are exactly what AEC vertical objects (Civil 3D, AutoCAD Architecture, exported
Revit) degrade into when opened without their object enabler — a common shape for real
consultant-issued drawings. **`TABLE`/`TABLECONTENT` are unhandled**, which would be fatal to
schedule reading except that `cad-ingestion.md` §5 already reconstructs schedules from *text
positions* with no gridlines — that design decision accidentally insulates us from this
particular gap, and should be recognised as load-bearing rather than incidental.

**Open-issue themes on entity coverage** `[ISSUE-UNOPENED]` — surfaced by search against the
primary issue tracker but not directly opened (see caveats): missing entities inside BLOCK
references (#143), a DXF written from a 290 MB assembly with xrefs losing content and crashing
AutoCAD (#1069), missing group codes in `dwg2dxf` output (#1052), "many DXF files produced by
LibreDWG have missing y coordinates" affecting a reported 43 of 89 test DWGs (#275), and
downstream FreeCAD parse failures on `dwg2dxf` output (FreeCAD#19247). **Treat these numbers as
unconfirmed** until the issues are opened directly. The `NEWS` file independently confirms the
*shape* of the risk: 0.14.1 alone fixes ten separate CVE/GHSA memory-safety findings from
oss-fuzz, including a hang in the **DXF writer (`dwg2dxf`)** itself
(GHSA-46mp-4x39-p444). Untrusted client DWGs into this binary is a hardening question, not only
a correctness one; the existing "isolated subprocess, temp dir per invocation" rule is doing
real work and should be strengthened rather than relaxed (resource limits, no network, dropped
privileges).

### Is GPL-via-subprocess a legally accepted separation?

Two independent grounds, and the second is the stronger one for this product:

**(a) Aggregation / separate programs.** The FSF's GPL FAQ, `#MereAggregation`
(https://www.gnu.org/licenses/gpl-faq.html#MereAggregation) `[FAQ-INDEX]`:

> "**Pipes, sockets and command-line arguments are communication mechanisms normally used
> between two separate programs. So when they are used for communication, the modules normally
> are separate programs.** However, if the semantics of the communication are intimate enough,
> exchanging complex internal data structures, that too could be a basis to consider the two
> parts as combined into a larger program."

And `#GPLPlugins` / `#GPLInProprietarySystem` `[FAQ-INDEX]`: a main program that uses "simple
fork and exec to invoke plug-ins" and does not establish intimate communication leaves them
separate programs; it is "**intimate communication by sharing complex data structures, or
shipping complex data structures back and forth**" that can make them one combined program.

Our invocation is `dwg2dxf <in> -o <out>` — command-line arguments in, a **DXF file** out. DXF
is a published interchange format, not LibreDWG's internal data structure, and is consumed by an
unrelated MIT library (ezdxf). That is the textbook separate-program case. The rule already in
`cad-ingestion.md` — subprocess only, never linked — is the right rule and the reason it holds.

**(b) No conveying.** GPLv3 obligations attach on *conveying*. A server-side-only deployment
distributes nothing to users. The FSF FAQ `#GPLRequireSourcePostedPublic` `[FAQ-INDEX]`: "**The
GPL does not require you to release your modified version, or any part of it. You are free to
make modifications and use them privately, without ever releasing them.**" This is precisely the
AGPL/GPL distinction, and it is why AGPL libraries are banned in shipped code while a GPL
subprocess is not. **The corollary is a real constraint:** the moment any artifact containing
`dwg2dxf` is handed to a third party — an on-prem installer, a client-side desktop build, a
customer-hosted container image — that is conveying, GPLv3 §6 engages for that binary, and the
"license text shipped" rule alone is not sufficient (a written offer or corresponding-source
availability is required for the LibreDWG binary itself). Ground (a) still keeps our own code
out of it; ground (b) stops applying.

| | LibreDWG 0.14.1 |
|---|---|
| Licence | GPL-3.0-or-later (confirmed, `COPYING`) |
| Self-declared maturity | **beta** — every release since 2021 |
| DWG read | r13–r2018 / AC1032 = current format family (ODA confirms AC1032 spans AutoCAD 2018–2025) |
| Named coverage gaps | PROXY_ENTITY, TABLE/TABLECONTENT, hatch API, dynblocks, MINSERT, IMAGE, LEADER; MLINE/VERTEX_3D can crash AutoCAD on the emitted DXF |
| Subprocess separation | Supported by FSF FAQ `#MereAggregation` + `#GPLPlugins`; independently, server-side use is not conveying |
| Cost | $0 |
| Verdict | **production-legal server-side**; becomes a real GPL§6 obligation if ever shipped to a client |

---

## 3. Alternatives for DWG read

| Option | Licence | Cost (published) | Reads 2D DWG? | BD-based commercial SaaS? |
|---|---|---|---|---|
| **ODA Drawings SDK, Sustaining** | Proprietary, annual subscription | **$7,500 y1 / $4,500 renewal** | Yes — AC1009→AC1032, full entity model, also imports PDF | **Yes**, expressly (Web/SaaS = Yes). Export-control clause §15 for counsel |
| ODA Drawings SDK, Commercial | Proprietary | $3,000 / $2,250 | Yes | **No** for hosted — Web/SaaS = No, 100-copy cap |
| **LibreDWG `dwg2dxf`** | GPL-3.0-or-later | $0 | Mostly — see §2 gaps | Yes, server-side subprocess |
| **`libdxfrw`** | **GPL-2.0-or-later** | $0 | **No, effectively.** Its own README: "a free C++ library to read and write DXF files… It **also has rudimentary capabilities to read DWG files**." | Same GPL analysis, but "rudimentary" rules it out on capability |
| **Autodesk Platform Services, Model Derivative** | Commercial cloud API | **UNVERIFIED —** see below | Yes, DWG→SVF2/OBJ | Yes contractually; but see data-residency and output-format objections |
| **Aspose.CAD for .NET** | Commercial | **Developer OEM US$799→$2,397; Developer SDK $15,980; Site OEM $11,186; Site SDK $39,950; Metered from $1,999/mo** | Yes — DWG R11–R14 through 2021–2024 | **Yes, but only on OEM/SDK/Metered tiers** — Small Business tiers exclude "SaaS project usage scenarios" |
| **CAD Exchanger (CADEX) SDK** | Commercial | **UNVERIFIED —** quote-only. Model published: joining fee + annual maintenance + **per-end-user-machine distribution fee, desktop vs server**, reported quarterly | 3D/MCAD-oriented; 2D drawing support not established | Model is per-machine royalty — poor fit for a server product |
| **Datakit** | Commercial | **UNVERIFIED —** product page 404'd; no price found | Not established | Not established |
| **Open Cascade (OCCT)** | LGPL-2.1 **with exception**, or commercial | $0 (LGPL) | **No — OCCT does not read DWG.** STEP/IGES/BREP 3D kernel | Irrelevant to this lane |
| **AutoCAD Core Console** | Requires a paid AutoCAD licence per instance | AutoCAD subscription (**UNVERIFIED —** not priced here) | Yes, natively | Server-farm automation on desktop AutoCAD licences is a licence-terms question that was **not verified**; historically constrained |

**Notes that change the ranking:**

- **`libdxfrw` is not a DWG solution.** "Rudimentary" is the maintainers' own word
  (https://raw.githubusercontent.com/LibreCAD/libdxfrw). It is also GPL-2.0-or-later, so it buys
  no licence relief over LibreDWG either.
- **APS Model Derivative outputs viewer geometry, not DXF.** DWG translates to SVF2 and OBJ; no
  primary source was found showing **DXF as an output format**. That means APS does not slot
  into the existing `DXF → ezdxf → EntityGraph` pipeline — it would replace it with a different
  extraction problem against an Autodesk-proprietary tessellated format. **This is a
  capability objection before it is a cost one.** Also: it is a cloud round-trip, so every
  client drawing leaves the country and the tenant boundary — a data-residency and
  confidentiality question that a Bangladeshi client's drawings may not survive.
- **APS pricing — UNVERIFIED.** Verified: the model moved to "Flex tokens", launched
  2025-12-08 with migration by 2026-02-18; "**The minimum purchase is 100 tokens**"; tokens
  expire one year from purchase; basic Model Derivative interactions are "1 token for every
  300,000 API calls"
  (https://aps.autodesk.com/blog/aps-business-model-evolution). Autodesk's Flex rate sheet gives
  "**$3 USD per token**… as of September 7, 2021" and lists Autodesk Platform Services token
  cost as "**Varies**", charged per result
  (https://www.autodesk.com/buying/flex/flex-rate-sheet). **Could not find: the current
  per-translation token cost for a DWG under the Flex model.** The older Cloud-Credit blog gave
  "0.2 CCs to process any other file format" besides Revit/Navisworks
  (https://aps.autodesk.com/blog/forge-pricing-explained-3-what-does-each-forge-api-cost) but
  never published a USD/CC rate, and CCs are superseded. **No per-drawing cost figure should be
  quoted from this document.** The overview page routes pricing to `aps.sales@autodesk.com`.
- **Aspose is the only alternative besides ODA with a fully published price list**
  (https://purchase.aspose.com/pricing/cad/net). It is .NET/Java/Python, and it rasterises or
  exports rather than exposing a full DWG object model, so it is a weaker fit than ODA at
  comparable money. The Small-Business/OEM split is the trap: the $799 tier does **not** permit
  SaaS.
- **CADEX's per-end-user-machine distribution fee** is structurally hostile to a server product
  that scales horizontally, independent of the (unpublished) rate.

---

## 4. Vector PDF geometry extraction

The common case for issued construction drawings is a **vector** PDF: paths, text and clipping
operators, no raster. What matters is whether a library exposes path segments with coordinates,
text with position *and* height, optional-content (layer) membership, and embedded rasters.

| Library | Licence | (a) vector paths w/ coords | (b) text + position **and height** | (c) layers / OCG | (d) embedded rasters | Permissive? |
|---|---|---|---|---|---|---|
| **pypdfium2** (PDFium) | **Apache-2.0 OR BSD-3-Clause** | **Yes** — raw API `FPDFPath_CountSegments`, `FPDFPath_GetPathSegment`, `FPDFPathSegment_GetPoint/GetType/GetClose` | **Yes** — `FPDFText_GetCharBox`, `FPDFText_GetCharOrigin`, `FPDFText_GetFontSize`, `FPDFText_GetUnicode` | **Partial / No** — no OCG header in the public API; only `FPDFPageObj_GetMark`/`FPDFPageObjMark_*` marked-content | Yes — `FPDFImageObj_*` | **Yes** |
| **pdfplumber** (on pdfminer.six) | **MIT** | **Yes** — `.lines`, `.rects`, `.curves`; each curve carries `path`: "a list of `(cmd, *(x, top))` tuples describing the full path description, including… control points used in Bezier curves" | **Yes** — char dicts carry `size`, `height`, `x0/x1/top/bottom` | **No** — not in the object model | Yes — `.images`, with `srcsize` | **Yes** |
| **pdfminer.six** | **MIT** | Yes (pdfplumber's engine; lower-level) | Yes | No | Yes | **Yes** |
| **pikepdf** (on qpdf) | **MPL-2.0** | Object-model access to content streams — you parse operators yourself | Same | **Yes** — direct access to `/OCProperties` → `/OCGs` names. **The only tool here that can name layers** | Yes — image XObjects | **Yes** (weak copyleft, file-level; safe for use, no obligation on our code) |
| **qpdf** | **Apache-2.0** | Structural/content-stream level, no geometry model | No | Via object model | Yes | **Yes** |
| **Ghostscript** | **AGPL-3.0** (confirmed: "GPL Ghostscript is free software; you can redistribute it… under the terms of the GNU **Affero** General Public License… version 3") + Artifex commercial | Yes, via device output | Yes | Partial | Yes | **No — banned** |
| **PyMuPDF / MuPDF** | **AGPL-3.0** (`COPYING` is the AGPLv3 text) + Artifex commercial | Yes, and the best ergonomics of the set | Yes | Yes | Yes | **No — banned** |
| **Apache PDFBox** (Java) | **Apache-2.0** | Yes — `PDFGraphicsStreamEngine` gives `appendRectangle/curveTo/lineTo/moveTo` callbacks | Yes — `PDFTextStripper`/`TextPosition` | Via COS object model | Yes | **Yes** — but it is Java, off the ADR-0001 lane |

Sources: pypdfium2 `pyproject.toml` `SPDX-License-Identifier: Apache-2.0 OR BSD-3-Clause`; PDFium
public headers `public/fpdf_edit.h` and `public/fpdf_text.h` at
https://pdfium.googlesource.com/pdfium/+/refs/heads/main/public/ (function names verified by
direct fetch); pdfplumber `LICENSE.txt` (MIT) and README object tables; pdfminer.six `LICENSE`
(MIT); pikepdf `LICENSE.txt` (MPL-2.0); qpdf `LICENSE.txt` (Apache-2.0); ghostpdl `LICENSE`;
PyMuPDF `COPYING`; PDFBox `NOTICE.txt` (Apache-2.0).

**Findings that bear on the current ruling:**

1. **The `pypdfium2` choice is sound and more capable than the ADR credits it with.** It is not
   render-plus-text-only: PDFium's public C API exposes full path-segment geometry, and
   pypdfium2 is an ABI-level ctypes binding that keeps "the raw PDFium API… accessible as well"
   (project README). Vector path extraction is available today without adding a dependency.
2. **The layer gap is real and is the one thing pypdfium2 cannot do.** PDFium ships no
   optional-content header in `public/` (the full list is `fpdf_annot, attachment, catalog,
   dataavail, doc, edit, ext, flatten, formfill, fwlevent, javascript, ppo, progressive, save,
   searchex, signature, structtree, sysfontinfo, text, thumbnail, transformpage` — no OCG). On a
   construction PDF, layer/OCG membership is often the only discipline signal available. **The
   permissive answer is `pikepdf` (MPL-2.0)** reading `/OCProperties` directly — it does not
   displace pypdfium2, it complements it. Worth a ticket.
3. **`pdfplumber` (MIT) is the fastest route to path geometry in Python** and gives text height
   for free, which `cad-ingestion.md` §4 requires ("Text carries its world height"). Its weakness
   is the same one: no OCG.
4. **The AGPL ban survives contact with the evidence.** Ghostscript and MuPDF/PyMuPDF are AGPL
   at their own repositories. Artifex's dual-licensing page confirms a commercial licence is
   required for SaaS — "Cannot use in server-based applications without revealing your app's
   code"; "If you can't meet the requirements of the GNU AGPLv3 above, a commercial license is
   required" (https://artifex.com/licensing/). **Commercial price: UNVERIFIED —** Artifex
   publishes no figures; `artifex.com/licensing/commercial` returned HTTP 500. Quote-only via
   sales. The banned-in-shipped-code rule and its enforcing licence test should stay.

---

## 5. Raster / scanned PDF — state of the art, 2026

Reported conservatively; only what was verified.

| Component | Tool | Licence | Verified? |
|---|---|---|---|
| OCR | **PaddleOCR** | **Apache-2.0** (`LICENSE`) | Licence verified directly |
| OCR | **Tesseract** | **Apache-2.0** (`LICENSE`) | Licence verified directly |
| OCR | **docTR** (Mindee) | **Apache-2.0** (`LICENSE`) | Licence verified directly |
| Raster→vector trace | **Potrace** | **GPL-2.0** | Licence verified; GPL, so subprocess-only like LibreDWG |
| Line/segment detection | **OpenCV** | **Apache-2.0** (4.x `LICENSE`) | Licence verified |

All three OCR engines are **Apache-2.0 and therefore production-legal with no copyleft
obligation** — the OCR half of scanned-drawing ingestion has no licensing obstacle at all.

**What is not verified, and should not be asserted:** that any of these delivers
professional-grade *drawing* OCR (rotated text, dimension strings, `%%C`-style escapes baked into
a raster, stacked fractions), or that a commercially-licensable, production-grade
**scanned-drawing-to-CAD vectorisation** product exists in 2026 with published pricing. No such
benchmark or vendor price list was located within this session. Vendors in this space exist but
price by quote; **no figure should be invented.** Treat the whole raster lane as unquantified.

This matters for the governing sentence more than for licensing: a raster drawing has **no
affirmable scale and no stable entity identity**, so it is a refusal-with-reason case under
`measurement-rules.md` §5 before it is a tooling case. Licensing is not the binding constraint
here; measurement law is.

---

## 6. Autodesk / DWG trademark and legal risk

Factual history, no speculation.

- **2006-11-13** — Autodesk filed a trademark-infringement suit against the Open Design Alliance
  concerning the TrustedDWG watermark that ODA libraries were writing into DWG files.
- **2007-04-02** — Consent judgement. The court permanently enjoined ODA from simulating
  Autodesk's TrustedDWG technology, including the watermark and TrustedDWG code, without
  Autodesk's authorisation.
- **2010-04-09** — Settlement of the remaining DWG-trademark disputes. Autodesk's own press
  release (https://investors.autodesk.com/news-releases/news-release-details/autodesk-and-open-design-alliance-reach-agreement-autodesk-dwg)
  records that ODA agreed to "cancel its DWG-based trademark registrations and cease use of DWG
  and DWG-based trademarks in its product marketing and branding", and states the decisive
  sentences for this question:

  > "**The settlement does not preclude ODA from developing interoperable software or from using
  > the .dwg extension in its file names.**"
  >
  > Autodesk "**does not prevent others from either using .dwg as a file extension or from making
  > software that is compatible with the Autodesk DWG file format.**"

- Autodesk subsequently **joined** the Open Design Alliance (reported by trade press; the ODA
  membership listing was not directly verified in this session — `[UNVERIFIED]` as to date).

**Reading.** The litigation was about **trademark and watermark simulation**, not about the
legality of reading the format. Autodesk has stated on its own investor-relations channel that
it does not prevent others from making DWG-compatible software. The residual, avoidable risks
are naming risks, and they are ours to control:

- Do not write a TrustedDWG watermark or anything simulating one (we only read; not applicable).
- Do not use "AutoCAD", "DWG" or "RealDWG" as or within a product/feature name, and do not imply
  Autodesk endorsement or certification. Describe capability functionally — "reads DWG files" —
  and carry the standard third-party-trademark attribution. This aligns with the existing
  guardrail against claiming BIM or capabilities we do not have.
- If ODA is licensed, ODA's Trademark Guidelines and Membership Rules §11–13 bind us (reproduce
  proprietary-rights notices; never register a domain containing ODA marks).

**No verified legal exposure was found for reading DWG files with third-party libraries in a
commercial product.**

---

## What this permits

Per option: **production-legal**, **dev-only**, or **banned** — and at what cost.

| Option | Status | Cost | Condition |
|---|---|---|---|
| **LibreDWG `dwg2dxf`, subprocess, server-side** | **Production-legal** | $0 | Never linked; separate process; DXF over the boundary; licence text shipped. Server-side only — shipping it to a client is conveying and engages GPLv3 §6 |
| **ODA File Converter (free binary)** | **Banned in production. Dev-only is itself doubtful** | $0 | Non-members: "non-commercial applications only"; the click agreement is a **60-day evaluation** for the purpose of deciding on membership. Current "dev-only" use is defensible only as genuine evaluation — **it is not an indefinite entitlement**, and the 60-day term should be treated as real |
| **ODA Drawings SDK — Sustaining** | **Production-legal for a SaaS backend** | **$7,500 y1, $4,500/yr** | Web/SaaS = Yes; unlimited distribution; unlimited seats; no royalty. One legal entity, no affiliates. Rights lapse with the subscription. Counsel to confirm Rules §17 vs. the Web/SaaS grant, and export-control §15 for BD |
| **ODA Drawings SDK — Commercial** | **Not usable for a hosted product** | $3,000 / $2,250 | Web/SaaS = **No**; 100-copy cap |
| `libdxfrw` | **Not viable** | $0 | "Rudimentary" DWG read, by its own README; GPL-2.0+ anyway |
| **APS Model Derivative** | **Blocked on capability before cost** | **UNVERIFIED** | No DXF output found → does not feed the ezdxf pipeline; cloud round-trip exports client drawings out of the tenant and the country |
| **Aspose.CAD — OEM/SDK/Metered** | **Production-legal** | **$2,397 / $15,980 / from $1,999 per month** | SaaS permitted only on OEM/SDK/Metered; Small Business tiers ($799/$3,995) exclude SaaS |
| CADEX / Datakit / Open Cascade | **Not applicable** | UNVERIFIED / n/a | 3D-MCAD lane; OCCT reads no DWG; CADEX charges per end-user machine |
| AutoCAD Core Console | **Not established** | UNVERIFIED | Requires paid AutoCAD licences; server-farm terms unverified |
| **pypdfium2** | **Production-legal** | $0 | Apache-2.0 OR BSD-3-Clause. Delivers (a) paths, (b) text+height, (d) images. **Not (c) layers** |
| **pdfplumber / pdfminer.six** | **Production-legal** | $0 | MIT. Delivers (a), (b), (d). Not (c) |
| **pikepdf** | **Production-legal** | $0 | MPL-2.0. **The only permissive route to (c) OCG/layer names** |
| qpdf | Production-legal | $0 | Apache-2.0; structural, no geometry model |
| Apache PDFBox | Production-legal but off-lane | $0 | Apache-2.0; Java, against ADR-0001's single-language rule |
| **Ghostscript, MuPDF, PyMuPDF** | **Banned in shipped code** | commercial price **UNVERIFIED** | AGPL-3.0 confirmed at source. Artifex publishes no prices |
| **PaddleOCR / Tesseract / docTR** | **Production-legal** | $0 | All Apache-2.0 |
| Potrace | Production-legal, subprocess-only | $0 | GPL-2.0 — same separation discipline as LibreDWG |
| OpenCV | Production-legal | $0 | Apache-2.0 |

## Bearing on the current ruling

The re-examination does not overturn ADR-0001 so much as **price the alternative and correct one
factual premise**:

- **The premise that survives.** The AGPL ban is correct at source. The subprocess-only rule for
  GPL is correct and well-grounded. The ODA File Converter ban is correct — and stricter than the
  ADR says, since even the dev-only use rests on a 60-day evaluation term.
- **The premise that was understated.** pypdfium2 already exposes full vector-path geometry;
  PDF ingestion is less constrained than "PDFs via pypdfium2" implies. The genuine PDF gap is
  **layers/OCG**, and it has a permissive fix (`pikepdf`).
- **The number the CEO asked for.** ODA production licensing costs **$7,500 in year one and
  $4,500 a year thereafter** for the tier that permits SaaS. That is small against the cost of a
  single wrong estimate, and it buys the entity coverage LibreDWG's own `TODO` says it lacks —
  most pointedly `PROXY_ENTITY`, the shape real consultant DWGs take. The trade is not
  free-vs-paid; it is **a beta-tagged reader with named unhandled classes at $0, versus the
  reference implementation with a recurring $4,500/yr and a lapse clause.**
- **What has not been established** and would decide it: how the two actually compare on *our*
  fixture drawings. No measurement was taken in this session. A head-to-head on the real
  multi-drawing fixture set — entity recovery rate, `explode_truncated` and per-type loss
  counters, schedule-sheet outcomes — is the evidence that should precede an ADR, and it is
  cheap to obtain under ODA's 60-day evaluation, which exists for exactly this purpose.

## Unverified — stated plainly

1. **APS per-translation cost under the Flex-token model.** Verified: 100-token minimum, $3/token
   SRP as of 2021-09-07, "Varies" for APS, 1 token per 300,000 basic API calls. Not found: tokens
   consumed by one DWG translation in 2026.
2. **Artifex commercial licence pricing** for Ghostscript/MuPDF/PyMuPDF — none published;
   `artifex.com/licensing/commercial` returned HTTP 500.
3. **CADEX and Datakit pricing** — quote-only; Datakit's product page 404'd.
4. **AutoCAD Core Console** server/automation licensing terms and cost.
5. **FSF GPL FAQ passages** — quoted via the search index of the primary page; `gnu.org` was
   unreachable from this container. Re-read at source before contractual reliance.
6. **LibreDWG issue numbers and figures in §2** (#143, #275, #1052, #1069, FreeCAD#19247) —
   surfaced by search, not opened directly; github.com HTML is gated in this session. The `NEWS`
   and `TODO` evidence around them *is* directly verified.
7. **Whether ODA's Sustaining Web/SaaS grant satisfies Membership Rules §17** (service-bureau
   prohibition, "except as expressly provided in its Membership Agreement"). The Rules PDF is
   dated 2015-11-03 and predates the tier. Counsel, on the actual Membership Agreement.
8. **US export-control status of Bangladesh** under ODA Membership Rules §15.
9. **Date Autodesk joined the ODA** — trade-press reported, not verified at a primary source.
10. **Whether APS Model Derivative can emit DXF** — no primary source found either way; the
    absence from every supported-output list examined is suggestive, not conclusive.
11. **Any 2026 benchmark for scanned-drawing vectorisation quality**, and any published price for
    a commercial product in that category.
