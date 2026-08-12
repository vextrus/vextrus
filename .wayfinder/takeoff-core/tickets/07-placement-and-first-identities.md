# Instance placement and the first identities

wayfinder:task
Status: closed
Claimed by:
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

- [x] Rev 1 registers 9 columns: mark family C1 ×4 → `C1#1..#4`, C2 ×4 → `C2#1..#4`, C3
      singleton keeps the bare mark.
- [x] A second registration pass over the same ingest is a no-op, not nine refusals — and a
      genuine second sighting of one identity refuses at the door with `DUPLICATE_IDENTITY`,
      landing in `refused_sightings` with its cited handles.
- [x] The 1.5× bubble and the arc/slab/stray-POINT entities yield no instance, by named absence.
- [x] `pnpm verify` green and under 60s; `pnpm test:db` green.

## Build note

`src/modules/takeoff/placement.ts` is pure §9: two anchor channels (an original INSERT
positioned by its own world point, derived paint for extent only; an original closed outline
gated by the 0.6–2.5 footprint window — the fixture's bulged slab spans 3.0 and is refused by
name), the mark as the gate, and one named disposition per original in the view, so the bubble
(grid evidence), the arc/dimension (no closed footprint) and the slab are each absent by name;
the stray POINT never reaches the graph and its absence is the pipeline's `unsupported_by_type`.
The element class is **not** read off a mark prefix: a view that may not yield instances but
names a class in its caption witnesses the class of the marks its own text carries
(`COLUMN SCHEDULE` → column), and an unwitnessed or disputed family places nothing.

The level question, ruled: `UNRESOLVED`, no level authored — authoring one is a human act
(identity.md §7), so `levelSlotOf` gives vertical classes the lawful-null UNRESOLVED basis and
foundation classes FOUNDATION; §3's one-hop carry is what moves the key when a human authors.

The door is `registerSightings` in `src/core/register.ts` (ticket 02's deferral, now closed):
`familyIdentities` is the ONE ordinal derivation site — family = (class, level slot, dotless
mark), sorted by content signature then the placement key as the row's own id — and
DUPLICATE_IDENTITY is written from the unique constraint's own violation on a savepoint, never
from a pre-flight SELECT. Migrations 0008/0009 add `register_object_sightings` (placement key +
cited handles + ingest, unique per project+drawing, SELECT/INSERT only on the app lane): the
placement key lives beside the register, never in its key, and is what makes a re-run a no-op.

Ticket 08 should know: ordinals derive from the *offered batch*, so rev 2's dropped/added column
would re-derive a family's indices and collide as DUPLICATE_IDENTITY — inheritance through
pairing is exactly the gap 08 closes, and the sighting rows (placement key → register object,
per drawing) are the join it should pair on.
