# The INTERPRETED basis — a number read off a scan

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

Charting admitted raster PDF as a first-class lane and ruled that machine-vectorized geometry
carries a **new sixth basis, `INTERPRETED`**, upgraded by *corroboration* rather than
relabelled to `MEASURED`. This ticket lands the amendment to `quantity-contract.md` §1 and
rules everything that follows from a sixth value.

## The decision

1. **Rank.** §1 orders basis by strength and says `DEFAULTED` is weakest *because it is the only
   value where nobody looked and nobody decided*. Where does `INTERPRETED` sit? A machine looked
   but no human decided — that is a genuinely new position on the ladder, not an obvious slot.
2. **Roll-ups.** §1's `quantityBasis` and `selectionBasis` are weakest-wins over attributes.
   Confirm the ordering is total once `INTERPRETED` is inserted, and that no existing comparison
   silently changes meaning.
3. **Corroboration.** `identity.md` §7 defines corroboration for *facts* (`AGREED |
   CONFLICTED_RESOLVED | UNCORROBORATED`) — agreeing readings corroborate, disagreeing ones
   suspend. Does a QS confirming a vectorized outline file the same object, or is confirming
   *geometry* different in kind from confirming a *fact*? A disagreement here is not "two
   readings of a number" but "that is not a column" — and suspension may be the wrong shape.
4. **The certificate.** §6 says no coverage percentage prints. But charting ruled the
   certificate *discloses* scan-derived lines. Disclose as a count, a list, or a scope statement?
5. **Tolerance.** §5's band is ±3% under, +0% over, and over-measurement is a hard block with no
   qualification door. A vectorizer that thickens a wall over-measures. Does the +0% rule apply
   unchanged to `INTERPRETED` lines, and if so what makes them ever publishable?

## Guardrails

- The two axes stay orthogonal. Basis means **where a number came from**, never **how sure
  anyone is** — the confidence-score reflex is what §1 exists to prevent.
- Two-point calibration is *not* in dispute and is not this ticket: `measurement-rules.md` §5
  already ranks "QS two-point" highest. Calibration fixes the ruler, not the reading.
- Research found **no verified 2026 benchmark for scanned-drawing vectorization quality**
  (`docs/research/ai-for-drawing-understanding.md`). Any claim about `INTERPRETED` accuracy must
  be measured here, not cited.
