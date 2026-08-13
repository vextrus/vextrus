# AI for drawing understanding — where it can sit, given "no AI in the fan-out"

**Researched 2026-08-13.** Every claim below carries a primary-source URL. Where a number could
not be verified against a model card, official API doc, paper, or licence file, it is marked
**[UNVERIFIED]** and no figure is stated. All prices are USD per million tokens (MTok) as
published on the dates given.

**The constraint this research is written against.** `docs/domain/formulas.md` §preamble:
*"No AI anywhere in the fan-out — every billable number is computed from human-confirmed
inputs."* Nothing here proposes relaxing that. The question is narrower and more useful: given
that no model may originate a quantity, where does a model earn its place? The answer this
research supports: **AI belongs upstream of confirmation and downstream of computation, never
between them.** It may propose, classify, route, group, explain, and reconcile. It may never
emit a number that reaches a register row without a human affirming the input it came from.

---

## 0. The three findings that matter most

1. **A 0.9B specialist beats the frontier on document parsing.** On OmniDocBench v1.6,
   PaddleOCR-VL-1.6 (0.9B params, Apache-2.0) scores **96.34 overall / 94.76 table TEDS** versus
   Gemini 3 Pro's **92.91 / 89.15** and Qwen3-VL-235B's **89.78 / 83.07**
   ([OmniDocBench leaderboard, accessed 2026-08-13](https://github.com/opendatalab/OmniDocBench)).
   For structured document extraction, the right model is small, cheap, self-hostable, and
   permissively licensed — not the frontier API.
2. **Frontier VLMs still hallucinate badly when the answer is absent.** On ChartHal, a benchmark
   built specifically around questions whose answers are missing from or contradicted by the
   chart, GPT-5 scores **34.46%** and o4-mini **22.79%**
   ([arXiv:2509.17481, 2025-09-22](https://arxiv.org/abs/2509.17481)). "The information isn't in
   this drawing" is exactly the judgement our governing sentence demands, and it is precisely the
   judgement current models are worst at. This is the single strongest argument for the existing
   law.
3. **Citations and structured outputs are mutually exclusive on the Claude API.** Enabling
   `citations` on a document block together with `output_config.format` returns a **400 error**
   ([Citations docs, accessed 2026-08-13](https://platform.claude.com/docs/en/build-with-claude/citations)).
   Since our auditability requirement *is* citation (every cell must cite a DXF handle), we
   cannot lean on the platform's citation feature plus a schema. We must build provenance into
   the schema ourselves and verify it deterministically. See §C-1.

---

## 1. Model comparison table

### 1a. Frontier hosted models

| Model | Context | Max output | Input $/MTok | Output $/MTok | Image input | Knowledge cutoff | Source (accessed 2026-08-13) |
|---|---|---|---|---|---|---|---|
| Claude Opus 5 (`claude-opus-5`) | 1M | 128k (300k via Batch beta) | $5 | $25 | yes, high-res tier | May 2026 | [models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Fable 5 (`claude-fable-5`) | 1M | 128k | $10 | $50 | yes | Jan 2026 | same; GA from 2026-06-09 |
| Claude Sonnet 5 (`claude-sonnet-5`) | 1M | 128k | $2 | $10 | yes | Jan 2026 | same ($2/$10 confirmed as standard, not introductory) |
| Claude Haiku 4.5 | 200k | 64k | $1 | $5 | yes, standard tier | Feb 2025 | same |
| GPT-5.5 (`gpt-5.5-2026-04-23`) | 1,050,000 | 128,000 | $5 (cached $0.50) | $30 | text + image | 2025-12-01 | [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.5) |
| GPT-5.6 (`gpt-5.6-sol`) | 1,050,000 | 128,000 | $5 (cached $0.50) | $30 | text + image | 2026-02-16 | [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.6) |
| Gemini 3.1 Pro | up to 1M in | 64k out | $2 ≤200k / $4 >200k | $12 ≤200k / $18 >200k | text, image, video, audio, PDF | [UNVERIFIED] | [model card, pub. 2026-02-19](https://deepmind.google/models/model-cards/gemini-3-1-pro/), [pricing, updated 2026-08-11](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.6 Flash | up to 1M in | 64k out | $1.50 | $7.50 | text, image, audio, video | Mar 2026 (some domains Jan 2025) | [model card, pub. 2026-07-21](https://deepmind.google/models/model-cards/gemini-3-6-flash/) |

Published multimodal/document benchmark numbers I could verify:

| Benchmark | Score | Model | Source |
|---|---|---|---|
| MMMU-Pro | 80.5% | Gemini 3.1 Pro | [model card](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| CharXiv (no tools / with tools) | 85.2% / 89.4% | Gemini 3.6 Flash | [model card](https://deepmind.google/models/model-cards/gemini-3-6-flash/) |
| MRCR v2 8-needle @128k / @1M | 84.9% / 26.3% | Gemini 3.1 Pro | [model card](https://deepmind.google/models/model-cards/gemini-3-1-pro/) |
| OmniDocBench v1.6 overall / table TEDS | 92.91 / 89.15 | Gemini 3 Pro | [OmniDocBench](https://github.com/opendatalab/OmniDocBench) |
| ChartHal accuracy | 34.46% | GPT-5 | [arXiv:2509.17481](https://arxiv.org/abs/2509.17481) |

**Anthropic publishes no DocVQA / ChartQA / InfographicVQA figure for the Opus 5 / Sonnet 5
family that I could locate. [UNVERIFIED] — do not quote one.** The MRCR @1M collapse from 84.9%
to 26.3% on Gemini 3.1 Pro is worth internalising: a 1M-token window is not a 1M-token *working
memory*. Feeding a whole drawing set in one prompt is not a strategy.

### 1b. Image resolution and tokenisation (the input side of the cost model)

**Claude** ([Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision), accessed 2026-08-13):
- Visual token = one 28×28 px patch. Cost = `⌈w/28⌉ × ⌈h/28⌉` visual tokens.
- **High-resolution tier (Claude 4.7 and later, so Opus 5 / Sonnet 5): max long edge 2576 px,
  max 4784 visual tokens.** Standard tier (earlier models): 1568 px / 1568 tokens.
- Larger images are **downscaled before processing**. A 3840×2160 image becomes 2576×1449 → 4784
  tokens.
- Max dimensions 8000×8000 px; max 10 MB base64 on the first-party API; up to 600 images per
  request (100 for 200k-context models); **above 20 image/document blocks a stricter per-image
  dimension limit applies — resize so neither dimension exceeds 2000 px**.
- Documented limitations, verbatim: *"Claude's coordinate and localization outputs are
  approximate"*; *"Claude can give approximate counts of objects in an image but might not always
  be precisely accurate, especially with large numbers of small objects."*

**Gemini** ([image understanding docs](https://ai.google.dev/gemini-api/docs/image-understanding), accessed 2026-08-13):
- *"258 tokens if both dimensions <= 384 pixels. Larger images are tiled into 768x768 pixel
  tiles, each costing 258 tokens."* Max 3,600 image files per request. Gemini 3 exposes a
  `media_resolution` parameter capping tokens per image.

**OpenAI image tokenisation formula: [UNVERIFIED]** — I could not retrieve the current vision
pricing page (403/503 from `openai.com/api/pricing` and the GPT-5.5 launch post on 2026-08-13).
Do not put an OpenAI per-sheet figure in a plan until this is checked.

**The load-bearing consequence for us.** An A1 sheet at 300 dpi is ~9930×7020 px. Claude
downscales *any* single image to 2576 px on the long edge — roughly **78 dpi on an A1 sheet**.
Rebar call-outs and schedule cell text at that scale are gone. Reading dense drawing text with a
frontier VLM therefore *requires tiling*, and tiling multiplies both cost and the number of
places a stitching error can hide. This is a strong structural argument for reading text from
**DXF TEXT/MTEXT entities**, which we already have with handles, rather than from pixels.

### 1c. Open-weight models (self-hostable)

| Model | Params | Licence (verified) | Document/OCR scores | Source |
|---|---|---|---|---|
| **PaddleOCR-VL-1.6** | 0.9–1.0B | **Apache-2.0** | OmniDocBench v1.6 **96.34** overall, text edit 0.0326, formula CDM 97.53, **table TEDS 94.76**; Real5-OmniDocBench 93.19 | [HF card, rel. 2026-05-28](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6); [leaderboard](https://github.com/opendatalab/OmniDocBench) |
| **MinerU2.5-Pro** | 1.2B | [UNVERIFIED] | OmniDocBench v1.6 **95.75**, table TEDS 93.42 | [leaderboard](https://github.com/opendatalab/OmniDocBench) |
| **GLM-OCR** | 0.9B | [UNVERIFIED] | OmniDocBench v1.6 **95.22**, table TEDS 92.83 | [leaderboard](https://github.com/opendatalab/OmniDocBench) |
| **Qwen3.5-27B** | 27B (dense, unified VL) | **Apache-2.0** | OmniDocBench1.5 **88.9**, OCRBench **89.4**, CharXiv-RQ 79.5, MMLongBench-Doc 60.2, CC-OCR 81.0, AI2D 92.9, MMMU 82.3, MMMU-Pro 75.0. 262,144 native context | [HF card, Feb 2026](https://huggingface.co/Qwen/Qwen3.5-27B) |
| **Qwen3-VL** (2B–235B-A22B) | various | **Apache-2.0** | numbers published only as images on the repo — [UNVERIFIED] from primary text | [HF 32B card](https://huggingface.co/Qwen/Qwen3-VL-32B-Instruct), [repo](https://github.com/QwenLM/Qwen3-VL) |
| Qwen3-VL-235B-A22B | 235B MoE | Apache-2.0 | OmniDocBench v1.6 **89.78**, table TEDS 83.07 | [leaderboard](https://github.com/opendatalab/OmniDocBench) |
| **InternVL3.5-8B** | 8.5B (0.3B vision + 8.2B LM) | **Apache-2.0** | card reports "+16.0% overall reasoning" vs InternVL3; per-benchmark figures are chart images — [UNVERIFIED] | [HF card, 2025-08-25](https://huggingface.co/OpenGVLab/InternVL3_5-8B) |
| **DeepSeek-OCR** | 3B | **MIT** | OmniDocBench Real5 73.99; olmOCR-bench 75.7 | [HF card, 2025-10-21](https://huggingface.co/deepseek-ai/DeepSeek-OCR) |
| **Molmo-7B-D** | 8B | **Apache-2.0** | avg 77.3 across 11 academic benchmarks (DocQA, ChartQA, InfographicVQA, TextVQA, AI2D included; per-benchmark split not isolated on the card) | [HF card, 2024-09-25](https://huggingface.co/allenai/Molmo-7B-D-0924) |
| Pixtral, Llama vision, Florence-2, DeepSeek-VL2 | — | **[UNVERIFIED]** licences — not checked against the licence file in this pass | — | — |

**Deployability.** PaddleOCR-VL-1.6 at 0.9B and DeepSeek-OCR at 3B run comfortably on a single
modest GPU; Qwen3.5-27B needs a serious card or quantisation. Specific VRAM figures are not
stated on the cards I read — **[UNVERIFIED]**, measure before planning capacity.

### 1d. Purpose-built document/layout models — licence first

| Tool | Licence (verified 2026-08-13) | Usable by us? |
|---|---|---|
| **LayoutLMv3** | **CC BY-NC-SA 4.0** — *"The content of this project itself is licensed under the Attribution-NonCommercial-ShareAlike 4.0 International"* ([HF card](https://huggingface.co/microsoft/layoutlmv3-base)) | **NO. Non-commercial. Banned.** Same class of hazard as the AGPL PDF libraries already banned in `cad-ingestion.md` §1. |
| **Table Transformer** | **MIT** ([LICENSE](https://raw.githubusercontent.com/microsoft/table-transformer/main/LICENSE)) | yes |
| **docTR** (Mindee) | **Apache-2.0** ([LICENSE](https://raw.githubusercontent.com/mindee/doctr/main/LICENSE)) | yes |
| **Marker** | repo `LICENSE` at `master` is **Apache-2.0** ([LICENSE](https://raw.githubusercontent.com/datalab-to/marker/master/LICENSE)) — **but it depends on Surya weights, which are not** | code yes; **check the weights** |
| **Surya** | code Apache-2.0; **weights under a modified AI Pubs Open-RAIL-M — free only for research, personal use, and startups under $5M funding/revenue** ([repo](https://github.com/datalab-to/surya)) | **conditional and revenue-gated — treat as a future licence bomb** |
| **PaddleOCR-VL** | **Apache-2.0** ([HF card](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6)) | yes — and it is the SOTA |
| Nougat, Donut | Apache-2.0 per third-party summaries — **[UNVERIFIED] against the licence file** | verify before use |

Marker's own OmniDocBench v1.6 result — **78.44 overall, table TEDS 65.77** — is far behind
PaddleOCR-VL-1.6's 94.76 TEDS ([leaderboard](https://github.com/opendatalab/OmniDocBench)).
The pipeline-tool era of document parsing is over; the small-VLM era won.

---

## 2. Engineering-drawing-specific research, 2023–2026

The literature closest to us is **panoptic symbol spotting on vector CAD primitives** — and it is
genuinely a live field, not a dead one.

- **FloorPlanCAD** ([arXiv:2105.07147](https://arxiv.org/abs/2105.07147)) established the task:
  identify countable instances ("things") and uncountable regions ("stuff") in drawings composed
  of vector graphical primitives.
- **ArchCAD-400K** ([arXiv:2503.22346](https://arxiv.org/abs/2503.22346), submitted 2025-03-28,
  CC BY 4.0): **413,062 chunks from 5,538 standardised architectural CAD drawings, >26× the
  largest prior CAD dataset.** Baseline: Dual-Pathway Symbol Spotter (DPSS), fusing primitive
  features with complementary image features. The abstract claims SOTA but publishes no PQ number
  in the abstract — **[UNVERIFIED]** at the number level.
- **VecFormer — "Point or Line? Using Line-based Representation for Panoptic Symbol Spotting in
  CAD Drawings"** ([arXiv:2505.23395](https://arxiv.org/abs/2505.23395), submitted 2025-05-29,
  rev. 2025-10-17): **91.1 PQ, with Stuff-PQ improved by 9.6 and 21.2 points over the
  second-best results.** The dataset for that figure is not named in the abstract —
  **[UNVERIFIED]**, presumably FloorPlanCAD-family; confirm from the paper body before quoting.
  Its framing is directly ours: existing methods *"rely on image rasterization, graph
  construction, or point-based representation, but these approaches often suffer from high
  computational costs, limited generality, and loss of geometric structural information"*, while
  line-based representation *"preserv[es] the geometric continuity of the original primitive."*
- **CADSpotting** ([arXiv:2412.07377](https://arxiv.org/html/2412.07377v1)) makes the same point
  bluntly: rasterising vector CAD *"introduces discrepancies between the original vector graphics
  and the rasterized images, resulting in errors due to the loss of precise geometric
  information."*
- **SVG decomposition for LMMs on floor plans**
  ([arXiv:2511.03478](https://arxiv.org/abs/2511.03478), 2025-11-05, Lee & Sarvghad): gave
  GPT-4o, Claude 3.5 Sonnet and Llama 3.2 11B Vision structured SVG alongside raster across 75
  floor plans. Finding: *"combining SVG with raster input (SVG+PNG) improves performance on
  spatial understanding tasks but often hinders spatial reasoning, particularly in pathfinding."*
  **Giving a VLM the vector data is not free — it helps perception and can hurt reasoning.**
- **CEQuest** ([arXiv:2508.16081](https://arxiv.org/abs/2508.16081), 2025-08-22): the only
  benchmark I found aimed squarely at construction *drawing interpretation and estimation*.
  Evaluated Gemma 3, Phi4, LLaVA, Llama 3.3, GPT-4.1. Conclusion in the authors' words: current
  LLMs *"exhibit considerable room for improvement,"* with domain knowledge integration named as
  the gap. Per-model accuracies are in the body, not the abstract — **[UNVERIFIED]** here.
- **FloorplanVLM** ([arXiv:2602.06507](https://arxiv.org/abs/2602.06507)): reported 92.52%
  external-wall IoU on floor-plan vectorisation per a secondary summary — **[UNVERIFIED]**,
  primary abstract not read in this pass.

**Rebar-schedule extraction specifically: essentially unaddressed in the open literature.** I
found BIM-model-driven BBS generation (i.e. starting from a 3D model, not a drawing) and
image-based rebar annotation detection, but no peer-reviewed work extracting a rebar schedule
from scattered vector TEXT entities with cell-level provenance. **That is our problem and it is
under-explored — which is both the opportunity and the reason there is no accuracy number to
inherit. We will have to measure our own.**

---

## 3. Per-role assessment (A–H)

Rating key: **FEASIBLE-NOW** = deploy behind ordinary review. **FEASIBLE-WITH-GUARDRAILS** =
deploy only with the mechanisms in §4 and an explicit refusal path. **NOT-YET** = do not build
against this in 2026.

### A. View/sheet classification — **FEASIBLE-NOW**
Deciding a model-space region is a floor plan vs schedule vs detail vs legend, from caption
grammar plus entity-census statistics.

*Why it is safe:* the output is a label on a region, not a number. A wrong label costs a
misrouted extraction that the next stage refuses on; it cannot inflate a quantity. Failure is
loud.

*Evidence:* this is coarse layout classification — strictly easier than the panoptic symbol
spotting that reaches 91.1 PQ on vector primitives
([arXiv:2505.23395](https://arxiv.org/abs/2505.23395)).

*Recommendation:* **deterministic caption-grammar + census heuristics first; a small model only
as a tie-breaker.** Most of this signal is in `$INSUNITS`, layer names, text-height histograms,
entity-type ratios and title-block captions — all already in the EntityGraph. If a model is used,
Claude Haiku 4.5 or a self-hosted Qwen3.5 class model with structured output over a closed enum
plus a mandatory `UNKNOWN` member. **Never let it pick "floor plan" when it means "I can't
tell."**

### B. Schedule table understanding — **FEASIBLE-WITH-GUARDRAILS**
Reconstructing rows/columns from scattered TEXT entities with no gridlines.

*Evidence for:* table structure recognition is the single most-measured document task and the
open specialists are excellent — table TEDS **94.76** for PaddleOCR-VL-1.6, **93.42** MinerU2.5-Pro
([leaderboard](https://github.com/opendatalab/OmniDocBench)).

*Evidence against, and it is decisive:* those numbers are for **rasterised document pages**. Our
input is *vector TEXT entities with handles and exact coordinates* — strictly more information,
and none of the published TEDS numbers transfer. Worse, TEDS ≈95 means roughly one cell in twenty
is structurally wrong somewhere in the corpus. **A 5% cell error rate in a rebar schedule is
catastrophic under our governing sentence.**

*Recommendation:* **geometric clustering of TEXT entity positions is the primary algorithm — it
is deterministic and it is exact.** Column boundaries fall out of x-coordinate histograms; rows
out of y-coordinates; both are computable, reproducible, and citable to handles for free. Use a
model only for the residue: a header that clustering could not assign, a merged cell, a
continuation row. Every model-proposed cell must carry the DXF handle it came from, and a
deterministic verifier must re-read that handle's string and reject any cell whose value does not
appear in it. **A cell the model invents cites nothing and is discarded.** Any schedule with an
unresolved cell defers with a reason; it does not ship with a guess. Do not send the raster to a
VLM at all — at 78 dpi effective resolution (§1b) it cannot read the cells anyway.

### C. Drawing-notation parsing — **FEASIBLE-WITH-GUARDRAILS, and mostly not AI**
`8-20+6-16mmØ`, `1 of 24-25mmØ`, `10Ø @ 4" c/c`, `@113/175/113`, `1ST TO TOP FLOOR`, mixed
Bangla/English.

*This is a grammar, not a perception problem.* The strings are short, the vocabulary is closed,
and the semantics are load-bearing: `8-20mmØ` misread as `8-20 mm` is a silent 4× rebar error —
exactly the "measure more, partially, and stay quiet" failure the governing sentence forbids. A
PEG/regex grammar parses these deterministically, refuses on non-match, and is testable against
fixtures forever.

*Where AI earns its place:* on **parse failure**, not parse success. An LLM is good at looking at
20 unparsed strings and proposing *"these look like a `<count>-<dia>mmØ @ <spacing> c/c` variant
with a Bangla numeral prefix — here is a candidate rule"*. That proposal goes to a human, becomes
a versioned grammar rule (the same way detailing rules are versioned data per `formulas.md` §5),
and is thereafter applied deterministically. **The model writes the rule; the rule does the
parsing.** That keeps every future parse reproducible and keeps the model out of the fan-out
entirely.

*Bangla/English mixing:* Qwen3-VL claims 32-language OCR support ([repo](https://github.com/QwenLM/Qwen3-VL));
no Bangla-specific accuracy figure is published on the primary cards — **[UNVERIFIED]**. For DXF
TEXT the string is already Unicode, so this is a tokenisation and normalisation problem, not an
OCR one.

### D. Symbol/legend recognition — **FEASIBLE-WITH-GUARDRAILS**
*Evidence:* this is the best-supported role in the literature. Vector-primitive panoptic symbol
spotting reaches **91.1 PQ** ([arXiv:2505.23395](https://arxiv.org/abs/2505.23395)) and there is
now a 413k-chunk training corpus, ArchCAD-400K, under CC BY 4.0
([arXiv:2503.22346](https://arxiv.org/abs/2503.22346)).

*The trap:* a spotted symbol is a **count**, and a count is a quantity. 91.1 PQ is a research
score on architectural drawings that are, in the ArchCAD authors' own word, "highly
standardized". Our drawings are not.

*Recommendation:* symbol spotting may **propose a candidate set for human confirmation** and may
**flag disagreement** (see H). It may not emit a count into the register. Prefer a vector-native
approach (line/primitive representation) over rasterisation — three independent papers report
that rasterising loses the geometric information that makes this work
([2505.23395](https://arxiv.org/abs/2505.23395), [2412.07377](https://arxiv.org/html/2412.07377v1),
[2105.07147](https://arxiv.org/abs/2105.07147)). We already hold the primitives with handles;
rasterising and then re-detecting would be throwing away our best asset.

### E. Convention profile resolution — **FEASIBLE-NOW**
Inferring which layers carry which role from an entity census.

*Why it is safe:* the output is a **mapping proposal**, it is small, a human reads it in thirty
seconds, and it is exactly the kind of thing `formulas.md` already treats as versioned data. The
census is deterministic; only the naming judgement ("`S-COL-TXT` is column annotation") is
fuzzy — and that judgement is a language problem, which is what these models are actually good at.

*Recommendation:* Claude Sonnet 5 or a self-hosted Qwen3.5-27B over the **census summary text**
(layer names, counts, colours, entity-type mix), never over the drawing image. Structured output
into a closed enum of roles plus `UNMAPPED`. **An unmapped layer must stay unmapped and defer —
never fall through to a default role.** The profile is stored, versioned, human-affirmed, and
thereafter applied deterministically; re-running the model on the same drawing must not silently
change a landed profile.

### F. Disambiguation proposals for a human — **FEASIBLE-NOW**
*"These 3 marks look like the same member family; confirm?"*

This is the ideal AI role in this system: the output is a **question**, the answer is a human's,
and the confirmation is what enters the register. It converts model uncertainty into a human
decision rather than into a number. It is also where the identity law lives — the ordinal is
frozen at first registration (`docs/domain/identity.md`), so grouping proposals must be presented
*before* first registration or as an explicit supersession, never as a silent re-key.

*Recommendation:* build this first. It is the highest value-per-unit-risk role in the whole list.
Present proposals with the handles that motivated them, an explicit confidence, and a
first-class **"none of these"** option. Never batch-apply.

### G. Natural-language interrogation of a takeoff — **FEASIBLE-WITH-GUARDRAILS**
*"Why is the column concrete 12% higher than last revision?"*

*Why it is safe if built right:* the register is the system of record and every figure already
traces to a row with a formula string and named variables (`formulas.md` preamble). So the model
does not need to compute anything — it needs to **query, diff, and narrate**. The 12% is computed
by SQL over two register versions; the model explains *which rows moved and why*.

*The guardrail that makes it work:* **the model must never do arithmetic.** Give it tools that
return computed values (`diff_register(rev_a, rev_b)`, `explain_row(id)`) and forbid it from
emitting any numeral that did not come out of a tool result. This is mechanically checkable: scan
the response for numeric literals and assert each appears verbatim in some tool result. A
response containing an uncited number is a bug, not a style issue.

*Evidence this guardrail is necessary:* GPT-5 at **34.46%** on ChartHal
([arXiv:2509.17481](https://arxiv.org/abs/2509.17481)) is a model confidently answering
chart questions whose answers are not in the chart. Ours would do the same to a register.

### H. Discrepancy detection across a drawing set — **FEASIBLE-WITH-GUARDRAILS, and high value**
*"Plan says 12 columns, schedule lists 9 marks."*

This is the best fit for the governing sentence in the entire list, because **its output is a
refusal reason, not a quantity.** Detecting a disagreement can only ever make the system defer
more and measure less — it is structurally incapable of causing over-measurement. Under "a
partial faulty estimate is more harmful than no estimate", a discrepancy detector is pure upside.

*Recommendation:* both counts come from deterministic extraction; the comparison is deterministic
set arithmetic over marks. **AI is not needed for the detection at all** — it is needed for
*triage and phrasing*: ranking which of 400 discrepancies a QS should look at first, and writing
the reason in a sentence a professional can act on. Keep detection deterministic; use the model
on the presentation layer only. Note the long-context caveat: do not attempt this by stuffing the
whole set into one prompt — MRCR v2 at 1M drops to 26.3% even on Gemini 3.1 Pro
([model card](https://deepmind.google/models/model-cards/gemini-3-1-pro/)).

**Summary:**

| Role | Rating | Primary technique | Model, if any |
|---|---|---|---|
| A view/sheet classification | FEASIBLE-NOW | census heuristics + caption grammar | Haiku 4.5 / small OSS as tie-breaker |
| B schedule tables | FEASIBLE-WITH-GUARDRAILS | geometric clustering of TEXT handles | model on residue only, handle-cited |
| C notation parsing | FEASIBLE-WITH-GUARDRAILS | PEG grammar, versioned | model proposes *rules*, never values |
| D symbol/legend | FEASIBLE-WITH-GUARDRAILS | vector-primitive spotting | VecFormer/DPSS-class, proposals only |
| E convention profile | FEASIBLE-NOW | census → mapping proposal | Sonnet 5 / Qwen3.5-27B on text |
| F disambiguation | FEASIBLE-NOW | proposal + human confirm | any frontier model |
| G NL interrogation | FEASIBLE-WITH-GUARDRAILS | tool-calling over the register | Sonnet 5, no-arithmetic guard |
| H discrepancy detection | FEASIBLE-WITH-GUARDRAILS | deterministic set diff | model for triage/phrasing only |

---

## 4. How to make AI output auditable — concrete mechanisms

Ordered by how much they buy us.

1. **Handle-cited extraction with deterministic verification.** Every model-produced cell,
   reading, or proposal carries the DXF handle(s) it came from. `cad-ingestion.md` §2 already
   makes the handle *the* stable provenance key — we are not inventing an audit trail, we are
   requiring the model to use the one that exists. Then **verify, don't trust**: look up the
   cited handle, re-read its string, and reject any output whose value is not literally present.
   This turns "did the model hallucinate?" from a research question into an assertion. It is the
   single highest-value mechanism on this list.
2. **Structured output with constrained decoding.** Anthropic: *"Structured outputs guarantee
   schema-compliant responses through constrained decoding"*, supported on `claude-opus-5`,
   `claude-sonnet-5`, `claude-haiku-4-5` and others
   ([docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)). OpenAI:
   *"the model will always generate responses that adhere to your supplied JSON Schema, so you
   don't need to worry about the model omitting a required key, or hallucinating an invalid enum
   value"* ([docs](https://developers.openai.com/api/docs/guides/structured-outputs)).
   **Caveat, cited:** format restriction measurably costs reasoning — *"we observe a significant
   decline in LLMs reasoning abilities under format restrictions"* and *"stricter format
   constraints generally lead to greater performance degradation in reasoning tasks"*
   ([arXiv:2408.02442](https://arxiv.org/abs/2408.02442), Tam et al., 2024-08-05). Mitigation:
   let the model reason in prose first, then emit the schema in a second constrained call.
   Also note the Claude schema limits: no recursive schemas, no numeric constraints
   (`minimum`/`maximum`), `minItems` only 0 or 1 — **range validation must be our code, not the
   schema.**
3. **A first-class refusal channel in the schema.** Every extraction schema gets a required
   `status: EXTRACTED | DEFERRED` and a required `reason` when deferred. Because
   `additionalProperties: false` and required-field enforcement are guaranteed by constrained
   decoding, the model **cannot** return a value without also returning a status. This is the
   schema-level encoding of "refusal always carries a reason; silence is the only condemned
   state."
   Justification from primary literature: hallucination is an incentive artefact —
   *"language models hallucinate because the training and evaluation procedures reward guessing
   over acknowledging uncertainty"* ([arXiv:2509.04664](https://arxiv.org/abs/2509.04664), Kalai,
   Nachum, Vempala & Zhang, 2025-09-04). If our own scoring rewards guessing, we will get
   guessing. **Score abstention as a success and a wrong-but-confident answer as a failure worse
   than abstention** — in evals and in prompts.
4. **Ensemble / self-consistency disagreement as a deferral trigger.** Run the extraction twice
   (two temperatures, or two models — e.g. PaddleOCR-VL locally and a frontier model). Agreement
   is not proof, but **disagreement is proof of doubt** and must force a deferral. This is cheap
   under our economics (§5) and converts a silent error into a loud one.
5. **Snapshot the exact inputs, model ID, and prompt version with every proposal.** Model IDs are
   pinned snapshots — *"Starting with the Claude 4.6 generation, model IDs use a dateless format
   that is also a pinned snapshot, not an evergreen pointer"*
   ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview)) — so
   `claude-opus-5` is reproducible in a way `gpt-4-turbo`-style aliases were not. Record it.
6. **The Claude Agent SDK's hooks and permissions as the audit seam.** The SDK exposes *Hooks*
   ("run custom code at key points in the agent lifecycle"), *Permissions* ("control which tools
   run automatically, which need approval"), *Subagents*, *Sessions*, and MCP
   ([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)). A `PreToolUse`
   hook is where a tenant-seam check and a handle-verification check belong: an agent that tries
   to write a register row gets refused by the harness, not by a prompt. Note the licence:
   *"Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service"* — it is
   not an open-source licence; a licence test asserting shipped-module provenance should know
   that.
7. **Platform citations — useful, but incompatible with our schema.** Claude's Citations feature
   returns `char_location` (0-indexed character ranges) for text, `page_location` (1-indexed) for
   PDFs, and `content_block_location` for *custom content documents*, where *"No additional
   chunking is done and chunks are provided to the model according to the content blocks
   provided"* ([docs](https://platform.claude.com/docs/en/build-with-claude/citations)). One
   content block per DXF entity would give handle-granular citations natively — **except that
   citations and structured outputs cannot both be enabled (400 error).** So: use citations for
   the *narrative* roles (G, H triage) and hand-rolled handle fields for the *extraction* roles
   (B, C). Do not plan on both at once.

---

## 5. Cost model — 40-sheet set, frontier VLM, high resolution

**Stated assumptions.** A1 sheets (841×594 mm) rendered at 300 dpi ≈ 9930×7020 px. Claude caps a
single image at 2576 px long edge / 4784 visual tokens, so reading dense text requires tiling:
a 4×3 grid of 12 tiles per sheet, each at the 4784-token cap. Prompt overhead 2,000 input tokens
per sheet; 4,000 output tokens per sheet. Non-batch, no caching, global inference geography.
Prices from [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) and
[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), both accessed 2026-08-13.

| Scenario | Input tok/sheet | Cost/sheet | **40-sheet set** |
|---|---|---|---|
| Opus 5, **tiled** 12×4784 (+2k prompt, 4k out) | 59,408 | $0.297 + $0.100 = **$0.397** | **~$15.90** |
| Opus 5, **single image/sheet** (2576 px ⇒ ~78 dpi — *text unreadable*) | 6,784 | $0.034 + $0.100 = **$0.134** | ~$5.36 |
| Sonnet 5, tiled | 59,408 | $0.119 + $0.040 = **$0.159** | **~$6.36** |
| Opus 5, tiled, **Batch API (50% off)** | 59,408 | $0.148 + $0.050 = **$0.198** | **~$7.95** |
| Gemini 3.1 Pro, 130 tiles × 258 tok (+2k, 4k out, ≤200k tier) | 35,540 | $0.071 + $0.048 = **$0.119** | **~$4.76** |
| GPT-5.5 | — | — | **[UNVERIFIED]** — image tokenisation formula not retrieved |

**Read this the right way.** ~$16 per 40-sheet set at the most expensive credible configuration
is *nothing* against the cost of the QS-hour it is trying to assist. Cost is not the constraint;
**correctness is.** That inverts the usual optimisation: we should spend freely on the mechanisms
in §4 — run the extraction twice on two models, tile with overlap, re-verify every cited handle —
because tripling a $16 bill to buy a measurable reduction in silent error is trivially correct
under our governing sentence. Batch API (50% off both directions) and prompt caching (cache read
= 0.1× base input) make redundancy cheaper still.

Add ~$0 marginal for the self-hosted leg: PaddleOCR-VL-1.6 at 0.9B on our own GPU is
electricity, and it is *better* at table structure than any frontier model (§0.1).

---

## 6. What AI must NOT touch

Directly from `docs/domain/formulas.md`, `quantity-contract.md`, and `identity.md`. These are not
recommendations.

1. **No quantity.** No AI output may become a value in a register row: no length, area, volume,
   count, weight, bar count, bar length, lap length, formwork area, excavation volume. Every one
   of these is `count × geometry` computed by deterministic code from human-confirmed inputs.
2. **No geometry.** The typed geometry union (`PRISM_RECT`, `PRISM_POLY`, `FRUSTUM_RECT`,
   `TAPER_LINEAR`, `AREA_THICK`) and its dimensions are affirmed inputs. A model may **not** pick
   the discriminant and may **not** supply a dimension. `formulas.md` §1 is explicit that a
   declared-but-malformed spec *defers* — a model "helpfully" resolving that malformation would
   reintroduce exactly the bounding-box fallback the law bans (a polygonal pile cap over-counts
   ~13% as a box).
3. **No identity.** Element identity `(project, discipline, level, element type, mark, ordinal)`
   is deterministic and the ordinal is frozen at first registration. A model may *propose* that
   two marks are the same family (role F); the key itself is assigned by code, and never re-keyed
   by inference.
4. **No rate, tax, threshold, or zone mapping.** These are effective-dated data. A model that
   "knows" a Bangladesh VAT rate or an SoR rate from training is a hardcoded value with extra
   steps, and a stale one — note Opus 5's reliable knowledge cutoff is May 2026
   ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview)).
5. **No detailing constant.** ℓd multiples, lap classes, hook tails, bend deductions, covers —
   all versioned data (`BNBC2020_BD @ 2026.07`). A model must never supply one, and must never
   "correct" one. Where the drawing's general notes override a computed default, the *notes* win
   verbatim and land in the applied-notes audit; a model may transcribe a note (handle-cited,
   human-affirmed) but not interpret its numeric effect.
6. **No scale affirmation.** An unaffirmed scale refuses. A model inferring scale from drawn
   geometry is the purest form of the banned guess: it is confident, invisible, and multiplies
   every downstream number.
7. **No unit resolution.** An unmapped `$INSUNITS` code reports null plus an unmapped flag. A
   model may not guess millimetres.
8. **No silent revision reconciliation.** Across a revision, a model may surface that something
   changed (role H) and may propose a mapping (role F). It may not decide that mark `C7` in rev B
   *is* mark `C7` in rev A and carry the ordinal across.
9. **No float, ever.** Anything a model returns is a string until deterministic code parses it to
   a decimal — and refuses on failure. Do not let a JSON `number` from a schema become a quantity.
10. **No writing to the register.** Enforced at the harness, not the prompt: the tool that writes
    a register row is not exposed to any agent. Per the Agent SDK's permission model, this is a
    hook-level refusal ([Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)), which is
    the only kind that holds.

---

## 7. Recommended shape, in one paragraph

Keep extraction deterministic and vector-native — geometric clustering of TEXT handles for
schedules, a versioned PEG grammar for notation, census heuristics for layer roles. Put a small,
Apache-2.0, self-hosted document model (PaddleOCR-VL-1.6 class) on the raster paths where we have
no vector data, because it beats the frontier on exactly that task at a fraction of the cost. Put
a frontier model — Sonnet 5 for volume, Opus 5 where judgement is worth $5/MTok — on the four
roles whose output is a *proposal, a question, a routing decision, or a sentence*: convention
profiles (E), disambiguation (F), takeoff interrogation (G), discrepancy triage (H). Require every
model output to cite DXF handles and verify those citations deterministically. Give every schema
a mandatory refusal branch, and score abstention as a win. That leaves the fan-out untouched, and
it is a genuinely powerful system — because the hard part of takeoff was never the arithmetic.

---

## Appendix: unverified items, for a follow-up pass

- Anthropic DocVQA / ChartQA / InfographicVQA / MMMU figures for Opus 5 and Sonnet 5 — not
  published where I could find them.
- OpenAI image tokenisation formula and vision pricing (pages returned 403/503 on 2026-08-13).
- Gemini 3 Pro model-card PDF benchmark table (PDF would not decode cleanly); Gemini 3.1 Pro
  knowledge cutoff.
- Which dataset VecFormer's 91.1 PQ is measured on; ArchCAD-400K/DPSS PQ numbers; CEQuest
  per-model accuracies; FloorplanVLM's 92.52% IoU — all in paper bodies, not abstracts.
- Licences for MinerU2.5-Pro, GLM-OCR, Nougat, Donut, Pixtral, Llama vision, Florence-2,
  DeepSeek-VL2 — **must be read from the licence file before any of these is used.**
- VRAM requirements for every open-weight model listed — not stated on the cards; measure.
- Bangla OCR / Bangla-mixed-string accuracy for any model — no primary figure found.
- Marker's dependency on Surya weights: confirm whether a Marker deployment can be configured to
  avoid the revenue-gated Open-RAIL-M weights entirely.
