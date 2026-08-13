# The loop log does not survive the container, so no campaign ever accumulates evidence

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

`.loop/` is gitignored (`.gitignore:30`) and no code path exports, uploads or commits it. The
container is disposable. **Every campaign's `log.jsonl` dies with the machine that wrote it.**

Measured on a cloud container at `6c6e001`: `find / -name log.jsonl` returns nothing. The repo
currently has **zero rows** of campaign evidence anywhere in git.

This is not a tidiness problem. It is load-bearing for at least five stated commitments:

- `docs/specs/cloud-campaign.md` rests its caps on *"n=3 from `.loop/2026-08-12T05-24-16/log.jsonl`"* —
  a file that no longer exists on any machine.
- **6.2** (turn/wall/cost distribution over ≥10 cloud closes → re-derive `MAX_TURNS` and the wall
  fuse) cannot ever be satisfied, because closes 1–9 are gone before close 10 happens.
- **6.4** (does dispatch width 3 produce zero conflicts) is the same shape.
- `ctxPeak` logging landed today (PR #31) and writes into the same doomed directory.
- Ticket 18 §3 could not test ADR-0007's and ADR-0013's founding premise for exactly this reason
  (`docs/research/what-fills-a-cloud-session.md` §4, Blocker 1).

`flags.mjs` already reads only the **most recent** run, so the boundary review sees at most one
container's worth of history even locally.

## The decision

1. **Where does a closed ticket's row live so it outlives its container?** Candidates: a committed
   append-only `.wayfinder/<effort>/log/` file written by the conductor rather than the worker; a
   line appended to the ticket itself at close; a GitHub artifact or a PR comment. Each has a
   different concurrency story under N containers — the committed-file option reintroduces exactly
   the merge conflicts §8.1 was landed to remove.
2. **Who writes it — worker or conductor?** ADR-0010's doer≠judge law says the conductor reads the
   PR, the check and the tree, never the transcript. A worker writing its own row is a claim; a
   conductor writing it is evidence.
3. **What is the row?** At minimum the fields `conduct.mjs` already logs: ticket, gates, turns,
   costUsd, wallMs, `ctxPeak`, `ctxWindow`, `overContextLine`, workerResult. Plus the machine and
   commit, per `CLAUDE.md` — a number with no environment is not a measurement.
4. **Retention and privacy.** These rows carry cost figures and ticket names. Committed to a repo
   that may go public, that is a decision, not a default.

## Guardrails

- Do not make `.loop/` tracked. It is per-container scratch and `.githooks/pre-push`'s cloud
  carve-out depends on `ACTIVE` being untracked (`cloud-campaign.md` §8.10).
- Until this is ruled, **do not plan analysis on `.loop/`** and do not quote a cap as derived from
  a log nobody can produce.

## Acceptance

- [ ] A named mechanism by which a closed ticket's row survives its container, with the
      concurrency story under dispatch width ≥3 stated.
- [ ] `cloud-campaign.md` 6.2 and 6.4 either unblocked or re-blocked on this ticket by name.
- [ ] `docs/specs/loop.md` states where the boundary review's evidence actually comes from.
