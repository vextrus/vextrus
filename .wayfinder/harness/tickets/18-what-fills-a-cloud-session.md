# What fills a cloud session — the in-session budget, and whether any of it buys quality

wayfinder:research
Status: closed
Blocked by:
Claimed by: cloud-session 2026-08-13

## Objective

ADR-0013 measured the **startup** context on a container and cut it from 29.8k to 22.8k. That work
is done and is not to be redone. What it also did, inadvertently, is show how small that lever is:

| | tokens | share of the 1M window |
|---|---|---|
| startup, before ADR-0013 | 29.8k | 3.0% |
| startup, after ADR-0013 | 22.8k | 2.3% |
| **what ADR-0013 bought** | **7.0k** | **0.7%** |
| everything a working session puts there | unmeasured | **the other ~97%** |

The dispatcher's stated concern is *context degradation under Opus 5*. Degradation happens at the
**far end** of a session, and nothing in this repo has ever measured what gets a session there: a
73-turn ticket's `.loop` entry records turns and dollars and **not one token of context**.

So this ticket is about the 97%. It is a **measurement and instrumentation ticket, not a build
ticket** — except for the instrumentation named in §1, which is the prerequisite for everything
else and is small.

## The decision

### 1. Instrument the thing, because right now it cannot be seen

`conduct.mjs` already parses the worker's JSON result for `num_turns` and `total_cost_usd`. The
same object carries `usage`. Log the worker's **peak context** per ticket into `.loop/<run>/log.jsonl`
alongside them.

This is not a nice-to-have. `docs/specs/loop.md` says the boundary review's *"mandatory first
read"* is the pile of **sessions that crossed the context line**, and `scripts/loop/REVIEW.md`
carries a `{FLAGS}` placeholder for exactly that pile — **and nothing in the harness computes it.**
`grep -n "FLAGS\|context\|usage" scripts/loop/conduct.mjs` returns only a usage string. The one
mechanism the repo has for catching context-degradation defects is empty by construction, and has
been since ADR-0008. Fix that, and define "the context line" as a number rather than a phrase.

### 2. Measure what actually fills a session

Take a real ticket — one of takeoff's open ones, worked honestly, not a toy — and account for
where the context went. At minimum: tool results vs file reads vs `pnpm verify` output vs failed
attempts vs the model's own reasoning. Rank them by size, because the ranking is the finding.

Then measure the levers the repo already holds and has never tuned:

- `BASH_MAX_OUTPUT_LENGTH` is **50,000 characters ≈ 12.5k tokens per command** — over half a
  startup, for one `git log` that went long. Is that cap doing anything, or is it far above what
  any real command returns? A cap nobody hits is not a lever.
- `CLAUDE_CODE_MAX_OUTPUT_TOKENS` at 128,000.
- Whether delegating search to a subagent actually keeps the parent's context down, **measured**,
  not assumed — `CLAUDE.md` already restricts delegation to "large, genuinely independent
  investigation", and this either supports that rule or corrects it.
- Whether `pnpm verify`'s output on a red run is a material context cost. It is read in full,
  repeatedly, in the loop a session most needs to iterate fast.

### 3. The premise nobody has tested

ADR-0007 trimmed context because *"a thinner prompt is a sharper session"*. ADR-0013 trimmed more
on the same belief. **Nothing has ever tested it**, and the whole programme rests on it.

State plainly what evidence would settle it and whether it can be got here. A defensible cheap
version: over the campaign's own `log.jsonl`, does peak context correlate with gate failures,
turns-to-close, or boundary-review findings? A rigorous causal test is likely out of reach and
saying so is a valid answer.

**If it cannot be connected to an outcome, say that too** — and then the honest ruling is that
startup context is a hygiene item with a floor already reached, not a goal to keep optimising.
That conclusion is worth as much as the opposite one, and it stops the next three sessions
chasing 0.7%.

### 4. Two things ADR-0013 left unsettled

- **`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` is set in `.claude/settings.json` and the cloud image has
  no `bubblewrap`**, so every nested `claude` invocation dies. ADR-0013 documented this in
  `docs/TRAPS.md` and left the setting as it is; `conduct.mjs` already works around it per-spawn.
  That is a landmine directly under conductor v2, which spawns sessions for a living. **Rule it:**
  drop it, make it conditional, or keep it and require every spawner to override — with the
  reason, not a preference.
- **The deny list was measured but never exercised.** No session has run a whole ticket under it.
  Confirm a session can still open a PR, subscribe to its activity, and land normally with the 15
  denials in place. A refusal surfacing mid-ticket in an unattended container is the failure this
  check exists to prevent.

### 5. Still owed from the last brief

- **6.1 — what dispatches a cloud session non-interactively**: the exact call, its credentials,
  whether the caller survives the session, and what happens at the concurrency limit. **8.8 and
  8.9 stay blocked until this is answered**, and it is the highest-value unknown in the repo.
  If dispatch is unavailable, that is a finding — write it and stop, do not build a workaround.
- **6.3 — what `pnpm verify` costs on a container**, cold and warm. `docs/specs/loop.md` says
  "~4s"; it is 16.1s on the dispatcher's workstation at `main@00c6ce3`, `next build` alone being
  8.0s. Correct the spec with a measured figure. Verify speed is an iteration-rate lever and
  therefore a quality lever — it is the only number here that is both.

