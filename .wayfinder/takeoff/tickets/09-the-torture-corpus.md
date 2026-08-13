# The torture corpus — the gate

wayfinder:grilling
Status: closed
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

## Resolution

Ruled 2026-08-13 by grilling. The corpus is a **framed census**, not a pile of fixtures: ten
rulings below, each with the measurement that forced it and the alternative put and rejected.

Measured on this container (`claude/torture-corpus-eivgkr@63baec8`, linux x64, node v22.22.2 —
**below the `engines` pin, so `pnpm verify` refuses at stage zero**; every stage was run
directly and every figure below carries that caveat):

| stage | wall |
|---|---|
| typecheck | 7.8s |
| lint | 4.6s |
| test (vitest — 114 tests, 11 files) | 10.6s |
| cad:ruff | 2.1s |
| cad:test (pytest — 35 tests) | 7.3s |
| build (`next build`) | 40.3s |
| **total** | **≈72.7s against the 90s bar** |

### 1. The corpus is framed now; rails fill it

This ticket rules the corpus's **shape**, and the shape lands before the rails do. Every later
rail ticket is then obliged to add its cases to an existing structure.

*Forced by:* the map's own Notes already rule that the spine owns the gate's shape, because a
gate built against one rail encodes that rail's assumptions and every later rail retrofits
(legacy fault F1/F8). That argument holds with equal force against building the gate **last** —
a corpus assembled after four rails have each invented a fixture idiom is the same retrofit,
paid at the end.

*Rejected:* build-the-corpus-once-after-the-rails; and the status quo, where "the corpus" is the
union of whatever each rail happened to write. The status quo is already producing divergence —
`views.spec.ts` locates fixture views by `startsWith` on caption text, a per-spec convention
nothing else is bound by.

*Accepted cost, stated:* the frame must be right while it has only ~5 cases to be right against.

### 2. Two termini per case, ratcheting outward

Each case declares a **seam assertion** (always — the stage that detects the defect) and a
**boundary assertion** (the bill + Certificate of Measured Coverage, as soon as one exists for
its kind). The declared terminus is a committed field that may only move **outward**, never
inward, and a meta-check fails the build once a case's rail has a boundary and the case is still
seam-only.

*Forced by:* `quantity-contract.md` §2 — "a per-line column cannot annotate a row that does not
exist… pile-cap rebar was −100% with no line and no deferral", and truncation-surfacing is
**mandatory**. A fidelity counter that fires at the seam and is dropped two stages later is
silence at the boundary while every seam test stays green. That drop-in-transit class is the
most expensive fault in the legacy census, and a seam-only corpus is structurally blind to it.

