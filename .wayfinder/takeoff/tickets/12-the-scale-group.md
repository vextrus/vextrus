# The scale group and its affirmation

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

Graduated from `takeoff-core`'s fog, which parked this with *"chart it when a quantity needs a
length."* The first vertical slice is RCC column concrete. **A quantity now needs a length.**

`measurement-rules.md` §5 calls per-region fail-closed scale a differentiator nobody in the field
ships. It also states the hardest constraint in the system: **a quantity without an affirmed
calibration is unrepresentable — `calibration_id NOT NULL`.** No spine table exists for this yet.

## The decision

*An AFK pass has since read the environment against every one of these — see **Findings** below,
which sharpens 1, 2, 3, 5 and 6 and adds three questions. Read it before grilling.*

1. **What a scale group *is*, mechanically.** §5 says affirmation happens per **scale group**
   (~6–8 acts per project), that per-drawing "affirms a falsehood" (one legacy sheet carried
   three internal scales), and that per-view "degenerates into confirm-all". So a group is
   neither. What derives group membership, and from what evidence?
2. **Positive membership.** §5: *membership is positive, never residual* — a view joins on
   affirmative evidence; no evidence means unplaceable, hatched, and it **measures nothing**.
   Rule what counts as affirmative evidence, and confirm the residual case is unrepresentable
   rather than merely discouraged.
3. **Precedence, implemented.** QS two-point → grid spacing match → overridden dimension ratio
   (style factor divided out) → file units header. **Printed scale notes rank nowhere.** The
   PDF lane loses **two** ranks, not one — ticket 06 measured it: no file-units header exists,
   and no DIMENSION object exists either, so the dimension-ratio rank has no input. `/UserUnit`
   read 1.0 in 14 of 14 files and PDF's own `/Measure` viewport (ISO 32000-1 §12.9) appeared in
   none, so there is no PDF-native substitute. Worse, the surviving grid-spacing rank is itself
   degraded: `cad-ingestion.md` §8 detects a bubble as text inside a **circle**, and the PDF lane
   has no CIRCLE (a circle is four Beziers; recovering one is arc-fitting, which is a guess).
   Rule what a two-rung ladder does to affirmation — and whether an arc-fit *proposal* a QS
   affirms is admissible, or whether the honest answer is that a PDF sheet without a QS two-point
   act is unplaceable and measures nothing.
4. **X and Y derive independently and are averaged as nothing.** Disagreement beyond tolerance
   makes the view unplaceable. Rule the tolerance and where anisotropy is surfaced.
5. **Single-observation verification at ±1% symmetric** — §5 derives this because scale error
   *cubes* into a volume against the ±3% band. Confirm the arithmetic holds for our kinds.
6. **The schema.** `scale_families` / `calibrations` per genesis §4, with `calibration_id NOT
   NULL` on every quantity line. A scale family is in the signed rule set, so **recalibration
   voids every signature scoped to it** — model that now, not after signatures exist.

## Findings — AFK reading pass, 2026-08-13

An unattended session may look things up but may not decide (`.wayfinder/TRACKER.md`, ADR-0015).
These are facts read off this tree and the closed decisions; the numbered questions above stand
unruled. Where a fact sharpens one, it says which. **F3, F5 and F6 change the shape of the
questions and should be read before the grilling starts.**

### F1. The schema half has no table to constrain yet

