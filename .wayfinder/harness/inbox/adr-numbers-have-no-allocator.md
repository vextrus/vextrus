# ADR numbers have no allocator

wayfinder:task
Status: open
Blocked by:
Claimed by:

## Objective

Ticket numbers have an allocator (`scripts/wayfinder/promote.mjs`), a minting convention
(`inbox/<slug>.md`) and a pre-push guard (`.githooks/pre-push:52-100`). **ADR numbers have none
of the three.** Audited 2026-08-16: no script under `scripts/` reads `docs/adr/`, and the hook's
guard matches `.wayfinder/*/tickets/*.md` only.

The defect class is identical, and TRACKER already states it in full: a session *"cannot see
what other branches are minting, and two branches that pick the same number produce two
**different filenames**, which git merges **WITHOUT A CONFLICT**."* Two parallel sessions each
read `docs/adr/`, each see 0015 as the highest, each write `0016-<their-own-slug>.md`, and both
land. Nothing in the repo notices. That is fail-open in a repo whose governing sentence forbids
exactly that.

**Number 0015 has already been chosen twice**, by two sessions that never saw each other: the
design-system session (`0015-the-design-system.md`, landed #42) and the HITL-boundary session
(`0015-the-hitl-boundary-is-mechanical.md`, #54). They never collided on `main` only because #46
reverted the first out of existence in between — **the near-miss was masked by an unrelated
revert, not caught by a mechanism.** The second session had to reason about whether the number
was safe to reuse and record its finding in the ADR's own header, which is a session doing an
allocator's job from inside a branch that cannot see the answer.

The exposure is immediate: tickets 12 and 13 are both likely to produce an ADR, and the campaign
this repo is building toward runs arc tickets in parallel by design.

## The work

Mirror the ticket solution, which is already proven here — same slug, same path, so a real
collision becomes a real conflict:

1. **`docs/adr/inbox/<slug>.md`** — a session writing an ADR mints it unnumbered, exactly as it
   mints a ticket. `Status:` and the ADR body are unchanged; only the number is withheld.
2. **An allocator that runs on `main`**, where every existing number is visible, renaming
   `inbox/<slug>.md` → `NNNN-<slug>.md`.
3. **A pre-push guard** refusing a newly *numbered* ADR, mirroring `.githooks/pre-push:52-100`
   including its exemptions — most importantly the **promotion exemption**: a slug sitting in
   `docs/adr/inbox/` at the merge base came through the sanctioned path and must pass. The hook's
   own comment records why this matters: *"refusing it would make the override the normal way to
   work, which is how a guard stops being one."*

## Open — resolve before or during, do not silently pick

- **Extend `promote.mjs`, or a sibling?** `promote.mjs` takes an `<effort-dir>` and is
  effort-scoped; ADRs are repo-global and have no effort. The shapes differ enough that
  overloading the argument may be worse than a second small script that shares the rename core.
  Rule it; do not leave two half-implementations.
- **How does anything cite a pending ADR?** ADRs are referenced by number across the tree
  (`ADR-0010`, `ADR-0014`), and an unnumbered one has no citable name. `Blocked by:` solved this
  for tickets by naming the slug and rewriting at promotion. Decide the equivalent — and note
  that a *ticket's resolution* may need to cite an ADR that is still in inbox, which is the case
  that will actually occur.
- **Does the allocator touch the two `0015`s?** Recommendation: **no.** ADRs are dated decisions,
  superseded and never edited; the surviving 0015 is correct and the other does not exist on
  `main`. Record the history, renumber nothing.

## Guardrails

- **"Never edit a landed ADR" is not violated by promotion.** An unnumbered inbox ADR has not
  landed as an ADR; naming it is allocation, not amendment. Say so where someone will read it,
  or the first person to notice will file a bug against the allocator.
- **Do not retro-number the existing 14.** They are cited by number throughout the tree and in
  every commit message that ever referenced one.
- The guard refuses and names its repair, like every other refusal in this repo.

## Acceptance

- [ ] A session mints an ADR into `docs/adr/inbox/<slug>.md` with no number.
- [ ] One allocator, running on `main`, is the only writer of ADR numbers.
- [ ] `.githooks/pre-push` refuses a newly numbered ADR, exempts promotions, and names its
      repair; covered by a test in the scripts lane alongside the ticket-guard tests.
- [ ] The pending-citation question is answered and written down, not left to the first session
      that hits it.
- [ ] `docs/adr/README.md` (or the ADR convention wherever it lives) states the minting rule, so
      it is discoverable from the directory a session is already looking at.
