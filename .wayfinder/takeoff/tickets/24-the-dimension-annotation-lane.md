# The dimension annotation lane — when the number and the picture disagree

wayfinder:grilling
Status: open
Blocked by: 07-raster-to-geometry.md, 19-the-member-type-registry.md
Claimed by:

## Objective

Ticket 07 ruled the scan lane **originates a location, never a dimension** — measured extent error
is ~0.7 paper mm regardless of resolution, putting a ±3% floor at ~2.4 m at 1:100, above every
member-scale dimension. Dimensions must therefore come from elsewhere. Ticket 19 owns the
*schedule* as a source. This ticket owns the other one: the **dimension string annotated on the
plan itself**, and what happens when it disagrees with the geometry it labels.

The disagreement is not hypothetical — it is the normal case, since 07 measured the geometry's
extent error at 6–8× the pixel quantum.

## The decision

1. **Does this lane exist at all, or does everything route through the schedule?** The cheapest
   defensible answer is that a scan publishes nothing not enumerated in a schedule. That is
   coherent and very restrictive — dimension strings are how a plan states a room span, and there
   is no schedule of rooms. Rule it in or out before designing it.
2. **Binding.** A dimension string is bound to what it measures by extension lines, arrowheads and
   proximity — all of which are exactly the thin-line class 07 measured at **recall 0.000** under
   fax at ≤300 dpi. If the extension lines are the first thing to vanish, on what evidence does
   `"3600"` attach to *that* wall rather than the one beside it? A mis-binding is not a wrong
   number, it is a number attached to the wrong object — worse, and invisible.
3. **Disagreement shape.** Annotation says 3600, vectorized extent says 3540 (inside 07's measured
   error). Which wins, and what is filed? `identity.md` §7 has `AGREED | CONFLICTED_RESOLVED |
   UNCORROBORATED` for *facts*, and ticket 03 is already asking whether confirming geometry is the
   same kind of act as confirming a fact. This is the concrete case that tests it. Note the
   asymmetry: if annotation always wins, the geometry is only ever a *corroborator*, which may be
   the whole answer.
4. **The disagreement that is not an error.** A dimension string may legitimately differ from the
   drawn geometry — drawings are not always drawn to scale, and a "NTS" detail is deliberately
   not. Does a large disagreement indicate a bad scan, a mis-binding, or an honest NTS drawing,
   and can those be told apart? If not, the disagreement is a deferral with a named cause.
5. **Bangla numerals.** 07 routed Bangla *text* to a human on measured CER. Bengali digits in a
   dimension string are a narrower problem than running text — a closed 10-glyph set in a known
   context. Is that narrow enough to machine-read where prose is not, or does the same refusal
   apply?

## Guardrails

- 07's R1 binds: geometry may corroborate a dimension, never originate one. This ticket may not
  reintroduce a measured extent as a published number.
- Over-measurement stays a hard block with no qualification door (`quantity-contract.md` §4). An
  annotation read too large is an over-measurement like any other.
- Raw retention as `cad-ingestion.md` §11 already requires of schedule cells: the source string is
  kept **verbatim**, and parses grade on top of raw truth, never instead of it.
- Every reading cites a source key (ticket 02) that code verifies resolves before a human sees it.
