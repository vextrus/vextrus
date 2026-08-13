# Vector PDF → EntityGraph: what a PDF actually yields

**Researched:** 2026-08-13 · **Status:** research + measurement, not a domain-law amendment.
The ruling it supports is in `.wayfinder/takeoff/tickets/06-vector-pdf-to-entitygraph.md`.

**Question put:** charting ruled the EntityGraph is the one interface. Can a vector PDF land in
the same versioned 10-type vocabulary that `cad/` emits from DXF, and at what fidelity?

## How this was measured

Every number below came from running code against files in this session — not from reading a
library's README. The probe scripts are committed at `docs/research/probes/vector-pdf/`; the
corpus is **not** committed (fetched to `.data/pdfprobe/`, scratch-only per
`docs/research/drawing-corpora.md`).

Machine and commit: `2026-08-13T05:12Z · linux x64 · claude/vector-pdf-entity-graph-vsl1f2@63baec8`.
Library versions pinned in the readings: **pikepdf 10.11.0 / libqpdf 12.3.2**,
**pdfplumber 0.11.10 / pdfminer.six 20260107**, **pypdfium2 5.12.1 / PDFium 152.0.7947.0**,
ezdxf 1.4.4, matplotlib 3.11.1.

### The corpus, and a correction to the ticket

The ticket named HABS/HAER as "licence-clean and PDF — the lawful test material for this lane."
**It is not vector, and its drawings are not PDF at all.** Verified against the LoC item API: for
`il0549` the file inventory is `image/tiff` ×6, `image/jpeg` ×12, `image/jpg` ×6 and exactly one
`application/pdf` — and that PDF is the *data page* (the typed historical report at
`…/data/il0549data.pdf`), not a sheet. The measured drawings live at `…/sheet/00001a.tif`. Probing
`…/sheet/tx0037sheet.pdf` returns 404 while `…/data/tx0037data.pdf` returns 200. **HABS is ticket
07's material, not this ticket's.** Replacement corpus, all licence-clean:

| file | what it is | provenance |
|---|---|---|
| `lah227/232/254.pdf` | single CAD-plotted civil detail sheets | City of Los Altos Hills standard details, published by the agency |
| `lah226.pdf` | the same set, 39 sheets in one file | ditto |
| `seattle.pdf` | 327-sheet 2026 municipal standard plans | City of Seattle, published by the agency |
| `level11.pdf`, `villa747.pdf`, `gottlieb.pdf` | vector architectural floor plans | Wikimedia Commons, CC BY-SA 3.0/4.0 |
| `plantegning.pdf` | a scan wrapped in a PDF | Wikimedia Commons, CC BY-SA 4.0 |
| `plot_r1.pdf` / `plot_r2.pdf` | **our own** `structural-r1/r2.dxf` plotted to vector PDF | `cad/tests/fixtures`, ground truth we own |
| `layered.pdf` | constructed here: two OCGs, `/OC` marked content | synthetic, this session |

The last two matter most: the round trip is the only experiment where the correct answer is
already committed to the repo, and the constructed layered file is the only way to test OCG
recovery without an AutoCAD licence.

### Consolidated census (page 1 of each file)

```
file             pages      sheet mm   paths  clips  chars  imgs  OCGs
lah227.pdf           1    216x279       2784      0      0     0     0
lah232.pdf           1    216x279       6935      0      0     0     0
lah254.pdf           1    216x279       7153      0      0     0     0
lah226.pdf          39    216x279          5      0    898     0     0
seattle.pdf        327    216x279          9      0   1486     0     0
level11.pdf          1    594x420       1074      5    660     0     2
villa747.pdf         1    420x297        593      1     80     0     1
gottlieb.pdf         1    210x148         12      2    131     1     0
plantegning.pdf      2    210x296          0      0      0     2     0
plot_r1.pdf          1    144x122        100     99      0     0     0
```

(`plot_r1`'s page is the plotter's own crop, not a sheet size — see §4 on why no page size is.)

`paths` counts paint operators (`S s f F f* B B* b b*`); `clips` counts `n`, the no-op paint that
ends a `W` clip. Keeping those apart is not pedantry — see §6.

---

## 1. Which library

**Ruling: `pikepdf` (MPL-2.0) is the extractor; `pypdfium2` (Apache-2.0 OR BSD-3-Clause) stays,
for rendering, not extraction.** This does not displace the existing ADR choice; it completes it.

`docs/research/dwg-pdf-ingestion-licensing.md` §4 predicted pypdfium2 could do paths and text and
that "the layer gap is real". Running it sharpened that considerably:

