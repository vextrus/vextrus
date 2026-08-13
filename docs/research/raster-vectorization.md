# Raster to geometry — the vectorization stack, its determinism, its floor

**Researched 2026-08-13** for `.wayfinder/takeoff/tickets/07-raster-to-geometry.md`. Research
only; decides nothing. Every claim carries a primary-source URL. Licence claims name the actual
file the text came from. Anything I could not read at source is marked **[UNVERIFIED]** and no
number is invented in its place.

This builds on, and does not repeat, `docs/research/ai-for-drawing-understanding.md` (model
licences, OmniDocBench, symbol spotting) and `docs/research/dwg-pdf-ingestion-licensing.md`
(PDF libraries, AGPL ban, GPL-by-subprocess).

---

## Summary — the seven findings that matter

1. **The ticket's premise about LSD is wrong in a way that helps us.** LSD was removed from
   OpenCV over a **licence conflict, not a patent** — the reference implementation on IPOL is
   **AGPL-3.0-or-later**. OpenCV's own class docs: *"Implementation has been removed from OpenCV
   version 3.4.6 to 3.4.15 and version 4.1.0 to 4.5.3 due original code license conflict.
   restored again after Computation of a NFA code published under the MIT license."*
   ([OpenCV docs](https://docs.opencv.org/4.x/db/d73/classcv_1_1LineSegmentDetector.html)) So
   **`cv::LineSegmentDetector` is back in core `imgproc` from 4.5.4 onward and is permissively
   licensed.** Do not use the original IPOL `lsd.c`; use OpenCV's.
2. **The whole classical geometry lane is clean.** OpenCV (Apache-2.0), opencv_contrib
   (Apache-2.0), scikit-image (BSD-3). LSD, Fast Line Detector, Hough, EdgeDrawing/EDLines,
   Zhang-Suen thinning — all permissive, all available today. **Potrace (GPL-2.0-or-later) and
   AutoTrace (GPL-2.0+ program / LGPL-2.1+ library) are the only copyleft entries, and potrace
   is useless to us anyway**: its own FAQ says *"Potrace is not designed to do centerline
   tracing."* A drawn line traced by potrace comes back as a closed outline of the ink, not a
   line.
3. **The classical detectors are deterministic by construction, and I verified this in the
   source, not the docs.** `lsd.cpp` and `fast_line_detector.cpp` contain **no RNG and no
   `parallel_for`**. `HoughLinesP` *does* randomise, but with a **hardcoded fixed seed** —
   `RNG rng((uint64)-1);`
   ([hough.cpp:548](https://raw.githubusercontent.com/opencv/opencv/4.x/modules/imgproc/src/hough.cpp))
   — so it too repeats exactly. **Neural OCR is the opposite:** PyTorch's own docs say
   *"Completely reproducible results are not guaranteed across PyTorch releases, individual
   commits, or different platforms"*
   ([reproducibility notes](https://docs.pytorch.org/docs/stable/notes/randomness.html)), and
   vLLM's FAQ answers "can the output of a prompt vary across runs" with *"Yes, it can."*
   ([vLLM FAQ](https://docs.vllm.ai/en/latest/usage/faq/)).
4. **Bangla primary figures now exist and they are bad.** Three independent primary sources:
   Surya 2's own README reports **Bengali 82.7%** on its internal 91-language benchmark
   ([README](https://raw.githubusercontent.com/datalab-to/surya/master/README.md)); bbOCR
   (AAAI'24, Bengali.AI/BRACU) reports **text-level CER 0.59 for bbOCR and 0.78 for Tesseract**
   averaged over nine scanned-document domains
   ([arXiv:2308.10647](https://arxiv.org/abs/2308.10647)); BanglaWild reports **Tesseract CER
   98.46, Surya 191.32, EasyOCR 48.43, best VLM (Gemini 2.5 Flash) 14.08** on in-the-wild
   Bengali ([arXiv:2608.03884](https://arxiv.org/html/2608.03884v1)). **And PaddleOCR — our
   preferred OCR stack — does not ship a Bengali model at all.**
5. **The ticket's claim about benchmarks is half right and needs amending.** There is no modern
   benchmark for *scanned construction-drawing* vectorization. But there **is** a directly
   relevant older literature the ticket does not cite: the IAPR **GREC arc/line segmentation
   contests** with the **Vector Recovery Index**, and — most usefully — a **published
   DPI-vs-accuracy study on engineering drawings at 200/300/400 DPI**
   ([Al-Douri, Al-Khaffaf & Talib 2011, doi:10.1007/978-3-642-25191-7_17](https://link.springer.com/chapter/10.1007/978-3-642-25191-7_17)).
   Its finding is not "more DPI is better" — it is **"different scanning resolutions affect the
   software differently,"** with two of three tools peaking at 300 and *declining* at 400. We
   still have to measure our own, but we are not starting from nothing and we should not assume
   monotonicity.
6. **The scan-quality floor has a citable rule, and it is not a DPI number — it is a
   pixels-across-the-thinnest-line rule.** NARA, on non-textual edge-based graphics such as maps
   and plans: *"a better representation of detail would be the width of the finest line, stroke,
   or marking that must be captured in the digital surrogate. To fully represent such a detail,
   **at least 2 pixels should cover it**."*
   ([NARA 2004 Technical Guidelines, p.43](https://www.archives.gov/files/preservation/technical/guidelines.pdf))
   Tesseract's own rule for the text half: *"Below an x-height of 10 pixels, you have very little
   chance of accurate results"*
   ([tessdoc FAQ](https://raw.githubusercontent.com/tesseract-ocr/tessdoc/main/tess3/FAQ-Old.md)).
   **Both rules independently condemn the 150 dpi fax** (§5).
7. **The strongest single number for the whole lane** is Surya 2's own per-source pass rate on
   olmOCR-bench: **`OldScan` 41.8%** against `Base` 99.7%
   ([README](https://raw.githubusercontent.com/datalab-to/surya/master/README.md)). A
   near-frontier document model loses ~58 points when the page is an old scan rather than a
   clean render. Whatever we ship for the scan lane, the honest prior is that scan quality — not
   model choice — is the dominant term.

---

## 1. The vectorization stack, permissively licensed only

### 1a. The distinction that organises everything: geometry vs text

These are two different pipelines with two different licence profiles, two different
determinism stories, and two different failure modes. Conflating them is the main way this
lane goes wrong.

| Produces **geometry** (lines, arcs, polylines) | Produces **text** (strings, boxes) |
|---|---|
| OpenCV `LineSegmentDetector`, `HoughLines`/`HoughLinesP`, `ximgproc::FastLineDetector`, `ximgproc::EdgeDrawing` (EDLines/EDCircles), `ximgproc::thinning` | Tesseract, PaddleOCR / PP-OCRv5, PaddleOCR-VL, DeepSeek-OCR, docTR, EasyOCR, Surya |
| scikit-image `hough_line`, `probabilistic_hough_line`, `skeletonize`, `find_contours`, `approximate_polygon` | Table Transformer (structure, not glyphs) |
| potrace, AutoTrace (region outlines / centerlines) | — |
| **Deterministic classical algorithms** | **Neural; see §2** |

**No permissive tool in this list emits an arc segment with endpoints.** `EdgeDrawing::detectEllipses`
returns circles and ellipses; `HoughCircles` returns full circles. Arc *segmentation* — a bounded
arc with two endpoints and a radius, which is what a DXF `ARC` is — has no off-the-shelf
permissive implementation I found. That is precisely why the GREC community ran an arc
segmentation contest for a decade (§4). **Treat arcs as an unsolved sub-problem of this lane,
not a library call.**

### 1b. Licence verification — geometry tools

Each row names the file the licence text was read from.

| Tool | Licence | File verified | Verdict |
|---|---|---|---|
| **OpenCV core** (`imgproc`: LSD, Hough) | **Apache-2.0** | [`opencv/4.x/LICENSE`](https://raw.githubusercontent.com/opencv/opencv/4.x/LICENSE) — *"Apache License Version 2.0, January 2004"* | **Clean** |
| `modules/imgproc/src/lsd.cpp` (file header) | legacy **BSD-3-Clause** — *"License Agreement For Open Source Computer Vision Library. Copyright (C) 2013, OpenCV Foundation"* | [lsd.cpp](https://raw.githubusercontent.com/opencv/opencv/4.x/modules/imgproc/src/lsd.cpp) | **Clean.** OpenCV relicensed to Apache-2.0 in the 4.5 series; older files still carry the BSD header. Both permissive, no conflict |
| **opencv_contrib** (`ximgproc`: FastLineDetector, EdgeDrawing, thinning) | **Apache-2.0** | [`opencv_contrib/4.x/LICENSE`](https://raw.githubusercontent.com/opencv/opencv_contrib/4.x/LICENSE) | **Clean**. `fast_line_detector.cpp` carries only *"It is subject to the license terms in the LICENSE file found in the top-level directory"* — no third-party encumbrance |
| **scikit-image** | **BSD-3-Clause** (some files BSD-2 / MIT) | [`LICENSE.txt`](https://raw.githubusercontent.com/scikit-image/scikit-image/main/LICENSE.txt) | **Clean** |
| **potrace** | **GPL-2.0-or-later** — *"under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2, or (at your option) any later version"* | [potrace.sourceforge.net](https://potrace.sourceforge.net/) | **GPL — subprocess-only, same discipline as LibreDWG.** But see 1d: it cannot do what we need |
| **AutoTrace** | program **GPL-2.0-or-later** (`COPYING` = GPLv2 text); library **LGPL-2.1-or-later** (`COPYING.LIB` = *"GNU LESSER GENERAL PUBLIC LICENSE Version 2.1, February 1999"*) | [COPYING](https://raw.githubusercontent.com/autotrace/autotrace/master/COPYING), COPYING.LIB (verified by direct fetch, HTTP 200) | **Copyleft. Subprocess-only if used at all.** The LGPL library split is real but buys us nothing over subprocessing |

**The original LSD reference implementation is AGPL and must never enter the tree.** IPOL's
publication page for Grompone von Gioi, Jakubowicz, Morel & Randall, *"LSD: a Line Segment
Detector"* states the source code is **AGPL-3.0-or-later**
([ipol.im/pub/art/2012/gjmr-lsd](https://www.ipol.im/pub/art/2012/gjmr-lsd/)). This is the
licence conflict OpenCV's docs refer to. OpenCV's re-implementation, restored in **4.5.4** (the
docs name the removal window as 4.1.0–4.5.3), is the one to use. **This corrects the ticket's
"patent" framing: there is no patent, there was an AGPL contamination, and it is resolved.**

**One packaging flag, verified.** The prebuilt PyPI wheels are not pure Apache-2.0: the
`opencv-python` README states *"All wheels ship with FFmpeg licensed under the LGPLv2.1"*, and
*"Non-free algorithms such as SURF are not included in these packages because they are patented
/ non-free and therefore cannot be distributed as built binaries"*, while *"SIFT is included in
the builds due to patent expiration since OpenCV versions 4.3.0 and 3.4.10"*
([README](https://raw.githubusercontent.com/opencv/opencv-python/4.x/README.md)). LGPL-2.1
FFmpeg in a server-side wheel is not a conveying event and not a problem for us, but a licence
test that asserts "everything shipped is permissive" should know it is there.

### 1c. Licence verification — text/OCR tools

| Tool | Code licence | Weights licence | Verdict |
|---|---|---|---|
| **Tesseract** | **Apache-2.0** ([LICENSE](https://raw.githubusercontent.com/tesseract-ocr/tesseract/main/LICENSE)) | `tessdata_best` **Apache-2.0** ([LICENSE](https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/LICENSE)) — this includes `ben.traineddata` | **Clean, code and weights** |
| **PaddleOCR / PP-OCRv5** | Apache-2.0 (verified in `dwg-pdf-ingestion-licensing.md` §5) | Apache-2.0 | **Clean** — but **no Bengali model**, see §3 |
| **PaddleOCR-VL** | **Apache-2.0** — HF card licence field reads `apache-2.0` ([HF card](https://huggingface.co/PaddlePaddle/PaddleOCR-VL)) | same card | **Clean, and SOTA on OmniDocBench** |
| **DeepSeek-OCR** | **MIT** ([HF card](https://huggingface.co/deepseek-ai/DeepSeek-OCR)) | same card | **Clean** |
| **docTR** (Mindee) | **Apache-2.0** (verified in `ai-for-drawing-understanding.md` §1d, [LICENSE](https://raw.githubusercontent.com/mindee/doctr/main/LICENSE)) | same | **Clean** — but no Bengali *pretrained model*, see §3 |
| **EasyOCR** | **Apache-2.0** ([LICENSE](https://raw.githubusercontent.com/JaidedAI/EasyOCR/master/LICENSE)) | **not separately licensed.** `bengali.pth` is distributed from the project's own GitHub release (`easyocr/config.py` → `releases/download/v1.1.8/bengali.zip`) with no distinct weights licence file I could find — **[UNVERIFIED]**, read as covered by the repo Apache-2.0 but confirm before shipping | **Probably clean; the weights licence is an open question** |
| ↳ EasyOCR's CRAFT detector | **MIT** — *"Copyright (c) 2019-present NAVER Corp."* ([LICENSE](https://raw.githubusercontent.com/clovaai/CRAFT-pytorch/master/LICENSE)) | — | Clean |
| **Table Transformer** | **MIT** (verified in `ai-for-drawing-understanding.md` §1d) | — | Clean |
| **Surya** | Apache-2.0 (`LICENSE` is the Apache-2.0 text, verified by direct fetch) | **modified AI Pubs Open-RAIL-M.** README, verbatim: *"The Surya code is licensed under Apache 2.0. The model weights use a modified AI Pubs Open Rail-M license (free for research, personal use, and startups under $5M funding/revenue)."* ([README](https://raw.githubusercontent.com/datalab-to/surya/master/README.md)) | **REVENUE-GATED BOMB. Do not build on it.** Re-confirmed at source this session |
| **LayoutLMv3** | **CC BY-NC-SA 4.0** — non-commercial (verified in `ai-for-drawing-understanding.md` §1d) | — | **BANNED** |

**Explicit bomb list for this lane:** AGPL — the original IPOL `lsd.c`, plus Ghostscript /
MuPDF / PyMuPDF already banned in `dwg-pdf-ingestion-licensing.md` §4. GPL — potrace, AutoTrace
(program), LibreDWG. Non-commercial — LayoutLMv3. Revenue-capped — Surya weights and therefore
Marker's default configuration. Nothing else in this document is encumbered.

### 1d. The recommended stack, and why potrace is not in it

**Potrace cannot do this job and no licence analysis is needed to reject it.** Its own FAQ:
*"No, Potrace is not designed to do centerline tracing, and for technical reasons, it is
unlikely that this will change in the near future."*
([potrace FAQ](https://potrace.sourceforge.net/faq.html)) Potrace traces the *boundary* of black
regions. A 0.25 mm wall line in a scan becomes a long thin closed loop — two nearly-parallel
paths plus two end caps — not one centerline. Converting that back to a centerline is the
original problem again. AutoTrace does offer `-centerline`
([README](https://raw.githubusercontent.com/autotrace/autotrace/master/README.md)) and is
therefore the only copyleft tool here with a real capability argument — but it is GPL, single-
maintainer, and produces the same output shape OpenCV's LSD gives us under Apache-2.0.

**The verified-clean pipeline, all permissive, all deterministic (§2):**

```
raster page (pypdfium2, Apache-2.0/BSD — already ruled in)
  → binarize            scikit-image (BSD-3): threshold_otsu / threshold_sauvola
  → text/graphics split (no permissive implementation found — see below)
  → thinning            cv2.ximgproc.thinning, THINNING_ZHANGSUEN | THINNING_GUOHALL (Apache-2.0)
  → line detection      cv2.LineSegmentDetector (Apache-2.0/BSD-3, imgproc, ≥4.5.4)
                        cv2.ximgproc.createFastLineDetector (Apache-2.0)
                        cv2.HoughLinesP (Apache-2.0)   ← only where the grid is known
                        cv2.ximgproc.EdgeDrawing → detectLines / detectEllipses (Apache-2.0)
  → text                Tesseract (Apache-2.0) or PaddleOCR (Apache-2.0); Bangla → §3
```

`ximgproc::thinning` is documented as *"Applies a binary blob thinning operation, to achieve a
skeletization of the input image"* with `THINNING_ZHANGSUEN` and `THINNING_GUOHALL`
([ximgproc docs](https://docs.opencv.org/4.x/df/d2d/group__ximgproc.html)).
`EdgeDrawing` is documented as *"Class implementing the ED (EdgeDrawing), EDLines, EDPF,
EDCircles and ColorED algorithms"*
([EdgeDrawing docs](https://docs.opencv.org/4.x/d1/d1c/classcv_1_1ximgproc_1_1EdgeDrawing.html))
— it is the one permissive tool in the set that offers lines *and* conic primitives from one
edge map, which makes it the most interesting candidate for the arc gap.

**The named hole in the pipeline: text/graphics separation.** No permissive implementation of
the classical Fletcher–Kasturi connected-component text/graphics separation was located in
OpenCV or scikit-image in this session — **[UNVERIFIED]** whether one exists elsewhere under a
clean licence. On a construction drawing this matters more than the detector choice: dimension
strings, hatching and title-block text all become spurious short segments if they reach LSD.
This is a build, not a dependency.

**`FastLineDetector` is Canny-based, and that is a design constraint, not a detail.** Its
parameters are `canny_th1`, `canny_th2`, `canny_aperture_size`, and *"setting to zero skips
Canny and treats input as an edge image"*
([FLD docs](https://docs.opencv.org/4.x/df/ded/group__ximgproc__fast__line__detector.html)).
Two hardcoded Canny thresholds against scans of unknown contrast is exactly the "no silent
defaults" hazard in CLAUDE.md. Either the thresholds become effective-dated config affirmed per
scan profile, or we feed FLD a binarized edge image we produced deterministically ourselves and
set the aperture to zero. LSD, by contrast, is presented by its authors as *"designed to work on
any digital image without parameter tuning"*
([IPOL](https://www.ipol.im/pub/art/2012/gjmr-lsd/)) — which is the better fit for our law.

---

## 2. Determinism

### 2a. Classical geometry — verified in the source, not inferred

I grepped the actual implementation files for randomness and parallelism. This is the primary
source; the docs say nothing about determinism either way.

| Detector | RNG in source? | `parallel_for`? | Bit-identical on re-run? |
|---|---|---|---|
| `cv::LineSegmentDetector` (`modules/imgproc/src/lsd.cpp`) | **none** | **none** | **Yes** — pure deterministic algorithm: gradient computation, pseudo-ordered region growing, rectangle fitting, NFA validation. No sampling anywhere |
| `cv::ximgproc::FastLineDetector` (`modules/ximgproc/src/fast_line_detector.cpp`) | **none** | **none** | **Yes** — Canny + connected-segment growing + least-squares fit |
| `cv::HoughLines` (standard) | none | — | **Yes** — deterministic accumulator vote |
| `cv::HoughLinesP` (probabilistic) | **`RNG rng((uint64)-1);`** at [hough.cpp:548](https://raw.githubusercontent.com/opencv/opencv/4.x/modules/imgproc/src/hough.cpp), used at line 623 `int idx = rng.uniform(0, count);` with the comment *"stage 2. process all the points in random order"* | — | **Yes, in practice** — the seed is a compile-time constant, so the "random" traversal is a fixed pseudo-random sequence. It is *not* seeded from time or entropy. But note the determinism is an implementation accident, not a documented contract: **a future OpenCV could change the seed and silently move every segment.** Pin the OpenCV version if HoughLinesP is used |

**The residual risk that is real and unmeasured.** All of these are floating-point. OpenCV
dispatches at runtime to different SIMD paths (SSE4.2 / AVX2 / AVX-512 / NEON) depending on the
CPU it finds. Floating-point reductions are not associative, so **bit-identity across different
CPUs, different OpenCV builds, or a CPU-vs-container-migration is not guaranteed and I found no
primary source claiming it is. [UNVERIFIED].** This is directly measurable and should be: run
the same page through the same pinned OpenCV on two different host CPU families and diff the
segment list. Until that measurement exists, the honest statement to ticket 02 is: **identical
input + identical binary + identical CPU ⇒ identical geometry; change any of those three and we
do not know.**

**The consequence for source keys.** Under `docs/domain/identity.md` no coordinate may enter an
identity key, so raster geometry cannot key an element by construction. But a *source key* that
points at "the segment LSD found here" is coordinate-derived and therefore inherits every one of
the caveats above. The defensible design is that a re-vectorization produces a **new proposal
set that must be reconciled against the affirmed register**, never a set of keys assumed to
match. Re-ingest of a scan is a supersession event, not an idempotent replay.

### 2b. Neural OCR — not reproducible, and the vendors say so

There is no ambiguity here and nobody claims otherwise.

- **PyTorch**, which every candidate model runs on: *"Completely reproducible results are not
  guaranteed across PyTorch releases, individual commits, or different platforms. Furthermore,
  results may not be reproducible between CPU and GPU executions, even when using identical
  seeds."* The mitigation offered is `torch.use_deterministic_algorithms()`, which *"lets you
  configure PyTorch to use deterministic algorithms instead of nondeterministic ones where
  available, and to throw an error if an operation is known to be nondeterministic (and without
  a deterministic alternative)"*
  ([reproducibility notes](https://docs.pytorch.org/docs/stable/notes/randomness.html)). Note
  what that second clause means: for some ops there **is** no deterministic alternative and the
  library's answer is to raise.
- **vLLM**, the serving runtime PaddleOCR-VL, DeepSeek-OCR and Surya are deployed on. Q: *"Can
  the output of a prompt vary across runs in vLLM?"* A: *"Yes, it can."* Cause: *"Variations in
  logprobs may occur due to numerical instability in Torch operations or non-deterministic
  behavior in batched Torch operations when batching changes,"* because *"the same requests
  might be batched differently due to factors such as other concurrent requests, changes in
  batch size, or batch expansion in speculative decoding"*
  ([vLLM FAQ](https://docs.vllm.ai/en/latest/usage/faq/)). **Greedy decoding does not save you**
  — the divergence is upstream of the sampler, in the logits, and once a different token is
  selected *"further divergence is likely."* vLLM documents a `VLLM_BATCH_INVARIANT=1` mode
  whose stated purpose is that *"the output of a model is deterministic and independent of the
  batch size or the order of requests in a batch"*
  ([Batch Invariance](https://docs.vllm.ai/en/latest/features/batch_invariance/)) — I did not
  verify its performance cost or its coverage; **[UNVERIFIED]**.
- **Across hardware:** no candidate model card makes any reproducibility claim at all. Not
  PaddleOCR-VL, not DeepSeek-OCR, not docTR, not Surya. **[UNVERIFIED] — and the absence is
  itself the finding: nobody is promising this.**
- **Tesseract** is the interesting exception. Its recognition path is an LSTM forward pass plus
  CTC/beam decode with no sampling step, so it *should* be deterministic — but **I found no
  primary source stating bit-identical reproducibility, and I did not audit the source for RNG
  use. [UNVERIFIED].** If determinism is required from the text lane, Tesseract is the candidate
  to measure first, because it is the only one whose architecture makes the claim plausible.

**The design conclusion.** Geometry can be deterministic; text cannot be assumed to be. That
argues for the same split the register already imposes: **machine geometry is a proposal that a
human affirms once, and the affirmed value — not the detector — is what re-ingest must
reproduce.** Storing the OCR string as an affirmed input, rather than re-deriving it on every
open, is the only way a scan-lane element survives a model upgrade.

---

## 3. Bangla OCR — primary figures exist, and they are worse than the ticket assumed

The prior research recorded "no primary-source Bangla OCR accuracy figure exists." **That is now
superseded: three primary sources report Bengali figures.** All three should be read together,
because they measure different things and disagree by an order of magnitude.

### 3a. Which candidate stacks even claim Bangla

| Stack | Claims Bangla? | Evidence |
|---|---|---|
| **PaddleOCR / PP-OCRv5** | **NO.** The published multilingual model list has 11 recognition models — korean, latin, eslav, th, el, en, cyrillic, arabic, devanagari, ta, te — and **Bengali appears in none of them**. The 106-language abbreviation table contains no `bn` row ([PP-OCRv5 multilingual doc](https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.en.md)). A `ppocr/utils/dict/bengali_dict.txt` character dictionary **does** exist on `main` (fetched, HTTP 200, 90-odd Bengali codepoints) but a GitHub code search for `bengali_dict` in the repo returns **zero** references — an orphan dictionary with no released model | Primary doc + repo |
| **PaddleOCR-VL** | **Unclear.** Card says *"Supports 109 languages… including but not limited to Chinese, English, Japanese, Latin, and Korean, as well as… Russian (Cyrillic script), Arabic, Hindi (Devanagari script), and Thai."* **Bengali is not named**, and no per-language table is published ([HF card](https://huggingface.co/PaddlePaddle/PaddleOCR-VL)) — **[UNVERIFIED]** either way |
| **docTR** | **Vocab yes, model no.** `doctr/datasets/vocabs.py` defines `VOCABS["bengali"]` from Bengali consonants, vowels, digits, matras, virama, signs and punctuation — and notably includes `"৳"`, the taka sign. But the docs state *"most of our recognition models were trained on our french vocab"* and **no pretrained Bengali recognition model is listed** ([vocabs.py](https://raw.githubusercontent.com/mindee/doctr/main/doctr/datasets/vocabs.py), [using_models](https://mindee.github.io/doctr/using_doctr/using_models.html)). docTR is a *training* path to Bangla, not a deployment one |
| **Tesseract** | **Yes** — `ben.traineddata` ships in `tessdata_best` under Apache-2.0 | [LICENSE](https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/LICENSE) |
| **EasyOCR** | **Yes** — `easyocr/config.py` defines `bengali_lang_list = ['bn','as','mni']` and a `bengali_g1` model (`bengali.pth`) ([config.py](https://raw.githubusercontent.com/JaidedAI/EasyOCR/master/easyocr/config.py)) | Repo source |
| **DeepSeek-OCR** | **Unclear.** Card is tagged "multilingual" but names no languages; the paper abstract states no language count ([HF card](https://huggingface.co/deepseek-ai/DeepSeek-OCR), [arXiv:2510.18234](https://arxiv.org/abs/2510.18234)) — **[UNVERIFIED]** |
| **Surya** | **Yes, with a number** — but revenue-gated weights | [README](https://raw.githubusercontent.com/datalab-to/surya/master/README.md) |

**The load-bearing consequence: our preferred OCR stack has no Bangla.** PaddleOCR is the
Apache-2.0 SOTA recommended in `ai-for-drawing-understanding.md` §7, and it cannot read Bangla
today. The two permissive stacks that *can* are Tesseract and EasyOCR, and the figures below are
about them.

### 3b. The primary figures

**Surya 2, self-reported, internal benchmark** —
[README](https://raw.githubusercontent.com/datalab-to/surya/master/README.md):

> **Overall pass rate: 87.2% across 91 languages.** … `bn` Bengali **82.7%**

Caveats that must travel with this number: it is a **vendor self-report on an internal,
unpublished benchmark**; "score" is a *pass rate* over a composite of *"text accuracy, layout,
tables, math, and reading order"*, **not a CER**; and the weights are revenue-gated, so we
cannot use the system that produced it. Context from the same README: Bengali 82.7% sits below
English 92.3% and above Arabic 72.7%.

**bbOCR (Bengali.AI + BRAC University), scanned printed Bengali documents** —
[arXiv:2308.10647](https://arxiv.org/abs/2308.10647), source code **BSD-3-Clause**
([LICENSE](https://raw.githubusercontent.com/BengaliAI/bbocr/main/LICENSE)). Evaluated on their
own **BCD3** dataset: *"9 categories of documents having 88.5K annotated words"* — Book, Book
Cover, Government Document, Magazine, Multi Column Book, New Newspaper, Old Newspaper, Property
Document, Single Column Book. Text-level (reading-order-aware, whole-document) results, from
Table 2 of the paper PDF:

| System | mean text-level **CER ↓** | mean text-level **WER ↓** |
|---|---|---|
| Tesseract | **0.78** | **0.97** |
| bbOCR | **0.59** | **0.80** |

Component-level, same dataset: *"The accuracy of the text recognition model APSIS-Net is **75%**
in the same dataset."* Conclusion in the authors' words: *"we observed 8.44% decrease in WER and
11.77% decrease in CER for bbOCR on average across all domains."* The paper also states the
pipeline *"only works on printed and scanned texts, not handwritten Bengali documents"* and
*"gives below-par performance for blurred images."*

**Read the 0.78 correctly.** These are *system-level, text-level* metrics over a reconstructed
whole document, so they fold in layout, segmentation and reading-order error, not just glyph
recognition. They are not comparable to a line-level CER. But that is exactly our situation: a
drawing sheet is a layout problem before it is a glyph problem. **A CER of 0.59 on the best
open Bengali document system means the majority of characters are wrong.**

**BanglaWild, in-the-wild Bengali scene text** —
[arXiv:2608.03884](https://arxiv.org/html/2608.03884v1), 2,535 Bengali scene-text images,
Table 1:

| System | CER ↓ | WER ↓ |
|---|---|---|
| Tesseract | 98.46 | 110.05 |
| Surya | 191.32 | 160.48 |
| EasyOCR | 48.43 | 89.26 |
| Gemini 2.5 Flash (best VLM) | **14.08** | **29.97** |
| Gemini 2.5 Pro | 21.65 | 36.42 |

Scene text is *not* our input and these numbers must not be quoted as document OCR figures.
What survives the domain gap is the **ranking and its shape**: EasyOCR is the only conventional
engine the authors call reliable for Bengali; **Tesseract's Bengali is catastrophic on anything
off-distribution**; and a frontier VLM beats every open conventional engine by 3.4×. The
authors also report that *"visual mis-recognition accounts for ~60% of errors in the strongest
systems"* — i.e. the failure is perceptual, not a conjunct-ligature modelling issue, which
means **resolution and scan quality are the lever, not the language model.**

**A higher figure exists and should not be used as a prior.** A 2019 BLSTM-CTC system reports
*"character level accuracy of 99.32% and word level accuracy of 96.65%"* across 20 Bengali fonts
([arXiv:1908.08674](https://arxiv.org/abs/1908.08674)). That is **synthetic rendered text from
known fonts on clean backgrounds**, trained on 47,720 text lines. It measures the ceiling of the
architecture, not the floor of a scan. Do not carry it into a plan.

### 3c. What this means for the product

Under the governing sentence, the range 0.59 CER (best open, scanned documents) to 82.7%
composite pass rate (vendor self-report, unusable licence) is **not a range you can build an
unattended Bangla text path on.** Nothing here contradicts the ticket's fallback: **route Bangla
text on a scan to a human.** What has changed is that this is now an evidenced decision with
three primary citations rather than an absence of data. If a machine Bangla path is attempted
later, EasyOCR (Apache-2.0, has a Bengali model, best conventional engine in the one head-to-head
that exists) is the candidate to measure, with its weights licence confirmed first.

---

## 4. Published benchmarks for scanned-engineering-drawing vectorization

**The ticket's claim — "there is no published benchmark for scanned-drawing vectorization
quality" — is correct as stated for construction drawings, and should be narrowed rather than
dropped.** A real evaluation literature exists; it is fifteen years old, it is about mechanical
and technical line drawings, and it answers a smaller question than ours.

### 4a. What exists and what it measures

| Resource | Input | What it measures | Does it answer "what geometric error on a scanned construction drawing"? |
|---|---|---|---|
| **GREC arc/line segmentation contests** — GREC'09 *"Performance Evaluation on Old Documents"* (Al-Khaffaf, Talib, Osman, Wong, LNCS, [doi:10.1007/978-3-642-13728-0_23](https://link.springer.com/chapter/10.1007/978-3-642-13728-0_23)); GREC'13 *"Final Report of GREC'13 Arc and Line Segmentation Contest"* (Bukhari, Al-Khaffaf, Shafait, Osman, Talib, Breuel, LNCS 2014, [doi:10.1007/978-3-662-44854-0_18](https://link.springer.com/chapter/10.1007/978-3-662-44854-0_18)) | **Raster** technical/engineering drawings, incl. old scanned documents | **Vector Recovery Index (VRI)** against vector ground truth | **Closest thing that exists.** Right task, right input modality, right metric family. Wrong domain (mechanical/technical line drawings, not construction plans) and the contests wound down after 2013 |
| **Al-Douri, Al-Khaffaf & Talib 2011, "Empirical Performance Evaluation of Raster to Vector Conversion with Different Scanning Resolutions"**, LNCS 2011 pp.176–182, [doi:10.1007/978-3-642-25191-7_17](https://link.springer.com/chapter/10.1007/978-3-642-25191-7_17) | Raster engineering drawings at **200, 300 and 400 DPI** | VRI vs ground truth, three commercial tools: **Vextractor, VPstudio, Scan2CAD** | **This is the DPI-vs-accuracy study.** See 4b — its finding is not what you would guess |
| **Liu & Dori, "A protocol for performance evaluation of line detection algorithms"** and the *Second International Graphics Recognition Contest — Raster to vector conversion* report ([doi:10.1007/3-540-64381-8_65](https://link.springer.com/chapter/10.1007/3-540-64381-8_65)) | Raster line drawings | Defines the VRI: detection rate `Dv` and false detection rate `Fv`, `VRI = 0.5·Dv + 0.5·(1−Fv)`, covering localization, endpoint precision and line-thickness accuracy | Gives us a **ready-made metric to reuse** — do not invent one |
| **SESYD** (Delalandre, Valveny, Pridmore, Karatzas, 2010), [project page](http://mathieu.delalandre.free.fr/projects/sesyd/) — page returned **HTTP 503** this session, so its contents are **[UNVERIFIED]** at primary source | Synthetic raster floorplans and electrical diagrams with ground truth | Symbol spotting/recognition | Symbols, not geometry. Adjacent, not ours |
| **Raster-to-Vector: Revisiting Floorplan Transformation** (Liu, Wu, Kohli, Furukawa, ICCV 2017) | **Raster** floorplan images, 870 annotated | Junction/wall precision & recall, *"around 90% precision and recall"*. **CVF PDF returned HTTP 403 this session**, so the exact tolerance definition is **[UNVERIFIED]** | Right modality, wrong drawings (real-estate floorplans), and the metric is *topological* — did you find the wall — not *metric* — how many mm off is it |
| **CubiCasa5K** ([arXiv:1904.01920](https://arxiv.org/abs/1904.01920)) | Raster floorplan images, **5,000 samples, 80+ categories, polygon annotations** | Multi-task parsing; abstract states no metric | Same objection. Also **licence [UNVERIFIED]** — arXiv shows only a non-exclusive distribution licence |
| **FloorplanVLM** ([arXiv:2602.06507](https://arxiv.org/abs/2602.06507)) | **Raster** floorplans → vector JSON. Datasets Floorplan-2M, Floorplan-HQ-300K, benchmark **FPBench-2K** | **IoU**; headline **92.52% external-wall IoU** | The most modern raster→vector floorplan benchmark. **IoU is an area-overlap score, not a geometric error** — it cannot tell you the millimetre offset of a wall centreline, which is the only thing a takeoff cares about. This confirms the prior doc's [UNVERIFIED] flag on that 92.52% figure at primary source |
| **FloorPlanCAD** ([arXiv:2105.07147](https://arxiv.org/abs/2105.07147)), **ArchCAD-400K**, **VecFormer** | **Vector CAD primitives, not raster** — *"CAD drawings in the dataset are all represented as vector graphics"* | Panoptic symbol spotting (PQ) | **No.** Input is already vector. These are the *destination* of vectorization, not a test of it |
| **AECV-Bench** ([arXiv:2601.04819](https://arxiv.org/abs/2601.04819)) | 120 floor plans, 192 QA pairs | Counting accuracy / MAPE, document QA | Measures VLM *drawing literacy*, not vectorization. Its finding is still ours: *"OCR and text-centric document QA are strongest (up to 0.95 accuracy)… symbol-centric drawing understanding — especially reliable counting of doors and windows — remains unsolved (often 0.40-0.55 accuracy)"* |
| **PubTables-1M / Table Transformer** | Document page images | Table structure (TEDS/GriTS) | Tables, not geometry. Out of scope for this question |

### 4b. The DPI study, and why it is the most useful thing in this section

From Springer's own abstract page for
[doi:10.1007/978-3-642-25191-7_17](https://link.springer.com/chapter/10.1007/978-3-642-25191-7_17):
*"Test images with three different scanning resolutions (200, 300, and 400 DPI)"* were
vectorized; *"Vector Recovery Index scores calculated with reference to the ground truth
images"* were statistically analysed. Findings: **Vextractor was best on average**; and
critically, **resolution affects each tool differently** — Vextractor and VPstudio improved from
200 to 300 DPI but **declined at 400 DPI**, while Scan2CAD **degraded monotonically as
resolution rose**.

**That non-monotonicity is the single most actionable finding in this section.** The intuition
"scan hotter, get better geometry" is empirically false for at least two of three commercial
vectorizers. Higher DPI resolves more paper texture, more halftone, more scanner noise, and
thresholding-plus-thinning pipelines break up into more spurious segments. **Our own DPI sweep
must therefore be a sweep, not a floor-finding exercise** — we must report the *curve* and its
peak per tool, and the ticket's synthetic-DXF experiment should be designed to detect a peak,
not just a threshold.

### 4c. Verdict on the ticket's claim

**Amend, do not delete.** Accurate restatement:

> No published benchmark measures the *metric geometric error* of vectorizing a *scanned
> construction drawing*. The closest published work is the IAPR GREC arc/line segmentation
> contest series (2009–2013) on technical line drawings, evaluated with the Vector Recovery
> Index, and a 2011 DPI-vs-VRI study at 200/300/400 DPI on three commercial vectorizers. Modern
> floorplan work (R2V 2017, CubiCasa5K 2019, FloorplanVLM 2026) is raster-input but scores
> *topological* or *area-overlap* correctness (precision/recall, IoU), never millimetres. Modern
> CAD symbol-spotting work (FloorPlanCAD, ArchCAD-400K, VecFormer) takes vector primitives as
> input and so tests nothing about vectorization at all.

**Three things we should take rather than invent:** the **VRI** as our metric (it already
decomposes into localization, endpoint precision and thickness); the **200/300/400 DPI sweep
design**, extended upward since our sheets are larger; and the expectation of a **peak** rather
than a plateau.

---

## 5. The scan-quality floor

### 5a. The two primary rules

**For lines — NARA's 2-pixel rule.** From the *Technical Guidelines for Digitizing Archival
Materials for Electronic Access*, June 2004, p.43
([PDF](https://www.archives.gov/files/preservation/technical/guidelines.pdf), text extracted
locally from the primary PDF):

> "The Quality Index (QI) measurement was designed for printed text where character height
> represents the measure of detail… **However, manuscripts and other non-textual material
> representing distinct edge-based graphics, such as maps, sketches, and engravings, offer no
> equivalent fixed metric. For many such documents, a better representation of detail would be
> the width of the finest line, stroke, or marking that must be captured in the digital
> surrogate. To fully represent such a detail, at least 2 pixels should cover it.**"

The same document's spec table for *"Textual documents, graphic illustrations/artwork/originals,
maps, plans, and oversized"* gives, as the alternative minimum, *"1-bit bitonal mode — **600
ppi** for documents with smallest significant character of **1.0 mm** or larger"*, and otherwise
*"adjust scan resolution to produce a **QI of 8** for smallest significant character"*, where the
QI scale is defined in the same document as *"barely legible (3.0), marginal (3.6), good (5.0),
and excellent (8.0)."*

**For text — Tesseract's x-height rule**, from the project's own FAQ
([tessdoc](https://raw.githubusercontent.com/tesseract-ocr/tessdoc/main/tess3/FAQ-Old.md)):

> "There is a minimum text size for reasonable accuracy. You have to consider resolution as well
> as point size. **Accuracy drops off below 10pt x 300dpi, rapidly below 8pt x 300dpi.** A quick
> check is to count the pixels of the x-height of your characters… At 10pt x 300dpi x-heights
> are typically about 20 pixels… **Below an x-height of 10 pixels, you have very little chance
> of accurate results, and below about 8 pixels, most of the text will be "noise removed".**"

with the LSTM-era addition: *"Using LSTM there seems also to be a maximum x-height somewhere
around 30 px. Above that, Tesseract doesn't produce accurate results."* — **there is a ceiling as
well as a floor**, which is a second, independent reason to expect a non-monotonic DPI curve
(§4b). And the main guide: *"Tesseract works best on images which have a DPI of at least 300
dpi"* ([ImproveQuality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)).

**For archival practice — FADGI**, *Technical Guidelines for Digitizing Cultural Heritage
Materials*, 3rd ed., 2023-05-09
([PDF](https://www.digitizationguidelines.gov/guidelines/FADGI%20Technical%20Guidelines%20for%20Digitizing%20Cultural%20Heritage%20Materials_3rd%20Edition_05092023.pdf),
text extracted locally). §3.6 *"Oversize Items: Maps, Posters, and Other Materials"*, resolution
row, verbatim:

| Star level | 1-Star | 2-Star | 3-Star | 4-Star |
|---|---|---|---|---|
| Resolution | ≥ 190 ppi (200 ppi − 3%) | ≥ 242.5 ppi (250 ppi − 2.5%) | ≥ 294 ppi (300 ppi − 2%) | ≥ 396 ppi (400 ppi − 1%) |

and the note: *"Image capture resolutions above 400 ppi may be appropriate for some materials…
Very fine detailed engravings, for example, may require **800 ppi or higher** to image
properly."* §3.5 *"Documents (Unbound): Modern Textual Records"* is single-tier at **≥ 294 ppi
(300 ppi − 2%)**.

FADGI also names a distortion source that our lane will meet on every A0 sheet, and it is not
resolution: for oversize originals captured in tiles, *"this approach suffers from the **loss of
geometric accuracy** and resolution inherent in acquiring images in sections and stitching them
into a single image,"* and *"In all three approaches, geometric accuracy can vary dramatically
based on the approach taken and the specific imaging systems used."* **A stitched A0 scan has an
unbounded, unstated geometric error before any detector runs.** That is a refusal condition our
scan profile must be able to express.

### 5b. What a 1:100 plan actually needs

Two computations, both derived from the primary rules above. Both are arithmetic on cited rules;
neither is a measurement, and both should be checked against the ticket's own DPI sweep.

**(i) DPI needed for the thinnest line, by NARA's 2-pixel rule** — `dpi = 2 ÷ (w_mm ÷ 25.4)`:

| Thinnest line on paper | Required scan resolution |
|---|---|
| 0.13 mm | **391 dpi** |
| 0.18 mm | **282 dpi** |
| 0.25 mm | **203 dpi** |
| 0.35 mm | **145 dpi** |

**The line-width series itself is [UNVERIFIED].** ISO 128's line-width steps are the natural
authority and `iso.org` returned **HTTP 403** for both the catalogue page and the OBP viewer in
this session, so **no ISO line-width value is asserted here.** The table is parametric on
purpose: read it against whatever the drawing's own line-width convention turns out to be, and
treat 0.13–0.18 mm as the plausible thin end for a CAD-plotted plan **only as a working
assumption to be replaced by a verified figure.**

**(ii) DPI needed for annotation text, by Tesseract's x-height rule.** For text of nominal
character height `h_mm` on paper, x-height is roughly `0.7·h_mm`, so `dpi = px ÷ (0.7·h_mm ÷ 25.4)`:

| Text height on paper | dpi for x-height 10 px ("very little chance" floor) | dpi for x-height 20 px (Tesseract's 10pt×300dpi reference) |
|---|---|---|
| 1.8 mm | 202 dpi | **403 dpi** |
| 2.5 mm | 145 dpi | **290 dpi** |
| 3.5 mm | 104 dpi | 207 dpi |

Note the collision with the LSTM ceiling: at 600 dpi, 3.5 mm text has an x-height of ~58 px,
**well past the "somewhere around 30 px" ceiling Tesseract documents.** A single global DPI
cannot be optimal for both the thinnest line and the largest text on the same sheet. **Per-region
rescaling before OCR is not an optimisation, it is a correctness requirement.**

**(iii) The measurement quantum, which is the number a QS will actually ask about.** At scale
1:100, one pixel of scan corresponds to `25.4 ÷ dpi × 100` mm on site:

| Scan resolution | mm on paper per px | **mm on site per px @ 1:100** |
|---|---|---|
| 150 dpi | 0.169 | **16.9 mm** |
| 200 dpi | 0.127 | 12.7 mm |
| 300 dpi | 0.085 | **8.5 mm** |
| 400 dpi | 0.064 | 6.4 mm |
| 600 dpi | 0.042 | **4.2 mm** |
| 1200 dpi | 0.021 | 2.1 mm |

Halve for 1:50, double for 1:200. **This is a hard floor on achievable precision, before
detector error, before binarization error, before scanner geometric distortion, before paper
stretch.** Any tolerance ticket 03 sets for the scan lane must be strictly looser than the
relevant row, and the register should carry the scan DPI so the floor is derivable from stored
data rather than remembered.

### 5c. The 150 dpi fax — the ticket's claim, now evidenced

At 150 dpi a pixel is 0.169 mm on paper. **Two independent primary rules condemn it:**

- **Lines:** a 0.18 mm line is covered by ~1.06 pixels — below NARA's *"at least 2 pixels should
  cover it."* Even a 0.35 mm line gets only 2.07 px, i.e. exactly at the floor with zero margin
  for thresholding loss. **A 150 dpi scan cannot represent the thin-line layer of a plan at all**;
  those lines survive as broken, aliased fragments or vanish in binarization.
- **Text:** 2.5 mm annotation text has an x-height of ~10.3 px — Tesseract's *"very little chance
  of accurate results"* band, and one notch above *"most of the text will be 'noise removed'."*
- **Archival practice:** 150 dpi is below **every** FADGI star level for oversize maps and plans,
  the lowest of which is ≥ 190 ppi.

**The product should refuse with a named cause, and the cause should be computed, not judged.**
The refusal reason writes itself from the numbers above and is exactly the shape CLAUDE.md
demands — a named reason, not silence:

> `SCAN_BELOW_MEASURABLE_FLOOR` — page rasterised at 150 dpi; at the affirmed scale 1:100 one
> pixel is 16.9 mm on site, and the thinnest detected stroke is covered by fewer than 2 pixels
> (NARA minimum). No geometry can be proposed from this page.

Note what makes this legal under the governing sentence: it is a **refusal**, so it can only ever
cause us to measure less. It needs no accuracy claim to be correct. And it is derivable from the
page's own DPI and the affirmed scale — both of which we already hold — so it never requires the
model to judge whether a scan "looks bad."

### 5d. The recommended working floor

Stated as a recommendation with its reasoning, not as a decided threshold:

| Band | Rule | Behaviour |
|---|---|---|
| **< 200 dpi effective** | below every FADGI star level for plans; sub-2-px on any thin line | **Refuse** with `SCAN_BELOW_MEASURABLE_FLOOR` |
| **200–300 dpi** | FADGI 1–3 star; NARA 2-px rule satisfied only for ≥0.25 mm lines; Tesseract marginal for ≤2.5 mm text | **Human tracing over a calibrated scan only** — the incumbent workflow the charting ruling ships first. No machine geometry |
| **≥ 300 dpi, unstitched** | FADGI 3-star; Tesseract's own recommended minimum | Machine vectorization permitted under `INTERPRETED`, with measured VRI attached |
| **≥ 400–600 dpi** | FADGI 4-star and above | The band where the DPI sweep should look for its peak, remembering §4b: **higher may be worse** |
| **any stitched oversize capture** | FADGI: *"loss of geometric accuracy… inherent in acquiring images in sections"* | **Flag regardless of DPI.** Geometric error is unbounded and unstated |

"Effective dpi" must be computed from the raster's pixel dimensions and the sheet's physical
size, never trusted from PDF metadata — a 150 dpi scan upsampled to 600 dpi carries a 600 dpi
header and none of the information. **[UNVERIFIED]** whether any of the candidate tools estimate
true effective resolution; assume not, and detect it ourselves from stroke-width statistics.

---

## 6. Unverified — stated plainly

1. **ISO 128 line-width series.** `iso.org` returned HTTP 403 for both the catalogue page and
   the OBP viewer. **No ISO line-width value is asserted in §5.** The DPI tables are parametric.
2. **Bit-identity of OpenCV detectors across CPU families / SIMD dispatch paths / builds.** No
   primary source found either way. Directly measurable; measure before ticket 02 relies on it.
3. **`HoughLinesP`'s fixed seed as a stability contract.** The seed is a compile-time constant
   in `hough.cpp` today. It is not documented as an API guarantee. Pin the version.
4. **Tesseract inference determinism.** Architecturally plausible (no sampling step) but I did
   not audit the source and no doc states it.
5. **EasyOCR's `bengali.pth` weights licence.** No separate weights licence file located; read as
   covered by the repo's Apache-2.0 but confirm before shipping.
6. **PaddleOCR-VL and DeepSeek-OCR Bangla support.** Neither card names Bengali; neither denies
   it. Untested.
7. **`VLLM_BATCH_INVARIANT=1`** — coverage, correctness and throughput cost not verified.
8. **SESYD** project page returned HTTP 503; its contents, ground-truth format and terms of use
   are unverified at primary source.
9. **Raster-to-Vector (ICCV 2017)** metric definition — the CVF PDF returned HTTP 403, so the
   pixel tolerance behind "around 90% precision and recall" is unread.
10. **CubiCasa5K licence** — arXiv shows only a non-exclusive distribution licence; the dataset's
    own terms were not read.
11. **A permissive text/graphics separation implementation** (Fletcher–Kasturi class). None found
    in OpenCV or scikit-image; whether one exists elsewhere under a clean licence is unchecked.
12. **Whether any permissive tool emits bounded arcs with endpoints.** None found.
    `EdgeDrawing::detectEllipses` returns conics, not arc segments.
13. **GREC'09 / GREC'13 contest scores.** Springer abstracts were not retrievable without the
    cookie handshake; bibliographic data came from the Crossref API. The contest *existence,
    metric and framing* are verified; **no participant score is quoted.**
14. **Al-Douri et al. 2011 numeric VRI values.** Only the abstract-level conclusions were read.
    The direction of the effect is verified; **no VRI number is quoted.**
