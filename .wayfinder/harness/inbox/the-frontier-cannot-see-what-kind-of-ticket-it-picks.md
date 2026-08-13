# The frontier cannot see what kind of ticket it picks

wayfinder:task
Status: open
Blocked by:
Claimed by:

## Objective

The loop's founding law is "the loop executes decided work; it never decides" (ADR-0008,
docs/specs/loop.md). Nothing enforces it. `frontier.mjs` selects on `Status:` / `Claimed by:` /
`Blocked by:` alone; the type line (`wayfinder:task` vs `wayfinder:grilling` vs
`wayfinder:prototype`) is invisible to it, so a decision or prototype ticket that is open and
unclaimed is picked exactly like decided build work.

Measured cost, 2026-08-14: the first conducted worker on a container (run
`2026-08-13T17-52-09`, PR #35) executed `takeoff/10-the-design-system.md` — a
`wayfinder:prototype` ticket in an effort whose build tickets are not generated yet — and its
work had to be reverted (PR #36). The proximate cause was a prompt pointing `conduct.mjs` at
`.wayfinder/takeoff/tickets`; the class cause is that no gate between the frontier and the
spawn asks what kind of ticket this is. cloud-campaign.md's closing paragraph already named the
question ("whether decision tickets belong in an automated campaign at all") and it is now no
longer hypothetical.

## The decision

1. Should `frontier.mjs` (or `conduct.mjs` before spawning) refuse any ticket whose type line
   is not `wayfinder:task`, fail-closed — a missing or unknown type counts as not executable?
2. Or is the dispatch unit the guard: the loop only ever pointed at `arcs/<arc>/` directories,
   which `/to-tickets` populates exclusively with build tickets, and a top-level `tickets/`
   directory is refused by conduct outright?
3. Ticket 10 is open and unclaimed again after the revert; until this is ruled, nothing may
   point `conduct.mjs` at `.wayfinder/takeoff/tickets`.

## Acceptance

- [ ] Ruled, with the refusal (wherever it lands) naming the ticket and its type, fail-closed
      on unknown types, and covered by a test in the scripts lane.
- [ ] docs/specs/loop.md states which ticket kinds the loop may execute.