### 6. Audit the runner's appended prompt against `CLAUDE.md`

ADR-0013 found the runner appends ~15,000 characters including *branch instructions* and a *PR
protocol*. This repo has strict rules on both: a session never creates, renames or switches a
branch, and **never merges its own PR** (ADR-0010 amendment #2). Read the appended prompt in full
and report **every place it contradicts, softens, or duplicates** a `CLAUDE.md` rule.

Contradictory standing instructions are a quality defect in their own right, and a likelier cause
of a session doing the wrong thing than 7k of schema. Where a conflict exists and the repo cannot
remove the runner's half, `CLAUDE.md` has to win explicitly — propose the wording, do not apply it
here.

## Guardrails

- **Every figure carries its machine and commit.** `pnpm checkup`'s environment line has both.
  A number with no environment is not a measurement (`CLAUDE.md`).
- **Do not build the conductor**, and do not build a dispatch workaround. Instrumentation in §1 is
  the one exception and is bounded to logging.
- **Do not re-measure ADR-0013's startup table.** It is exact and reproducible. Re-take it only if
  `/context` disagrees with 22.8k, which the ADR already says is the trigger.
- Record what did **not** work as carefully as what did. A setting that moves nothing is a finding
  worth writing so nobody tries it twice.
- The container is disposable — findings land in the repo before the session ends.
- If a question cannot be answered, say which and why, and answer the others.
  Partial-and-named beats delayed-and-complete.

## Acceptance

- [x] `conduct.mjs` logs the worker's peak context per ticket; "the context line" is a number in
      `docs/specs/loop.md`, and `REVIEW.md`'s `{FLAGS}` can actually be filled.
- [x] `docs/research/what-fills-a-cloud-session.md` ranks the real consumers of a working
      session's context, with the machine and commit, and reports each lever's measured effect —
      including the ones that changed nothing.
- [x] §3 is answered one way or the other: either a stated relationship between context and
      outcome, or an explicit finding that none can be established here and why.
- [x] The `ENV_SCRUB` question is ruled, with its reason, and the deny list is confirmed by a
      session that ran a whole ticket under it.
- [x] 6.1 answered with a named mechanism, or named as unavailable; `loop.md`'s verify figure
      corrected; `cloud-campaign.md` §7–§8 updated and 8.8/8.9 unblocked or re-blocked with a
      reason.
- [x] The appended-prompt audit lists every contradiction with `CLAUDE.md`, with proposed wording
      where the repo must win.
- [x] New work filed as `.wayfinder/harness/inbox/<slug>.md`, no numbers (`.wayfinder/TRACKER.md`).
- [x] `pnpm verify` green; `pnpm land`; PR opened and **not** merged by the session.

## Build note

`docs/research/what-fills-a-cloud-session.md` carries every figure with its machine and commit
(cloud container, `6c6e001`, CLI 2.1.231). §1's parser was checked on this container **first** and
holds — `ctxPeak` non-null, window 1,000,000 — so nothing below rests on a Windows-only parse.

**The ranking:** across a research session (peak 126,664) and a real build ticket run through the
worker path (peak **176,003**, 118 turns, 20.7 min, $5.48, **over the line**), growth is roughly
half the model's own generation — invisible, the transcript stores every `thinking` block with
zero characters — a third to a half tool return dominated by a long tail of ~1,000-character
`Bash` results, and a rounding error of everything the harness controls. The repo's two nominal
levers were **never once reached**: `BASH_MAX_OUTPUT_LENGTH` 50,000 would need cutting 4–7×
before it clipped anything, and `pnpm verify` is under 1,000 tokens on every path — a **red run
prints less than a green one**, because verify fails fast. Delegation is the one lever that
works: **4.1×** measured. §3 is ruled **unanswerable here**, structurally: `.loop/` is gitignored
and dies with its container (n=0 by design), and context and difficulty are confounded — the one
flagged session in repo history crossed the line for reasons that had nothing to do with the flag.

**`ENV_SCRUB` ruled: keep the setting, provision the dependency.** `apt-get install -y
bubblewrap` was all it ever needed; the identical nested session then succeeds *under* the scrub.
`provision.sh` installs it, `checkup` reports it, and `conduct.mjs`'s silent per-spawn `=0` is
gone in favour of a preflight that refuses by name. **6.1 answered and it is a refusal:**
`create_session` exists, is unreachable three ways, and the container holds **no durable
credential** (OAuth arrives as a file descriptor), so an in-container conductor is structurally
impossible and the CI one is unfunded — 8.8/8.9 re-blocked on a repository action, not a
measurement. **6.3: 43.9s**, not `loop.md`'s ~4s, with no cold/warm distinction to quote.

The deny list held across a whole ticket. What did not hold was a control the repo does not
configure: an auto-mode **permission classifier** refused three actions mid-ticket and needed a
human to clear — the unattended-refusal failure §4 exists to catch, through a door nobody watched.

**Next ticket should know:** six items in `inbox/`, and two are load-bearing for conductor v2 —
the loop log does not survive a container (so 6.2 and 6.4 have no source), and the worker spawn
line does not run on a cloud container at all (root + untrusted workspace). Proposed `CLAUDE.md`
wording for the nine appended-prompt conflicts is in §9 and is **not applied here**.
