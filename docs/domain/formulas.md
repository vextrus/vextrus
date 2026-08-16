# Formulas — quantities, BBS, units, rates

Re-derived 2026-08-12 from the legacy engines (golden-tested there against a professional QS
workbook). Every emitted line carries a human-auditable formula string plus named variables.
**No AI anywhere in the fan-out** — every billable number is computed from human-confirmed
inputs. Honest deferral throughout: a sub-part the input cannot pay is returned as a deferral
with a reason, surfaced, never guessed.

## 1. Geometry

Typed member geometry is a discriminated union — `PRISM_RECT`, `PRISM_POLY`, `FRUSTUM_RECT`,
`TAPER_LINEAR`, `AREA_THICK` — and there is **no silent bounding-box fallback**: a
declared-but-malformed spec returns a reason and defers (a polygonal pile cap over-counts ~13%
as a box; a box dressed as a measured cap is fabrication). A stored plan area disagreeing with
its own polygon's shoelace by >0.5% is a hidden magic value and refuses.

## 2. Concrete volume

- `PRISM_POLY`: `count × (shoelace(plan) − Σ deductible openings) × depth`
- `FRUSTUM_RECT` (prismoidal/Simpson, exact for straight-line rectangular taper):
  `count × [ h/6 · (A₁ + 4·Aₘ + A₂) + A₁·h_base ]`, `Aₘ = ((L₁+L₂)/2)·((W₁+W₂)/2)`
- `TAPER_LINEAR`: `count × ((A + B)/2) × span`
- `AREA_THICK`: `count × (area − openings) × thickness`
- Rect prism: `count × L × B × H`
- **Vertical members expand per level** from the level stack; a banded vertical prices each
  band's own section × its own count; a level no band covers **defers** — never inherits an
  adjacent band's section.

## 3. Formwork (contact area on the real shape)

- Polygonal foundation/cap: **side faces only** = `perimeter × depth` (not plan area — that is
  a slab soffit; not top/bottom — cast against blinding / open).
- Frustum: four inclined trapezoids + base-block sides:
  `2·((L₁+L₂)/2)·√(h² + ((W₁−W₂)/2)²) + 2·((B₁+B₂)/2)·√(h² + ((L₁−L₂)/2)²) + 2(L₁+B₁)·h_base`
- Tapered beam: `(2·mean d + mean b) × span` — **the top is never counted**.
- Slab: **soffit area** with rule-driven opening deduction. Beam: `count × (2d + b) × L`.
- Foundation: `count × 2(L + B) × depth`. Vertical: `count × 2(L + B) × storey height`,
  per level, band-aware.

## 4. Earthwork and blinding

- Excavation: `count × (L + 2a) × (B + 2a) × (depth + dx)` — working allowance `a` (seed
  1.5 ft) and depth extra `dx` (seed 0.5 ft) are config. Polygon/frustum pits **defer**.
- Blinding (CC): `count × (L + 2p) × (B + 2p) × t` — projection and thickness config (seed
  3 in each). Deferred for polygon plans (needs an offset polygon).

## 5. Rebar / BBS

**Detailing rules are versioned data** (`BNBC2020_BD @ 2026.07`, citing BNBC 2020 Part 6
Ch. 8 / ACI 318 / IS 2502 site convention). Two laws: swapping a value changes output with no
code edit; **the drawing's own general notes override computed defaults verbatim** (grade,
cover, an explicit lap multiple), landing in the applied-notes audit and re-versioning the set.

Values (BD defaults): fy 420 MPa (Grade-60), f'c default 3000 psi. **ℓd table** (multiples of
d_b; columns ≤19 mm / ≥20 mm): f'c 3000 → 44/54 confined, 66/83 otherwise; 3500 → 41/50,
61/78; 4000 → 38/47, 57/72; clamp f'c to the row at-or-below (conservative); top-bar ×1.3;
floor 300 mm. **Laps**: Class A 1.0 ℓd / Class B 1.3 ℓd, floor 300 mm, compression ≈30d,
**default Class B**. **Hooks** (tails): 90° = 12d; 180° = max(4d, 65 mm); stirrup 135° =
max(6d, 75 mm). **IS 2502 additive hook allowances**: 90° = 12d, 135° = 10d, 180° = 9d.
**Bend deductions** per bend: 45° = 1d, 90° = 2d, 135° = 3d, 180° = 4d. **Covers (mm)**:
beam 25 · column 40 · wall 20 · slab 20 · pile cap/footing/pile (cast against earth) 75.
**Tie spacing** = least(16·db_long, 48·db_tie, least member dimension). **Curtailment**: extra
top over supports Ln/3 each side; extra bottom midspan ends L/4 from support; 45° crank extra
0.42·D per crank. **Add-ons**: wastage 3%; lap% 0 — **laps are modeled, never
percentage-allowed**; binding wire 8 kg/tonne. **Stock bar 12,000 mm.**

**Unit weight**: kg/m = d²/162 with the verified lookup (8→0.395 · 10→0.616 · 12→0.888 ·
16→1.579 · 20→2.466 · 22→2.98 · 25→3.854 · 28→4.828 · 32→6.313 · 36→7.981 · 40→9.864). The
table, not a weighbridge, is authoritative — billing is on nominal mass (`bd-authority.md` §5).

