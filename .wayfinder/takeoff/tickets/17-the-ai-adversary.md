# The AI adversary — the agent architecture

wayfinder:grilling
Status: open
Blocked by: 02-the-source-key.md
Claimed by:

## Objective

Charting ruled AI's constitution: **adversarial-first**. Its flagship job is finding *absence and
contradiction* — output is a refusal reason, a discrepancy, or a question for a human, never a
quantity. Recognition and automation are admitted strictly as **verified proposals**. This ticket
rules the architecture that makes that true mechanically rather than by intention.

The demo this is meant to produce: *"I measured 47 items. I did not measure these 12, and here is
why for each. And your column schedule and your plan disagree on C4 — which is right?"* No
competitor ships the second sentence (`docs/research/takeoff-competitors-2026.md`: basis
taxonomy, coverage declaration and refusal-with-reason are **unoccupied across every vendor**).

## The constitutional rules to implement

1. **AI proposes; it never concludes, never measures, never emits a quantity, and never sets
   basis to `MEASURED`.** `formulas.md` already rules no AI anywhere in the fan-out.
2. **Every proposal cites source keys, and code verifies the citations resolve before a human
   ever sees it.** An uncitable proposal is **discarded silently — not surfaced with a confidence
   score.** Research found Claude's Citations and Structured Outputs are **mutually exclusive**
   (a 400 if both are set), so this verification is ours to build, not the platform's to provide.
3. **Proposals enter the same disposition surface as deterministic machine proposals**, carrying
   a distinct origin (`RULE` vs `MODEL`) — one human act, one taxonomy, two originators, exactly
   as `identity.md` §7 already frames refusals.
4. **Abstention is never the model's decision.** Coverage is computed by deterministic code from
   the scope register; the agent contributes *candidate absences*, which are evidence, never
   verdicts. Research: **GPT-5 scores 34.46% on ChartHal**, where the answer is absent from or
   contradicted by the source — "this drawing doesn't say" is the failing case.

## The decision

1. **Which roles ship, in what order.** Research rated sheet classification, convention-profile
   resolution and **disambiguation proposals** feasible now, with disambiguation the highest
   value per unit of risk. Schedules, notation, symbols, interrogation and cross-sheet
   discrepancy are feasible with guardrails.
2. **Self-hosted or API.** Research found a **0.9B Apache-2.0 specialist beats the frontier at
   document parsing** — PaddleOCR-VL-1.6 at 96.34 overall / 94.76 table TEDS against Gemini 3
   Pro's 92.91 / 89.15. Cost is not the constraint (~$15.90 per 40-sheet set on Opus 5), which
   argues for spending it on **redundancy — ensembles, overlapped tiling, re-verification —
   rather than optimising it away.**
3. **Never rasterize our own vectors to re-detect what we already hold.** VecFormer, CADSpotting
   and FloorPlanCAD independently report that rasterising vector CAD destroys the geometric
   information the task needs, and an A1 sheet downscales to ~78 dpi in a single frontier-model
   image. Where a model *is* used on geometry, it consumes primitives, not pixels.
4. **The audit trail.** An AI proposal that a human accepted must be reconstructable years later:
   model, version, prompt, cited keys, and the human act. Rule where that lives — it is not the
   act log (`identity.md` §7 is human-only) and it is not the register.

## Guardrails

- **Schedules: geometric clustering primary, model on the residue only.** `cad-ingestion.md` §5
  reconstructs tables without gridlines and its known defect class is already characterised;
  a model must not replace a method we can test deterministically.
- **Notation: the model proposes grammar *rules*, never values** — §6's parsers are golden-tested
  against real strings and stay code.
- Licence hazards to avoid, verified: **LayoutLMv3 is CC BY-NC-SA 4.0**; **Surya's weights are
  modified Open-RAIL-M** (free only below $5M revenue, and Marker depends on them).
