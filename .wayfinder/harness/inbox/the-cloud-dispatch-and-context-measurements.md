# The cloud measurements — dispatch, context, and the real verify cost

wayfinder:research
Status: open
Blocked by:
Claimed by:

## Objective

`docs/specs/cloud-campaign.md` landed items 8.1–8.7 and 8.10. **8.8 (conductor v2) and 8.9 (the
per-PR review check) are blocked on measurements that only a cloud container can take**, and were
deliberately not started rather than written against a guessed API. This ticket takes them.

It is a **measurement ticket, not a build ticket.** Nothing here changes behaviour except where a
finding is a one-line correction to a stale number. Answers land as a decision file and, where a
finding forces one, as tickets.

## The decision

### 6.1 — What dispatches a cloud session non-interactively?

The conductor must start a container against a branch and a prompt, with no human present, and
know when it finished. Establish, **by trying it, not by reading about it**:

1. The concrete invocation — API, CLI, GitHub Action, or scheduled workflow. Name the exact call.
2. **Credentials**: what the calling side needs, where it lives, and whether a GitHub Actions job
   can hold it. `ci.yml` currently declares `permissions: contents: read` on purpose (ADR-0011);
   say plainly whether dispatch needs more, and if so exactly what.
3. **Durability**: does the caller survive the session, or must the session report its own
   completion? This decides whether the conductor polls PRs or holds handles — a different
   conductor either way.
4. **Concurrency**: how many containers may run at once, and what happens at the limit — a queue,
   a refusal, or a silent drop. A silent drop would break the gate model, so find out which.

If dispatch turns out not to be available at all, **say so and stop** — that is a finding, and it
sends the campaign back to a long-lived container running `conduct.mjs`, which §6 already
contemplates. Do not build a workaround in this ticket.

### 7.1 — Can the cloud's MCP schemas be deferred?

The dispatcher measured **29.3k startup in cloud against 15.4k locally**, ~9.7k of it *Claude Code
Remote* MCP tool schemas. Locally those are deferred and cost nothing until fetched. This is the
single largest context lever in the system and the repo cannot touch it.

- Run `/context` in a cloud session and record the full breakdown verbatim.
- Establish whether that server can be deferred, disabled, or trimmed — by setting, by
  `.claude/settings.json`, or not at all.
- Re-run `/context` after each change and record the delta. **A setting that does not move the
  number is a finding too**, and worth writing down so nobody tries it twice.
- Confirm what the repo contributes in cloud (locally: `CLAUDE.md` 2.2k, skills 854, SessionStart
  ~400). If the repo's share is materially different there, that is worth knowing before anyone
  proposes shaving `CLAUDE.md` again.

### 6.3 — What does `pnpm verify` actually cost on a container?

`docs/specs/loop.md` says "~4s" and cites it as the reason this environment is lighter than the
legacy one. It is **16.1s locally** at `main@00c6ce3` (`next build` alone is 8.0s). Measure it on
a container, cold and warm, and **correct `loop.md` with the measured figure** — a stale constant
in a spec that other decisions cite is worse than no constant.

Also record `pnpm checkup`'s environment line and `scripts/provision.sh` wall time, since both
feed the campaign's preflight budget.

## Guardrails

- **Every figure carries its machine and commit.** `pnpm checkup`'s environment line has both;
  quote it. A number with no environment is not a measurement (`CLAUDE.md`).
- **Do not build the conductor here.** This ticket answers the questions 8.8 rests on. Building
  against answers found mid-session is how a measurement turns into an unreviewed design.
- The container is disposable and nothing outside git survives it — findings go in the repo
  before the session ends, not into a transcript.
- If a question cannot be answered, **say which one and why**, and leave the others answered.
  Partial-and-named beats delayed-and-complete here.

## Acceptance

- [ ] `docs/research/cloud-dispatch-and-context.md` records 6.1, 7.1 and 6.3 with the machine and
      commit each was taken on, including every attempt that did **not** work.
- [ ] `docs/specs/loop.md`'s verify figure is corrected to a measured one, or the ticket says why
      it could not be measured.
- [ ] `docs/specs/cloud-campaign.md` §7 and §8's measurement table are updated with the answers,
      and 8.8/8.9 are either unblocked with a named mechanism or re-blocked with a named reason.
- [ ] Any finding that forces work is filed as `.wayfinder/harness/inbox/<slug>.md` — no numbers
      (`.wayfinder/TRACKER.md`).
- [ ] `pnpm verify` green; `pnpm land`; PR opened and **not** merged by the session.
