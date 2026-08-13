# The DWG lane — which converter ships

wayfinder:research
Status: open
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
