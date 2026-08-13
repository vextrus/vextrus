# Decisions — one file per closed ticket

The gist and link for every closed ticket in this effort. **The decision itself lives in exactly
one place — its ticket's `## Resolution`.** This directory is the map's index, sharded.

## Why it is a directory and not a section of `MAP.md`

Measured on the first parallel wave (PRs #16–#24, 2026-08-13), replaying every session-side merge
with `git merge-tree --write-tree`: **six of seven conflicted, and every one conflicted in exactly
one file — `.wayfinder/takeoff/MAP.md`, in the tail of *Decisions so far*.** Nothing else
conflicted, ever. Not `identity.md` (three PRs), not `quantity-contract.md` (three), not
`cad-ingestion.md` (two) — git's 3-way merge handled every genuine prose edit and failed only on
the one structure that guarantees failure: an append-only list where every session appends at the
same line. ADR-0010 predicted it; at two sessions it is friction, at nine it was the whole problem,
and the next wave is ten (`docs/specs/cloud-campaign.md` §1).

Two sessions closing two tickets now write two different files and merge cleanly by construction.

## The rule

**A decision file's name is its ticket's file name.** `tickets/06-vector-pdf-to-entitygraph.md`
resolves into `decisions/06-vector-pdf-to-entitygraph.md`. Nothing is allocated at close time, so
nothing can collide — the number was allocated once, when the ticket was created.

Charting-time rulings, which belong to no ticket, are `00-charting.md`. Charting is one session's
act and never runs concurrently, so they stay one file.

## There is deliberately no index file

An `INDEX.md` listing every decision would be a file every closing session appends to — the
conflict this directory exists to remove, moved one level down. The directory listing is the
index, and it sorts correctly because the names are the tickets' names.

## Closed efforts are not migrated

`.wayfinder/harness/` and `.wayfinder/takeoff-core/` keep their `## Decisions so far` sections:
every ticket in both is closed, so nothing will ever be appended to them again, and rewriting a
finished record to match a convention it cannot benefit from is churn.
