# The DWG lane — which converter ships

wayfinder:research
Status: closed
Blocked by:
Claimed by:

## Objective

Clients ship DWG. ADR-0001 and `cad-ingestion.md` §1 currently rule: **LibreDWG `dwg2dxf`**
(GPL, subprocess-only, licence text shipped) is the production lane; **ODA File Converter is
dev-only and banned from every production artifact.** The CEO asked for this to be re-examined,
noting ODA may be licensable for production and that we convert only DWG→DXF.

Research is **in flight** — `docs/research/dwg-pdf-ingestion-licensing.md`, covering ODA
membership tiers and costs, LibreDWG's real DWG-version coverage, the FSF position on
subprocess separation, and every alternative (APS Model Derivative, libdxfrw, Teigha, CADEX,
Datakit). This ticket rules once the file lands.

## The decision

1. **Which converter is production**, at what licence cost, and on what evidence about fidelity
   — not merely about licensing. A legally clean converter that drops entity types is worse than
   no converter, because a silent drop is exactly the failure class `cad-ingestion.md` §3's loss
   counters exist to surface.
2. **Fidelity must be measured, not assumed.** Convert a DWG to DXF and compare entity counts
   per type against the source. Whatever ships needs a **sanity number** in the §12 sense.
3. **Whether ADR-0001 is amended or superseded.** ADRs are never edited (`CLAUDE.md`) — if the
   ruling changes, it is a new dated ADR that supersedes.
4. **The fallback.** If no converter is both clean and faithful, the honest product behaviour is
   a named refusal on DWG upload with a "convert to DXF and re-upload" path — worse UX, zero
   silent loss. Rule whether that is acceptable rather than discovering it later.

## Guardrails

- GPL via subprocess is the *existing* ruling's basis; if it is kept, the licence text ships and
  nothing links. If ODA is bought, its terms are quoted in the resolution, not paraphrased.
- No converter output is trusted without loss counters (`cad-ingestion.md` §3).
- `docs/research/drawing-corpora.md` found LibreDWG's own test corpus is in-tree GPL-3.0 —
  usable for *measuring* fidelity in a scratch directory, never vendored.

## Resolution

**Ruled 2026-08-13. LibreDWG stays the production lane; ODA is priced, not bought; and the lane
becomes two passes because a single `dwg2dxf` call cannot say what it lost.** Recorded as
**ADR-0012 — The DWG lane is audited, not trusted**, superseding ADR-0001's converter clause;
`cad-ingestion.md` §1 and §12 amended to match.

The research (`docs/research/dwg-pdf-ingestion-licensing.md`) answered the CEO's question — ODA
**is** licensable at **$7,500 y1 / $4,500 renewal**, Sustaining being the only tier whose
`Web/SaaS use` row reads Yes — and then said the deciding evidence was missing. It has now been
taken.

### The measurement

LibreDWG **0.13.3** built from `mirrors.kernel.org/gnu/libredwg` (0.14.1 is GitHub-only and gated
here), `./configure --disable-bindings --disable-shared --enable-release` → `IS_RELEASE 1`,
`DEBUG_CLASSES` undefined. Run over the project's own 139-DWG GPL-3.0 corpus in a scratch
directory, never vendored. **Ground truth is external, not LibreDWG's own opinion:** 34 corpus
DWGs ship an AutoCAD-authored DXF twin — provenance confirmed because the twin carries no
`999 LibreDWG` header stamp and writes `$ACADMAINTVER 29` in AutoCAD's field formatting, where
LibreDWG's own output stamps `999 LibreDWG 0.13.3` and writes `$ACADMAINTVER 0`. Census counts
entities across modelspace, every paperspace layout, and every non-layout block, via ezdxf 1.4.4.

Taken on `63baec8`, branch `claude/dwg-lane-tickets-xldyja`, Linux 6.18.5-fc-v20 x86_64, 4 cpus,
2026-08-13T05:08Z.

**1. The converter never reports failure.**

| | count |
|---|---|
| conversions attempted | 139 |
| **exit code 0** | **139** |
| DXF that ezdxf refuses to parse | 8 |
| DXF that parses to **zero entities** | 8 |

Sixteen files — 11.5% — produced an empty or unreadable artifact, and every one of them exited 0.

**2. Loss is real on current-format files.** 31 modern (r13+) ground-truth pairs:

| | |
|---|---|
| entities in the AutoCAD twins | **3,736** |
| entities recovered through the lane | **3,646** |
| **aggregate recovery** | **−2.41%** |
| pairs exact | 19 / 31 |
| worst single file | `2004/Surface.dwg`, **−27.8%** |

Aggregate per-type net delta: `ACAD_PROXY_ENTITY −27` · `WIPEOUT −16` · `ACAD_TABLE −7` ·
`ARC_DIMENSION −6` · `IMAGE −5` · `EXTRUDED/LOFTED/PLANE/REVOLVED/SWEPTSURFACE −1` each — and,
on `example_r13`/`example_r14` identically, **`POINT −4` `ARC −2` `INSERT −2` `LINE −2` `SOLID −2`
`MTEXT −1`**. The research predicted proxies, tables and images from LibreDWG's `TODO`; the
measurement confirms all three, adds `WIPEOUT` (not on that list), and **refutes the reading that
only exotic classes are at risk** — plain lines and block references go missing too, reproducibly
across two saves of the same drawing.

**3. Nothing was lost invisibly — and this is what decided it.** Three-way census on
`example_2018.dwg` (AutoCAD twin / `dwgread -O JSON` decoder / emitted DXF), 23 entity types
agreeing exactly across all three, and every disagreement:

