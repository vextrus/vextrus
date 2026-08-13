# The INTERPRETED basis — a number read off a scan

wayfinder:grilling
Status: closed
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

## Resolution

Ruled 2026-08-13 by grilling. The basis enum exists in no TypeScript file yet (`MEASURED` /
`DEFAULTED` grep clean), so this landed as a pure amendment to `quantity-contract.md` §§1, 3, 4,
5, 6 and `identity.md` §7 — no migration, no code, and the ordering was free to be whatever it
could be argued into.

**1. Rank — second-weakest, below `ENTERED`, above `DEFAULTED`.** What forced it: read against
§1's own justification, the ladder is not ordered by effort but by **recourse**, and each rung
names its check — re-measure, re-read, re-run a pinned rule id, compare the artifact, challenge a
named human. `INTERPRETED` has none: no human owns it, and a vectorizer is not guaranteed to
reproduce its own output, so it fails the very property that makes `DERIVED` checkable. It beats
`DEFAULTED` on one count, that something looked at the drawing. *Rejected:* slotting it just
under `MEASURED` as "geometry through a noisier ruler" — that imports the confidence axis into
the basis axis, the reflex the §1 guardrail exists to prevent, and its concrete consequence is
that weakest-wins would rank a scan-derived number **above** a QS-typed one, pointing challenge
and dip-sample attention away from the machine's guesses.

Corollary ruled with it: **`INTERPRETED` names the source medium, never the agent.** A QS
hand-tracing on a calibrated scan also produces `INTERPRETED`; basis is a historical claim and
does not change when someone checks it. The alternative launders a scan onto the top rung the
moment a human touches it.

**2. Roll-ups — total, and one clause changed meaning.** Ladder is now `MEASURED` › `TRANSCRIBED`
› `DERIVED` › `IMPORTED` › `ENTERED` › `INTERPRETED` › `DEFAULTED`; totality is trivial. §5's
"basis difference is unavailable as an excuse for an over-measurement" absorbs the new value
untouched. But §3's per-line actor trigger (*"basis not `MEASURED`"*) turned **unsatisfiable**:
it demands a name on every scan-derived line, and an `INTERPRETED` line has no human by
construction. Ruled: narrow the clause to human judgement (`basis neither MEASURED nor
INTERPRETED`) and extend §3's machine-provenance row — vectorizer id + version + render DPI,
the treatment `DERIVED` already gets because machine work is *checkable rather than believable*.
*Rejected:* reading the clause as satisfiable-by-force, i.e. a human must dispose every
interpreted line. That is a publishability rule wearing an attribution rule's clothes — it hides
"must a human clear this?" in the actor field where no reader would look for it. The question is
real and was ruled on its own terms in §5 below.

**3. Corroboration — agreement corroborates, value disagreement suspends, referent disagreement
repudiates.** Agreement needs no new machinery: `identity.md` §7's existing `UNCORROBORATED` →
`AGREED` with an edition bump. A wrong *number* on an agreed object is two readings and suspends,
unchanged. *That is not a column* is different in kind, and suspension is the wrong shape — it
parks an attribute while the register object stands, and a suspended phantom still occupies a row
in the system of record for physical scope, which is §4's pile-cap exemplar reproduced; §4
independently fixes the shape, since a phantom is over-measurement and over-measurement is a hard
block. What forced the *mechanism*: `identity.md` §2 already faced "this must never reach a bill"
for a second sighting and **rejected a status flag on the register** — *"one forgotten `WHERE`
from over-measurement"* — in favour of a separate table with no join from any bill. Repudiation
reuses that table rather than inventing a lifecycle, and is human-only, consistent with §2's
one-way presence recogniser.

**4. The certificate — a sheet-level scope statement, no line count.** Sheets supplied as raster
are named with vectorizer id + version and DPI. What forced the unit: §3 already makes
(drawing, view) a mandatory per-line citation, so the statement is a query over held data; §8
makes the boundary instrument *enumerated and few* while quantities are *sampled and many*, so a
per-line list puts the many into the few's document; and a sheet count converts to no percentage
in either direction, clearing **both** of §6's stated objections rather than one. *Rejected:* a
count of interpreted lines — meaningless by count for the same reason the banned percentage is,
and a reader recovers the percentage by subtraction. The statement doubles as the AI disclosure
§3 has required since the RICS standard of 9 March 2026, which nothing else in the map had landed.

**5. Tolerance — `+0%` binds unchanged; corroboration is the publishability gate.** The relaxed
band was closed by existing text, not preference: §5 lists **basis difference** among the excuses
*"unavailable for an over-measurement."* Publishability was answered mostly by an uncited clause
— §5's two ledgers make validation *per engine, per class*, so the raster path is a **distinct
engine** that may not borrow the vector path's validation, and an unvalidated class never reaches
a certificate. Ruled: an `INTERPRETED` line reaches a bill only as `AGREED`; uncorroborated
interpreted geometry is not a line but a declared exclusion with a named cause and a queue item
(§4's *known scope, not measured*). The raster lane measures less, completely, and says so.

*Objection answered rather than dodged:* §7 rejects universal per-row confirmation as degenerating
into `confirm-all` at volume, and on a fully-scanned set this gate is exactly that. Bulk
corroboration is therefore lawful and recorded at the granularity performed (`identity.md` §7,
one act with N subjects); the anti-rubber-stamp force is §8 — an unvalidated engine class is a
mandatory dip-sample stratum, Part A reviewed in full, Part B blind re-derivation. *Rejected:* an
inner-edge-biased vectorizer whose error distribution is one-sided-under, making raw
`INTERPRETED` numbers legal under-measurements publishable with no human. "Reliably one-sided"
would be an empirical claim about one vectorizer on our own synthetic corpus, and the research
found no verified 2026 benchmark to extrapolate from; promising it holds on a client's unseen
scan is the unfalsifiable promise the destination refuses to make. Ticket 07 must measure that
distribution regardless — keep the bias as engineering, never as a licence to skip the human.

### Downstream

- **Ticket 02 (the source key)** asked whether a raster source key must survive re-vectorization.
  §1's recourse argument now depends on it *not* being guaranteed to; 02 rules the consequence.
- **Ticket 07 (raster to geometry)** owes the measured error distribution, and now also the
  vectorizer id/version/DPI triple that §3 makes a mandatory publishable attribute.
- **Ticket 09 (torture corpus)** gains fixtures this ruling makes assertable: an uncorroborated
  interpreted sheet must produce declared exclusions and **no lines**; a repudiated phantom must
  be unreachable from any bill; an interpreted line must never publish as `MEASURED`.
