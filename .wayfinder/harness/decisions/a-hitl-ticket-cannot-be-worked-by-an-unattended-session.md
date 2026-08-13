# A HITL ticket cannot be worked by an unattended session

Ruled 2026-08-14 by **ADR-0015**, in an attended `/grilling` session.
Ticket: `inbox/a-hitl-ticket-cannot-be-worked-by-an-unattended-session.md` (closed in place —
unnumbered; `pnpm promote` numbers it when the dispatcher next runs it).

**An unattended session may work a HITL ticket for facts and must stop at the first decision.**
Not refused at dispatch — `/grilling` already assigns the agent the fact-finding half, and that
is the expensive half. What was missing was never permission to start; it was a place to stop.

The boundary is **two forbidden writes**, not a new state: no `## Resolution`, no
`Status: closed`. `Status:` stays binary — a HITL ticket with the reading done is *open*. A
session clears its own claim when it **stops**, not only when it closes.

Attendance is asserted by the claim on `main` — `attended <date>` via
`pnpm dispatch --attended` — because a session cannot push to `main` and never merges its own PR
(ADR-0010), so it cannot manufacture the value. CI enforces, fail-closed, unknown type reads as
HITL; not `pre-push`, which runs inside the container it would constrain. The rule lives in
`SKILL.md`, not `CLAUDE.md` (5,998/6,000 bytes; ADR-0014 declined to move the cap).
`grilling` stays the default type.

**Forced by two measurements already in the tree.** `scripts/checkup.mjs:594` (ticket 15): a
cloud container signs indistinguishably, so no commit-time artifact is unforgeable on its own —
the unforgeable act had to be the human's merge click. And #44: the session disclosed its own
violation unprompted, and the next human read that PR and reverted the wrong line anyway, which
rules out every honour-based remedy.

**Landed here:** the ADR, `SKILL.md`, `TRACKER.md`.
**Deferred:** the mechanism — `inbox/the-attended-claim-and-its-gate.md`. Until it lands the
gate is prose.
