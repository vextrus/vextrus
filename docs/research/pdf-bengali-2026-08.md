# A server-generated PDF with correct Bengali shaping — 16 August 2026

**Question (issue #133, a decision ticket on the takeoff wayfinder map #128):** which toolchain can
produce **one server-generated PDF** binding a Bill of Quantities to its Certificate of Measured
Coverage (`quantity-contract.md` §6 — *"a browser print cannot guarantee the certificate travels"*),
rendering **Bangla and English** with correct **complex-text shaping** (conjuncts, reph, pre-base
matras, ya-phala), lakh/crore grouping, no colour-only signalling — under a **permissive licence**
(`cad-ingestion.md` §1: *"AGPL PDF libraries (PyMuPDF/fitz, mutool) are banned in shipped code"*).

**Method.** Two kinds of evidence, kept apart. *Read* evidence is upstream source, LICENSE files and
issue trackers, cited by URL. *Measured* evidence is this machine: every candidate marked **[M]** was
installed, given the same Bengali test string, and its PDF rendered to a bitmap and read back
glyph-by-glyph. Measurements were taken 2026-08-16 on Linux 6.6 / Node v24.19.0 (ICU full) /
Python 3.12 in a scratch directory outside the repo — **nothing here was added to the tree.** No
README claim of "Unicode support" is treated as evidence of shaping anywhere in this document.

**This document does not rule.** It presents options; §9 lists what the founder must decide.

---

## 1. The one-line summary

**Three permissive toolchains were measured rendering correct Bengali** — pdfkit+fontkit (Node, MIT),
Typst (subprocess, Apache-2.0), ReportLab 5 + uharfbuzz (Python, BSD-3) — and a fourth, WeasyPrint
(Python, BSD-3), is read-verified on the same Pango/HarfBuzz path. **Shaping is a solved problem
under a permissive licence on both runtimes.** The decision is therefore not "can it shape" but
*where the document stage lives* and *how much you care about the text a machine reads back out*.

On that second axis the candidates split, and it is the sharpest finding here. **Correct rendering
and correct extraction are different properties**, and only one candidate measured has both:

| | renders Bengali correctly | extracts back to the input string |
|---|---|---|
| **Typst 0.15.1** | ✅ | ✅ **exact** — it emits `/ActualText` spans |
| pdfkit + fontkit | ✅ | ❌ visual order, plus an empty `bfrange` entry |
| ReportLab 5 (shaped) | ✅ | ❌ conjuncts come back as private-use codepoints |
| fpdf2 (shaped) | ✅ | ❌ garbage where clusters merged |
| fpdf2 (**unshaped**) | ❌ **broken** | ✅ **exact** |

That last row answers the ticket's fourth question in the opposite direction to the intuition: a
**text-extraction round-trip is not merely theatre as a shaping test, it is inverted** — measured, it
*passes* on the visibly broken document and *fails* on the correct one (§7.3).

---

## 2. What "shaping" means here, and the only engine that does it

Bengali needs four things no glyph-by-glyph renderer does:

| Behaviour | Test string | What must happen |
|---|---|---|
| Conjunct (ligature) | `ক্ষ` (U+0995 U+09CD U+09B7) | three codepoints → **one** glyph; the virama U+09CD is consumed |
| Reph | `র্ক` (U+09B0 U+09CD U+0995) | `র্` moves **after** the base and becomes a zero-advance above-base mark |
| Pre-base matra | `কি` (U+0995 U+09BF) | the matra follows the consonant in logical order and must render **before** it |
| Ya-phala | `ক্য` (U+0995 U+09CD U+09AF) | post-base form `.pstf` |

Pre-base matra reordering is **shaper logic, not a GSUB feature** — a library that applies `liga`
and stops still produces broken Bengali. The reordering lives in HarfBuzz's Indic shaper
(`src/hb-ot-shaper-indic.cc`: `initial_reordering_indic` / `final_reordering_indic`,
`reph_position_t`, `reph_mode_t` — https://github.com/harfbuzz/harfbuzz/blob/main/src/hb-ot-shaper-indic.cc),
and Bengali is explicitly in the Indic shaping model
(https://harfbuzz.github.io/opentype-shaping-models.html). HarfBuzz's own licence is the **"Old MIT"**
licence — *"HarfBuzz is licensed under the so-called 'Old MIT' license"*
(https://github.com/harfbuzz/harfbuzz/blob/main/COPYING).

**So every viable candidate below is a wrapper around HarfBuzz or a faithful port of it.** The
question "does this library shape?" reduces to "is HarfBuzz — or rustybuzz, or fontkit's ported
shapers — in the path?", and that is a question about a dependency graph, which is checkable.

A useful consequence for evaluation: **querying a font's feature list is not evidence either.**
Measured, `fontkit`'s `availableFeatures` for Noto Sans Bengali reports only
`aalt,ccmp,ordn,abvm,blwm,dist,kern,mark,mkmk` — no `rphf`, no `half`, no `pstf` — and yet the
shaped output contains glyphs named `uni09AF.pstf` and `uni09A809CD.half2`. **The layout output is
the evidence; the feature list is not.** [M]

---

## 3. Node / TypeScript candidates

### 3.1 pdfkit + fontkit — MIT, real shaping, measured correct [M]

- **Licence:** pdfkit **MIT** (`package.json` `"license": "MIT"`, v0.19.1, measured;
  https://github.com/foliojs/pdfkit/blob/master/LICENSE). fontkit **MIT** *as declared* — v2.0.4's
  `package.json` says `"license": "MIT"`, and every published version from 1.0.0 (2014) to 2.0.4
  (2024) declares MIT with no change. **But the fontkit repository contains no `LICENSE` file at
  all**: `raw.githubusercontent.com/foliojs/fontkit/master/LICENSE` 404s, GitHub's licence detector
  returns null, and issue #255 *"need to place LICENSE file"* has been open since 2021-06-09
  (https://github.com/foliojs/fontkit/issues/255). The declaration in `package.json` and the README
  is the only artifact. That is almost certainly fine legally and is **not** fine for an automated
  SBOM or licence scanner, which will report fontkit as *unknown licence*. Worth knowing before a
  licence test is written against a dependency tree (§9.7).
- **Shaping engine:** fontkit implements its own OpenType layout engine including ports of
  HarfBuzz's Indic and Universal shapers. Verified in the **installed package**, not on a README:
  `node_modules/fontkit/src/opentype/shapers/` ships `IndicShaper.js`, `UniversalShaper.js` and
  `ArabicShaper.js` plus the generated `indic.machine` / `indic.trie` / `indic.json` state machine.
  `IndicShaper.js` registers `initialReordering` (line 34) and `finalReordering` (line 49) as layout
  stages; `finalReordering` carries the reph-repositioning algorithm verbatim — *"o Reorder reph: …
  Possible positions for reph, depending on the script, are; after main…"* (lines 701–736) — with
  `rephPos` / `rephMode` handling and a `wouldSubstitute(…, 'rphf')` probe at line 235. That is
  HarfBuzz's Indic shaper, ported. pdfkit routes `text()` through `font.layout()`.
  (Upstream: https://github.com/foliojs/fontkit/tree/master/src/opentype/shapers.)
- **Measured shaping output** (fontkit 2.0.4, Noto Sans Bengali):

  ```
  কি     2 cps → 2 glyphs:  60 uni09BF   then  25 uni0995       ← matra emitted BEFORE the base
  ক্ষ     3 cps → 1 glyph:  135 uni099509CD09B7                  ← conjunct ligature
  র্ক     3 cps → 2 glyphs:  25 uni0995,  132 uni09B009CD @adv=0  ← reph after base, zero advance
  ক্য     3 cps → 2 glyphs:  25 uni0995,  133 uni09AF.pstf        ← post-base form
  ন্ত্র    5 cps → 2 glyphs: 230 uni09A809CD.half2, 305 uni09A409CD09B0.blws
  ```

  All four behaviours correct. **Rendered sample** (PDF written by pdfkit, rasterised by pypdfium2)
  read visually: `কংক্রিট পরিমাণ — RCC Column Concrete` / `পরিমাপকৃত পরিধির সনদ / Certificate of
  Measured Coverage` / `৳1,00,00,000` all render correctly, Bengali and Latin from **one font file**.
- **Runtime:** pure JS, in-process, no native binary, no browser. `node_modules/pdfkit` 8.2 MB +
  `fontkit` 5.7 MB, measured. One-page document in 132 ms including Node start-up (measured; not a
  differentiator — all candidates were sub-200 ms).
- **Maturity — the split that matters:** pdfkit is actively maintained (pushed 2026-08-16), but
  **fontkit's last commit is 2024-08-09 (v2.0.4)** — effectively frozen for two years. pdfkit cannot
  fix a shaping bug; only fontkit can, and fontkit is not moving.
- **Open Bengali bugs, and what the measurement says about them.** pdfkit #804 *"Bangla font not
  working properly (joint letters)"* has been **open since 2018-04-16 with zero comments**
  (https://github.com/foliojs/pdfkit/issues/804); #909 and #1140 are the same complaint. The exact
  case reported is ya-phala, `ত + ্ + য`. **Measured, that case is correct today** with
  fontkit 2.0.4 and Noto Sans Bengali: `ত্য` → 2 glyphs, `uni09A4` + `uni09AF.pstf` — the post-base
  form, which is the right answer. The pdfmake maintainer's reply to the same report (#898) points at
  the font rather than the engine, and that reconciles: **the engine shapes; a font without the
  Bengali OpenType tables cannot be rescued by any engine.** So the open issue is real but is not
  evidence against fontkit *with this font* — which is exactly why §5.4's font choice and §7's gate
  both matter. fontkit's own tracker carries no open Bengali/Indic issue.
- **Conformance data, and its limit:** fontkit is a first-class engine in Unicode's
  `text-rendering-tests` (542 pass / 211 fail across the suite), but **the suite has no Bengali or
  Devanagari group at all** — its Indic coverage is Kannada. So that suite is not evidence either
  way here, in either direction.
- **Known defect (measured):** pdfkit's `/ToUnicode` CMap is **lossy for shaped Bengali**. Its
  `bfrange` contains an *empty* entry — literally `<>` — for the glyph `headlinebeng.200`, a headline
  connector the font's GSUB inserts and which fontkit reports with `codePoints: []`. pdf.js then
  surfaces that glyph as `U+0005`. A second glyph carries a wrong mapping outright
  (`uni09A409CD09B0` reported as `[0995]`). Reproduced identically with the google/fonts **variable**
  build and the notofonts **static** build, so it is not a variable-font artifact. pdfkit's `actual`
  option passed to `text()` emits **no** `/ActualText` at all (measured: the string `ActualText` does
  not appear in the output bytes); ActualText requires the tagged-PDF `doc.struct` API.
- **Integration cost, unverified in this repo:** pdfkit `require`s `fs` at module load and reads its
  bundled `.afm` metrics from `__dirname/data/` (measured, `pdfkit/js/pdfkit.js:9,2448`). Under
  Next.js this normally needs `serverExternalPackages`. **This was not tested against this repo's
  `next build` — treat it as a task, not a risk that is known to be absent.**

### 3.2 @react-pdf/renderer — MIT, same shaper as §3.1

A React component model over the same fontkit layout engine
(https://github.com/diegomura/react-pdf, MIT, v4.6.1 published 2026-08-14 — the most actively
maintained member of this family). Its dependency graph resolves to **upstream** `fontkit@^2.0.2`,
not the abandoned `@react-pdf/fontkit` fork, and `@react-pdf/textkit` calls
`font.layout(runString, …, 'ltr')` and keeps `glyphRun.positions`. So §3.1's shaping evidence carries
across.

One detail is worth reading twice. `@react-pdf/textkit` carries an explicit list —
`SCRIPTS_NEEDING_DECOMPOSITION = ['Bengali', 'Devanagari', …]` — and applies NFD to those runs before
shaping, with the comment: *"fontkit's glyph output after OpenType shaping can produce codepoints
that don't match the NFC input, making index mapping unreliable."* **Bengali is named, in the
source.** That is reassuring (someone hit this and handled it) and a warning (fontkit's cluster
mapping is unreliable enough to need the workaround) — and it is independent corroboration of §3.1's
measured `/ToUnicode` defect.

It buys JSX templating for the bill face; it costs a second rendering model beside the app's real
React tree (its components are not DOM components) and a heavier dependency. **Not separately
measured.**

### 3.3 pdf-lib — MIT, and it *throws* on Bengali [M]

- **Licence:** MIT (pdf-lib 1.17.1, `@pdf-lib/fontkit` 1.1.1 — both measured from their
  `package.json`).
- **Measured:** with the same Noto Sans Bengali file, `page.drawText('RCC Column Concrete')`
  succeeds and `page.drawText('কি')` **throws**:

  ```
  ReferenceError: regeneratorRuntime is not defined
      at StateMachine.match (@pdf-lib/fontkit/dist/fontkit.umd.js:35623)
      at setupSyllables  (…:35996)
      at ShapingPlan.process (…:34378)
      at OTLayoutEngine.substitute (…:37883)
  ```

  The stack is instructive: pdf-lib *does* call the Indic shaper — `@pdf-lib/fontkit` is a fork of
  fontkit — but the fork's UMD bundle was built against a Babel runtime it does not ship, so the
  Indic syllable state machine dies on Node 24. pdf-lib 1.17.1 is from 2021 and the fork is older.
- **And if it did not crash, it would still be wrong.** Reading `CustomFontEmbedder.encodeText`, it
  takes only `.glyphs` from the layout result — there is no reference to `positions`, `xOffset` or
  `yOffset` anywhere in it, and widths are summed from `glyph.advanceWidth`. **GPOS is discarded.**
  For Bengali that means glyph selection and reordering would be right while every mark attachment
  lands at its default advance rather than its attached position: matras and below-base marks
  visibly misplaced. Upstream PR #1775, *"Replace fontkit with HarfBuzz for better shaping for all
  languages"* (opened 2026-04-06), is still unreviewed and its author expects it not to be merged.
- **Reading:** the crash is the honest failure mode, and the design underneath it is the dishonest
  one — output that looks nearly right and is quietly wrong is the failure class
  `CLAUDE.md`'s governing sentence exists to refuse. pdf-lib 1.17.1 has been unmaintained since
  2021-11. Rule it out for Bengali.

### 3.4 pdfmake

A declarative document-definition layer over pdfkit (`pdfkit@^0.19.1`), so it inherits §3.1's shaper
and adds none of its own — and, being a layer between the string and the shaper, it also inherits
whatever its line-breaking and table-splitting do to a cluster. Its own tracker carries the canonical
Bangla report, #898 *"Bangla font not working properly (joint letters)"*, and the maintainer's reply
is the reason it is not a separate candidate: *"Pdfmake use for rendering PDF file library pdfkit. Is
not able to fix in pdfmake."* **Not measured.** There is no reason to prefer it to pdfkit directly,
and if it were chosen it would need §7's gate run against it — inheriting a shaper is not the same as
reaching it intact.

### 3.5 Headless Chromium (Puppeteer / Playwright `page.pdf()`)

- **Licence:** Puppeteer **Apache-2.0** (v25.7.0, 2026-08-13); Playwright **Apache-2.0** (v1.62.1,
  2026-07-30); Chromium **BSD-3-Clause**; HarfBuzz Old MIT. All clean.
- **Shaping:** HarfBuzz itself, not a port. Blink's own README is explicit that this is the complex-
  script path: *"The text shaping implementation is in `shaping/harfbuzz_shaper.cc`"* and *"for
  complex scripts, the output also describes positioning in the vertical direction, **reordered
  glyphs**, and association into grapheme clusters"*
  (https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/fonts/README.md).
  Chromium is the *reference* for correct Bengali — bug reports in other projects use "correct in
  Chrome" as the baseline (e.g. https://github.com/typst/typst/issues/5023).
- **Constraints:** `page.pdf()` is **Chromium-only and headless-only** — Playwright states
  *"Generating a pdf is currently only supported in Chromium headless"*. It renders under `print`
  media unless `emulateMedia()` says otherwise. Text is emitted as real selectable text via Skia's
  PDF backend, not raster.
- **This is the strongest renderer on the list and the one with the most awkward standing.** It is
  server-generated: the process is ours, headless, on our machine, and `page.pdf()` writes the file
  — nothing about it resembles a QS pressing Ctrl+P. §6's prohibition is aimed at a *client* browser
  print, whose defect is that the certificate can be dropped from the print range. But the clause
  reads *"one server-generated PDF (a browser print cannot guarantee the certificate travels)"* and a
  founder may read the parenthesis as a reason or as a definition. **That reading is a decision, not
  a research finding** (§9).
- **Cost:** a Chromium download of **~280 MB on Linux** (~170 MB macOS) pinned per revision into
  `~/.cache/puppeteer`, a browser process per document, a second engine to keep patched, and CSS
  paged-media quirks (`@page`, running headers, repeated table headers) that are Chromium-specific.
  Not measured. **gotenberg** (MIT) is the same engine as an out-of-process HTTP service, if the
  Chromium blob is wanted off the Next.js image.
- **Banned relative:** `@vivliostyle/cli` is **AGPL-3.0** — disqualified outright by
  `cad-ingestion.md` §1's AGPL ban, and it offers nothing not obtainable directly (it bundles
  `puppeteer-core` and `pdf-lib`). Worth naming here precisely because it is the kind of dependency a
  licence test must catch: the AGPL is three levels down a CSS-typesetting toolchain, not on the
  label. `paged.js` (MIT, last released 2023-07) is a browser polyfill that does no shaping of its
  own and still needs Chromium — redundant with this row.

### 3.6 Typst from Node, and shaping-only building blocks

Typst has Node bindings as well as the CLI — see §4.3, including the version caveat that decides
whether they inherit the `/ActualText` behaviour.

Two other Node-side pieces are worth knowing exist, because they change what "build it yourself"
costs (§4.6's Node equivalent):

- **harfbuzzjs** (MIT, v1.6.0 published 2026-08-09) is real HarfBuzz compiled to WASM, published
  **under the harfbuzz org itself**, with one open issue. It gives exactly what a PDF writer needs —
  `hb.shape()`, `getGlyphInfos()`, `getGlyphPositions()` with `xOffset/yOffset/xAdvance`,
  `font.glyphToPath()` — with no native binary and no browser. It is **not** a PDF library: the play
  is harfbuzzjs for shaping plus a writer for placement, which buys canonical shaping and costs you
  line-breaking, subsetting and `/ToUnicode`. It is also the obvious **oracle** for §7's gate,
  whichever producer is chosen.
- **skia-canvas** (MIT) reaches HarfBuzz through SkParagraph and `skia-safe`'s `pdf` feature, and
  documents `canvas.saveAs("all-pages.pdf")`. Whether Skia's PDF backend emits usable `/ToUnicode`
  for reordered Indic runs is **unverified**; that is the question §7.3 would have to answer before
  it is a candidate.

---

## 4. Python / subprocess candidates

The cost that is *not* in the licence: `cad/` is law-bound to one job. `cad-ingestion.md` §6 ends
*"These parsers live beside their consumer in the app, not in `cad/` — the pipeline stays
geometry/spatial-only"*, and ADR-0001 gives `cad/` exactly one contract: *"DXF/DWG in, versioned
EntityGraph JSON out"*. **A PDF writer in `cad/` contradicts both.** A Python renderer therefore
either amends that law, or lands as a *third* thing — a `docs/` CLI beside `cad/` — with its own
`uv` project, its own verify stages, and its own artifact contract. That is the real price of the
Python side, and it is larger than any licence difference below.

### 4.1 WeasyPrint — BSD-3-Clause, Pango/HarfBuzz, HTML+CSS

- **Licence:** BSD-3-Clause — https://github.com/Kozea/WeasyPrint/blob/main/LICENSE. v69.0,
  2026-06-02, actively maintained.
- **Shaping engine, from source not README:** `weasyprint/text/ffi.py` dlopens `pango-1.0`,
  `harfbuzz`, `harfbuzz-subset`, `fontconfig`, `pangoft2-1.0` and declares `hb_font_t` / `hb_face_t`
  / `hb_subset_*` directly (https://github.com/Kozea/WeasyPrint/blob/main/weasyprint/text/ffi.py).
  Install docs require Pango ≥ 1.44.
- **Native dependencies and their licences:** Pango LGPL-2.1-or-later, GLib/GObject LGPL-2.1+,
  fontconfig MIT-style, FreeType FTL-or-GPLv2, HarfBuzz Old MIT — all **dynamically loaded system
  libraries via cffi `dlopen`**, none vendored or statically linked. **cairo is not a dependency**:
  since v53 WeasyPrint writes PDF itself through `pydyf` (BSD), so the cairo LGPL/MPL-1.1 question
  does not arise.
- **LGPL posture:** `dlopen` of an unmodified distro `libpango-1.0.so` is textbook LGPL §4/§6
  dynamic use. Nothing forces our code open; shipping a container still carries the LGPL source
  offer for those libraries.
- **Known defects:** issue #2841 (OPEN, filed 2026-07-15 against 69.0) — *"Corrupted ToUnicode CMap
  (empty bfchar entries) for real-GSUB text"*: glyphs render correctly, extraction is corrupted where
  GSUB substituted. Fix PR #2869 closed unmerged
  (https://github.com/Kozea/WeasyPrint/issues/2841). This is **the same defect measured in pdfkit in
  §3.1** — empty `bfchar` entries — arrived at independently. Issue #1469: setting CSS
  `letter-spacing` makes Pango disable ligature formation, which splits conjuncts; fixed in 53.x but
  the rule stands — **never set `letter-spacing` on a Bengali run**.
- **Not measured here** (system Pango was not installed in the scratch environment); its shaping is
  read-verified through the dependency graph, which for a Pango consumer is strong evidence.

### 4.2 ReportLab 5 + uharfbuzz — BSD-3, zero system libraries, measured correct [M]

- **Licence:** BSD-3-Clause (`reportlab` 5.0.0, measured installed; PyPI classifier *License :: OSI
  Approved :: BSD License*). `uharfbuzz` **Apache-2.0** (v0.56.0, measured from its dist-info) with
  HarfBuzz **statically bundled in the wheel** — no system packages at all.
- **Shaping engine, from installed source:** `reportlab/pdfbase/ttfonts.py` imports `uharfbuzz`,
  builds an `hb.Face` from the TTF bytes, and `shapeFragWord()` calls `uharfbuzz.shape()` with
  `BufferClusterLevel.MONOTONE_CHARACTERS`; `pdfgen/textobject.py` consumes `x_offset` / `y_offset` /
  `x_advance`. Enabled per string via `shapeStr(s, font, size, force=True)` or the `shaping` extra —
  **it is off by default.**
- **Measured:** same test lines rendered twice in one document, shaping off and on. Off: broken —
  `ক্ষ` prints as three glyphs `ক ্ ষ` with a visible hasant, `কি` prints matra-after-base. On:
  correct — conjunct formed, matra reordered before the base, reph placed. Read visually from the
  rasterised page.
- **Architectural caveat, measured:** ReportLab has no glyph-ID text-showing path. It reverse-maps
  every shaped glyph back to a *character*, and where no reverse mapping exists — i.e. exactly the
  conjunct and reph ligature glyphs — it allocates a **private-use codepoint** (`hbAddPrivate`,
  starting at U+E000). Measured extraction of the shaped lines yields empty/PUA strings where the
  conjuncts are. **Correct rendering, deliberately incorrect extraction.**
- **Maturity:** shaping first shipped in 4.4.0 (2025-04-17) and ReportLab's own release notes call it
  *"preliminary support for glyph shaping in south Asian languages"*
  (https://docs.reportlab.com/releases/notes/whats-new-44/). Sixteen months old. Before 4.4.0
  ReportLab did no shaping at all — TTF embedding only, which is **not** shaping.

### 4.3 Typst — Apache-2.0, 17 MB static binary, measured correct [M]

- **Licence:** Apache-2.0 (`LICENSE` in the release tarball, verified in the downloaded artifact;
  https://github.com/typst/typst/blob/main/LICENSE). Measured version **0.15.1 (9dfd3a08)**.
- **Shaping engine:** `rustybuzz` — a Rust port of HarfBuzz whose `src/hb/` contains
  `ot_shaper_indic.rs`, `ot_shaper_indic_machine.rs`, `ot_shaper_indic_table.rs`, `ot_shaper_use.rs`
  (https://github.com/harfbuzz/rustybuzz/tree/main/src/hb). rustybuzz is MIT and reports passing
  *"2221 out of 2252"* HarfBuzz shaping tests.
- **Measured:** the same bilingual test page compiled with `--font-path` and rendered — Bengali
  conjuncts, reph, pre-base matras and ya-phala all correct; Latin and `৳1,00,00,000` correct in the
  same run. Zero bare-virama glyphs and a single-glyph `ক্ষ` under the §7 gate.
- **Runtime:** one statically linked binary, 17.5 MB compressed / 54 MB unpacked (measured), no
  system libraries, no Python, no browser. A subprocess with a temp dir — **exactly the shape
  ADR-0001 already sanctions for LibreDWG.** It consumes none of the "GPL as subprocess" allowance
  because it is Apache-2.0 outright.
- **It is the only candidate measured whose Bengali text extracts correctly.** Typst's PDF backend
  was rewritten onto **krilla** (MIT/Apache-2.0) in PR #5420, shipped in 0.14.0, and krilla emits
  `/ActualText` marked-content spans automatically. Measured in the 0.15.1 output: the spans are
  there — inside a compressed object stream, which is why a naive byte grep misses them — and they
  carry the **logical** string, decoded from UTF-16BE as `কং`, `ক্রি`, `কি`, `র্ক`, `ক্য`, `রি`, `মা`.
  Extracted with pdfium (`pypdfium2`, the renderer this repo already sanctions), all three test lines
  round-trip **exactly**:

  ```
  PASS 'কংক্রিট পরিমাণ — RCC Column Concrete'
  PASS 'কি ক্ষ র্ক ক্য ন্ত্র · ৳1,00,00,000'
  PASS 'পরিমাপকৃত পরিধির সনদ / Certificate of Measured Coverage'
  all exact: True
  ```

  **Correction to an earlier reading in this research:** an initial extraction of the same file with
  `pdfjs-dist` returned garbage, which looked like a Typst defect. It is not — `pdf.js`'s
  `getTextContent()` does not honour `/ActualText`. The *document* was right and the *extractor* was
  wrong. Recorded because it is exactly the mistake this document warns against elsewhere: the tool
  you measure with is part of the measurement.
- **Known defects:** rustybuzz is **archived and unmaintained** upstream, which redirects to
  HarfRust; Typst's migration PR #8172 is still open. Low practical risk — the port is finished and
  the successor is by the same org — but it is a watch-item. Typst issue #4225 (OPEN), *"PDF text
  extraction can fail in complex shaping scenarios"* (Devanagari), predates the krilla backend; the
  0.14.0 changelog still flags that every character must appear in the ToUnicode mapping, *"which may
  currently not be the case in complex shaping scenarios"* — so treat the round-trip above as
  measured-true for these strings, not as a warranty. Open Indic issues #6339 and #8062 concern
  **line-breaking and hyphenation**, not shaping. Bengali rendering bug #5023 (`Noto Serif Bengali`,
  `ত্তি`) was reported and fixed the same day, 2024-09-25, shipping in 0.12 — the healthiest
  responsiveness signal in this survey.
- **If Typst is wanted in-process rather than as a subprocess:** `@myriaddreamin/typst-ts-node-compiler`
  (Apache-2.0, v0.7.0, prebuilt N-API binaries, no compiler on the install path — but gnu/musl must
  match the container). **Caveat, unverified:** that project's `Cargo.toml` patches every typst crate
  to a *fork*, and which upstream Typst version npm 0.7.0 embeds could not be established. Since the
  `/ActualText` behaviour above arrives with Typst ≥ 0.14, **the binding's embedded version must be
  confirmed before it can be assumed to inherit it.** The CLI measured here is 0.15.1 and does.
- **Cost:** the bill template is written in Typst markup, not HTML/CSS and not React. For a fixed
  A4 document with a table and a certificate block that is arguably a feature — Typst's paged model
  is native rather than emulated — but it is a template language nobody in the repo writes today, and
  the document's en+bn strings would need to reach it as data across a process boundary.

### 4.4 fpdf2 — real shaping, LGPL-3.0-only [M]

- **Licence:** **LGPL-3.0-only** — measured from the installed 2.8.8 dist-info
  (`License-Expression: LGPL-3.0-only`, `LICENSE` = GNU LGPL v3). It never relicensed:
  `py-pdf/fpdf2`'s LICENSE has a single commit, the initial one, 2013-07-31.
- **Shaping:** real, via optional `uharfbuzz` (`fpdf/fonts.py`: `import uharfbuzz as hb`,
  `perform_harfbuzz_shaping()`; https://py-pdf.github.io/fpdf2/TextShaping.html). **Off by default**
  — measured, `FPDF().text_shaping` is `None` until `set_text_shaping(True)`.
- **Measured:** identical to ReportLab's result — off is visibly broken, on is correct — and it was
  fpdf2's off/on pair in one document that produced the §7 discrimination evidence.
- **The licence is the question.** LGPL over a *pure-Python* module is a harder argument than
  WeasyPrint's `dlopen`, not an easier one: there is no dynamic-linking step, `import` is the only
  mechanism. ReportLab offers the same uharfbuzz capability under BSD-3.

### 4.5 Read but not carried forward

| Candidate | Licence | Why it falls away |
|---|---|---|
| **Apache FOP** | Apache-2.0 | Its own complex-scripts table reads **Bengali: Support *none*, Tested *none*** (https://xmlgraphics.apache.org/fop/2.11/complexscripts.html). FOP implements its own GSUB/GPOS processor rather than HarfBuzz, and has no Indic reordering shaper. Knowing the `bng2` script tag is a registration, not an implementation. |
| **wkhtmltopdf** | LGPL-3.0 | Repo archived 2023-01-02, last release 0.12.6 (2020), unpatched CVE-2022-35583 (SSRF, CVSS 9.8). Qt4 WebKit predates modern HarfBuzz integration. |
| **LaTeX (LuaLaTeX + luahbtex)** | LPPL macros, **GPLv2+ binaries** | Genuine HarfBuzz via luaotfload `mode=harf`, which the manual states is *required* for Indic scripts. But TeX Live `scheme-full` is ~9.4 GB and `scheme-basic` (~265 MB) lacks polyglossia. An order of magnitude heavier than Typst for the same subprocess shape. |
| **LibreOffice headless** | MPL-2.0 | Shaping confirmed in source (`vcl/source/gdi/CommonSalLayout.cxx` calls `hb_buffer_create` / `hb_buffer_set_cluster_level`). ~340–470 MB installed and you author ODT/DOCX rather than a document. Justifiable only if Office-format ingest were also needed. |
| **SILE** | MIT | Real HarfBuzz + ICU, but last release v0.15.13 (2025-05-31), small ecosystem, and needs system HarfBuzz+ICU — strictly dominated by Typst's static binary. |
| **Pango + cairo directly** | LGPL-2.1 / MPL-**1.1** | Same shaper as WeasyPrint, but you hand-write box layout and inherit cairo's older dual licence. No reason to prefer it to WeasyPrint, which dropped cairo. |
| **Prince XML / PDFreactor / DocRaptor** | Commercial | Excellent Indic quality; USD 3,800/server, 1,900–7,000/yr, and SaaS egress of quantity data respectively. Not permissive. |
| **skia-python + uharfbuzz** | BSD-3 | Skia's own docs state it *"does not shape text"* — you would wire uharfbuzz yourself, i.e. §4.6. |

### 4.6 The build-it-yourself floor

`uharfbuzz` (Apache-2.0, HarfBuzz bundled) → shaped glyph IDs with offsets; `fontTools` (MIT) →
subsetting and the `cmap` reverse mapping for a correct `/ToUnicode`; `pydyf` (BSD, WeasyPrint's own
writer) → the PDF bytes. This is the route where `/ToUnicode` and `/ActualText` correctness is ours to guarantee rather than
someone else's open bug, because we would own the cluster→codepoint mapping that WeasyPrint #2841 and
ReportLab's `hbAddPrivate` each get wrong. It is viable precisely because a BOQ is a fixed-layout
table, not flowing prose. It is also a text engine we would then own forever.

**The Node equivalent is `harfbuzzjs` + a writer** (§3.6) — same trade, same shaper, no Python.

Recorded as the floor the other options are measured against, not as a recommendation — and note
that Typst already reaches the extraction correctness this floor was going to buy (§4.3), which
removes most of its reason to exist.

---

## 5. Fonts

### 5.1 Noto Sans Bengali — SIL OFL 1.1, and the clause that matters

The licence shipped with the family is SIL Open Font License 1.1
(https://raw.githubusercontent.com/google/fonts/main/ofl/notosansbengali/OFL.txt, retrieved
2026-08-16). Three clauses decide our position, quoted from that file:

- **Embedding is granted outright.** *"Permission is hereby granted, free of charge, to any person
  obtaining a copy of the Font Software, to use, study, copy, merge, **embed**, modify, redistribute,
  and sell modified and unmodified copies of the Font Software…"*
- **The PDF does not inherit the licence.** Clause 5: *"The Font Software, modified or unmodified,
  in part or in whole, must be distributed entirely under this license… **The requirement for fonts
  to remain under this license does not apply to any document created using the Font Software.**"*
  An issued bill with an embedded subset is a document, not a redistribution of the font under
  another licence. This is the clause that makes OFL safe for a document product, and it is explicit.
- **Bundling the .ttf in the repo or the container carries one obligation.** Clause 2: bundled or
  redistributed copies must each carry *"the above copyright notice and this license"*, as a
  stand-alone text file, a human-readable header, or machine-readable metadata. So the font file
  ships **with its `OFL.txt` beside it** — the same discipline `cad-ingestion.md` §1 already applies
  to LibreDWG ("license text shipped").
- **No Reserved Font Name is declared.** The copyright line is *"Copyright 2022 The Noto Project
  Authors (https://github.com/notofonts/bengali)"* with no *"with Reserved Font Name"* suffix, so
  clause 3 does not bite even if the font were subset or instanced. (Subsetting for embedding is in
  any case an ordinary act of embedding, which clause 1 grants.)

SIL's own FAQ states both readings explicitly (https://openfontlicense.org/documents/OFL-FAQ.txt):
Q1.12 *"Can I embed OFL fonts in my document? Yes, either in full or a subset."*; Q1.13
*"Referencing or embedding an OFL font in any document does not change the license of the document
itself."*; Q1.20 *"At a minimum you must include the copyright statement, the license notice and the
license text."* Q2.6 notes that **subsetting counts as modification** — harmless here only because no
RFN is declared.

### 5.2 Embedding is a correctness requirement, not a nicety

Measured, all four producers embed a subset — every output PDF contains a `FontFile2` stream. That
is the right behaviour, and the spec explains why the alternative is not viable:

- ISO 32000-1:2008 §9.6.2.2 — the only fonts a reader must have are the **standard 14**
  (Times, Helvetica, Courier, Symbol, ZapfDingbats). **None contains a single Bengali glyph.**
- §9.5 and §9.8.1 — a font dictionary carries *"information that can be used to provide a substitute
  when the font program is not available"*, and metrics that let a reader *"synthesize a substitute
  font"*.

So a non-embedded Bengali font is a lottery on the reader's machine, and a *losing* one twice over:
if no Bengali face is installed you get notdef boxes, and if one is installed the substitute has
**different glyph IDs**, so a shaped Identity-H glyph stream renders as arbitrary glyphs. A print
shop's RIP is the worst case. **Embed, always.**

If a signed bill is ever to be archived, PDF/A-2b turns this into a validation rule
(veraPDF's implementation of ISO 19005-2:2011,
https://github.com/veraPDF/veraPDF-validation-profiles/wiki/PDFA-Parts-2-and-3-rules):
**6.2.11.4.1-1** *"The font programs for all fonts used for rendering within a conforming file shall
be embedded within that file"*; **6.2.11.7.2-1** *"The Font dictionary of all fonts shall define the
map of all used character codes to Unicode values, either via a ToUnicode entry, or other
mechanisms"*. Note that the second of those is exactly the rule §7.3 shows **every** candidate
currently violates for Bengali.

### 5.3 One file for both scripts — but only one of the two Noto builds [M]

Measured, the two official builds of the *same family name* differ in a way that decides the
document:

| Build | Glyphs | `A`–`z` | ASCII `0`–`9` | `৳` | Bengali digits `০` | em dash |
|---|---|---|---|---|---|---|
| google/fonts `NotoSansBengali[wdth,wght].ttf` (variable) | 730 | ✅ | ✅ | ✅ | ✅ | ✅ |
| notofonts `NotoSansBengali-Regular.ttf` (static) | 418 | ❌ | ❌ | ✅ | ✅ | ❌ |

The variable build sets the whole bilingual bill — Bengali, English, `৳1,00,00,000`, the em dash —
from **one embedded font**. The static build has **no Latin and no ASCII digits at all**: measured,
`fpdf2` warned *"Font MPDFAA+NotoSansBengali is missing the following glyphs: 'O' (O), 'F' (F), ':',
'—', 'R', 'C', 'o', 'l', 'u', 'm', …"* and dropped them. A producer that does not warn drops them
silently — which on a BOQ face means an English item description and the digits of a rate vanish
while the Bengali stays perfect.

**This is the font trap, and it is worth a test of its own:** whichever font is chosen, assert its
coverage of the document's full character set (Bengali block, Latin, ASCII digits, `৳`, the
punctuation the template uses) at build time, and pin the file by hash. Measured hashes for the two
builds are in §7.1.

### 5.4 The three Noto Bengali families, and the `bng2` trap

Inspected with `fontTools` over the current `google/fonts` binaries:

| Family | Version | GSUB script tags | Latin A–Z | Notes |
|---|---|---|---|---|
| **Noto Sans Bengali** | 3.011 | **`bng2` only** (+`latn`) | 26 ✅ | has `akhn rphf blwf half pstf vatu pres abvs blws psts cjct`; lacks `haln` |
| **Noto Serif Bengali** | 3.000 | `beng` **and** `bng2` | 26 ✅ | has `haln`; **lacks `half` and `vatu`** |
| **Noto Sans Bengali UI** | 2.001 | `beng` + `bng2` | **0 ❌** | no Latin at all — never for a bilingual document |

**The `bng2` trap.** Noto Sans Bengali registers its GSUB under the *v2* script tag `bng2` and **not**
under `beng`. HarfBuzz (and its ports) try the v2 tag first and are fine. Any naive OpenType engine
that looks up `ScriptList['beng']` finds **nothing** and emits completely unshaped text — silently,
with no error, from a font that visibly "has all the features". This is precisely the regression
class §7's gate exists to catch, and it is a second reason the feature-list query in §2 is not
evidence.

### 5.5 Alternatives, with their licences read

| Font | Licence (primary source) | Verdict |
|---|---|---|
| **Noto Serif Bengali** | OFL-1.1, no RFN (https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifbengali/OFL.txt) | ✅ the serif pairing; has Latin |
| **Hind Siliguri** | OFL-1.1, Indian Type Foundry | ✅ |
| **Anek Bangla** | OFL-1.1, Ek Type | ✅ |
| **Baloo Da 2** | OFL-1.1 | ✅ but a display face — wrong register for a bid document |
| **Kalpurush** | OFL-1.1 **with Reserved Font Name Kalpurush** (https://raw.githubusercontent.com/potasiyam/Kalpurush/master/LICENSE) | ⚠️ RFN bites: any subset or modification **must be renamed**. The repo ships no binary, so the provenance of any `.ttf` found elsewhere would have to be established separately. |
| **SolaimanLipi** | ⚠️ **unresolved** — a redistributor page claims OFL 1.1 with *no named copyright holder*; other sources say GPLv2 via ekushey.org | ❌ **do not ship.** No primary copyright statement means the licence cannot be cleared. |
| **Mukti / Mukti Narrow** | **GPL-3.0+ with font exception** (https://mitradranirban.github.io/fonts-mukti/) | ❌ copyleft; the font exception covers embedding in a document but not bundling the `.ttf`, which OFL does cleanly |

SolaimanLipi and Kalpurush are the two faces a Bangladeshi QS is most likely to *ask* for by name.
Both carry a cost — one unclearable, one a rename obligation — and neither is needed, because Noto
Sans Bengali covers the script under a licence with no ambiguity in it.

---

## 6. Lakh/crore grouping — measured, and one trap

Measured on this machine (Node v24.19.0, full ICU), formatting 10,000,000:

| Locale | Output | Note |
|---|---|---|
| `bn-BD` | `১,০০,০০,০০০` | lakh grouping, **Bengali digits** (`numberingSystem: beng`) |
| `bn-BD-u-nu-latn` | `1,00,00,000` | lakh grouping, ASCII digits |
| `en-IN` | `1,00,00,000` | lakh grouping, ASCII digits |
| **`en-BD`** | **`10,000,000`** | **Western grouping** — resolves to plain `en`; there is no `en-BD` in CLDR |

**The trap:** the obvious locale tag for the English face of a Bangladesh document, `en-BD`, silently
produces Western grouping. `bn-BD-u-nu-latn` is the tag that gives lakh grouping with ASCII digits.
This is exactly what `CLAUDE.md`'s lint rule anticipates — a document formatter must *state* its
locale, and which locale it states is a decision with a wrong answer that looks right.

The CLDR data behind those measurements
(https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-numbers-full/main/bn/numbers.json,
https://raw.githubusercontent.com/unicode-org/cldr/main/common/main/bn.xml):

- **`bn-BD` is not a CLDR locale.** It resolves to `bn`, because `likelySubtags` maps
  `bn → bn_Beng_BD`. So **`bn` *is* the Bangladesh locale**; `bn-IN` would be the one needing
  separate treatment. `en-BD` likewise does not exist and falls back to plain `en` — which is exactly
  why the measurement above prints Western grouping.
- **Digit set and grouping are orthogonal.** `decimalFormats` for **both** the `beng` and `latn`
  numbering systems are `#,##,##0.###`, and `currencyFormats` for both are `#,##,##0.00¤`. `#,##,##0`
  *is* the 3-2-2 Indic grouping. So `১,০০,০০,০০০` and `1,00,00,000` are both correct `bn`; only the
  digits differ, and the grouping never does.
- **CLDR puts the currency symbol after the number** (`#,##,##0.00¤`), measured as
  `১,০০,০০,০০০.০০৳`. `CLAUDE.md` states the target form as **`৳1,00,00,000`** — symbol first, ASCII
  digits. Both departures from CLDR are defensible (BD commercial practice does commonly prefix ৳),
  but they are **deliberate deviations and the formatter should say so in a comment**, or the next
  reader will "fix" it back to CLDR.
- Digits need no shaping: Bengali digits map 1:1 to glyphs with no reordering.

Whether the Bengali face prints Bengali digits or ASCII digits is a domain question this research
does not settle — CLDR's default for `bn` is `beng`, Bangladesh commercial practice mixes the two,
and a bill is a commercial document read by an accountant. **Named as an open decision (§9).**

---

## 7. How shaping is tested mechanically — the ticket's fourth question

Three strategies were proposed. All three were run against real PDFs from three different producers.

### 7.1 Glyph-level extraction — the one that gates CI

`pdfjs-dist` (**Apache-2.0**, v6.2.108, pure JS, no native dependency, measured) exposes the shaped
glyph run through `page.getOperatorList()`: each `OPS.showText` argument is an array of glyph objects
carrying the glyph's width and its `/ToUnicode` mapping. This runs inside `vitest`, in the existing
`test` stage of `pnpm verify` — **no new stage, no rasteriser, no native binary, no browser.**

Measured across three producers:

```
                      total glyphs   bare-virama glyphs   single-glyph "ক্ষ"
pdfkit  (shaped)          132                 0                   1
fpdf2   (off + on)        139                 6                   1     ← the 6 come from the OFF lines
Typst   (shaped)          119                 0                   1
```

- **Assertion A — no bare virama.** A correctly shaped Bengali run contains **zero** glyphs whose
  mapping is U+09CD; the virama is always consumed into a ligature or half-form. Measured, this fires
  exactly on the unshaped lines and on nothing else. It is font-version-independent and
  glyph-ID-independent.
- **Assertion B — cluster count.** `ক্ষ` is three codepoints and must emit **fewer than three**
  glyphs. This is the more robust of the two because it depends on **no** `/ToUnicode` correctness at
  all, only on counting — which matters, because §7.3 shows `/ToUnicode` is the least trustworthy
  thing in the file. Measured to discriminate on every producer.
- **Assertion C — pre-base matra order.** For `কি`, the matra glyph must be emitted **before** the
  base consonant. Measured directly in pdfkit's stream (`uni09BF` then `uni0995`) and in ReportLab's
  (`ি` then `ক`). This is the single most diagnostic behaviour, because no non-shaping renderer can
  produce it by accident.

What makes these stable enough to gate CI: none of them asserts a glyph **ID**, an advance width, an
absolute coordinate, or a rendered pixel. They assert *counts* and *order*, which are properties of
the shaping algorithm rather than of the font build or the rasteriser.

**Glyph IDs specifically must never be asserted.** Measured across two runs, the same character's
glyph ID differed (`uni09BF` was gid 11 in one subset and gid 14 in another) because every producer
subsets the font and renumbers by the set of glyphs actually used. A golden file of glyph IDs would
churn on any change to the document's text. Assert cmap-derived *names*, counts and ordering.

**The two assertion families are not redundant — you need both.** Measured:

- `কি` is **2 glyphs whether shaped or not** — only the *order* changes. So a count assertion alone
  is blind to a broken pre-base matra.
- `ক্ষ` is 1 glyph shaped and 3 unshaped, but its glyphs are in the same relative order either way.
  So an ordering assertion alone is blind to lost conjunct formation.

A gate that runs only one of them is a false sense of safety. Run B (count) *and* C (order).

**Caveat, stated:** Assertion A reads `/ToUnicode`, so a producer with broken `/ToUnicode` could in
principle hide a virama — and §7.3 shows every producer's `/ToUnicode` is partly broken. B and C are
the load-bearing pair; A is a cheap extra.

**Pin the font by content hash.** HarfBuzz's own shaping corpus names each test font by its SHA1
(`test/shape/data/in-house/fonts/8116e5d8….ttf`) and *skips tests when the font file hash does not
match* (https://github.com/harfbuzz/harfbuzz/blob/main/test/shape/README.md); Typst vendors fonts as
crates rather than reading system fonts. **Never resolve the font from the system** — fontconfig
ordering differs between a WSL dev box and a CI container, which would make every assertion above
meaningless. Measured SHA-256 for the two builds tested here: google/fonts variable
`dcd42978094e584a849c84a51450eeac40c8826057d566ea6d4b9627a403a05a`, notofonts static
`b55c62ee531e3214da6c0701daecea89a52ba42db7d8206b92e6b51f397a3193`. Record the font version
(`name` ID 5) beside the hash so a deliberate font bump reads as a font bump in the diff.

**An oracle is available if the assertions should be generated rather than written.** HarfBuzz's
`hb-shape` (and `harfbuzzjs`, MIT, or `uharfbuzz`, Apache-2.0) will shape the same string against the
same pinned font and emit `glyphname=cluster@xoff,yoff+advance` — the format of HarfBuzz's own
`.tests` corpus, e.g.
`…;U+091F,U+094D,U+200D,U+092F,U+093F;[uni093F=0+398|uni091F=0+876|…]`, where the pre-base matra
`uni093F` is emitted first: the exact Devanagari analogue of our `কি`. Comparing the PDF's glyph run
to a freshly-computed HarfBuzz run means the expectation never goes stale, and a HarfBuzz-level
regression surfaces separately from a producer-level one.

### 7.2 Rendered-image hashing — theatre at the exact-hash level

A page bitmap hash changes with the rasteriser version, antialiasing, hinting and subpixel
positioning, none of which are the property under test. Measured, the bitmaps here were produced by
`pypdfium2` 5.13.0 — a library whose pinned PDFium build changes on its own release schedule, so the
hash would churn on a dependency bump that touched no Bengali behaviour whatsoever. An exact hash
would be a flaky gate that teaches the team to regenerate goldens, which is how a check stops being a
check.

**Nobody serious gates on an exact image hash across environments**, and the projects that would
know say so in their test infrastructure:

- **Firefox reftest** carries `fuzzy(minDiff-maxDiff,minPixelCount-maxPixelCount)` annotations
  precisely for *"tests that should match but have unavoidable differences (antialiasing, etc.)"*
  (https://firefox-source-docs.mozilla.org/layout/Reftest.html).
- **web-platform-tests**, used by both Chromium and Firefox, has the same escape hatch in-test:
  `<meta name=fuzzy content="maxDifference=10-15;totalPixels=200-300">`
  (https://web-platform-tests.org/writing-tests/reftests.html).
- **Typst** *does* use reference PNGs — with a default per-channel tolerance of 1
  (`tolerance.unwrap_or(1)`, `tests/src/run.rs`) — and gets away with it only because its test world
  uses **vendored fonts and its own rasteriser**, never system fonts (`tests/src/world.rs`).
- **Unicode's own cross-engine text-rendering-tests** avoid pixels entirely: they compare **SVG path
  output**, allowing *"maximally 1 font design unit of difference"*
  (https://github.com/unicode-org/text-rendering-tests).

A fuzzy comparison is therefore defensible, but it buys nothing §7.1 does not already buy, at the
cost of a rasteriser inside `pnpm verify` and a tolerance nobody can justify from first principles.

Where a rendered image *is* the right instrument: as a **human-reviewed artifact** at the point the
native Bengali reviewer signs off (#128 gates that on first client issue), and as the thing a person
looks at when §7.1 goes red. Not as the assertion.

### 7.3 Text-extraction round-trip — worse than theatre; it is inverted

Measured, `fpdf2` writing the same string twice into one document — once unshaped, once shaped:

```
extracted, shaping OFF:  "OFF: কংক্রিট পরিমাণ — RCC Column Concrete"   ← identical to the input
extracted, shaping ON:   "ON: কংক্রি! \"# ট পরি%মাণ — RCC Column Concrete"
```

**The round-trip passes on the broken document and fails on the correct one.** The reason is
structural, not a bug in fpdf2: an unshaped PDF emits one glyph per codepoint in logical order, so
its `/ToUnicode` is trivially faithful; a shaped PDF reorders and merges clusters, and a `/ToUnicode`
CMap alone cannot describe that merge back to Unicode. The same failure was measured for pdfkit
(visual order, plus the empty-`bfchar` artifact) and for ReportLab (private-use codepoints where the
conjuncts are). It is corroborated upstream by WeasyPrint #2841 and ReportLab's `hbAddPrivate`
design.

**Typst is the exception, and the exception is instructive:** it round-trips exactly (§4.3) — not
because its `/ToUnicode` is better, but because it *additionally* emits `/ActualText`. So the
round-trip test does not measure shaping even when it succeeds; it measures whether the producer
bothered to describe its own output.

The mechanism is ISO 32000-1 §9.10.2 — *"If the font dictionary contains a ToUnicode CMap … use that
CMap to convert the character code to Unicode"* — and §9.10.3's `beginbfchar` / `beginbfrange`
operators, which is the very structure measured broken in pdfkit's output in §3.1 (an empty `<>`
entry inside a `bfrange`). §9.10.1 names the alternative: *"An `ActualText` entry for a structure
element or marked-content sequence … may be used to specify the text content directly."*

This result was reproduced independently in a second environment during this research, with a
different writer configuration and a different extractor: unshaped text round-tripped exactly, shaped
text came back with a stray `\x06`. Two measurements, two extractors, same inversion.

**So a round-trip assertion must never be used as a shaping gate.** It is, however, a legitimate gate
on a *different and genuinely valuable* property — whether a QS can search or copy a Bengali item
description out of an issued bill, and whether PDF/A-2b rule 6.2.11.7.2-1 holds. On that property the
candidates genuinely differ, and **Typst passes it exactly** because it emits `/ActualText` (§4.3)
while pdfkit, ReportLab and fpdf2 do not.

**Two warnings about running it.** First, the extractor is part of the measurement: `pdf.js`'s
`getTextContent()` **ignores `/ActualText`** and reported Typst's output as garbage, while `pdfium`
honours it and round-tripped it exactly. A round-trip test written against `pdfjs-dist` would fail a
correct document. Use `pypdfium2` for this one. Second, passing it proves nothing about shaping —
`fpdf2` with shaping *off* passes it perfectly.

### 7.4 What a gate would actually look like, and where it lands

One test file, one committed font pinned by hash, a handful of strings — `কি` (matra), `ক্ষ`
(conjunct), `র্ক` / `কর্ম` (reph), `ক্য` (ya-phala), `ন্ত্র` (stacked conjunct) — rendered through
whatever producer is chosen, read back glyph-by-glyph, asserting **B and C** (and A as a freebie).
Small, no service dependency, fails loudly when a toolchain upgrade drops the shaper, and per ADR-0007
it adds **no new stage** to the verify contract — only a test.

**Which side it lands on follows the renderer:**

- **Node renderer → `vitest`.** `pdfjs-dist` (Apache-2.0, pure JS) already gives the shaped glyph run
  through `getOperatorList()`; the `test` stage already exists. Nothing new enters the toolchain.
- **Python/subprocess renderer → `cad`'s `pytest`.** `fontTools` 4.63.0 is **already in
  `cad/uv.lock`** as an ezdxf transitive dependency (verified in the lockfile), so a test could read
  the embedded `FontFile2`, resolve CID→GID and name glyphs with no new dependency. But note the
  tension: `cad-ingestion.md` §6 says the pipeline stays geometry/spatial-only, and a Bengali shaping
  test is not geometry. It would be a test in `cad/` about something `cad/` does not do.

**Use the right tool for each half.** `pypdfium2` exposes **no glyph identity**: its `FPDFText_*` API
returns `GetUnicode` / `GetCharBox` / `GetCharOrigin`, all keyed on Unicode resolved from
`/ToUnicode` and `/ActualText`. That makes it the correct instrument for the §7.3 round-trip (it
honours `/ActualText`, which `pdf.js` does not) and the wrong instrument for the shaping gate, which
needs to know which glyph was drawn. `pdfjs-dist` is the reverse. Neither one alone covers both, and
using the wrong one produces a confident false result — as it did once during this research (§4.3).

---

## 8. The cross-cutting finding

Arrived at from two directions — measurement here, and open upstream bugs in WeasyPrint (#2841),
Typst (#4225) and ReportLab's `hbAddPrivate` design — **correct rendering and correct extraction are
different properties for Bengali, and most toolchains deliver only the first.** Shaping reorders and
merges clusters; a `/ToUnicode` CMap alone cannot describe that merge back to Unicode, so the
extracted string comes out in visual order with holes in it. The fix is `/ActualText`, and it has to
be emitted deliberately by the producer.

Measured, **Typst is the one candidate that does emit it**, and its Bengali round-trips exactly
(§4.3). pdfkit, ReportLab and fpdf2 do not — pdfkit's `text()` ignores its own `actual` option
entirely, and ActualText there needs the tagged-PDF `doc.struct` API written by hand.

Why this matters to the ticket rather than being trivia: a signed, certificate-bound bill is a
document a QS reads **and** a document a machine may later re-read — searched, indexed, diffed
against a re-issue, or checked by a procuring entity. `quantity-contract.md` §6 makes the certificate
travel with the bill; it does not say the bill must be machine-readable text. **If the founder
decides it must be, that requirement selects the toolchain almost by itself.** If it need not be,
the field stays open and the decision returns to runtime and licence.

Related, and worth stating plainly: a document whose Bengali cannot be extracted is also a document
whose Bengali cannot be *checked* by anything but a human reader — which is a live concern for a
product whose governing sentence is about partial faulty output, and for the native-Bengali review
#128 defers to first client issue.

---

## 9. What the founder decides

1. **Runtime.** Node in-process (§3.1/§3.2) keeps the document stage in the app under ADR-0001's
   one-`tsconfig` rule and adds no process boundary. A subprocess (§4.3 Typst) matches the shape
   ADR-0001 already sanctions for LibreDWG but adds a second artifact contract; a Python renderer
   additionally contradicts `cad-ingestion.md` §6's *"geometry/spatial-only"* unless it lands as a
   third project or that clause is amended.
2. **Is headless Chromium a "browser print"?** §6's parenthesis reads as a reason to one eye and a
   definition to another. It is the best renderer and the heaviest dependency.
3. **Does the bill need to be text-searchable in Bengali?** This is the question that most narrows
   the field. If **yes**, Typst is the only candidate measured that satisfies it today (§4.3, §8),
   and the others would need `/ActualText` written by hand or the §4.6 floor. If **no**, three
   permissive options are measured working right now and the choice reverts to runtime and licence.
4. **Bengali digits or ASCII digits on the Bengali face** (§6) — CLDR says `beng`, commerce says it
   varies, and the bill is a commercial document. Related and smaller: `CLAUDE.md`'s `৳1,00,00,000`
   prefixes the symbol where CLDR `bn` suffixes it. Both deviations are defensible; both should be
   *stated* in the formatter rather than left to be discovered.
5. **Which font file, pinned by which hash** (§5.3–§5.5) — the two official Noto Sans Bengali builds
   are not interchangeable: one has Latin and ASCII digits, one does not. Whichever is chosen ships
   with `OFL.txt` beside it (OFL clause 2) and a coverage assertion over the document's full
   character set.
6. **LGPL posture** — whether WeasyPrint's `dlopen` of Pango, and separately fpdf2's pure-Python
   LGPL-3.0, are inside or outside "permissive" for this repo. ReportLab (§4.2) makes the question
   avoidable on the Python side; Typst (§4.3) makes it avoidable entirely.
7. **The licence test named in `cad-ingestion.md` §1 and ADR-0001 does not exist yet** — grep of the
   tree finds no reference to `pypdfium2`, `fitz`, `mutool` or AGPL in any test (measured). ADR-0001
   says *"enforced by a test when a PDF lane lands"*. A document renderer **is** a PDF lane. Note
   also that `eslint.config.js` ignores `cad/**`, so a Python-side licence assertion has to be a
   pytest, not a lint rule.
