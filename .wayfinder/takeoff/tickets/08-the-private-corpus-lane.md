# The private corpus lane

wayfinder:task
Status: open
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
