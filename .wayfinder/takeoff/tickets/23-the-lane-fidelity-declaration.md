# The lane fidelity declaration — an artifact that says what it could not see

wayfinder:grilling
Status: open
Blocked by: 06-vector-pdf-to-entitygraph.md
Claimed by:

## Objective

Charting ruled the **EntityGraph is the one interface** and no downstream stage learns a second
source format exists. Ticket 06 measured what that costs: a vector PDF lands as **LWPOLYLINE +
TEXT** — two of the ten types — with the other eight as `unsupported_by_type` counters, and with
whole *channels* routinely missing rather than merely empty:

- **text** absent on 3 of 3 real CAD-plotted sheets (SHX glyphs plot as outlines);
- **layers** absent on 5 of 5 (the PostScript→Distiller path flattens OCGs away);
- **units** absent always (no `$INSUNITS` analogue, `/UserUnit` 1.0 in 14 of 14, `/Measure` in 0
  of 14);
- **blocks and dimensions** absent by construction.

The envelope survives — no new type is needed — but it currently cannot express any of this. A
consumer reading a PDF-lane artifact sees zero TEXT entities and cannot tell *"this drawing has
no labels"* from *"this drawing's labels are unreadable to me"*. The first is a fact; the second
is `quantity-contract.md`'s condemned silence wearing a fact's clothes.

## The decision

1. **Does the artifact declare its lane, its channels, or both?** A `source_lane` enum is the
   small answer; per-channel presence (`text_channel_absent`, `layer_channel_absent`,
   `units_channel_absent`) is the honest one, and the two are not the same — Seattle's 2026 set
   is the same lane as the Los Altos details and has a text channel where they do not.
   Channel presence is a *measurement of the file*, not a property of the format.
2. **Who is forbidden to run.** `cad-ingestion.md` §10's convention profile resolves roles from a
   census including **layer statistics**; on a layer-absent artifact that column does not exist,
   and a resolver that reads "one layer, unnamed" and resolves confidently from nothing is the
   silent-default class `CLAUDE.md` bars. Same for the view partition, which keys its coverage
   band on caption height and has no captions on a text-absent sheet. Rule whether an absent
   channel makes a stage **refuse by name** or makes it **unavailable to call** — the second is
   stronger and is the §7 view-law pattern (one exported predicate, CI-asserted single site).
3. **`unsupported_by_type` is a counter, not a declaration.** It says four POINTs were dropped.
   It cannot say "this lane has no concept of a DIMENSION". Do the eight structurally-absent
   types belong in the same counter as a genuinely-unsupported entity, or is conflating "the
   file had none" with "the format has none" itself a silent default?
4. **What the certificate says.** `quantity-contract.md` makes coverage a query against the
   book. A campaign ingested from a channel-poor lane has a lower ceiling on what it could ever
   have measured, and the Certificate of Measured Coverage is where a QS should learn that —
   before signing, not after. Rule whether lane fidelity is a certificate field.

## Guardrails

- Findings and every figure above: `docs/research/vector-pdf-to-entitygraph.md`; probe at
  `docs/research/probes/vector-pdf/`.
- **Never widen the envelope to fix this.** The one-interface ruling is load-bearing; a
  PDF-specific entity type would break it in the first commit that added one.
- The governing sentence is the test: measure less, completely, and *say so*. A declaration that
  no stage is obliged to read is not saying so.
- Ticket 07 will bring a third lane with a different channel profile again. Whatever this rules
  must hold for a lane that does not exist yet.
