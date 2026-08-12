# DXF to EntityGraph

wayfinder:task
Status: closed
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

- [x] `ingest` on the fixture DXF produces an artifact that validates on both sides, with
      non-zero entity counts and honest counters.
- [x] A deliberately truncated run (tiny cap) reports `explode_truncated: true` + per-type
      losses — tested.
- [x] `pnpm verify` green (pytest covers the extractor invariant).

## Resolution

Extractor in `cad/src/vextrus_cad/ingest.py`; CLI `ingest <file.dxf> [--explode-depth]
[--derived-budget]` emits validated JSON on stdout. Entity vocabulary (closed set of 10):
LINE, LWPOLYLINE, POLYLINE, SOLID, CIRCLE, ARC, TEXT, MTEXT, INSERT, DIMENSION; anything
else lands in a new `counters.unsupported_by_type` — counted, never silently dropped.
Fixtures `structural-r1.dxf`/`-r2.dxf` (revision pair: one column nudged, one deleted, one
added) regenerate byte-identically from `tests/fixtures/gen_structural.py`
(`write_fixed_meta_data_for_testing` + pinned `PYTHONHASHSEED`; `.gitattributes` keeps DXF
eol untouched — sha256 is pinned in the committed artifact). Shape decisions worth
remembering:

- `src is None` IS the original-entity predicate; originals must carry their DXF handle
  (validator-enforced both sides). Derived entities cite the *top-level* original's handle —
  virtual entities carry no handles of their own, so nested provenance resolves to the
  model-space INSERT/DIMENSION that painted them.
- Nested references recurse without emitting themselves; a depth-capped reference counts as
  a lost INSERT, a budget-capped leaf counts under its own type. Budget losses are exact:
  `derived + Σ lost_by_type == full-run derived` (tested).
- Colour resolves true_color → explicit ACI → BYLAYER (layer "0" in a block takes the
  insert's layer) → BYBLOCK (parent insert's resolved colour). Closed paths carry shoelace
  area; open paths carry explicit null (closed ⇔ area, validator-enforced).
- Sanity number (§12): r1 reads exactly 34 original / 48 derived / `{POINT: 4}` unsupported.

Code review (in-scope findings, all fixed with regression tests before landing):

- **Mesh POLYLINE crash** — polyface/polygon-mesh variants pass the type gate by name but
  `make_path` raises TypeError; now counted as `POLYLINE(POLYFACE)`/`POLYLINE(POLYMESH)`.
- **Area computed after decimation** — the point cap leaked into a carried figure (0.24% off
  on the slab fixture, silently); area now comes from the full flattening.
- **Derived MTEXT rotation read 0** — transforms store `text_direction`; `get_rotation()` is
  the lawful accessor. Same class: TEXT/ATTRIB anchors now via `get_placement()` (group-10
  insert is meaningless for non-left justification).
- **Degenerate paths** emitted contract-invalid `pts: []` — now counted `(DEGENERATE)`;
  `extract()` validates its own emission so no invalid artifact can flow, and non-finite
  coordinates refuse by name (`math.isfinite` in the validator).
- **Mirror drift at four edges** (empty original handle, absent `h` key, `$`-vs-fullmatch
  colour, bool-as-count) — both validators aligned, refusal cases tested both sides.
- **PowerShell 5.1 stdout redirect corrupts the artifact** (UTF-16 BOM) — the CLI grew
  `--out` and the regeneration docs use it.

Out-of-scope findings routed: `ingests.unsupported_by_type` column + register transition
guards + refused-sightings project pairing → noted on ticket 04; auth/tenant findings
(stale-membership TenantCtx, non-transactional signup hook, default-tenant divergence,
migrate-script quoting) reported to the operator for their own tickets.

Proof: `pnpm verify` green in 7.0s (35 pytest + TS mirror parsing the committed artifact).
