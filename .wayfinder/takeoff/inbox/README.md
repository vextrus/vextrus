# Inbox — new tickets, before they have a number

A session that surfaces new work writes it here as `<slug>.md` — **slug only, no number** — with
the ordinary tracker header. The dispatcher promotes the inbox on `main`:

```
node scripts/wayfinder/promote.mjs .wayfinder/takeoff   # --dry-run to see the plan first
```

which allocates numbers past the highest one already in `tickets/`, rewrites any `Blocked by:`
edge that names an inbox slug, and `git mv`s the files across.

## Why a session may not pick the number itself

Measured on the first parallel wave (2026-08-13). On `claude/raster-to-geometry` a session created
`23-the-effective-resolution-gate.md` and `24-the-dimension-annotation-lane.md`. On
`claude/vector-pdf-entity-graph` a different session created `23-the-lane-fidelity-declaration.md`
and `24-who-decomposes-a-pdf-page.md`. Two 23s and two 24s — and because the **filenames differ,
git saw four unrelated additions and merged them without a conflict.** No mechanism in the repo
could see it; it was caught and renumbered by hand.

A `Blocked by:` line naming `23-….md`, written on one branch, would after that merge have pointed
at the *other* branch's ticket, and `frontier.mjs` would have answered confidently and wrongly.
That is a fail-**open** defect, which the governing sentence forbids.

Slugs invert it: two sessions minting the same slug write the same path, so git conflicts and says
so. Numbers are then allocated once, by a single writer that can see every existing number.

`.githooks/pre-push` refuses a push that adds `NN-<slug>.md` to an effort that already has
tickets, so this is mechanism rather than instruction. Charting a **new** map is exempt — its
whole numbered set is created at once, by one session, with nobody to collide with.

`frontier.mjs` never looks here: an un-numbered ticket is not yet in the graph.
