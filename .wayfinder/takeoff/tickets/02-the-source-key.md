# The source key — provenance when there is no DXF handle

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

`cad-ingestion.md` §2 rules that **"the DXF handle (`h`) is THE stable provenance key"** — every
schedule cell, note reading and measurement cites handles. Charting admitted vector PDF and
raster PDF as first-class lanes. **Neither has handles.** This ticket generalises §2 without
weakening it, and the amendment is written into the domain file as part of the resolution.

## The decision

1. **The scheme.** A source key becomes `(scheme, key)` with a closed scheme vocabulary —
   `DXF_HANDLE`, and one each for vector-PDF and raster-derived evidence. What generates the
   PDF key? Charting proposed a **content-derived** digest (page + operator-path, quantized),
   explicitly **never an ordinal counter**, because `identity.md` §3 requires that an identical
   re-derivation reproduce the identical key multiset — a counter re-mints on re-ingest and
   orphans every citation. Confirm or replace that construction.
2. **Quantization.** A content digest over floating-point path coordinates is unstable unless
   quantized. §3 already quantizes placement keys to 0.1 drawing unit. What is the analogous
   figure for PDF user-space, and what happens when two distinct paths collide after
   quantization — refuse, or disambiguate by an ordinal *within* the collision set?
3. **Raster.** Under the ruling in ticket 03, raster geometry is machine-vectorized and carries
   basis `INTERPRETED`. Its source key must survive re-vectorization of the same page — or must
   it? If the vectorizer is not deterministic, a re-run orphans citations, and that consequence
   must be named rather than discovered.
4. **Storage.** Register sightings, refusals and cited-handle arrays all currently store bare
   handle strings. Does the scheme ride in the column, in a separate column, or in a prefix?

## Guardrails

- `identity.md` §1: every figure traces to a register row **by reference**; §3: zero minted ids,
  no UUIDs, no DB sequences, no timestamps in any derived key.
- `identity.md` §5: the *semantic* carries cited evidence handles deliberately — a row whose
  numbers are unchanged but whose evidence moved must re-present. Whatever the key becomes, this
  must keep working.
- The closed `takeoff-core` work stores DXF handles today. This is a migration, not a rewrite —
  existing rows must remain valid under the generalised scheme.

## Blocks

Ticket 17 (AI architecture — proposals cite source keys and code verifies they resolve) and
19 (member-type registry — every schedule cell cites its sources).
