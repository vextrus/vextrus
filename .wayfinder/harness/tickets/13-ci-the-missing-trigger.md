# CI — the missing trigger

wayfinder:grilling
Status: open
Claimed by:
Blocked by:

## Objective

Decide whether CI exists, what fires it, and what it runs — then hand the building of it to a
spec. This ticket produces a decision, not a workflow file.

## What forced it

Three separate threads converge here, and none of them can advance without this one.

- **ADR-0007 refers work to a CI that does not exist.** `test:db` and Playwright are both placed
  "in CI"; `.github/workflows` is absent. The contract names a lane with nothing in it.
- **Ticket 07 could not chart a single per-commit capability, for want of an invoker.** Its
  ranking was staleness × invoker, and with no CI anywhere, everything that would run *per commit*
  scored zero and was declined — the new-contributor path, Linux-native behaviour, the lot. That
  is not a judgement about their value; it is the absence of anything to trigger them.
- **Ticket 06 named CI as the seam that would make the merge gate mechanical.** Until it exists,
  *"verify ran on this head"* is a human-read claim in a PR comment, and *"branch up to date"* is
  unenforceable — GitHub offers that setting only as a sub-option of required status checks.

The shape of the answer is already unusual and the grilling should start from it: **the script is
already written.** `pnpm parity` — checkup → verify → `test:db` → a `next dev` boot probed for 200
— runs on every cloud session and is the Linux-native check in full. What is missing is not a
thing to run but something to *run it, unasked, on a commit*.

## The question

1. **Does the cloud sandbox count as the lane, or is CI a thing beside it?** Every cloud session
   already runs `pnpm parity` from `provision.sh`. The gap is that a session is opened by a human
   with a ticket, not by a push. Is "a session per commit" a sane trigger, or an abuse of one?
2. **What does it run?** `pnpm parity` entire, or `verify` only, with `test:db` and the dev probe
   left to provisioning? ADR-0007 puts Playwright outside the verify lane — does CI inherit that,
   or is CI precisely where e2e was always going to live?
3. **What does it gate?** ADR-0010's merge protocol is currently honour-based. A required status
   check would make it mechanical — but the same ADR ruled that the click stays human. A check
   that gates the *button* without taking it is the target; confirm that is what required checks
   actually do.
4. **What does it cost?** Ticket 09 measured a container provisioning itself from empty in ~83s
   and `parity: ok in 57s`. A per-commit run is that, every commit, against a repo with no
   customer yet.

## Folded in from the map's fog

**When the build stage stops being cheap.** `next build` is verify's fifth stage and grows with
every route — 6.7s → 15.2s at ticket 01, 16–25s across ticket 09's runs. The standing ruling is
*re-measure, not relax*, but nothing re-measures it and no threshold is stated. That is the same
missing invoker wearing a different hat, so it is decided here or not at all: does CI carry a
timing budget, and does exceeding it fail a run or merely report?

## Guardrails

- **This ticket decides; it does not build.** A workflow file is `/to-spec` and `/to-tickets`
  territory. The map ends at the decision.
- Do not weaken `pnpm parity` to make it affordable per commit. If the full gate is too expensive
  to run on every push, the ruling is *which subset runs when*, stated as such — not a quieter
  gate pretending to be the same one.
- Nothing here may claim a customer, a deployment target, or a release process (`docs/CONTEXT.md`).
