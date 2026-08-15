# Widen the DWG extractor to carry DIMENSION's own attributes

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

Rank 3 of the scale ladder — the overridden dimension ratio, style factor divided out — has **no
input on either lane today**, and on the DWG lane that is a scope gap rather than a law.

[Ticket 12](../tickets/12-the-scale-group.md) ruled rank 2 dead, which leaves rank 3 as the only
machine-derivable scale evidence for a DWG whose `$INSUNITS` is `0` (mapped, but supplying no
scale) or an unmapped code. Without it those sheets have exactly one rank — a QS two-point act —
and 12 ruled they form their own island scale group affirmed by hand.

## The measurement

`DIMENSION` is in the extractor's closed vocabulary (`entitygraph.py` `ENTITY_TYPES`), but
`ingest.py::_record` emits **common fields only** — `h`/`t`/`layer`/`color`/`src`. Its own comment
at `ingest.py:191`: *"DIMENSION: provenance fields only; its rendered geometry (measurement text
included) arrives as derived entities citing this handle."*

So the ratio's numerator (the stated length) is reachable only as **derived text** and its
denominator (the drawn span) only as **derived paint** — and `grid.ts` already set this tree's
precedent: derived paint *"is admissible as corroboration of a signature anchored on an original —
never as the thing that invents the bubble."* A scale invented from derived geometry is exactly
that forbidden shape.

The widening is **lawful**: a DIMENSION's definition points, `measurement`, text override and
`DIMLFAC` are original attributes of an original entity, which `cad-ingestion.md` §3 permits. It has
simply never been ticketed.

## The decision

1. **Which attributes cross the seam.** Definition points, `measurement`, the text override, and
   `DIMLFAC` are the candidates rank 3 needs. Rule the set, and whether it is closed.
2. **How the style factor is divided out.** `DIMLFAC` is the linear scale factor; a dimension may
   also be overridden per-entity. Rule which factors are honoured and what an unreadable or absent
   factor does — 12's guardrail is that it **refuses with a named reason, never a ×1 fallthrough**
   (`CLAUDE.md`).
3. **What a text override means for trust.** A draughtsman who types `6000` over a span that
   measures `5847` has declared a disagreement with their own drawing. Rule whether such a
   dimension is *stronger* evidence (the human stated the truth), *weaker* (the geometry is known
   not to match), or **refuses** — this is the sharp question, and it is not obvious.
4. **The extractor's audit obligation.** ADR-0012 makes the DWG lane audited, not trusted; the new
   fields need whatever counters and validation the artifact contract requires
   (`entitygraph.py`'s `ArtifactError` checks are the pattern).

## Guardrails

- `cad-ingestion.md` §3's extractor invariant binds: INSERTs and DIMENSIONs explode to world
  geometry, and the derived stream is unchanged by this. This ticket adds **original attributes on
  the original record**, it does not reclassify derived paint.
- Rank 3 sits *below* the QS two-point act and *above* the file units header in §5's precedence.
  Landing an input for it does not change that order.
- A dimension whose attributes are absent or malformed **defers with a named reason**. No bounding
  box, no assumed factor.
