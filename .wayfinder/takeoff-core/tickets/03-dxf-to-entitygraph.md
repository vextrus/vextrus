# DXF to EntityGraph

wayfinder:task
Status: open
Blocked by:

## Objective

`cad/` ingestion v1: `python -m vextrus_cad ingest <file.dxf>` emits a valid EntityGraph
artifact from a real DXF via ezdxf — entity extraction per `docs/domain/cad-ingestion.md`
§2–§4 (handles, native units, resolved colour, world text height, the extractor invariant,
real fidelity counters). Plus the synthetic fixture set: a small structural drawing **and its
revision pair**, drawn by script so they are regenerable.

## Guardrails

- Extraction consumes original entities only; every synthesized entity carries `src`; caps
  that trip must say so with per-type loss counters (`cad-ingestion.md` §3).
- Unmapped `$INSUNITS` codes: null + flag, never unitless (§2).
- The Zod mirror and Python validator grow in the same commit; the round-trip fixture test
  stays green both sides.
- No DWG lane, no PDF lane, no table reconstruction yet — entities and counters only.
- Fixtures are synthetic and committed with their generator script.

## Exit criteria

- [ ] `ingest` on the fixture DXF produces an artifact that validates on both sides, with
      non-zero entity counts and honest counters.
- [ ] A deliberately truncated run (tiny cap) reports `explode_truncated: true` + per-type
      losses — tested.
- [ ] `pnpm verify` green (pytest covers the extractor invariant).
