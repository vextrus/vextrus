# The scale group and its affirmation

wayfinder:grilling
Status: closed
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

## Resolution

Ruled 2026-08-15 in an attended `/grilling` session, one question at a time. The claim was empty
at dispatch, which needs no ruling (ADR-0015 amendment): attendance is discovered by asking, and
every question below was answered by a human. The AFK reading pass above (`9euvud`) supplied the
facts; this session supplied only decisions.

### 1. A scale group is an equivalence class of views over annotation plotted height

Not a drawing, not a view — §5 rules both out, and the ~6–8-acts figure against O(100+) views on
a 50-sheet set means a group is **cross-sheet**: it is a class over the whole set, not a
subdivision of a sheet. The QS is affirming *scales* — 1:50, 1:100, 1:20 details — and a building
set has 6–8 of them.

The relation runs on **body annotation height**, because a draughtsman authors text at a fixed
*plotted* height, so the same note is drawn 2× as tall at 1:100 as at 1:50. This reuses the family
of signal `takeoff-core` 05 already proved sound and scale-free.

**Grid spacing is struck as corroboration.** It was proposed and rejected in the same breath: in
model space a plan is drawn 1:1, so `grid.ts`'s `minSpacing` is the **building's module in native
units** and carries no scale information at all. Two views at different scales of one grid agree;
two views at the same scale of different bay grids disagree. Neither necessary nor sufficient.

**Captions are excluded from the signal.** A view title is plotted at a constant height whatever
the view's scale — that is what a title is for — so caption height would smear every class toward
one. `views.ts` already isolates the two populations: captions are `anchors` (line 397 medians
their heights for `bandGap`), everything else is body.

*Alternative put and rejected:* the group is **QS-declared** — the human lassos views into groups.
It reaches the same act count and needs no detection. Rejected because it makes membership a
*human* residual: the QS sweeps leftovers into whichever group looks right, which is §5's
confirm-all degeneration relocated to a lasso tool. A machine that proposes nothing has made the
human the detector.

### 2. The relation runs on physical plotted height; unnormalisable sheets form island groups

Within a sheet the cluster is a ratio and needs no scale. **Across** sheets it needs a common
physical referent, and the two lanes differ:

