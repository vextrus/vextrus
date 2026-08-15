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

## Decisions

<pointer to decisions/ — one file per closed ticket, named for it. Never a list here.>

## Not yet specified

<!-- in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->
```

The map is an **index**, not a store: a decision lives in exactly one place — its ticket's `## Resolution` — and the index only gists and links it. That index is `decisions/<the ticket's own filename>`, **one file per closed ticket, never a list in `MAP.md`**: a list is a file every closing session appends to, and N parallel sessions conflict on it N−1 times (`.wayfinder/TRACKER.md`). Charting-time rulings, which belong to no ticket, go in `decisions/00-charting.md` — charting is one session's act and never runs concurrently.

## Ticket types

Each ticket carries a `wayfinder:<type>` line. Every ticket is either **HITL** — worked *with* a human who speaks for themselves — or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side (a grilling agent that answers its own questions has broken this).

**Nobody declares attendance — you find out by asking.** On a HITL ticket the first act is a question, and the answer settles it. **Answered: a human is here.** That answer *is* the live exchange this type requires, so grill and rule in the one session — no second pass, no permission to seek, and `CLAUDE.md` §5's "you cannot ask mid-session" does not reach you, because on a HITL ticket asking *is* the work. **Unanswered: the turn simply ends**, and a container with nobody in it has ruled nothing. That is the enforcement, and it needs no flag: a session cannot fake an answer it was never given.

**Before the answer comes, do the half that never needed one — facts, never decisions.** `/grilling` already assigns it: *"if a fact can be found by exploring the environment, look it up rather than asking me."* Look it up, write what you found into the ticket under its own heading, sharpen the questions the facts sharpened. Then put the first question and **stop at the decision**: until a human answers, never append `## Resolution`, never set `Status: closed`. If the session ends there, clear your own claim and leave the ticket open — open with the reading done is what this state is, and it needs no new field. An absent or unrecognised type counts as HITL.

The claim on `main` is **not** how you know whether anyone is watching — it is how *CI* knows, after the conversation is gone (ADR-0015). Never read it as permission, and never write it.

- **research** (AFK): surface a fact a decision waits on, from sources outside the working tree. Resolved by a `/research` subagent; findings land in `docs/research/<slug>.md`.
- **prototype** (HITL): raise the fidelity of the discussion with a cheap concrete artifact via `/prototype`. Use when "how should it look/behave" is the question.
- **grilling** (HITL): conversation via `/grilling`, one question at a time. The default.
- **task** (HITL or AFK): manual work that must happen before a *decision* can be made — provisioning, moving data so its shape can be seen. The one type that *does* rather than decides; it earns its place by unblocking a decision. The resolution records what was done and any facts later tickets depend on.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. **Not yet specified** holds the dim view — suspected questions not yet sharp enough to ticket. The test is whether you can state the question precisely now, _not_ whether you can answer it: **ticket** when the question is sharp (even if blocked); **fog** when you can't phrase it that sharply. Don't pre-slice fog into ticket-sized pieces — one patch may graduate into several tickets, or none.

## Out of scope

The destination fixes the scope; work beyond it is **out of scope**, not fog. When an existing ticket turns out to sit past the destination, **close it** and leave one line in Out of scope (gist + why, linking the closed ticket). It stays out of `decisions/`, which records the route actually walked.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session** — research tickets excepted.

### Chart the map

1. **Name the destination** — a `/grilling` pass; the destination fixes the scope, so it's settled first.
2. **Map the frontier** — grill again, **breadth-first**: fan out across the space, surfacing open decisions and first takeable steps. If this surfaces no fog, you don't need a map — stop and ask.
3. **Create the map**: Destination and Notes filled, fog sketched into Not yet specified. Any ruling charting itself made goes in `decisions/00-charting.md`.
4. **Create the tickets you can specify now**; wire `Blocked by:` edges in a second pass.
5. **Fire the research subagents** for each research ticket, in parallel.
6. Stop — charting is one session's work; it hand-resolves nothing.

### Work through the map

1. Load the **map** — the low-res view, not every ticket body.
2. Take the **ticket the dispatcher picked** — never self-select (ADR-0010). Its claim is already set on `main` before you start, by `pnpm dispatch`: `Claimed by: dispatched <date>` for a container nobody is watching, `attended <date>` (via `--attended`) when the dispatcher is in the room. **Never write an attended claim yourself** — a claim on your branch is invisible on `main` and forgeable by the session it vouches for, which is the whole reason it lands through a PR the human clicks. A claim you did not expect means stop and report.
3. Resolve it — zoom into related/closed tickets on demand; invoke the skills the Notes name. If in doubt, `/grilling`.
4. Record: append `## Resolution` (the ruling, the measurement that forced it, the alternative put and rejected), set `Status: closed`, clear the claim — the one claim edit a session ever makes: **its own, in the edit where it stops**, whether it stopped by closing or at a HITL boundary it may not cross; a claim left behind by a session that ended is a ticket no frontier can see again — and write the gist to `decisions/<this ticket's filename>`. **Don't touch `MAP.md`** unless the ruling changes the destination, the notes or the fog — a closing session that edits the map is the conflict this layout removed.
5. Add newly-surfaced tickets **into `inbox/<slug>.md`, with no number** — you cannot see what other branches are minting, and two branches picking the same number merge without a conflict (`.wayfinder/TRACKER.md`; the pre-push hook refuses the numbered form). Write `Blocked by:` edges to inbox tickets by slug; promotion rewrites them. Then: graduate fog the answer made specifiable; rule mis-scoped tickets out of scope; update or delete tickets the decision invalidated.

Other sessions may be working the map concurrently — expect concurrent edits; the claim line is what keeps you off each other's tickets.
