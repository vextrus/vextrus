# The private corpus lane

wayfinder:task
Status: closed
Blocked by:
Claimed by:

## Objective

Build the mechanism that lets a real drawing corpus harden the extractor **without a single byte
entering this repo**. The CEO has placed the Edison DWG set and its BOQ workbook at
`V:\repos\edison-dwg-boq` — outside the repo tree, sibling to `V:\repos\vextrus`.

`CLAUDE.md` states the guardrail without qualification: *"'Edison' is a competitor whose data is
internal benchmark only — never a client, never demo content, **never in this repo**."* Genesis
§6 repeats it for fixtures. This ticket does not soften that; it builds the lane that makes it
unnecessary to soften.

## What this ticket does

1. **`VEXTRUS_PRIVATE_CORPUS`** — an env var naming a directory the repo never sees. The lane
   reads it, runs the extractor, and **reports**: per-type entity counts, loss and
   `unsupported_by_type` counters, refusals with causes, view partition outcomes, sanity numbers.
2. **It refuses to run if the path resolves inside the repo.** Mechanical, not prose — the same
   fail-closed philosophy as the boundary-lint fixture test (genesis D7).
3. **It never gates.** Not in `pnpm verify`, not in CI. It emits a report a human reads.
4. **It emits no fixture into the tree.** What crosses back is only the *defect class*,
   reproduced synthetically in the torture corpus (ticket 09). The drawing stays out; the lesson
   comes in — exactly how the legacy censuses' findings reached `docs/domain/` with no Edison
   bytes.
5. **Record the operational fact**: these sessions run in Linux cloud containers and cannot
   reach `V:\`. The lane is **local-machine-only by construction**, which is a feature — no
   cloud container ever holds those files.

## The BOQ workbook is a different artifact and needs its own handling

It is not corpus, it is a **yardstick** for destination bar 2. `quantity-contract.md` §5 governs
it and one clause bites hard: *"an input may never be derived from the figure the gate it feeds
compares against."* Tuning any threshold until our number matches Edison's BOQ is back-solving,
and it silently voids the only bar that can falsify the thesis. Also §5: ground truth is **row
sums, never printed grand totals**; a self-disagreeing yardstick row prints **ungated**, never
dropped; and yardstick-defect is **unavailable as an excuse for an over-measurement**.

Rule in the resolution whether the workbook may be used at all before a *clean-room* yardstick
(destination bar 2's real QS) exists, or only alongside it.

## Resolution

**Built, and the workbook is sealed.** `pnpm corpus` is the lane: `src/server/corpus.ts` (guard +
census + report), `src/server/corpus-main.ts` (entry), `src/server/__tests__/corpus.spec.ts`
(21 tests, all guard-shaped). Operator documentation: `docs/private-corpus-lane.md`.

### What was built

`VEXTRUS_PRIVATE_CORPUS` names a directory; the lane walks it, runs
extract → `partitionViews` → `georeferenceGrid` → `placeInstances` over every DXF, and emits a
markdown (or `--json`) report: per drawing sha256, `$INSUNITS` (unmapped flagged), originals and
derived, originals by type, `lost_by_type`, `unsupported_by_type`, views by type, countable
views, unassigned handles, view reason codes, grid axes/spacing/deferral causes, placement
instances and disposition codes; per corpus the same, summed, plus refusals by cause and
**stage failures** — a stage that *threw* on a real drawing is the highest-value row in the file.

Each pipeline stage is wrapped, so a throw is a reported row rather than a dead run. A file the
lane does not read carries a named cause (`FORMAT_NOT_IMPLEMENTED`, `NOT_A_DRAWING`,
`SYMLINK_NOT_FOLLOWED`, `UNRECOGNISED_EXTENSION`, `EXTRACTOR_REFUSED`) — never a skipped line,
never a zero.

**The guard is mechanical and fail-closed**, in the shape of the boundary-lint fixture test
(genesis D7): refuses a corpus inside the repo, refuses a corpus that *contains* the repo,
refuses when it cannot locate the repo at all (unprovable containment is a refusal), resolves
symlinks before comparing and never follows one during the walk, and guards every path it writes
*before* creating anything at it — the work dir test proves no `.corpus-work` appears in the tree
when the guard fires. **It never gates**: `corpus.spec.ts` reads `verify.mjs`, `ci.yml`,
`parity.sh` and `package.json` and asserts none of them invoke it, and that `pnpm corpus` is the
only script that does. Exit 0 when the census ran however many drawings refused inside it; exit 2
only when the lane itself refused. Artifacts land in `<corpus>/.vextrus-lane/`, named by a hash
of the relative path; nothing is emitted into the tree, no fixture, no filename.

The extractor seam is injectable (`opts.ingest`), so the lane's own tests exercise the whole
report path with the committed synthetic artifact and **no `uv` subprocess** — `pnpm verify`
never runs the extractor twice and never depends on a machine-specific corpus.

### The operational fact, recorded

These sessions run in Linux cloud containers that cannot reach `V:\`. The lane was therefore
built and tested against synthetic input only, and has never been run against the Edison corpus
by any agent. That is the design, not a gap: local-machine-only by construction means no cloud
container ever holds those files. What crosses back is a defect class, reproduced synthetically
in the torture corpus (ticket 09).

**A fact the first real run will hit:** the extractor reads DXF, so a DWG set refuses in full
today with `FORMAT_NOT_IMPLEMENTED`. The lane is honest about it rather than silent, and the DWG
lane (ticket 05) is the unblocker. Converting the set to DXF locally makes it corpus in the
meantime, which is a defensible first run.

### The ruling on the BOQ workbook

**Sealed. It is not read as ground truth at all — not before a clean-room yardstick, and not
alongside one.** Once destination bar 2's yardstick exists (a practising Bangladeshi QS's own
hand takeoff) and our figures are registered and frozen, the workbook may be opened to
*corroborate*, never as the gate's yardstick and never as an input to any threshold.

The measurement that forced it: `quantity-contract.md` §5's back-solving ban — *an input may
never be derived from the figure the gate it feeds compares against* — is **unenforceable after
the fact**. A person who has read the number cannot un-read it, and every later threshold
decision becomes unauditable in a diff. Not reading it is the only mechanical protection, and
this repo refuses rather than assumes everywhere else. §5's other clauses stand where the
workbook does eventually enter: ground truth is row sums never printed grand totals; a
self-disagreeing yardstick row prints ungated; yardstick-defect is unavailable as an excuse for
an over-measurement; and a class whose only yardstick is competitor-derived stays **unvalidated**
— it reaches no certificate and becomes a mandatory dip-sample stratum (§5, §8).

The alternative put and rejected: **use it now for defect discovery** — reading it to find work
item classes we never thought to measure, which drawings alone cannot reveal. Rejected because
its unique value over public sources is small while its contamination risk is total: the layout,
unit and item-grammar questions are answered from PWD/SoR/e-GP sources (`bd-authority.md`), which
exist for exactly that and are not a competitor's commercial document. Copying a competitor's
line list into the work-item catalogue (ticket 01) would also make committed data
competitor-derived, which `CLAUDE.md` forbids outright.

The seal is mechanical, not remembered: the lane refuses workbook extensions by name and prints
the yardstick rule as the reason, so a workbook sitting beside the drawings is never opened by
accident.
