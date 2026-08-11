# Tracker — local markdown

Work larger than one session is charted here: no network, no auth, greppable, and it lives in
the same git history as the code the decisions are about.

## Layout

```
.wayfinder/
  <effort-slug>/
    MAP.md              Destination · Notes · Decisions so far · Not yet specified · Out of scope
    tickets/
      NN-<slug>.md      decision tickets (charted by /wayfinder)
    arcs/
      <arc-id>/
        NN-<slug>.md    build tickets (written by /to-tickets, one arc at a time)
```

Decision tickets decide; arc tickets build. Same field lines (`Status:` / `Blocked by:` /
`Claimed by:`), so the frontier query (`scripts/loop/frontier.mjs`) works on either directory,
and the loop (`docs/specs/loop.md`) executes arc tickets headless.

## Operations

| Operation | Expression |
|---|---|
| **A ticket** | `tickets/NN-<slug>.md`; its **name** is the `# ` heading — refer to it by name. |
| **Ticket type** | `wayfinder:<research\|prototype\|grilling\|task>` line in the body. |
| **Blocking** | `Blocked by:` line naming tickets by filename. Empty/absent = unblocked. |
| **Claiming** | `Claimed by:` line, set **before** any work. |
| **Open / closed** | `Status:` line. |
| **The frontier** | Open, unclaimed, every blocker closed. `grep -L "Status: closed" .wayfinder/<effort>/tickets/*.md` |
| **Resolution** | `## Resolution` appended; `Status: closed`; one line added to the map's *Decisions so far*. |

## Rules

- **One ticket per session**, then `/clear`. Research tickets are the only exception.
- Load `MAP.md` at low resolution — zoom into a ticket only when you take it.
- Never `/compact`. Past 150K mid-ticket: write state into the ticket, `/clear`, resume fresh.
- A ticket too big for one session is a **graph defect** — split the node, never stretch the
  session.
- A resolution states the ruling, the measurement that forced it, and the alternative that was
  put and rejected.