- **PDF is the strong lane.** User space is points (1/72"), fixed by the format, and `/UserUnit`
  read 1.0 in 14 of 14 files (F5) — so a plotted annotation's height in points *is* its physical
  height on paper, absolutely, with no header. The lane that lost two ladder ranks is the lane
  where the partition works best.
- **DWG normalises through `$INSUNITS`**, which lands the partition on rank 4. With a mapped
  non-zero code, model space at 1:1 means the scale is already **complete** and the file holds one
  group trivially; text-height clustering earns its keep on DWG only where rank 4 fails —
  `INSUNITS=0`, unmapped codes, and legacy files drawn at 5× in model space, which is exactly
  §5's "one legacy sheet carried three internal scales".

A sheet that cannot supply the normaliser **cannot join the project-wide relation**. Its views
cluster only among themselves and form their own island group(s), affirmed separately — not an
error, not a fallback, a smaller partition honestly stated, priced in extra affirmation acts.
This is the ruling on `INSUNITS=0`, which F5 named as the live instance of the question already
sitting in the code: a mapped code that supplies no scale is **not** affirmative evidence.

*Alternative put and rejected:* normalise each sheet by its own median height and cluster the
ratios — lane-uniform, no header needed. Rejected: it assumes every sheet's dominant annotation
sits at one plotted height, true of a tidy set and false of precisely the legacy sheets this
mechanism exists to survive, and it fails silently rather than refusing.

### 3. Membership is positive, and the residual case is structurally unrepresentable

A view joins the class whose band contains the dominant mode of its own body-annotation heights.
Two ways to carry no evidence, one outcome: **no body text** (pure geometry, or the caption is the
only text), and **no dominant mode** (a flat spread — the view is not internally consistent and
the machine has no proposal to make). Both are unplaceable, hatched, and measure nothing.

The residual case is unrepresentable **structurally, not by policy**: there is no default group
and no nearest-group assignment, and downstream `calibration_id NOT NULL` is the enforcement — a
view in no group yields no calibration, so a quantity line for it cannot be written. There is no
row shape that expresses the fallback.

Band width and the dominant-mode criterion are **effective-dated config, not constants**
(`CLAUDE.md`), and belong with the convention profile: what height a set plots its annotation at
is a draughting convention.

*Alternative put and rejected:* **sheet inheritance** — a view with no body text inherits the
group of the views it shares a sheet with, as a machine proposal a QS affirms. It rescues real
views (a small unannotated key plan usually *is* at the sheet's scale). Rejected: it is the
residual rule in a sheet-shaped costume, and it fails on exactly the legacy multi-scale sheet the
mechanism exists for. The QS's escape hatch is an explicit act (§9's `SCALE_GROUP_ASSIGNED`), not
a silent inheritance.

### 4. Rank 2 is struck; the ladder is three ranks and the lanes are uneven

`minSpacing` is not a weak scale observation — per §1 it is **not a scale observation**. Turning it
into one needs a real-world spacing, whose only sources are a dimension string along the grid
(rank 3's input) or a QS stating the module (rank 1 in a hat). It was never independent.

| lane | ranks with a real input |
|---|---|
| DWG, `$INSUNITS` mapped and non-zero | **rank 4, complete** — model space is 1:1; not a degraded rank 1 |
| DWG, `INSUNITS=0` or unmapped | rank 3 (only once the extractor widens) or rank 1 |
| PDF | **rank 1 only** |

Two consequences ruled with it:

- **The arc-fit question dissolves.** It existed only to recover CIRCLE on the PDF lane so bubbles
  could feed rank 2. Nothing in this ticket needs an arc fit, and the tempting guess never has to
  be adjudicated. Bubble recovery may still matter to grid georeferencing — not this ticket.
- **The DWG extractor widens for rank 3** (Q8): DIMENSION defpoints, `measurement`, text override,
  `DIMLFAC`. These are original attributes of an original entity, which `cad-ingestion.md` §3
  already permits — `ingest.py:191` emits "provenance fields only" as *scope*, not law, and says so
  in its own comment. Without it rank 3 has no input on either lane. Filed as
  `inbox/dwg-dimension-attributes.md`; it is not this ticket's diff.

**Routing.** Striking rank 2 is a `measurement-rules.md` §5 amendment, and the map's Notes are
explicit that domain-law amendments each get their own ticket and none may be made in passing —
the exact overreach the prior attempt committed (#44, undone by #52). This ticket rules rank 2
dead and **files** the amendment as `inbox/measurement-rules-5-strike-the-grid-rank.md`. No domain
doc is edited here.

*Alternative put and rejected:* keep rank 2 as a **corroborator** that never originates a scale but
flags an independently-derived scale predicting an absurd grid module (a 47m bay). Cheap, and a
real check. Rejected *as a rank* — it is a **verification**, not evidence, and belongs with §6's
agreement test if anywhere. Sitting on the ladder is what made it look like evidence.

### 5. No affirmed calibration ⇒ unplaceable on PDF; no pre-fill from printed scale notes

With one rank and no mechanism behind it yet (F2: no act type; the canvas is ticket 15, blocked on
10 + 11), a PDF view whose group carries no affirmed calibration is unplaceable, hatched, and
measures nothing. Stated positively: **on the PDF lane the machine partitions and the human
calibrates, always, by construction** — and because §2 makes the PDF partition the best one we
have, a handful of two-point acts covers the whole set, which is what makes 6–8 sufficient.

**Sequencing consequence, written down rather than discovered later: the PDF lane measures nothing
until ticket 15's canvas lands.** The DWG lane with a mapped non-zero `$INSUNITS` measures without
any of it, which is what keeps the first vertical slice unblocked.

*Alternative put and rejected:* **pre-fill the affirmation from the title block's printed scale
note**, offered as the value the QS confirms. Seductive — it is machine-proposes/human-affirms, the
pattern used everywhere else, and the note is usually right. Rejected: §5 ranks printed scale notes
nowhere, and pre-filling smuggles them back in at the one place that matters more than evidence.
It converts a **measurement** into a **confirmation click** — confirm-all re-entering through the
dialog. A QS who drags two points across a known dimension has measured; a QS who clicks OK on
"1:100" has read the title block, and the title block is the thing that is wrong on the sheet that
ruins you. The note may be shown as text on the sheet, never as a value in the field.

### 6. X/Y independence is a property of the rank; never averaged; one shared tolerance

- **Rank 4 is isotropic by construction** — one declared unit for both axes; a header cannot
  disagree with itself. Stated as isotropic, not as "untested".
- **Ranks 1 and 3 require both axes.** A two-point drag measures one direction, so rank 1 costs
  the QS **two drags per group** — 6–8 groups become 12–16 acts. That cost is accepted. A group
  calibrated on one axis only is **not calibrated**; there is no isotropic fallback.
- **Never averaged.** Anisotropy means the sheet was non-uniformly scaled — a plot squeezed to fit
  paper — so every derived length is wrong by a direction-dependent factor and the mean is a number
  wrong in both directions and right in neither. Beyond tolerance the group is unplaceable.
- **The anisotropy tolerance and §7's verification tolerance are one effective-dated value**,
  because they are one test: two observations of a single quantity must agree within ε. Two config
  keys would invite drift for a reason nobody could state.

**Three new machine-originated refusal causes**, because three remedies differ:
`SCALE_NOT_AFFIRMED` (group exists, no calibration → affirm it; one act clears many views),
`SCALE_GROUP_UNRESOLVED` (the view joined no group — §3's case), `SCALE_SELF_DISAGREEING` (two
observations beyond tolerance → re-measure, or the plot is genuinely distorted). Measured against
`quantity-contract.md` §2: the doc names members and rules *per-member originator legality*, and
does not claim a closed list, so members with a stated machine originator fit the existing frame —
enum additions in `src/core/enums.ts`, no domain amendment.

*Alternative put and rejected:* one `SCALE_UNAVAILABLE` carrying a message. Rejected on the doc's
own ground — it splits `INGESTION_TRUNCATED` from `ENTITY_TYPE_UNHANDLED` because they have
"opposite remedies". A cause you must read prose to act on is a log line, not a taxonomy member.

### 7. ±1% holds, as an agreement threshold; `NOT NULL` ships on slice 1 unused

The arithmetic confirms: for scale error `e` entering `n` drawing-derived lengths the quantity errs
by `(1+e)^n − 1` — at e=1%, **n=1 → +1.00%, n=2 → +2.01%, n=3 → +3.03%**. §5's "scale error cubes
into a volume" is exact; at n=3 a 1% error consumes the whole ±3% band alone.

But **no formula reaches n=3 today**. `formulas.md` §2's rect prism is `count × L × B × H` with
L, B from the schedule and H from the level stack; the binding exponent is **2** (`PRISM_POLY`'s
shoelace × entered depth, `AREA_THICK`'s area × entered thickness), whose honest threshold is
±1.49%. **±1% is held anyway**, on grounds that carry where the derivation alone does not: n=3
arrives with excavation and `FRUSTUM_RECT`, and a threshold that loosens now and tightens later is
one nobody trusts; it is now **one number for two tests** (§6's anisotropy and this one), and one
number is explainable to a QS; and headroom on a rejection threshold costs a re-measure while slack
costs a wrong quantity — the governing sentence prices those very differently.

Two precisions carried into the ruling rather than left to inference. **±1% bounds *agreement*
between two observations, not accuracy against ground truth** — two observations can agree within
1% and both be biased the same way. And it is **symmetric**, whereas the ±3% band is under-only
with +0% over (`quantity-contract.md` §5), where any scale error is already a hard block. Different
quantities; they must not be netted against each other, which is the error the "allocation out of
the tolerance band" framing invites.

**`calibration_id NOT NULL` ships on slice 1 knowingly, and multiplies nothing there.** RCC column
concrete is scale-invariant end to end: the formula is n=0, and the count feeding it is scale-free
because `placement.ts` is ratio-only by construction (every constant a share of `minSpacing`) —
`takeoff-core` 05's result and this ticket's own guardrail. A nullable column tightened later is a
backfill against rows that never had a calibration: you either invent one or the migration cannot
run. Free today, impossible after the first signature.

**Corpus obligation:** slice 1 cannot demonstrate the calibration through arithmetic, so the
torture corpus asserts it through **refusals** — an unplaceable view measuring nothing, a
self-disagreeing group refusing, an `INSUNITS=0` sheet forming its own island. Those are testable
on slice 1 and are what `pnpm verify` holds. The arithmetic assertion waits for the first n≥1 kind.

### 8. The calibration key is derived and content-addressed over the band, not the members

F3 is the binding constraint: `View.id = anchor.handle`, `viewKey = ${type}:${id}`, and ticket 02
scoped source keys to `(file bytes, extractor identity)` with no cross-version survival. Any
calibration keyed on its **member set** dies on every re-ingest, including one that redrew nothing —
which would make every re-issue a recalibration and void every signature under it.

- **Membership is never stored.** It is recomputed from body-annotation heights on every ingest;
  there is no member-set column to go stale.
- **The key digests `(project, lane normaliser, quantized nominal plotted height, affirmed X,
  affirmed Y, evidence rank)`.** An unchanged sheet re-ingests to the same band, resolves to the
  identical calibration, and voids nothing; a sheet genuinely redrawn at another scale lands in a
  different band and is a different calibration by construction.
- **Quantize the band representative; never digest the empirical cluster statistic.** Clustering
  depends on the population, so an empirical mean shifts when a sheet is added. A config-bucketed
  nominal height makes **adding sheets free** — a new 1:100 sheet joins the existing 1:100
  calibration and voids no signature. That digesting the member set would void on mere *growth* is
  the tell that the member set is the wrong thing to digest.

This lands on `identity.md` §9's split: a calibration is a **row-level semantic** concern and
re-presents only when the semantic moved; the manifest governs boundary validity independently.

*Alternative put and rejected — and it earned a real hearing:* **affirmation is per set revision by
design.** No digest, no content addressing; each pinned set gets its own 6–8 acts. Honest, trivial,
and it makes "recalibration voids signatures scoped to it" true by construction rather than by
care. Rejected on the map's own destination — *"survives a set revision as a delta, not a
do-over"*: re-asking every calibration on every re-pin makes the revision a do-over at the
calibration layer, and §9 explicitly refuses the analogue (partial re-issue of the plumbing sheets
must not disturb structural rows; under per-revision affirmation it disturbs all of them). It also
scales wrongly — the cost falls hardest on the client who re-issues most carefully.

### 9. The schema is ruled, not built; 13 inherits the constraint

**This ticket builds nothing.** Wayfinder plans; the prior attempt at this ticket touched 31 files
and amended domain law, which is what #52 had to undo. F1's fork resolves as *neither builds here*:
12 rules the shape, and `calibration_id NOT NULL` is a constraint **ticket 13 must honour when it
first names quantity lines**, citing this ruling. 13 is where a rail's obligations to the spine are
ruled, and a table created by the ticket that does not own it will be the wrong shape.

**Ordering dependency, stated so it cannot be missed: 13 may not land a quantity-line table without
that FK.** Adding it afterwards is §7's backfill argument one layer up.

| table | half | contents |
|---|---|---|
| `scale_families` | derived | recomputed per ingest, per project: quantized nominal band, lane normaliser, member view keys as **provenance only, never identity** (mirroring `grid.ts`'s `handles`). Enumerable, so the QS sees "7 groups, 3 affirmed, 2 unplaceable" |
| `calibrations` | affirmed | immutable, content-addressed by §8's digest: affirmed X, affirmed Y, evidence rank, the originating act |

**Quantity lines FK to `calibrations`, never to `scale_families`.** A family is derived and moves
between ingests; a calibration does not. Pointing the FK at the immutable row is what makes "an
unchanged sheet voids nothing" hold *at the database* rather than by care. Both are tenant tables
and take the `db/rls.ts` block (ADR-0004).

**Three act types** (`src/core/enums.ts`), settling F2: `SCALE_AFFIRMED` (the QS supplies or
confirms a family's number), `SCALE_OVERRIDDEN` (the QS supplies a number contradicting a
machine-derived one — wins, and is a dip-sample stratum), `SCALE_GROUP_ASSIGNED` (the QS places an
unplaceable view into a family). The third exists **because of §3**: sheet inheritance was refused
as a machine proposal, so the escape hatch we pointed at has to be a real act. It changes a
*partition*, not a *number*, so it is not the same stratum as an override.

*Alternative put and rejected:* one `SCALE_AFFIRMED` act with an `overridden` flag and a nullable
`assigned_view`. Fewer members, one write path. Rejected on F2's own reasoning — the dip sample is a
**sampling frame that must be queried**, and a flag makes the stratum a payload dig rather than a
query on `act_type`.

### Not ruled here

- **F4's "~6–8 acts per project" is still ungrounded in this repo.** The corpus that could measure
  it is ticket 08's private local-only lane. This ruling makes the figure *plausible* by attaching
  affirmation to a cross-sheet class rather than to a sheet, but the number itself remains a design
  intent, not a measurement, and should not be quoted as one.
- **`pnpm verify` was not run for content reasons** — this ticket changes markdown only — but it is
  run by `pnpm land` on the merged tree as the session's last act.

### Filed

- `inbox/measurement-rules-5-strike-the-grid-rank.md` — the §5 amendment striking rank 2.
- `inbox/dwg-dimension-attributes.md` — widen the extractor for rank 3's input.

**Note for whoever promotes the inbox:** `MAP.md`'s Notes say *"Five domain-law amendments are
forced by this map's destination"*. The first of these two makes it six. That line is not edited
here — a closing session that edits `MAP.md` is the conflict this layout removed
(`.wayfinder/TRACKER.md`) — so the count is corrected at promotion, on `main`, by the single writer
that can see every ticket.