| channel | pikepdf | pdfplumber | pypdfium2 |
|---|---|---|---|
| path segments, world coords | yes — `parse_content_stream`, CTM composed by us | yes — `.lines/.rects/.curves` | yes — `FPDFPath_GetPathSegment` |
| text position + **world height** | yes — `Tf` size × `Tm`∘`CTM` scale | yes — char `size` | **yes, but only via `FPDFText_GetMatrix`** |
| **OCG layer membership** | **yes** — `BDC /OC` + page `/Resources/Properties` | no | **no — measured, see below** |
| clip vs paint distinction | yes, natively (we see the operators) | no — clip rects appear as `rects` | no |
| images | yes (`Do` + XObject) | yes | yes |
| licence | MPL-2.0, file-level copyleft, no obligation on our code | MIT | Apache-2.0 OR BSD-3-Clause |

**The measured pypdfium2 finding, stated precisely.** `FPDFText_GetFontSize` returns **1.0 for
every character** on all three text-bearing files — CAD and DTP producers alike set `Tf … 1` and
carry the scale in the text matrix. World height is still recoverable, as `fontsize × √(b²+d²)`
from `FPDFText_GetMatrix`; that product reads 9.0 / 8.4 / 10.0 on `level11` / `gottlieb` /
`villa747`, **matching pdfplumber's `size` exactly**. So the channel is available — but a naive
`GetFontSize` reading would have silently produced a world height of 1.0 for every label on
every sheet. Two further pdfium traps: it synthesises whitespace characters with an identity
matrix (132 of 792 "chars" on `level11`, all reading height 1.0 — they must be filtered), and its
char count exceeds the real glyph count for the same reason (792 vs pdfplumber's 660).

**The OCG gap is worse than "partial".** pdfium *does* report that an object sits inside an `/OC`
mark, and even exposes the OCG dictionary's key names (`N`, `T`, and on Illustrator files `I`,
`U`). But every one of those params reports type `FPDF_OBJECT_UNKNOWN` (0), and
`FPDFPageObjMark_GetParamStringValue` returns 0 for each. Measured on both `layered.pdf` and
`level11.pdf`. **The layer name is not retrievable through PDFium's public API** — pdfium can tell
you an object is on *a* layer, never *which*.

pikepdf does all four channels in one pass, which is the deciding fact: a second library means a
second geometry model and a join between them on floating-point coordinates.

---

## 2. Text with world height — available, and routinely absent

`cad-ingestion.md` §4 requires text to carry world height, and `takeoff-core`'s view partition
keys its coverage band on caption height. Both survive **when the text is text**.

**It very often is not.** Three of three real CAD-plotted detail sheets yielded **zero
characters** — `lah227` (2,784 paths, 0 chars), `lah232` (6,935, 0), `lah254` (7,153, 0). Rendering
`lah227` confirms the sheet is full of text: dimension strings, a five-row schedule table, a title
block, rotated `HINGE`/`POINTS` labels. Every glyph is a stroked vector outline. This is the
classic AutoCAD SHX path — SHX is not a font in the PDF sense, so a plot has nothing to embed and
emits outlines. Our own `structural-r1.dxf` round trip reproduces it: 23 original TEXT + 4
original MTEXT entities in the committed EntityGraph (41 and 5 counting derived), **0 chars** in
the plotted PDF.

The contrasting case is real too: Seattle's 2026 sheet 003d extracts its full visible text (580
chars, world heights 12.57 / 9.43 / 6.29 pt) with nothing missing.

**The consequence to carry forward.** Text extractability is a property of the *object*, not of
the file, and nothing in a PDF announces it. But the *absence* is machine-knowable at ingest, and
that is what makes it a lawful refusal rather than a silence: `chars == 0 ∧ paths > 0` is
decisive, and a per-sheet ratio catches the mixed case. The governing sentence requires this
surface as a named counter — a caption-height coverage band computed from a sheet whose captions
are outlines is a partial faulty measurement, which is the condemned state.

---

## 3. Optional Content Groups — recoverable, and usually not there

**When OCGs exist, full per-object membership is recoverable**, and pikepdf gets both halves:
`/OCProperties/OCGs` names the layers, and walking the content stream with a `BDC`/`EMC` stack
resolves each `/OC /MCn` against the page's `/Resources/Properties` map. Proven on the constructed
file — every path attributed to `S-COLS`, every text run to `S-ANNO-TEXT` — and on a real one:
`level11.pdf` attributes 1,079 paths and 70 text runs to `Layer 1`.