| type | AutoCAD | decoder | our DXF | |
|---|---|---|---|---|
| `WIPEOUT` | 2 | **2** | 0 | writer-stage — decoder still names it |
| `ARC_DIMENSION` | 1 | **1** | 0 | writer-stage — decoder still names it |
| `ACAD_TABLE` | 1 | 0 | 0 | decoder-stage — but decoder emits `UNKNOWN_ENT` = 1 |

Confirmed on the other lossy files: `2013/gh109_1.dwg` loses 25 `ACAD_PROXY_ENTITY` and the
decoder reports **`UNKNOWN_ENT` = 25**; `r14/Leader.dwg` loses 5 `IMAGE` and the decoder reports
**`IMAGE` = 5**; `2018/Helix.dwg` converts to zero entities and the decoder reports **`HELIX` = 1**.
**Every measured loss, writer-stage and decoder-stage alike, is visible in `dwgread -O JSON`.**

So the fault in ADR-0001's lane is not LibreDWG's coverage — it is that one `dwg2dxf` call is
**unauditable**, which no amount of licence money fixes and which `cad-ingestion.md` §3's loss
counters already demand be fixed. The census *is* the loss counter.

**4. `--enable-debug` recovers `example_2018` to a perfect 211/211** (WIPEOUT 2, ACAD_TABLE 1,
ARC_DIMENSION 1 all returning) but does not touch the proxy or image losses. So the release
build's loss on that file is a **policy**, not a capability limit — and the policy is right: those
classes are ones LibreDWG's own `TODO` calls "broken/untested", so enabling them trades a named
refusal for a possibly-wrong number, the one trade the governing sentence forbids.

**5. Throughput is not a constraint.** 2.2 MB DWG → 0.63 s; 520 KB → 0.09 s, on 4 cores. The
second decode pass fits the 50-sheets-in-10-minutes bar with room to spare.

### The ruling, against the ticket's four questions

1. **Which converter ships** — LibreDWG, at $0, **on fidelity evidence and not merely licensing**:
   97.6% aggregate entity recovery on current-format files with 100% of the shortfall accountable.
   ODA is not bought now; the trigger is named instead (below).
2. **The sanity number** (§12) — pinned: `example_2018.dwg` = **207 recovered + 4 named losses**
   against an AutoCAD twin of **211**. A silent 207 fails the fixture exactly as a silent 211 does.
3. **ADR-0001** — **superseded in part** by ADR-0012, never edited. ADR-0012 also *tightens* what
   the CEO's question was expected to loosen: **ODA File Converter's dev-only permission is
   withdrawn**, because even that use rests on a 60-day click agreement whose stated Purpose is
   evaluating membership.
4. **The fallback** — a blanket "convert to DXF and re-upload" refusal is **rejected and not
   needed**: measured, there is no silent-failure class to escape. But its mechanism is adopted at
   *sheet and class* granularity and becomes the lane's normal behaviour, not an emergency: any
   census/DXF per-type shortfall or `UNKNOWN_ENT` refuses that class by name, and an unparseable
   DXF refuses the sheet as `dwg_dxf_unparseable`.

**The ODA trigger, named in advance so it is not re-litigated:** a 60-day Sustaining evaluation
runs in the private corpus lane (**The private corpus lane**) on real Bangladeshi consultant DWGs.
Buy ODA if the audited lane refuses whole sheets on more than 5% of that corpus, or if any refusal
lands on a class the QS must then hand-measure. *The 5% is this ruling's assumption, not a
domain-law figure — the evaluation may revise it against what a QS actually tolerates.*

### The alternative put and rejected

**Buy ODA Sustaining now** ($7,500 then $4,500/yr). Rejected on three grounds. It is unmeasured —
no ODA binary is obtainable in a cloud container without an account and a 60-day agreement, so
the head-to-head this ticket asked for is *half* done and buying now would spend on the untested
half. It buys smaller gaps, not *visible* ones — an unaudited ODA lane would fail the governing
sentence the same way the unaudited LibreDWG lane does, so the two-pass audit is required either
way and is what actually closes the ticket. And the rights lapse with the subscription ("you lose
the right to distribute the ODA-based product, even if it was developed during the validity of the
license"), making it a permanent obligation taken pre-first-customer. Also rejected: **shipping
the `--enable-debug` build** (see 4), and **refusing DWG wholesale** (see 4).

### Caveats, stated plainly

- **Measured on 0.13.3, not 0.14.1** — the GNU mirror's newest, GitHub being gated. 0.14.1's
  `NEWS` is dominated by memory-safety fixes rather than entity coverage, so the coverage findings
  should hold; the sanity number is re-taken when the pinned version moves.
- **No ODA number was measured** — every ODA figure here is the research's licence reading, not a
  fidelity observation. That is exactly what the trigger exists to settle.
- **`example_r13`/`example_r14` pair equivalence is assumed** — the DWG and its DXF twin are taken
  to be the same drawing. The identical loss signature across both versions is strong evidence,
  not proof.
- Two reader traps found the hard way, both recorded in ADR-0012: `dwgread -O JSON` output is
  **not valid UTF-8**, and entity type lives under the `entity` key while non-entities use
  `object` — a reader that reads only `object` counts zero entities and reports a clean drawing.

### Handed on

- **The torture corpus** gains a required fixture class: an MTEXT drawing note containing a raw
  newline. Both modern unparseable outputs (`2018/Dynblocks.dwg`, `2013/gh44-error.dwg`) failed on
  exactly this — an ordinary consultant disclaimer note, written through unescaped, invalidating
  the entire DXF from that byte on.