*Rejected:* seam-pinned only (a third of the work, green forever, never proves bar 1);
boundary-pinned only (unwritable until ticket 16 lands, and a red case names a pipeline rather
than a bug — the seam assertion is the difference between "the bill is wrong" and "the bill is
wrong *here*").

*Accepted cost, stated:* a case is now inherently **cross-lane** — the depth-cap case asserts in
`cad/tests/` (Python) *and* in vitest (TypeScript). Nothing in this repo spans those two lanes
as one object today; `cad.spec.ts` crosses the seam by shelling out but is still one test in one
lane. The ratchet is also the first place this frame could be routed around.

### 3. Code-driven assertions, bound by a declared index

Assertions stay ordinary `pytest`/`vitest` tests in whatever shape the case needs. A single
committed index carries only what the ratchet needs — case id, defect name, law clause cited,
lanes it must be asserted in, current terminus. A **meta-test binds the two**: every index entry
has a real test in each lane it declares; every corpus-tagged test appears in the index; no
terminus regresses.

*Forced by:* the four algebras' expectations do not share a shape. "shoelace disagrees by >0.5%
so refuse", "net = gross − Σ(deducted openings)", and "`explode_truncated` fires with per-type
counters" cannot be expressed in one schema without inventing a DSL to describe assertions in a
repo that already has two perfectly good assertion languages. A manifest's failure mode is the
one that would quietly break bar 1: an expectation the schema cannot express gets **dropped**
rather than escalated, and the corpus looks complete while asserting less than its ticket
promised.

*Rejected:* fully manifest-driven cases; and pure naming convention, which yields no ratchet.

*Accepted cost, stated:* the index is a second place to update. The "every corpus-tagged test
appears in the index" direction is therefore load-bearing, and it needs a tagging mechanism in
both lanes — a marker in pytest, and in vitest a filename or directory convention, since vitest
has no native equivalent.

### 4. Micro-fixture per case; composites frozen, by exception

One directory per case with its own generator and its own minimal fixture — the smallest
artifact exhibiting exactly that defect. `structural-r1/r2` is **frozen** as the one existing
composite and takes no new cases. A new composite is created only where the defect **is** an
interaction, and is frozen once landed.

*Forced by:* the sanity-number discipline (`cad-ingestion.md` §12). On a shared sheet, adding
case N+1 shifts handles and re-pins every earlier case's count — so routine growth would require
a re-pin that is indistinguishable in a diff from the forbidden move (`CLAUDE.md`: never edit a
fixture to green a build). Micro-fixtures make growth free: adding a case creates files and
re-pins nothing, and a red test names a defect rather than a sheet.

*Rejected:* dense composites throughout (unworkable within ~4 additions); micro-only (loses the
irreducible interaction cases — the schedule-text-leaks-into-plan phantom and the moved-between-
sheets member cannot exist on a minimal drawing).

*Objection recorded and answered:* a corpus of twenty 8-entity drawings proves the pipeline
against drawings unlike any it will meet, while the non-functional bar is 50 sheets / 500K
entities. The corpus is a **correctness-of-refusal** instrument; scale is a separate bar met by
a separate fixture.

*Shape:* `cad/tests/corpus/<case-id>/gen.py` exporting `build()`, a shared `_lib.py` owning the
`PYTHONHASHSEED=0` re-exec and the ezdxf meta-data pin so byte-stability lives in exactly one
place, and one `regen.py` walking every case — 218 lines × 20 cases in one file is its own
defect.

### 5. Any-shape fixtures, under a written admission criterion

A case's fixture is the smallest artifact exhibiting the defect — a DXF, a raster page, an
EntityGraph JSON, a string table, a level-scheme row. **Admission criterion:** a case is
admitted iff (i) it traces to a named legacy census defect or a cited domain-law clause, **and**
(ii) its failure mode is a wrong number or a silence.

*Forced by:* `cad-ingestion.md` §6 rules the notation parsers live beside their consumer in the
app, not in `cad/` — so `%%C`, the four Ø-lookalikes, `@125m` and `@ 61/2"` have no drawing in
them. `@ 61/2"` read as 30.5" instead of 6½" is a 5× quantity error with measured provenance;
excluding it because its fixture is a string would put a known money defect outside the very
census that exists to enumerate known money defects — a blind spot in the shape of a file format.

*Rejected:* drawing-only (crisper corpus, simpler loader, known blind spot — not worth it).

*The criterion is enforced at review, not by machine*, and exists to stop "corpus" creeping to
mean "all tests". A test that a function sorts correctly fails neither limb.

### 6. The index is a census of the known, and `undecided` expires

The index enumerates **every admitted defect class**, including those whose expectation is not
yet ruled. An `undecided` entry names the ticket that owes the ruling, asserts nothing, and
cannot fail — but it is visible and counted. The meta-test **refuses an `undecided` entry whose
blocking ticket has closed.**

*Forced by:* this is the scope register's own logic turned on the corpus. A ruled-only index has
exactly the defect `quantity-contract.md` §2 condemns — the defects it does not cover are
invisible in it, so the corpus can be 100% green while structurally blind and nothing in the
artifact says which. That is `incomplete: 0` printed over a bill 54% short, in miniature.

The expiry clause is what makes the index more than bookkeeping: ticket 04 closes and the
meta-test goes red until case 10 carries a real expectation. It is the only enforcement the
"rails fill it" half of ruling 1 has.

*Rejected:* ruled-only entries.

*Accepted cost, stated:* the meta-test reads `.wayfinder/*/tickets/*.md` for `Status:` lines,
coupling the test suite to the tracker. Normally refusable; earned here only because the tracker
is in-repo, greppable and plain-text **by explicit design** (`.wayfinder/TRACKER.md`: "no
network, no auth, greppable, and it lives in the same git history as the code the decisions are
about"). The weaker fallback, had that offended, was a ticket id checked by a human at
ticket-close, enforced by nothing.

### 7. The list: all fifteen in, four added, two properties, one out

**All 15 candidates admitted, none out** — every one is law-cited or census-cited. Triaged
against what the suite asserts **today**:

| # | defect | status |
|---|---|---|
| 1 | depth cap + per-type loss counters | **seam covered** (`test_truncated_budget_reports_per_type_losses`, `test_truncated_depth_counts_unexpanded_inserts`) — owes only its boundary terminus |
| 11 | unclassifiable caption; member-scoped detail never countable | **seam covered** (`views.spec.ts:108/85`, `placement.spec.ts:173`) — owes its boundary terminus |
| 8 | duplicate marks; content-signature tie-break | **partial** — `placement.spec.ts:92` keys by content and `src/core/pairing.ts` exists; duplicate-marks-on-split-sections does not |
| 2 | xref junk outside the 2–98 window + byte-for-byte control | **gap, buildable now** — the stray line is named unassigned, but nothing asserts the extents window or the no-rejection equality |
| 4 | `%%C`/Ø-lookalikes/`@125m`/`@ 61/2"` | **gap, buildable now** — no notation parser tests exist at all |
| 5 | feet-inch on a metric sheet; `1ST TO TOP FLOOR`; `7th-Roof` | **gap, buildable now** |
| 6 | Bangla and mixed en+bn captions | **gap, buildable now** — caption grammar is built, bn stems untested |
| 9 | re-origined revision pair | **gap, buildable now** — lands as a new frozen composite |
| 10 | member moved between sheets across revisions | **ruled, buildable now** — ticket 04 closed on `main` during this session; §3 rules the member keeps its identity and ordinal and re-presents for disposition, and removal-plus-registration **is the defect** the case asserts against |
| 3 | schedule y-jitter 0.1–0.7 against a 7.4 row gap | **undecided** → ticket 19 |
| 7 | three internal scales; `NOT TO SCALE` that is to scale | **undecided** → ticket 12 |
| 12 | raster sheet; vector PDF with no `$INSUNITS` | **undecided** → tickets 06, 07 |
| 13 | pile-cap plan area disagreeing with its shoelace >0.5% | **undecided** → member algebra |
| 14 | opening exactly *at* the deduction threshold | **undecided** → ticket 13 / face rail |
| 15 | level ordinal with no multiplier row must throw | **undecided** → ticket 20 |

**Four added**, each because the map's destination names something the list has no fixture for:

- **A. The wrong-selection defect.** `quantity-contract.md` §1's 20.2× overcharge class — a right
  number at the wrong rate, which "no quantity tolerance can catch". In scope even with an
  unpriced bill, because §2.1 makes the item description *the method of measurement*: a wrong
  item selection is a wrong coverage **denominator**, not merely a wrong price.
- **B. Topology's declared refusal.** The map's algebra ladder rules topology is "the refusal,
  not the measurement — a tee is identified in the run graph and declared unmeasured with a
  named cause". The ladder's most distinctive rung, and the list had no case for it.
- **C. Absent scale evidence.** Item 7 covers *conflicting* scale; `measurement-rules.md` §5's
  harder law is *absent* scale — "membership is positive, never residual… no evidence ⇒
  unplaceable, hatched, and it **measures nothing**" — plus the NOT NULL calibration reference.
- **D. A malformed face outline.** Item 13 proves defer-never-bounding-box for the *member*
  algebra; the face algebra needs its own — an unclosed outline group defers, never falls back.

**Two properties**, asserted over the whole corpus rather than as cases: (i) no fidelity counter
is nonzero at a seam and absent at the boundary — the ratchet's own proof; (ii) every refusal a
case asserts is drawn from the shared `refusalCauses` enum (`src/core/enums.ts`), never an
ad-hoc string.

**One ruled out: lakh/crore misgrouping on a document.** A real prohibition (`CLAUDE.md` bans
`toLocaleString('en-US')`), but ৳10,000,000 for ৳1,00,00,000 is the *right number in the wrong
convention* — it fails limb (ii). It belongs to a format lint with its own check, and admitting
it starts the dilution the criterion exists to prevent.

### 8. One lane, a named budget, reported and not enforced

The corpus stays **inside `pnpm verify`**. The frame names a corpus budget of **20s across both
lanes**; `verify`'s existing per-stage line is the instrument. Breaching it triggers
partition-by-lane — never trimming, per this ticket's guardrail.

*Forced by:* the measurement above. Headroom is ~17s, not the slack it was assumed to be, and
`next build` alone is 55% of the spend — so the corpus's growth allowance is governed by a stage
the corpus does not control.

*Rejected — partition now:* a corpus lane outside `verify` is a lane outside the contract, and
ADR-0007 rules the exit code **is** the contract. Destination bar 1 requires the corpus to pass
*inside* `pnpm verify`; moving it out to buy room fails the bar by construction rather than by
measurement. Partitioning is the remedy for a measured breach, not a posture adopted in advance.

*Rejected — a failing time guard:* `vitest.config.ts` carries a hard-won ruling that **nothing
in this lane measures latency**, written after three containers went red on the 5s default and
took `pnpm verify` with them; its own verdict is that verify then "answered by reporting that
the tree's contract does not hold on this machine, a false accusation naming no repair." A
corpus time-guard that fails the build is exactly that species, and would be the first such
assertion added after that ruling.

*Rejected — a case-count guard* (offered as the only machine-checkable substitute, declined): a
proxy that bites the day someone adds one slow case.

*Accepted cost, stated plainly:* **nothing enforces the corpus budget.** It is a number in a
document and a line in `verify`'s output that a human reads. Pinning runtime the way §12 pins
the sanity number was considered and is impossible — runtime is not byte-stable across machines,
which is precisely why the sanity-number trick works for entity counts and cannot work here.
`verify.mjs` already prints per-stage seconds and a total and asserts nothing about time; the
90s bar is human-held, and the corpus budget is the same species.

### 9. The byte-pin is made real (it is currently false)

**Measured, and it is a defect this ticket found rather than assumed.** The committed
`structural-r1.dxf` is **84,292 bytes with CRLF** — Windows-authored. This Linux container
regenerates the same drawing as **68,666 bytes with LF**: identical content, 15,626 differing
line endings, a 31,252-line diff. `.gitattributes`'s `*.dxf -text` is working correctly — it
stops git normalising, which *preserves* the platform difference rather than hiding it.

**Nothing catches this.** The only pinned artifact is the derived `*.entitygraph.json`, which is
line-ending-insensitive, so `test_ingest_matches_committed_artifact` and `test_sanity_number`
both pass on either file. The DXF byte-pin this ticket's guardrail rests on is asserted by
nothing and is false across platforms. (Confirmed and restored: `git checkout`, cad lane green,
35 passed in 1.21s.)

*Ruled:* the generator writes with an explicit `newline="\n"` so output is platform-neutral; the
two committed fixtures are regenerated once; and `regen.py --check` regenerates every corpus
fixture to a temp dir and asserts byte-equality inside the cad lane. That `--check` is the only
instrument that would have caught this, which is the argument for it.

*Rejected:* dropping to content-stability (makes the guardrail decorative and leaves the
corpus's growth story resting on a property nothing enforces); platform-scoping the pin (makes
the central invariant hold only on a machine most sessions are not running — this container is
Linux, the fixtures are Windows-authored, and that gap **is** the defect).

**Read this before touching the fixtures:** the fix requires regenerating two committed fixtures,
a 31,252-line diff that touches a fixture to make a check pass. `CLAUDE.md` forbids editing a
fixture to green a build. This is the legitimate opposite — making a stated invariant true, not
making a red test go away — but it is indistinguishable in a diff, so it is recorded here
explicitly. It should land in a commit whose entire subject is that invariant.

*Cost:* regenerating both fixtures took 3.4s wall, mostly `uv run` + `ezdxf` import paid once.
Marginal per-fixture cost is **unmeasured**; at ~20 fixtures it lands against ~17s of headroom,
and if it does not fit, this is the first thing partition-by-lane should take.

### 10. This ticket rules and stops

The deliverable is the decision. The frame is built downstream through `/to-spec` →
`/to-tickets` as an arc, sequenced **early** — bar 1's frame must exist before rails can fill it.

*Forced by:* the build is `cad/tests/corpus/` with `_lib.py` and `regen.py --check`, the index
schema plus zod and dataclass validators, meta-tests in both lanes (entry↔test binding both
directions, terminus ratchet, `undecided` expiry, refusal-name check), the newline fix and its
regeneration, then 6 buildable-now cases and 3 boundary termini. `.wayfinder/TRACKER.md` rules a
ticket too big for one session is a graph defect — split the node, never stretch the session.

*Also:* the newline fix deserves a commit of its own rather than burial under a frame's worth of
new files, for the reason given in ruling 9.

### Postscript — the expiry clause fired before the frame existed

`origin/main` moved 11 commits during this session and closed tickets 01–04. Case 10 had been
triaged `undecided → ticket 04`; ticket 04 §3 now rules that a member re-sheeted between
revisions **keeps its identity and its ordinal and re-presents for disposition, and
removal-plus-registration is a defect** — so case 10 entered the census already ruled, and the
table above was corrected before this ticket closed. Tickets 06, 07, 12, 13, 19, 20 remain open,
so the other six `undecided` entries stand.

That is ruling 6 working by hand on its first day, which is the argument for building it: the
correction was available only because someone re-read a triage table against the tracker. The
meta-test is what makes that automatic instead of lucky.
