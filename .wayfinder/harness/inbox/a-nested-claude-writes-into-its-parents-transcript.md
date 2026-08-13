# A nested claude writes into its parent's transcript

wayfinder:task
Status: open
Blocked by:
Claimed by:

## Objective

Measured on a cloud container at `6c6e001`, CLI 2.1.231. A nested `claude` inherits
`CLAUDE_CODE_SESSION_ID` from its parent and writes its records into a transcript file named for
**the parent's** session id. Run from the repo root, the child's records land in the parent's own
transcript file; run from another directory, they land in that directory's project folder under
the parent's session-id filename.

The effect on any transcript-based reading is that the child's context series is interleaved with
the parent's, where it reads as a **context collapse** — in the measurement for ticket 18, from
45,620 tokens to 21,486 and back. An analysis that did not filter it would report a compaction
that never happened, and `overContextLine` computed from such a file would be wrong in the
direction that clears the flag.

Foreign records were identifiable here only by `effort` (`high` on the child, `medium` on the
parent, from `CLAUDE_EFFORT`), which is a coincidence of this container rather than a
discriminator anyone should rely on.

`scripts/loop/usage.mjs` is **not affected**: it parses a live stdout stream, not a transcript
file, and the repetition does not arise there. This ticket is about anything that reads
`~/.claude/projects/`, and about conductor v2 — which spawns sessions from inside a session, so
every worker it starts would write into the dispatching session's transcript.

## The decision

1. **Should a spawner clear `CLAUDE_CODE_SESSION_ID` for its children?** `conduct.mjs` is the one
   spawner today. Clearing it is one line, but it is another undocumented incantation of exactly
   the kind ticket 18 §4 ruled against for `ENV_SCRUB` — so if it is the answer, it belongs
   somewhere stated, with a preflight, not as a bare `env` key.
2. **Is the parent's transcript corrupted in any way that matters beyond analysis?** The parent
   session continued normally here, so the observed damage is to readers. Confirm that, rather
   than assuming it.
3. **Does anything in the repo read a transcript today?** Nothing does. If something is going to
   (a boundary review reading its own history is the obvious candidate), it needs a documented
   rule: **deduplicate assistant records by `requestId` and drop foreign session records** —
   not doing the first overstated a session's output tokens by ~60% in the ticket-18 measurement.

## Acceptance

- [ ] Ruled, and if a spawner must clear the variable, the change carries a preflight or a
      comment saying why, not a bare assignment.
- [ ] `docs/TRAPS.md` carries the interleaving, since it presents as a context collapse and is not
      one.
