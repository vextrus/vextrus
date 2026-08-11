---
name: wayfinder
description: Plan a huge chunk of work — more than one agent session can hold — as a shared map of decision tickets, and resolve them one at a time until the way to the destination is clear.
disable-model-invocation: true
---

A loose idea has arrived — too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **shared map** of **decision tickets** — questions whose resolution is a decision, not slices of a build to execute — worked one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting — it shapes every ticket. It might be a spec to hand off, a decision to lock before planning starts, or a change made in place.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear — nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off (`/to-spec`, then `/to-tickets`). An effort can override this in its **Notes**; absent that, produce decisions, not deliverables.

## The tracker

This repo uses the **local-markdown tracker** — `.wayfinder/TRACKER.md` is authoritative for layout, fields, claiming, blocking, and the frontier query. In short: a map lives at `.wayfinder/<effort>/MAP.md`; each ticket is `.wayfinder/<effort>/tickets/NN-<slug>.md` with `Status:` / `Blocked by:` / `Claimed by:` lines; the frontier is open + unclaimed + all blockers closed. Refer to tickets **by name** (their `# ` heading), never by bare number.

## The map body

The whole map at low resolution, loaded once per session:

```markdown
## Destination

<what reaching the end looks like — one or two lines; every session orients to it first>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

- [<closed ticket name>](tickets/NN-<slug>.md) — <one-line gist of the answer>

## Not yet specified

<!-- in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->
```

The map is an **index**, not a store: a decision lives in exactly one place — its ticket's `## Resolution` — and the map only gists and links it.

## Ticket types

Each ticket carries a `wayfinder:<type>` line. Every ticket is either **HITL** — worked *with* a human who speaks for themselves — or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side (a grilling agent that answers its own questions has broken this).

- **research** (AFK): surface a fact a decision waits on, from sources outside the working tree. Resolved by a `/research` subagent; findings land in `docs/research/<slug>.md`.
- **prototype** (HITL): raise the fidelity of the discussion with a cheap concrete artifact via `/prototype`. Use when "how should it look/behave" is the question.
- **grilling** (HITL): conversation via `/grilling`, one question at a time. The default.
- **task** (HITL or AFK): manual work that must happen before a *decision* can be made — provisioning, moving data so its shape can be seen. The one type that *does* rather than decides; it earns its place by unblocking a decision. The resolution records what was done and any facts later tickets depend on.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. **Not yet specified** holds the dim view — suspected questions not yet sharp enough to ticket. The test is whether you can state the question precisely now, _not_ whether you can answer it: **ticket** when the question is sharp (even if blocked); **fog** when you can't phrase it that sharply. Don't pre-slice fog into ticket-sized pieces — one patch may graduate into several tickets, or none.

## Out of scope

The destination fixes the scope; work beyond it is **out of scope**, not fog. When an existing ticket turns out to sit past the destination, **close it** and leave one line in Out of scope (gist + why, linking the closed ticket). It stays out of Decisions so far, which records the route actually walked.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session** — research tickets excepted.

### Chart the map

1. **Name the destination** — a `/grilling` pass; the destination fixes the scope, so it's settled first.
2. **Map the frontier** — grill again, **breadth-first**: fan out across the space, surfacing open decisions and first takeable steps. If this surfaces no fog, you don't need a map — stop and ask.
3. **Create the map**: Destination and Notes filled, Decisions-so-far empty, fog sketched into Not yet specified.
4. **Create the tickets you can specify now**; wire `Blocked by:` edges in a second pass.
5. **Fire the research subagents** for each research ticket, in parallel.
6. Stop — charting is one session's work; it hand-resolves nothing.

### Work through the map

1. Load the **map** — the low-res view, not every ticket body.
2. Choose the ticket (the user's, or the first frontier ticket). **Claim it** — set `Claimed by:` before any work.
3. Resolve it — zoom into related/closed tickets on demand; invoke the skills the Notes name. If in doubt, `/grilling`.
4. Record: append `## Resolution` (the ruling, the measurement that forced it, the alternative put and rejected), set `Status: closed`, clear the claim, append one line to Decisions so far.
5. Add newly-surfaced tickets; graduate fog the answer made specifiable; rule mis-scoped tickets out of scope; update or delete tickets the decision invalidated.

Other sessions may be working the map concurrently — expect concurrent edits; the claim line is what keeps you off each other's tickets.