`db/schema/core.ts` carries thirteen tables — tenants, users, memberships, projects, levels,
drawings, drawing_revisions, ingests, ingest_jobs, register_objects,
register_object_sightings, refused_sightings, acts — over eleven landed migrations
(`0000`–`0011`). There is **no quantity-line table**, so `calibration_id NOT NULL` currently has
no column to sit on. Ticket 13 is where quantity lines are first named ("a rail hands the spine a
set of quantity lines"), and 13 is blocked on 01, not on this.

*Sharpens Q6:* this ticket's schema half is `scale_families` + `calibrations` **plus a constraint
that a table nobody has created must honour**. Whether 12 creates the quantity-line table to hang
the FK on, or rules the constraint and leaves 13 to obey it, is undecided and is a real fork.

### F2. There is no affirmation act, and affirmation is an act by the spine's own definition

`src/core/enums.ts` lists four act types: `LEVEL_AUTHORED`, `DISCIPLINE_CONFIRMED`,
`MARK_RENAMED`, `DEFERRAL_FILED`. The header defines an act as "a human write that changes what
the machine would derive" (`identity.md` §7) — which is precisely what a QS affirmation is, and
what a QS *override* is a second time over, since §5 makes the override a **declared
disagreement and a dip-sample stratum** rather than a quieter affirmation.

*Sharpens Q1/Q6:* the affirmation surface is one or two new `actTypes` members, and attribution
is derived from the act log rather than stamped on rows (`quantity-contract.md` §3). If affirm
and override are one act type with a flag, the dip-sample stratum has to be recovered from the
payload; if two, the stratum is a query on `act_type`.

### F3. A view's identity does not survive a re-ingest — which is the hardest constraint on Q1

`views.ts` sets `View.id = anchor.handle` (the caption text's own source key) and
`placement.ts:360` derives `viewKey = ${view.type}:${view.id}`. Ticket 02 ruled source keys
**scoped to `(file bytes, extractor identity)` — no cross-file, no cross-version survival**; a
vectorizer upgrade is a declared re-ingest.

So a scale group whose membership is stored as a set of view keys **dies on every re-ingest of a
sheet, including one that redrew nothing**. Read against §5's "recalibration voids every
signature scoped to it", that keying makes every re-issue a recalibration and voids every
signature under it — the exact failure `identity.md` §9 refused when it kept the citation-scope
key *derived* rather than minted, "so re-pinning an unchanged set would [not] void a signature
that nothing invalidated".

*Sharpens Q1 and Q6:* §9's move is available here — a **content-addressed** calibration whose key
digests the affirmed number, the evidence rank and the group's derivation, so an unchanged sheet
re-ingests to the identical calibration and voids nothing, while a changed one is a different
calibration by construction. Whether that is right (and what "the group's derivation" hashes over,
given that membership is per-view and view keys are exactly what moved) is the decision. The
alternative — affirmation is per set revision by design, ~6–8 acts *per pinned set*, re-asked on
every re-pin — is coherent and much simpler, and should be put and beaten rather than skipped.

### F4. Nothing in the tree grounds the "~6–8 acts per project" figure

The partition is per **caption**, so a 50-sheet set (the map's NFR bar) with several captioned
views per sheet is O(100+) views — consistent with §5's "per-view degenerates into confirm-all",
but the 6–8 figure itself has no measurement behind it in this repo. The corpus that could ground
it is ticket 08's private lane, which is local-machine-only and never in a cloud container, so
this pass could not measure it and neither can a container session.

### F5. The ladder, rank by rank, against what this tree can actually feed it

| rank | evidence | input available today |
|---|---|---|
| 1 | QS two-point | **none** — no act type (F2), no canvas (ticket 15, blocked on 10 + 11) |
| 2 | grid spacing match | half — see below |
| 3 | overridden dimension ratio | **none on either lane** — see below |
| 4 | file units header | DWG only; six codes |

**Rank 2 is not independent of ranks 1 and 3.** `grid.ts` computes `minSpacing` — "computed here
and nowhere else", native drawing units, uninterpreted — and it is the only site that does. But a
*match* needs a **real-world** spacing to match against, and nothing in this tree supplies one:
`cad-ingestion.md` §8 and §9 name no source, and §9's placement constants are deliberately shares
of the spacing precisely so none is needed. The only candidates are a dimension string running
along the grid (rank 3's input, and ticket 26's material) or a QS stating the grid module — which
is rank 1 wearing a different hat.

*Sharpens Q3, and reframes it:* the ticket asks what a **two-rung** ladder does to affirmation on
the PDF lane. If rank 2 has no independent feed, the PDF lane is **one rung** — QS two-point — and
the honest answer the ticket already floats ("a PDF sheet without a QS two-point act is
unplaceable and measures nothing") stops being the pessimistic reading and becomes the arithmetic.
The arc-fit proposal question then only decides whether the QS is *offered* a starting guess, not
whether a scale can exist without them.

**Rank 3 has no lawful input on the DWG lane either — not just the PDF lane.** `DIMENSION` is in
the extractor's closed vocabulary (`entitygraph.py` `ENTITY_TYPES`), but `ingest.py::_record`
emits **common fields only** for it — `h`/`t`/`layer`/`color`/`src` and nothing else. No
definition points, no `measurement`, no text override, no `DIMLFAC`. Its own comment: "provenance
fields only; its rendered geometry (measurement text included) arrives as derived entities citing
this handle." So the ratio's numerator (the stated length) is reachable only as **derived text**
and its denominator (the drawn span) only as **derived paint** — and `grid.ts` already ruled the
governing precedent for this tree: derived paint "is admissible as corroboration of a signature
anchored on an original — never as the thing that invents the bubble."

This is a scope fact, not a law: a DIMENSION's defpoints, measurement and override *are* original
attributes of an original entity, so `cad-ingestion.md` §3 permits extracting them. But nobody has
ticketed that widening, and until it exists the DWG ladder is **two rungs (1 and 4)**, not four.
Ticket 06's research doc flagged the PDF loss and asked that 12 "be told it is two"; the DWG side
is the half that document did not look at.

**Rank 4 is a unit, not a paper scale, and `unitless` is mapped.** `INSUNITS_MAP` interprets six
codes — `0: unitless`, `1: inch`, `2: foot`, `4: mm`, `5: cm`, `6: m`; anything else sets
`detected=None` and `insunits_unmapped=True`, and `ingestion.ts:269–274` already emits the two
honest warnings ("units are undetermined, never assumed" / "the drawing declares no units: scale
must be affirmed"). Two things follow. First, the extractor reads **model space**, where a plan is
drawn 1:1 and `$INSUNITS` therefore answers the whole question — rank 4 is not a weaker
measurement of what rank 1 measures, it is a different and complete one, which is worth saying out
loud before ruling that a two-rung ladder is crippled. Second, `0: unitless` is a **mapped code
that supplies no scale** — it is not `insunits_unmapped`, but it is not affirmative evidence
either.

*Sharpens Q2:* `INSUNITS=0` is a live instance of the affirmative-evidence question already
sitting in the code, and whichever way Q2 rules, that line is the test of it.

### F6. The ±1% derivation checks out at n=3 — but no first-slice formula reaches n=3

The arithmetic first. For a scale error `e` entering `n` drawing-derived lengths, the quantity
errs by `(1+e)^n − 1`: at `e = 1%`, **n=1 → +1.00%, n=2 → +2.01%, n=3 → +3.03%**. So §5's "scale
error *cubes* into a volume against the ±3% band" is exactly right — at n=3, a 1% scale error
consumes the entire band on its own.

**No formula in `formulas.md` §2 reaches n=3 from drawing geometry.** Every concrete volume takes
its section from a schedule (`ENTERED`) and its height from the level stack: the rect prism is
`count × L × B × H`, and the first vertical slice — **RCC column concrete** — is exactly that
form. The highest exponent §2 reaches on *drawing-derived* length is **n=2**: `PRISM_POLY`'s
`shoelace(plan) × depth` and `AREA_THICK`'s `area × thickness`, where the plan polygon is drawn
and the depth is entered. Face areas are n=2, network runs n=1, a count is n=0. Two consequences,
both for Q5:

- **On slice 1, an affirmed calibration is mandatory and multiplies nothing.** Column volume is
  scale-invariant, and so is the count that feeds it: `placement.ts` is ratio-only by construction
  (every constant a share of `minSpacing`, "a threshold in drawing units is the same species as a
  guessed scale"), which is takeoff-core 05's result and this ticket's own guardrail. The question
  Q5 should therefore face is not only whether ±1% is right, but whether the first slice can
  *demonstrate* the scale group at all — or whether it ships the `NOT NULL` before any arithmetic
  depends on it, which is defensible (the contract is the point) but should be chosen knowingly.
- **If the binding exponent is 2, ±1% is conservative against its own derivation** — the
  n=2-equivalent threshold is ±1.49%. Holding ±1% anyway is defensible on three grounds (headroom,
  one number to explain, and n=3 arriving with the excavation and frustum kinds), but the stated
  derivation does not by itself carry it, and the ticket asks for the arithmetic to be confirmed.

One precision worth carrying into the grilling: ±3% is **under-only, +0% over**
(`quantity-contract.md` §5), so a *symmetric* ±1% is not an allocation out of the tolerance band —
on the over side any scale error is already a hard block. ±1% is a **rejection threshold on the
agreement between two observations**, which is a different quantity from the error against ground
truth, and the two should not be netted against each other in the derivation.

### F7. The refusal taxonomy names no scale cause, so "hatched" has no code

`refusalCauses` has seven members — `DUPLICATE_IDENTITY`, `DISCIPLINE_NOT_AUTHORITATIVE`,
`NOT_ESTABLISHED`, `NOT_IN_PROJECT_SCOPE`, `NOT_IN_THIS_BILL`, `INGESTION_TRUNCATED`,
`ENTITY_TYPE_UNHANDLED` — and none names an unaffirmed, unplaceable or self-disagreeing scale.
The nearest is `NOT_ESTABLISHED`, the machine default. Nothing derives per-axis scale anywhere, so
X/Y anisotropy (Q4) has no surface at all today.

*Sharpens Q2 and Q4:* "unplaceable, hatched, measures nothing" is partly a question about whether
the taxonomy gains a member. The taxonomy is deliberately one enum with two originators
(`identity.md` §7), so adding to it is a spine-level act, not a local one — and Q4's "where
anisotropy is surfaced" has the same answer shape.

### F8. Environment

`pnpm verify` could not run in this container (checkup: nothing on `localhost:5544`, node
v22.22.2 against `engines >=24`, provision never run). Nothing above required it — every fact is
read off the tree, the closed decisions, and `docs/research/vector-pdf-to-entitygraph.md` §4 — but
no measurement in this section was executed here, and none should be quoted as if it were.

### Questions the facts added

- **Q7. Does rank 2 survive as an independent rank?** F5 says its only real-world feed is rank 1
  or rank 3. If it does not, §5's four-rank ladder is a two-rank ladder on DWG and a one-rank
  ladder on PDF, and that is a `measurement-rules.md` amendment, not an implementation note.
- **Q8. Does the DWG extractor widen to carry DIMENSION defpoints, measurement and `DIMLFAC`?**
  Lawful under §3 (original attributes of an original entity), unticketed, and the sole thing
  standing between rank 3 and an input on the lane that could support it. It is a consequence of
  whichever way Q3 rules, so it belongs in that ruling rather than in a ticket of its own.
- **Q9. Is the calibration key minted or derived?** F3 makes this the question on which
  "recalibration voids every signature" either behaves or destroys a signature on every re-ingest.
  `identity.md` §9 already walked this fork once, in this repo, and chose derived.

## Guardrails

- The strict unit lane: an unknown or unmapped unit resolves to **null — never guess a scale**.
  A sheet-layout lane may assume a convention to partition and declare, but nothing on that lane
  may multiply geometry into a stored dimension.
- Machine proposes; a QS affirms. A QS override wins but is a **declared disagreement and a
  dip-sample stratum**.
- `takeoff-core` 05 proved the view partition needs no affirmed scale at all — it reads only
  ratios of the drawing's own text heights. Do not regress that.

## Prior attempt — read as argument, never as decision

Executed AFK once before ADR-0015 existed, at **`1daba61`** (branch
`claude/scale-group-ticket-mp8y1i`, 2026-08-13 21:30, 31 files). It **ruled** — set
`Status: closed`, wrote `## Resolution`, and amended `measurement-rules.md` and
`quantity-contract.md`, which is the same domain-law overreach #44 committed on ticket 13 and
#52 had to undo. It is unmerged and stays that way; it is not deleted, because a deleted branch
is unreachable history and the reasoning is worth reading.

`git show 1daba61`. **An argument, not a decision.** The AFK reading pass above (`9euvud`) is the
same ticket worked correctly under the rule — the two make a useful before/after.
