# The private corpus lane

**What it is.** A way for a real drawing corpus to harden the extractor without a single byte
entering this repo. `CLAUDE.md` is unqualified — competitor and client data are *never in this
repo* — and this lane exists so that rule never has to bend. Nothing it touches is committed,
nothing it produces is a fixture, and it gates nothing.

```
VEXTRUS_PRIVATE_CORPUS=V:\repos\edison-dwg-boq pnpm corpus            # markdown to stdout
VEXTRUS_PRIVATE_CORPUS=V:\repos\edison-dwg-boq pnpm corpus --json -o V:\tmp\census.json
```

Code: `src/server/corpus.ts` (the lane), `src/server/corpus-main.ts` (the entry point),
`src/server/__tests__/corpus.spec.ts` (the guard, proven fail-closed).

## What it reports

Per drawing: sha256, `$INSUNITS` (and whether it is unmapped), original and derived entity
counts, originals by type, `lost_by_type` and `unsupported_by_type`, then the view partition
(views by type, countable views, unassigned handles, reason codes), the grid backbone (axes,
spacing, deferral causes) and placement (instances, disposition codes). Per corpus: the same,
summed, plus **refusals by cause** and **stage failures** — a stage that *threw* on a real
drawing is the single highest-value line in the report.

A file the lane does not read is a **named refusal**, never a skipped line and never a zero:
`FORMAT_NOT_IMPLEMENTED` (DWG and PDF — tickets 05/06/07 rule those lanes, none is built yet, and
the refusal names which), `NOT_A_DRAWING` (a workbook, see below), `SYMLINK_NOT_FOLLOWED`,
`UNRECOGNISED_EXTENSION`, `EXTRACTOR_REFUSED`.

Until the DWG lane lands, a DWG set refuses in full. Converting the set to DXF locally is an
operator's interim step and makes it corpus today; it is never the *product's* answer, which
ticket 05 rejected explicitly. This lane is also where ticket 05's 60-day ODA evaluation runs.

## The three mechanical properties

1. **It refuses if the corpus resolves inside the repo**, refuses if the corpus *contains* the
   repo, and refuses if it cannot locate the repo at all — unprovable containment is a refusal.
   Symlinks are resolved before the comparison and are never followed during the walk. Every
   path the lane writes passes the same guard *before* anything is created at it.
2. **It emits nothing into the tree.** Per-file artifacts land in `<corpus>/.vextrus-lane/`,
   named by a hash of the relative path; the report goes to stdout or to a path outside the repo.
3. **It never gates.** Not a `pnpm verify` stage, not a CI job, not invoked by any other script —
   and `corpus.spec.ts` proves all three by reading `verify.mjs`, `ci.yml`, `parity.sh` and
   `package.json`. Exit 0 when the census ran, however many drawings refused inside it; exit 2
   only when the lane itself refused.

## Local-machine-only, by construction

Agent sessions run in Linux cloud containers that cannot reach `V:\`. That is the feature: no
cloud container ever holds those files. The lane is run by a human on the machine that holds the
corpus, and what travels back is a **defect class** — reproduced synthetically in the torture
corpus (`.wayfinder/takeoff/tickets/09-the-torture-corpus.md`), exactly as the legacy censuses'
findings reached `docs/domain/` with no competitor bytes. A count, a reason code, or a sentence
of prose may cross. A drawing, a filename, an artifact or a report may not.

## The BOQ workbook is sealed

A BOQ that ships with a competitor's drawing set is not corpus — it is a **yardstick**, and
`quantity-contract.md` §5 governs it. It is **not read**, before or alongside anything:

- **An input may never be derived from the figure the gate it feeds compares against.** Tuning
  any threshold until our number matches that BOQ is back-solving, and it silently voids
  destination bar 2 — the only bar that can falsify the thesis. The ban is unenforceable after
  the fact: a person who has read the number cannot un-read it, and every later threshold
  decision becomes unauditable. Not reading it is the only mechanical protection.
- **It may enter only as a second reading, never the first.** Once bar 2's clean-room yardstick
  exists — a practising Bangladeshi QS's own hand takeoff — and our figures are registered and
  frozen, the workbook may be opened to *corroborate*. It is never the gate's yardstick, and a
  class whose only yardstick is competitor-derived stays **unvalidated**: it reaches no
  certificate and becomes a mandatory dip-sample stratum (§5, §8).
- Ground truth is **row sums, never printed grand totals**; a self-disagreeing yardstick row
  prints **ungated**, never dropped; and yardstick-defect is **unavailable as an excuse for an
  over-measurement**.
- The layout questions a BOQ could answer — units, item grammar, sectioning — are answered from
  public PWD/SoR/e-GP sources instead (`docs/domain/bd-authority.md`). Nothing unique is lost.

The seal is mechanical, not remembered: the lane refuses workbook extensions by name and prints
the reason, so a workbook sitting beside the drawings is never read by accident.
