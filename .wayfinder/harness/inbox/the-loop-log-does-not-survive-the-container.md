# The loop log does not survive the container, so no campaign ever accumulates evidence

wayfinder:grilling
Status: closed
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

- [x] A named mechanism by which a closed ticket's row survives its container, with the
      concurrency story under dispatch width ≥3 stated.
- [x] `cloud-campaign.md` 6.2 and 6.4 either unblocked or re-blocked on this ticket by name.
- [x] `docs/specs/loop.md` states where the boundary review's evidence actually comes from.

## Resolution

Ruled 2026-08-13 (harness-grounding session, dispatched work item 6). Implemented, tested,
same commit.

1. **Where:** `.wayfinder/<effort>/log/<run-id>.jsonl`, committed — one file per run, named by
   run id, so the concurrency story at any dispatch width is "distinct runs, distinct paths":
   this does not reintroduce the append-conflict class §8.1 killed. Cloud workers under
   docs/specs/execution.md carry their row in the PR body instead (a container that cannot
   commit to the effort's history can still open its PR). `.loop/` stays untracked — the
   pre-push guard's scoping depends on its location, per this ticket's own guardrail.
2. **Who:** the conductor, as its true last act (`scripts/loop/evidence.mjs`,
   wired at the end of `conduct.mjs`). The worker never writes a row — a worker's row is a
   claim, a conductor's is evidence. The commit is explicit-path (`git commit -- <file>`), so a
   halted worker tree is left exactly as evidence.
3. **The row:** everything conduct.mjs already logs (ticket, gates, turns, costUsd, wallMs,
   ctxPeak/ctxWindow/ctxCalls, overContextLine, workerResult) plus, new: `machine` on the start
   entry (platform, arch, node, short HEAD — a number with no environment is not a measurement),
   `workerSession` (transcript correlation), and `permissionDenials`.
4. **Retention and privacy:** rows carry ticket names and cost figures. Both are already public
   in committed research docs ($5.48 et al.), so committing rows adds no new exposure class;
   revisit before any row ever gains a field that is not already the repo's public voice.

`flags.mjs` reads a committed log directly (`pnpm flags .wayfinder/<effort>/log/<run>.jsonl`);
loop.md states the boundary review's evidence source; cloud-campaign 6.2 is unblocked and 6.4
now waits only on width > 1 (an execution.md stage), not on evidence survival.