**Cutting length** by BS 8666 shape code (bend radius 2d ≤16 mm else 3.5d): `00` = A;
`11` = A+B−0.5r−d; `21` = A+B+C−r−2d; `51` closed link = 2(A+B+C)−2.5r−5d; generic fallback
Σlegs − bends·(0.5r+d). Raw cutting length is never rounded; a separate rounded value (up to
25 mm) is the only rounded surface. The **IS-additive convention** (Σlegs + hook allowances −
bend deductions) is what BD sites use; the IS↔BS divergence is **recorded, never asserted
equal** — asserting ≈ would fail a correct build.

**Bar synthesis per member class** (`REBAR = span × count` is the named failure):
- Through bars: `span + 2·ℓd`, stock-split with lap overlap counted.
- Extra top over support: `2 × (Ln/3)`, straight, embedded — never full span.
- Closed link: legs to the outer bend line (b−2c, d−2c); IS additive with 10d hooks and
  3×90°+2×135° deductions; dense end zones + mid zone, each `⌊dist/spacing⌋ + 1`.
- Mat bar: `net = dim − 2c`, +2×12d hooks, −2×90°; count `⌊(distDim − 2c)/spacing⌋ + 1`.
- Column/wall vertical: storey run + one storey lap (class default), stock-split.
- Slab crank: `clear span + 2ℓd + 2(0.42D) − 4×45° − 2×90°`.
- **Counting rule** `⌊(distance + 0.5 mm)/spacing⌋ + 1` — the 0.5 mm tolerance exists so an
  imperial round-trip never drops a bar at an exact-multiple boundary.

**Stock splitting with billable lap**: if L ≤ stock, one piece; else
`n = ⌈(L − lap)/(stock − lap)⌉`, **billable length = L + (n−1)·lap** — every join is steel in
place. Invariants: stock > lap; every piece ≤ stock.

**BBS assembly**: bars/unit from spacing or explicit count; × parent element count;
weight = cutting length × kg/m; anchorage ends by role (MAIN both, DISTRIBUTION one,
STIRRUP/TIE none — hooks already in the shape); a synthesis-supplied cutting length is used
verbatim, never re-derived. **Cutting stock**: 1-D bin packing grouped **by diameter**,
first-fit-decreasing; a piece longer than stock flags lap-required and leaves the bins.

## 6. The unit canon

- **Two tiers**: physical dimensions (MASS/VOLUME/LENGTH/AREA/COUNT — cross-dimension is
  `DIMENSION_MISMATCH`) and **packaging units** (bag, drum, coil, …) that canonicalise to
  themselves and need a **product property** to reach a physical unit (`PRODUCT_FACTOR_MISSING`,
  never a silent 1.0 — "a 40 kg cement bag is a different product, not a different physics").
- **One factor per unit** (`toCanonical`); every pair derives as a quotient — reciprocals are
  exact by construction (a stored-reciprocal table was wrong by 6% on sand and passed every
  absolute pin). Canonicals: kg · m³ · m · m² · pcs. Exact constants only:
  `0.028316846592` m³/cft · `0.3048` m/ft · `0.09290304` m²/sft · `1000` kg/MT ·
  `0.45359237` kg/lb. A conversion literal outside the canon is a lint failure.
- **Refusal is structural**: the failure arm carries no value, no factor — a caller cannot
  destructure a number out of it. Reason codes are stable identifiers (they translate to
  Bangla), never prose. Typos refuse (`Dozzen`); rate **bases** (`job`, `LS`, `per % cft`,
  `hour`) are not units and never enter the unit column.
- **Conversion is the last term of the formula**: `amount = rate × qty × convert(1, qtyUnit,
  rateBasisUnit)` — never a hidden pre-step restating qty (the legacy bug priced every volume
  line 35.31× off), and the dip-sample checker must see the term.
- **A rate converts inversely to a quantity** (৳420/cft = ৳14,832/m³; backwards is a 1,247×
  error) — in exactly one function, once, at entry. The quoted figure + unit stay write-once
  provenance.
- Resource factor lookups key on **(tenant, resource id), never a bare code** — codes collide
  across tenants; resolving by code is an isolation breach.

## 7. Rate analysis (the BD "analysis of rates")

All decimal, never floats:

```
materialRate  = Σ(consumption × unitRate × (1 + wastage%)) / basisQty
labourRate    = Σ(labour lines) / basisQty × floorMultiplier
equipmentRate = Σ(equipment lines) / basisQty
direct        = material + labour + equipment
sundry        = direct × sundry%
subTotal      = direct + sundry
overhead      = subTotal × overhead%      // PWD 2022: 3.5%
profit        = subTotal × profit%        // PWD 2022: 10%
composite     = subTotal + overhead + profit
```

**Overhead and profit both ride the same subtotal, additively — never compounded.** VAT is a
document-level line, never composed into the rate. A missing resource rate **throws** — it
never prices at zero. Per-resource-line contributions are kept (the only thing that lets a QS
trace a taka in the composite back to a norm line). Floor escalation resolves by **ordinal**
(`measurement-rules.md` §7); a scheme with no row for the ordinal throws — the silent ×1
fallback understates an eighth-floor labour rate by 45% and says nothing.

Golden vectors are re-derived from the PWD published Analysis of Rates during the book
module's build — legacy vectors derived from competitor data stay in the legacy repo.
