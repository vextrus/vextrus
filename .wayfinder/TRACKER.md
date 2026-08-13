# Tracker — local markdown

Work larger than one session is charted here: no network, no auth, greppable, and it lives in
the same git history as the code the decisions are about.

## Layout

```
.wayfinder/
  <effort-slug>/
    MAP.md              Destination · Notes · Decisions · Not yet specified · Out of scope
    tickets/
      NN-<slug>.md      decision tickets (charted by /wayfinder)
    decisions/
      NN-<slug>.md      one per closed ticket, named for it; the map's index, sharded
    inbox/
      <slug>.md         newly surfaced tickets, no number yet — promoted by the dispatcher
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
| **A new ticket** | `inbox/<slug>.md`, **no number** — a session never allocates one. `node scripts/wayfinder/promote.mjs .wayfinder/<effort>` numbers them on `main`. |
| **Resolution** | `## Resolution` appended; `Status: closed`; a gist written to `decisions/<the ticket's own filename>`. Never edit `MAP.md` to close a ticket. |

## Rules

- **One ticket per session**, then `/clear`. Research tickets are the only exception.
- Load `MAP.md` at low resolution — zoom into a ticket only when you take it.
- Never `/compact`. Past 150K mid-ticket: write state into the ticket, `/clear`, resume fresh.
- A ticket too big for one session is a **graph defect** — split the node, never stretch the
  session.
- A resolution states the ruling, the measurement that forced it, and the alternative that was
  put and rejected.
- **A session never allocates a ticket number.** It cannot see what other branches are minting,
  and two branches that pick the same number produce two *different* filenames, which git merges
  **without a conflict** — measured 2026-08-13, `23-` and `24-` both minted twice, invisible to
  every mechanism here and caught by hand. Mint into `inbox/<slug>.md`; the same slug is the same
  path, so a real collision becomes a real conflict. `.githooks/pre-push` refuses the numbered
  form on an effort that already has tickets.
- **Nothing a closing session writes may be a file another closing session also writes.** An
  append-only list shared by N parallel sessions conflicts N−1 times, mechanically, forever: in
  the first parallel wave six of seven merges conflicted and every one was `MAP.md`'s decision
  list, nothing else (`docs/specs/cloud-campaign.md` §1). One record, one file, named for
  something already allocated. This binds every index a ticket contributes to — the torture
  corpus index next.

## Who claims (ADR-0010)

Concurrency is coordinated by the **dispatcher** — the human who opens a session — not between
sessions. A claim written on a session's own branch is invisible on `main`, which is the only
place a second dispatch would look, so claiming is not a session's job:

- **The dispatcher picks the ticket and sets `Claimed by:` on `main` at dispatch**, in the same
  breath as creating the branch. A session is never handed "take the next frontier ticket".
- **A session never sets a claim, and never touches another's.** The one claim edit a session
  makes is clearing *its own* in the same edit that closes the ticket — a closed ticket keeps
  no claim. Finding a claim it did not expect, it stops and reports: an unexpected claim means
  a stale container or a dispatch mistake, and neither is a session's to adjudicate.
- **Only the dispatcher breaks a stale claim** — they are the only party who knows whether that
  container is still alive.
- **The loop is the exception, by unit not by rule.** Its dispatch unit is the *arc directory*,
  which is exclusively the campaign's for its duration; inside a campaign, workers select and
  claim freely (`docs/specs/loop.md`).
