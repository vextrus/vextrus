# ADR-0012 — The DWG lane is audited, not trusted

**Date:** 2026-08-13 · **Status:** accepted · **Supersedes:** ADR-0001's DWG/converter clause
(ADR-0001 otherwise stands in full and is not edited)

## Context

ADR-0001 ruled LibreDWG `dwg2dxf` the production DWG lane and ODA File Converter dev-only. The
CEO asked for a re-examination, noting ODA may be licensable for production. Research landed in
`docs/research/dwg-pdf-ingestion-licensing.md`: ODA **is** licensable — Sustaining tier,
$7,500 first year / $4,500 renewal, the only tier whose `Web/SaaS use` row reads Yes. The ban was
a choice, not a necessity.

The research also said the deciding evidence had not been gathered: how the converters compare on
real drawings. It has now been gathered for LibreDWG, against genuine external ground truth.
LibreDWG 0.13.3 was built from the GNU mirror (0.14.1 is GitHub-only and gated in this
environment) with `--enable-release`, and run over the project's own 139-file GPL-3.0 test corpus
in a scratch directory. 34 of those DWGs ship an **AutoCAD-authored DXF twin** — verified
AutoCAD-authored because it carries no `999 LibreDWG` stamp and uses AutoCAD's `$ACADMAINTVER`
formatting, where LibreDWG's own output writes `999 LibreDWG 0.13.3` and `$ACADMAINTVER 0`. That
twin is an independent census of what the drawing actually contains.

The measurement is quoted in full in
`.wayfinder/takeoff/tickets/05-the-dwg-lane.md`. Its three load-bearing facts:

1. **139 of 139 conversions exited 0** — including 8 that produced an empty DXF and 8 whose DXF
   no parser will read. `dwg2dxf` never reports failure.
2. **Loss is real on current-format files.** Across 31 modern ground-truth pairs the lane recovers
   **3,646 of 3,736 entities (−2.41%)**, exact on 19 of 31, worst case −27.8%. The dropped classes
   are `ACAD_PROXY_ENTITY` (−27), `WIPEOUT` (−16), `ACAD_TABLE` (−7), `ARC_DIMENSION` (−6),
   `IMAGE` (−5), and the surface family — plus, on two files, ordinary `LINE`/`ARC`/`POINT`/
   `INSERT`/`SOLID`/`MTEXT`. Exotic classes are not the only ones at risk.
3. **Every one of those losses is visible in `dwgread -O JSON`.** Where `dwg2dxf` silently drops
   a class, the decoder census either still names it (`WIPEOUT` 2, `ARC_DIMENSION` 1, `IMAGE` 5,
   `HELIX` 1 — writer-stage loss) or flags it (`UNKNOWN_ENT` = 25 where 25 proxies were lost, = 1
   where the table was lost — decoder-stage loss). **Nothing in this corpus was lost
   invisibly.**

Fact 3 is the one that decides. The problem with ADR-0001's lane is not the converter's coverage;
it is that a single `dwg2dxf` call is **unauditable**, and an unauditable converter cannot satisfy
`cad-ingestion.md` §3's loss counters or the governing sentence. That is fixable without buying
anything.

## Decision

- **LibreDWG remains the production DWG lane. ODA is priced but not bought.** GPL-via-subprocess
  stands: never linked, DXF over the boundary, licence text shipped, server-side only. Shipping
  any artifact containing `dwg2dxf` to a third party is conveying and engages GPLv3 §6 — that is
  a fence on on-prem and desktop builds, not on the hosted product.
- **The lane is two passes, not one.** `dwgread -O JSON` produces the object census; `dwg2dxf`
  produces the geometry. The census is the loss counter. A conversion is complete only when both
  ran and were reconciled per type. Conversion cost is not a reason to skip it: a 2.2 MB DWG
  converts in 0.63 s on 4 cores, against a 10-minute budget for 50 sheets.
- **Discrepancy is a named refusal, never a silent pass.** Any per-type shortfall between census
  and DXF, and any `UNKNOWN_ENT`, refuses the affected class on that sheet with its cause named.
  A DXF the parser rejects refuses the whole sheet as `dwg_dxf_unparseable`. `dwg2dxf`'s exit code
  is evidence of nothing and is not consulted as a success signal.
- **The build is `--enable-release`.** `--enable-debug` recovers `example_2018.dwg` to a perfect
  211/211 against the AutoCAD twin, but it enables classes LibreDWG's own `TODO` calls
  "broken/untested" — trading a named refusal for a possibly-wrong number, which is the single
  trade the governing sentence forbids. The measurement is kept so the choice can be revisited if
  those classes stabilise.
- **ODA File Converter's dev-only permission is withdrawn.** The research established that even
  non-production use runs on a 60-day click agreement whose stated Purpose is evaluating
  membership. Indefinite dev use is not covered by it. It may be used only inside a bounded,
  dated evaluation aimed at the purchase decision below.
- **The ODA trigger is named in advance.** A 60-day Sustaining evaluation runs in the private
  corpus lane on real Bangladeshi consultant DWGs. ODA is bought if the audited LibreDWG lane
  refuses whole sheets on more than 5% of that corpus, or if any refusal lands on a class the QS
  must then hand-measure. Below that, $4,500/yr in perpetuity buys entity coverage we can already
  account for. (The 5% figure is this ADR's assumption, not a domain-law figure; the evaluation
  ticket may revise it against what a QS actually tolerates.)
- **The sanity number required by `cad-ingestion.md` §12 is pinned:** `example_2018.dwg` —
  AutoCAD twin **211** entities, audited release lane **207** recovered plus **4 named losses**
  (2 `WIPEOUT`, 1 `ACAD_TABLE`, 1 `ARC_DIMENSION`). Both numbers are the fixture assertion; a
  silent 207 fails it exactly as a silent 211 would.

## Consequences

- DWG ingestion costs a second decode pass and gains the only property that makes it shippable:
  it can say what it lost. Under-measurement with a reason replaces silent under-measurement.
- We ship a converter with named coverage gaps and are honest about them in the product, rather
  than paying $4,500/yr to make a smaller gap invisible. If the real BD corpus disagrees, the
  trigger fires and the price is already known.
- `dwgread -O JSON` output is **not valid UTF-8** (a `0xb0` degree sign broke a strict decode);
  the census reader decodes with replacement. Entity type lives under the `entity` key,
  non-entities under `object` — a reader that reads only `object` sees zero entities and reports
  a clean drawing, which is the exact failure this ADR exists to prevent.
- Two of the eight unreadable outputs failed on the same defect: an MTEXT drawing note carrying a
  raw newline, written through unescaped, which invalidates the whole DXF from that byte on. Both
  were ordinary consultant disclaimer notes. This is a required torture-corpus fixture class, not
  an edge case.
- The measurement is on 0.13.3. 0.14.1's `NEWS` is dominated by memory-safety fixes rather than
  entity coverage, so the coverage findings are expected to hold — but the sanity number is
  re-taken when the pinned version moves.