**But zero of the five real CAD-plotted sheets carried a single OCG.** All five were produced
through `PScript5.dll` → Acrobat Distiller; that path flattens optional content away entirely.
Autodesk's `DWG To PDF.pc3` driver does include layer information by default (Autodesk support
article *"How to turn off layer information when plotting to pdf in AutoCAD products"*; the option
is `Include layer information` under Plot → Properties → Custom Properties — body text
confirmed via a secondary walkthrough, as `autodesk.com` returned 503 through this container's
proxy). So the channel is real in modern plots and absent in the enormous installed base of
distilled ones. We have no AutoCAD-plotted sample; **this is the one gap in the evidence below,
and it is stated rather than papered over.**

**A trap worth a check, measured:** Seattle's 327-sheet set *has* an `/OCProperties` dictionary
containing **zero OCGs** — Acrobat's OCR plug-in wrote the shell. Testing `'/OCProperties' in
Root` reports layers on a file that has none. **Count the OCGs.**

The consequence lands on `cad-ingestion.md` §10: the convention profile resolves roles from an
entity census *including layer statistics*. On the dominant real-world PDF, that column does not
exist. The census must report `layer_channel_absent` — not an empty-string layer on every entity,
which would let the resolver read a one-layer drawing and "resolve" confidently from nothing.

---

## 4. Units and scale — the ladder loses two rungs, not one

The ticket anticipated losing `measurement-rules.md` §5's lowest rank (file units header). It
loses that one and one more.

- **MediaBox is paper, never world.** All five real CAD sheets are 216×279 mm — US Letter, plotted
  to fit, regardless of what they draw. Page size is not a scale hint.
- **`/UserUnit` is 1.0 in every file measured** (14 of 14). It is the PDF's only global scale knob
  and nobody sets it.
- **PDF's own measurement mechanism is absent in practice.** ISO 32000-1 §12.9 defines viewport
  `/Measure` dictionaries carrying an explicit real-world scale. **Zero of 14 files carried `/VP`
  or `/Measure`.** The one PDF-native path to an affirmable scale is spec-real and field-absent.
- **The dimension rank dies too.** §5's third rank is "overridden dimension ratio (style factor
  divided out)". A PDF has no DIMENSION object (§5 below): a dimension plots as lines, arrowheads
  and text with nothing tying the measurement string to the geometry it measures. On a sheet whose
  text is outlined there is not even a string.

So of §5's four ranks, the PDF lane retains **QS two-point** and **grid spacing match** — and §8's
grid detection is itself degraded on this lane (§5 below). §5's fail-closed path is not an edge
case here; it is the main path. That is a fact for **ticket 12 (the scale group)**, which already
anticipates the loss of the last rank; it should be told it is two.

Incidental corroboration of §5's measured finding that printed scale notes are not evidence at any
rank: two of the sheets in this corpus print `SCALE: NONE` and `NOT TO SCALE` in their title
blocks while being perfectly scalable drawings.

---

## 5. The mapping — two of ten types, and eight named absences

PDF paints with four constructs. The honest mapping:

| PDF construct | EntityGraph | note |
|---|---|---|
| path (`m`/`l`/`c`/`re` + paint op) | **LWPOLYLINE** | `h` (closepath) → `closed: true` + shoelace area; otherwise `area: null`. `re` → a closed 4-point path. |
| Bezier `c` | flattened into the same LWPOLYLINE | §4's existing law: fixed tolerance, point cap. |
| text (`BT`/`Tf`/`Tm`/`Tj`) | **TEXT** | `p`, `height`, `rot` all recoverable; `rot` = `atan2(b, a)`. |
| image XObject (`Do`) | **none** | ticket 07's lane. A counter, never a drop. |

And what has no representation, each of which must become an `unsupported_by_type` counter:

- **LINE.** A PDF does not distinguish a line from a polyline. Emitting LINE for 2-point paths
  invents a distinction the file does not contain; emit LWPOLYLINE and count.
- **CIRCLE and ARC.** A circle in a PDF is four Bezier segments. Recovering CIRCLE means
  *arc-fitting* — a guess, and `CLAUDE.md` bars guesses. This is not cosmetic: `cad-ingestion.md`
  §8 detects a grid bubble as "a bare letter/numeral text anchored inside a **circle**". On the
  PDF lane that predicate has no input. Grid detection here needs either an arc-fit *proposal* a
  human affirms, or an honest deferral — and it is the rank the scale ladder still depends on.
- **INSERT.** Form XObjects are the structural analogue, but no file in the corpus used them for
  drawing content, and they carry no block name even when used. Block references do not survive
  plotting; nor do block attributes (grid-bubble letters, callout tags — §3's separate channel).
- **DIMENSION.** No dimension object exists; see §4.
- **SOLID, POLYLINE, MTEXT.** No distinct representation.

**So the PDF lane's real vocabulary is LWPOLYLINE + TEXT.** The EntityGraph envelope survives
unchanged — that is the point of the one-interface ruling — but a consumer that cannot tell a
2-of-10 artifact from a 10-of-10 artifact will read absence as evidence of absence. The envelope
already has `unsupported_by_type`; what it lacks is a statement of *which lane produced it*.

**Two channels PDF gives us for free**, worth recording because they are §4 pain points on the DXF
side: colour arrives already resolved (`RG`/`rg` in the stream — no BYLAYER resolution problem at
all), and page extents are exact by construction, so §4's stray-entity percentile rejection has
nothing to do.

---

## 6. Derived vs original — the invariant weakens but does not go vacuous

The ticket asked whether §3's extractor invariant means anything when everything in a PDF is
paint. Measured against ground truth we own — `structural-r1.dxf`, whose committed EntityGraph is
**59 original entities** (plus 49 derived, 4 unsupported POINTs):

- the plotted PDF carries **100 painted path objects** (489 subpaths) and **0 text**;
- and **99 clip rectangles** (`re W n`), which are not drawing content at any level.

Had the extractor treated `n` as a paint operator, it would have invented 99 phantom rectangles on
a 59-entity drawing — a 2.7× over-count of closed outlines, which under
`measurement-rules.md` §3 is exactly the fabrication class that hard-blocks. **So the invariant is
not vacuous.** It restates on this lane as: *no operator that does not paint may become an entity,
and no entity may be synthesized from a construct the file does not contain* — barring clip paths,
annotation appearance streams, and Form XObject re-instantiation. What it can no longer do is
distinguish a block-internal label from a drawn one, because the plotter destroyed that
distinction. On the PDF lane, "original" means *painted*, and there is no derived channel to guard
against, only non-content to exclude.

**The handle has no analogue, and content-stream position is not a substitute.** Measured across
the committed revision pair (`structural-r1` → `r2`: one column nudged, one deleted, one added,
sheet retitled — every other view untouched): both plot to exactly 100 painted paths, and of r2's
paths whose geometry is unchanged from r1, **65 keep their content-stream index and 25 do not**.
A three-column edit renumbered a quarter of the untouched drawing. `identity.md`'s deterministic
element key is unaffected — it never used the handle — but `cad-ingestion.md` §2's "the DXF handle
is THE stable provenance key" has no PDF equivalent, and an ordinal is demonstrably not one. This
is direct evidence for **ticket 02 (the source key)**, which proposed a content-derived digest and
explicitly barred an ordinal counter: the measurement supports the proposal.

---

## 7. Throughput — the bar is met with room

Single-threaded pure-Python content-stream walk with CTM composition, over the 39-sheet
`lah226.pdf`: **138,017 painted paths in 6.37 s = 21,651 paths/s.** The non-functional bar is 500K
original entities in under 10 minutes = 833/s. **26× headroom before any parallelism**, on the
slowest plausible implementation.

The scale risk is not time, it is count. Real CAD sheets carry **2,784–7,153 painted paths each**
(the same drawing content that is ~59 entities in DXF plots to ~100 paths at fixture scale, but a
real sheet's dashed lines and hatching each explode into separate paths). Fifty such sheets is
140K–360K paths from drawings a DXF lane would call far smaller. The 500K bar is therefore a
*PDF-lane* bar, and ticket 11's index should size against it.

---

## What is not established

- **No AutoCAD-plotted (`DWG To PDF.pc3`) sample was obtainable in this session.** The OCG-present
  case is proven on an Illustrator file and a constructed file; that a real AutoCAD plot names its
  OCGs with the DWG layer names rests on vendor documentation, not on a file we measured. Get one
  before the convention profile leans on layer names.
- **No Bangladeshi drawing was measured.** Everything here is US/EU/AU practice. BD sheets are the
  target and remain unmeasured on this lane.
- **Rotated text was never measured on a text-bearing sheet.** Every sheet in the corpus with real
  text carries it upright (rotation 0.0 across the corpus); every sheet with rotated text has that
  text outlined. `rot` is recoverable in principle from the text matrix; it is untested in fact.
- **Type3 fonts were not separated out.** matplotlib's default (`pdf.fonttype 3`) also yields
  0 chars; whether some real producers emit Type3 glyphs that a different reader could decode was
  not pursued.
- **`docs/research/dwg-pdf-ingestion-licensing.md` §4's licence findings were not re-verified**;
  they are dated 2026-08-13 and stand.
