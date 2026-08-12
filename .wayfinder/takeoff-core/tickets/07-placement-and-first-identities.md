# Instance placement and the first identities

wayfinder:task
Status: open
Blocked by: 06-grid-backbone.md

## Objective

Columns placed at grid intersections become the first `register_objects` rows carrying the full
identity key, ordinals frozen at first registration. This is where the register's **door**
lands — the registration logic ticket 02 deferred (`src/core/register.ts` says so in its own
header): mark families sorted by content signature of authored inputs only, `mark#i` keying,
row-id tie-break, and a `DUPLICATE_IDENTITY` refusal that lands in `refused_sightings` rather
than on the register.

## Guardrails

- `cad-ingestion.md` §9 and `identity.md` §2–§4 bind verbatim.
- Placement constants are **shares of the minimum grid spacing** from ticket 06, never absolute
  and never hardcoded: containment/merge 0.08, near-anchor bound 0.9 (beyond it, honest
  absence), footprint 0.6–2.5 of grid spacing.
- No coordinate, label, or correctable attribute enters the identity key. The placement key
  quantizes world coordinates to 0.1 drawing unit (§3) — it is not the identity key.
- Vertical classes expand per level; foundation classes take the lawful-null level basis. The
  fixture has no authored level stack yet — decide whether these columns register under
  `UNRESOLVED` or the ticket authors a level, and record which.
- Label normalization strips size parentheticals and compares dotless-uppercase; both forms are
  the drawing's own — nothing invented.
- No quantities. Objects and identity only.

## Exit criteria

- [ ] Rev 1 registers 9 columns: mark family C1 ×4 → `C1#1..#4`, C2 ×4 → `C2#1..#4`, C3
      singleton keeps the bare mark.
- [ ] A second registration pass over the same ingest is a no-op, not nine refusals — and a
      genuine second sighting of one identity refuses at the door with `DUPLICATE_IDENTITY`,
      landing in `refused_sightings` with its cited handles.
- [ ] The 1.5× bubble and the arc/slab/stray-POINT entities yield no instance, by named absence.
- [ ] `pnpm verify` green and under 60s; `pnpm test:db` green.
