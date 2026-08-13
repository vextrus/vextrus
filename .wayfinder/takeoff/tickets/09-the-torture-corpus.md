# The torture corpus — the gate

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

Destination bar 1. A committed, synthetic, deliberately vicious fixture corpus that runs inside
`pnpm verify`, where **every fixture asserts either a correct measurement or a named refusal —
never a wrong number, never silence.** This ticket rules what is in it and how it is generated.

The corpus is not invented hostility. Every entry below is a **documented defect from the legacy
censuses or a clause of the domain law**; we are building fixtures for failures we already know
are real.

## The candidate defect set (rule which are in, and add what is missing)

- Nested INSERTs past the depth cap and past the derived-entity budget — `explode_truncated`
  plus **per-type** loss counters must both fire (`cad-ingestion.md` §3; one global scalar was a
  named legacy defect).
- Xref junk outside the 2nd–98th inter-percentile extents window (§4), and a control drawing
  where nothing is rejected so extents equal naive extents **byte-for-byte**.
- A schedule with intra-row y-jitter of 0.1–0.7 units against a true row gap of 7.4 — the
  measured 3:1 defeat that made the reconstructor return **zero tables on a sheet titled
  "& SCHEDULE"** (§5). Band-first clustering must survive it, and zero-tables-on-a-schedule-sheet
  must surface as a machine-knowable silence.
- `%%C`/`%%D`/`%%P` escapes and all four Ø-lookalikes (Ø Φ ø U+2205); the `@125m` mm-typo; the
  unspaced vulgar fraction `@ 61/2"` accepted only as 6½", never 30.5" (§6).
- Feet-inch dimensions on a metric sheet; `1ST TO TOP FLOOR`; `7th-Roof` endpoint semantics.
- Bangla captions, and a mixed en+bn caption.
- One sheet carrying **three internal scales** (`measurement-rules.md` §5's measured case) and a
  sheet printing `NOT TO SCALE` that *is* to scale — printed scale notes are evidence at no rank.
- A mark family with duplicate marks on split sections (the 82.6%-phantom-money class,
  `identity.md` §4) and a tie-break of identical content signatures.
- A revision pair where the drawing has been **re-origined** — the case RIB's own docs concede
  breaks geometry matching, and the case our domain-derived identity key is supposed to survive.
- A member that moved **between sheets** across revisions (ticket 04's question, as a fixture).
- An unclassifiable caption anchoring nothing; a member-scoped "PLAN OF <subject>" that must be
  a detail and never countable (`cad-ingestion.md` §7).
- A scanned raster sheet and a vector PDF with no `$INSUNITS`.
- A polygonal pile cap whose stored plan area disagrees with its own shoelace by >0.5%
  (`formulas.md` §1 — must refuse, not fall back to a box).
- An opening exactly *at* the deduction threshold — §2 deducts only if **strictly greater**.
- A level ordinal with no row in the multiplier scheme — must **throw**, never ×1.

## Guardrails

- Fixtures are **synthetic and generated** — `cad/tests/fixtures/gen_structural.py` is the
  existing pattern, and it regenerates **byte-identically** (pinned hash seed + `.gitattributes`
  `-text`). Whatever is added must hold that property or the sanity number is worthless.
- Keep the sanity-number discipline (`cad-ingestion.md` §12): after any converter change the
  entity count on a pinned reference reads an exact known value.
- `pnpm verify` stays under 90s with the whole corpus in it. If it cannot, the corpus is
  partitioned by lane — not trimmed.
- **Never weaken a check, delete a test, or edit a fixture to green a build** (`CLAUDE.md`).
