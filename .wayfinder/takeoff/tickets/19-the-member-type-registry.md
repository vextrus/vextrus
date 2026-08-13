# The member-type registry — reading schedules

wayfinder:grilling
Status: open
Blocked by: 02-the-source-key.md
Claimed by:

## Objective

`cad-ingestion.md` §11 specifies the registry and nothing implements it. The first vertical slice
is RCC column concrete, and a column's section comes from the **column schedule** — so this is
directly on the slice's critical path.

## What §11 and §5 bind

- One row per **mark family**, variants beneath, rebar zones per band, provenance to schedule
  cell / caption / band label.
- Evidence admission is **view-membership-filtered before derivation** (`takeoff-core` 05's
  partition is the filter).
- **Raw retention**: every zone keeps its source cell text **verbatim**; parses grade *on top of*
  raw truth, never instead of it.
- **Noise never becomes a family** — markless rows, spec-bleed cells and junk headers exit as
  **named non-family dispositions**, never dropped.
- A schedule view contributing **zero evidence surfaces a named deferral**.
- **Nothing here emits a member count** — a schedule has no Nos column; counts come from
  placement. `REBAR = span × count` is a named failure.
- Table reconstruction (§5) needs no gridlines: anchor on title text, collect within a reach
  window, **row-cluster by y** with tolerance from the median consecutive gap, stop at a vertical
  gap > 3.5× local pitch, header is the first leading row carrying a name/mark cell, **column
  centres come from the header**, two texts in one cell join with `+` (double rebar curtains),
  **every cell cites its source handles** — now source *keys* (ticket 02).

## The decision

1. **The band-first clustering fix.** §5 records the measured defect precisely: clustering on the
   gap between *distinct* y values lets 0.1–0.7 units of intra-row jitter outvote a true 7.4 row
   gap 3:1, resolving pitch to 0.50 and returning **zero tables on a sheet titled "& SCHEDULE"**.
   Rule the algorithm that survives it, and note that *tuning constants in drawing units are the
   same species as guessed scale* — so constants must be content-scaled shares, as
   `cad-ingestion.md` §9 already requires of placement.
2. **Where the BD notation parsers live.** §6 is explicit: **beside their consumer in the app,
   not in `cad/`** — the pipeline stays geometry/spatial-only. Confirm the seam.
3. **The convention profile's role** (§10) — layer roles and caption grammars resolved per
   drawing from an entity census, with the **ablation law** CI-enforced: `resolve(census, {})`
   must deep-equal `resolve(census)` for any census, so a seed may corroborate but **never add,
   drop or re-assign a role**. Rule whether the registry consumes the profile or precedes it.
4. **Zero-evidence deferral vs. AI residue.** Ticket 17 rules geometric clustering primary and a
   model on the residue only. Rule where the boundary sits — which is to say, what "residue" is.

## Guardrails

- The schedule is the *type* authority; placement is the *count* authority. A single crossing of
  that line is a double-count.
- Every deferral carries a named cause from the shared taxonomy (`identity.md` §7).
