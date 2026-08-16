# The harness — planning and executing the takeoff module

**Status:** **accepted 2026-08-16** (proposed and accepted the same day; the founder accepted
both §5 amendments and directed that A1 be built immediately) · **Date:** 2026-08-16.
**Supersedes:** nothing. **Constrains:** no product code — this is workflow, so it lives in a spec and
in `docs/tracker.md`, never in an ADR (`genesis-ii.md` §3).
**Evidence:** `docs/research/harness-2026-08.md` §10–§15 (2026-08-16, primary sources) and the
measurements in §7 below. Every claim here traces to one of those, to an ADR, or to a run in this
session.

---

## 1. The destination

The takeoff module is planned as one shared map on the tracker and built as a stream of small,
self-contained tickets, each executed in a fresh session that starts at ~14k of context, cites the
domain clause it implements, and ends in a pull request whose green CI is the only thing that can
merge it. The founder decides two things — **where the map goes**, and **whether a diff may land** —
and nothing else. Everything between is mechanical: the frontier query says what is next, `pnpm
verify` says whether it works, `/code-review` in a fresh context says what the author could not see,
and GitHub's branch protection says nobody may skip either. The harness is the shape of that
sentence; it is not software we own, and every part of it is a surface Anthropic or GitHub already
ships.

## 2. What this spec is not

The first founding died of harness-before-product: 4,349 lines of scripts, nine of sixteen ADRs about
the repo building itself, and **zero build tickets emitted** (`genesis-ii.md` §3). Four rules keep
this one different, and each is checkable against this document:

1. **The product foundation exists and is verified.** Register spine, both seams, the model ledger,
   CI, protected `main` — `pnpm verify` green in 11.4–13.4 s, `pnpm test:db` green live (§7).
2. **The harness is sized to a counted backlog, never speculative.** Nothing in §5 is built before
   the number that justifies it exists. Today that number is **zero build tickets**, so today the
   dispatcher is a human, and that is the correct answer, not a deferral.
3. **The dispatcher is chosen from what Anthropic ships, not built.** Research §11 inventories eleven
   surfaces; §4.4 picks one and rejects the rest by name.
4. **Every piece is measured.** §8 names what is watched, and §9 the numbers at which this spec has
   succeeded or failed.

A fifth rule is inherited and unchanged: *nothing may be justified by a workflow it would enable
later.* Where this spec proposes a thing whose justification is future work, it says so and gates it
on a count.

## 3. The pipeline

```
planner → contracts → graph → dispatcher → executor → verifier → evaluator → merge
```

Read it as Anthropic's planner / generator / evaluator (research §11.1) with three of our own parts
named separately, because in this repo they are separately enforced: the **contract** (a ticket that
cites a clause), the **graph** (Issues, with typed edges), and the **merge** (a human, on green CI).

### 3.1 Planner — `/wayfinder` with the founder

**Surface:** the bundled plugin skill, founder-invoked (`disable-model-invocation: true`), HITL, one
issue labelled `wayfinder:map`. Its body carries Destination / Notes / Decisions so far / Not yet
specified / Out of scope; decision tickets are sub-issues; the frontier query is the ready set.

**Shape for a whole module.** The map's **Destination names the whole takeoff module**; **charting
goes only as far as the fog can be stated now**. The two are not in tension — the skill's own rule is
"don't chart what you can't yet see … Don't pre-slice the fog into ticket-sized pieces". The tracker's
existing rule ("a map that resolves more than five decisions without emitting a build arc is charted
too wide") is the guard that keeps a module-wide destination from becoming a module-wide chart. Arcs
are labelled `arc:<name>` so `/to-spec` can be pointed at one arc's resolved decisions rather than
at the whole map.

**Alternatives rejected.** *One map charted module-wide up front* — the skill's own field report:
"I charted 27 tickets, and by the time I got to the thirteenth, the rest no longer made sense"
(research §10). *Nested maps / a map of maps* — absent from every source read; each session would
have to be taught a structure the skill does not know, and even map closeout is undefined upstream
(#823). *Several sequential maps* — fragments Decisions-so-far across maps, and that index is the one
thing a fresh session reads.

### 3.2 Contracts — the build ticket

**Surface:** `/to-spec` then `/to-tickets` (both founder-invoked), emitting sub-issues on the plugin's
template: `## Parent` · `## What to build` · `## Acceptance criteria` · `## Blocked by`.

**Three fields we add**, recorded in `docs/tracker.md` so every session sees them:

- `## Clause` — the numbered section of `docs/domain/` the ticket implements. CLAUDE.md already
  requires it; the ticket is where it becomes checkable.
- `## Verification` — **the command whose exit code decides**, plus the named refusal cases that must
  fire. This is the field the plugin's template lacks and Anthropic's best-practices requires: "The
  most useful specs are self-contained: they name the files and interfaces involved, state what is out
  of scope, and end with an end-to-end verification step that proves the feature works." `/goal`'s
  anatomy is the model: "One measurable end state … A stated check … Constraints that matter."
- `## Out of scope` — present in the plugin's *spec* and triage brief, absent from its ticket.

**Alternatives rejected.** *Naming files in the ticket* — the plugin's reason ("they go stale fast")
is right for a module whose files do not exist yet; the clause is the stable anchor and it is
versioned in git. *A `/triage` Agent Brief* — that surface is for inbound reports, and this repo
triages none (`docs/agents/issue-tracker.md`: "PRs as a request surface: no").

### 3.3 Graph — GitHub Issues, unchanged

Nodes are issues typed by label; the two native, UI-visible edges are sub-issue (parent) and
`blocked_by`; the claim is the assignee; the frontier query is the scheduler's ready set. All of it
is exercised (`docs/tracker.md`). Research §10.1 lists what the graph-engineering literature asks for
that we lack; the rulings:

| ask | ruling |
|---|---|
| budgets per node | **Per ticket *class*, not per ticket** (§7). A per-issue token field is a number nobody would maintain and no source measures. |
| atomic claim (the read→claim TOCTOU that let two upstream sessions resolve one ticket "one second apart") | **Closed by seriality** — one executor at a time. The documented alternative, a lock file in git (research §11.1), is needed only above one concurrent executor and lands with §5.A1 if it does. |
| mid-ticket checkpoint | **Stays manual**: an abandoned claim is unassigned with a comment saying where it stopped. A session that dies mid-ticket leaves a branch; the ticket is re-claimed and the branch is read. |
| trajectory logs | **Declined.** No source measures a benefit on a small repo, and the tracker's "one paragraph, no transcript" is a deliberate anti-sprawl rule. The diff, the PR body and `docs/lessons/` are the record. |
| semantic edges beyond two | **Declined.** "Supersedes" is an ADR convention; "implements" is the `## Clause` line. |

### 3.4 Dispatcher — the founder, and one accepted workflow

**Nothing Anthropic ships reads GitHub Issues as a queue** (research §11): Routines' GitHub triggers
are Pull request and Release only; the Action fires per event and knows nothing of `blocked_by`;
`/batch`, dynamic workflows and agent teams decompose their own task lists; `--max-turns` and
`--max-budget-usd` exist only in print mode. So a picker+launcher is the one genuinely missing piece,
and it has exactly three shapes: **GitHub as picker** (an event), **a cloud scheduler as picker** (a
poll), **a shell as picker** (a loop).

**Today: the founder is the dispatcher.** `/clear`, run the frontier query from `docs/tracker.md`,
take the first row. This is not a placeholder — it is the honest reading of where wall time goes: the
pick is seconds, the session is minutes, CI is ~80 s. Automating the pick buys seconds; the levers
that buy minutes are ticket quality, verify speed, and parallelism.

**The amendment (§5.A1)** is the issue-triggered GitHub Action, because it is the only surface where
GitHub itself is the picker (no polling), state stays in Issues, CI runs on its pushes, and merge
stays human. **Accepted and built 2026-08-16** as `.github/workflows/agent.yml` (§5.A1): it fires
only on `issues.labeled` with `ready-for-agent`, refuses by name if the ticket is blocked, already
claimed, or missing its `## Clause` / `## Verification` sections, and runs serially. The founder
keeps the dispatcher's own switch — a ticket is dispatched by applying the label, and by nothing
else.

**Alternatives rejected.** *Routines* — no `issues` event, ≥1 h poll, state in claude.ai rather than
Issues, no dollar cap, and "A green status … does not mean the task in your prompt succeeded".
*Agent teams* — a second task list beside Issues, and "In non-interactive mode with the `-p` flag …
Claude doesn't spawn teammates". *`/batch` and dynamic workflows* — they decompose one instruction and
never read the tracker. *Worktree or `--bg` fan-out* — forfeits the prompt cache ("the cache is
effectively scoped to one machine and directory … That includes worktrees of the same repository")
and raises the cross-agent merge-conflict rate from 19.8% to 41.7% (arXiv 2607.04697). *A committed
`claude -p` loop* — Ralph's shape; the shipped `ralph-loop` plugin is a Stop hook that re-injects the
same prompt into the **same** session, with bounds that are currently broken upstream (research §14).

### 3.5 Executor — one fresh session per ticket

**Surface:** an ordinary interactive session in this repo. It reads `CLAUDE.md`, claims the ticket,
opens `issue-<n>-<slug>`, implements the clause, runs `pnpm verify` (and `pnpm test:db` if it touched
`db/` or `src/core/db.ts`), runs `/code-review`, opens one PR naming the assumption, waits for CI,
squash-merges. That flow is written into `docs/tracker.md` by §10's issue — today it exists only in
session briefs, which is why a fresh session cannot yet be told only "take the first row".

**Alternatives rejected.** *A project skill (`.claude/skills/build-ticket`)* — the procedure belongs
in `docs/tracker.md`, which a session reads on its way to the frontier query and which costs no
startup context; a skill body would sit in context for the rest of the session (capped at 5,000
tokens per skill). *`claude -p --bare`* — `--bare` skips CLAUDE.md, so the executor would run without
the law. *A subagent executing a whole ticket* — a background subagent never gets `AskUserQuestion`,
so a refusal that needs the founder cannot surface, and CLAUDE.md forbids delegating your own review.

### 3.6 Verifier — `pnpm verify`, `pnpm test:db`, CI

`pnpm verify` is the contract (ADR-0007): typegen → tsc → eslint → vitest → schema-drift → ruff →
pytest → next build, fail-fast, uncached, **11.4–13.4 s**. `pnpm test:db` is the live seam test, on
demand locally and on every push in CI. Protected `main` requires the CI job `verify`.

**What makes it "nearly perfect", in the C-compiler post's sense** — "it's important that the task
verifier is nearly perfect, otherwise Claude will solve the wrong problem":

- **The domain's refusals are the eval set.** Reason codes are closed enums; a refusal test is exactly
  Anthropic's eval recipe ("20-50 simple tasks drawn from real failures"; "two domain experts would
  independently reach the same pass/fail verdict"). The gap today: **nothing asserts that every closed
  reason code is exercised by name.** §10's issue closes it, giving CLAUDE.md's "refuses or defers with
  a named reason" the mechanical enforcement every other NEVER already has.
- **Guardrails fail closed**, each with a fixture test proving the rule fires (ADR-0007).
- **Regression is guarded from the start** — the C-compiler post added CI late, "near the end of the
  project", after "Claude started to frequently break existing functionality"; ours has run on every
  push since founding.
- **Nothing may be weakened**: "It is unacceptable to remove or edit tests" is Anthropic's line and
  CLAUDE.md's NEVER; the landed-migration guard (#85) is its schema-side twin.

**Rejected:** folding `pnpm test:db` into `pnpm verify` — ADR-0007's stack-independence; a daemon
inside verify makes green depend on the machine.

### 3.7 Evaluator — `/code-review` in a fresh fork, then the human

**Surface:** the bundled `/code-review`, run by the executor session **before** it opens the PR. It
runs "as a background subagent with its own context window", forked so it "reads the parent's cache",
and it "follows your `CLAUDE.md`". Cost: "seconds to a few minutes", normal usage.

**Level, and the threshold.** `medium` by default; `high` when the diff touches `db/`,
`db/migrations/`, `src/core/db.ts` or `src/core/model.ts`. The docs are explicit that the level *is*
the confidence dial — "At `low` and `medium`, the review reports only the findings it's most confident
in … `high` through `max` broaden coverage and may include findings the review is less sure about" —
and equally explicit that **no numeric threshold exists**. So the threshold is stated in words and
belongs in the PR body: *a finding blocks the PR if it names a correctness defect or a stated
requirement the diff misses; everything else is recorded and left.* That is the docs' own brake — "A
reviewer prompted to find gaps will usually report some, even when the work is sound … Chasing every
finding leads to over-engineering."

**Alternatives rejected.** *A custom evaluator subagent* (`.claude/agents/reviewer.md`) — the bundled
skill already runs in a fresh fork, reads CLAUDE.md, and costs zero custom agents. *`/code-review
ultra` per ticket* — $5–25 and 5–10 minutes each; reserved for a diff the founder flags. *`/goal` in
the executor session* — bounded and cheap, but its evaluator "doesn't run commands or read files
independently", so it would grade pasted output while `pnpm verify` grades the tree; and Claude 5's
own guidance is that explicit verification instructions cause over-verification.

### 3.8 Merge — the human, on green CI

`gh pr merge --squash --delete-branch`, never `--admin`. Protected `main`: required check `verify`,
`enforce_admins: true`, linear history, no force-push. Already in force since 2026-08-16.

## 4. What runs today under §3 unchanged

Everything in §3 except §3.4's amendment. Specifically: no custom agent, no second hook, no script
that runs Claude, no new ADR, and no product code beyond §10's refusal-coverage test. The three
tracker-doc changes (§3.2's fields, §3.1's arc label, §3.5's session flow) are workflow, which §3
places in `docs/tracker.md` by name.

## 5. Amendments to `genesis-ii.md` §3 — **accepted 2026-08-16**

Both were accepted by the founder on the day they were written, and both now stand as dated
amendments under `genesis-ii.md` §3, which is the authoritative text. The founder additionally
directed that **A1 be built immediately rather than at the ≥ 8-ticket gate this section proposed
for it**, having authorised harness-before-product explicitly. What that changes, stated plainly:
the count now governs when the dispatcher is *used*, not when it is written. The workflow is inert
until an issue carries `ready-for-agent` — it has no schedule, no poll and no daemon — so writing
it early costs one file and buys the first arc a dispatcher that is already tested. What it does
*not* buy is exemption from §8: if the metrics there go the wrong way, the workflow is deleted,
and that is a one-line change.

### A1 — a committed workflow may run Claude, for one purpose, above one number

**Proposed text** (to be added to §3 as a dated amendment, not an edit):

> *Amendment, 2026-08-\_\_:* §3's "no script that runs Claude" admits exactly one exception: a single
> GitHub Actions workflow that runs `anthropics/claude-code-action` when an issue is labelled
> `ready-for-agent`, provided (a) the backlog it serves is counted and open, (b) it opens no PR that a
> human does not merge, (c) it adds no state outside GitHub Issues, and (d) its cost and defect rate
> are recorded in `docs/specs/harness.md` §8. Any second such workflow needs its own amendment.

**Evidence for it.** Research §11: the Action is the only shipped surface where the picker is GitHub
itself (no polling, no daemon, no second task list); it guarantees a fresh context per run; it leaves
state in Issues; CI runs on its pushes when it authenticates as the Claude App; and it *cannot* merge
("Cannot merge, rebase, or execute git operations beyond pushing commits"; "cannot approve pull
requests"), so the human verdict survives by construction. Machinery: one workflow file, one secret,
one `gh` step that refuses a blocked issue and claims by assignee. Bounds: `--max-turns` in
`claude_args`, job `timeout-minutes`, a `concurrency` group.

**The fault it must not reproduce**, and how it is prevented: *harness before product*. The workflow
is not written until the first `/to-tickets` run has produced **≥ 8 open, unblocked `ready-for-agent`
build tickets**. Below that number the founder dispatching by hand is faster than writing the
workflow, and the count is public in the tracker, so the trigger cannot be fudged.

**Recommendation: accept the amendment text now; build at the count.** Accepting costs nothing and
removes a decision from the critical path of the first build arc.

### A2 — more than one executor at a time

**Proposed text:**

> *Amendment, 2026-08-\_\_:* more than one executor session may run concurrently only when the
> tickets are provably independent (no shared file named in either ticket's `## Verification`, no
> `blocked_by` relation), and the claim is taken before any read of the code.

**Evidence.** Parallelism is the only lever that shortens wall time by more than seconds — and it is
the one with measured downside: cross-agent merge-conflict rate 41.7% vs 19.8% within one agent
(arXiv 2607.04697); "Having 16 agents running didn't help because each was stuck solving the same
task" (Anthropic); and a worktree fan-out forfeits the prompt cache. Seriality also closes the claim
race for free (§3.3).

**The fault it must not reproduce:** two sessions resolving one ticket, which is a documented upstream
failure, and two branches touching one file, which is the 41.7%.

**Recommendation: accept, but do not use it until A1 is built and ten serial tickets have merged** —
the defect rate of one executor is the baseline against which a second is judged.

### Not proposed, and why

- **A `PreToolUse` hook refusing edits to landed migrations** — CI enforces it (#85) and verify's
  drift stage covers the schema side; a second hook buys minutes of earlier feedback at the price of
  the one-hook rule. *Refuse* (unchanged from research §9.1).
- **A `Stop` hook running `pnpm verify`** — 12 s per turn end, overridden after 8 blocks, and verify
  already runs before every commit and on every push. *Refuse* (research §9.2).
- **A custom evaluator subagent** — §3.7. *Refuse* (research §9.3).
- **`/goal`, `/loop`, Routines, agent teams, `.claude/workflows/`** — §3.4, §3.7. *Refuse.*

## 6. The environment

- **Startup context budget: ≤ 15k. Measured 12.3k** on 2026-08-16 after #89 denied `SendUserFile`
  and `ListAgents` by bare name — down 1.6k from 13.9k (system tools 6.7k · system prompt 3.5k ·
  memory 2.0k · skills 1.6k), with 9.7k of tool schemas deferred and costing nothing. A change that
  pushes startup above 15k is a defect to fix, not a new baseline.
- **Tool set.** Denied by bare name: the tools this project never calls (`.claude/settings.json`).
  `AskUserQuestion` stays — it is how the HITL skills speak to the founder, and no subagent ever gets
  it. Deferred tools cost names only and are left alone. **Never deny a tool mid-session** — built-in
  tool definitions live in the system-prompt layer, so it recomputes the whole request.
- **Model and effort per ticket class** — default effort on every class, per Anthropic's "for most
  tasks you should use the model's default effort level"; the class chooses the *model*, not the dial:

  | class | examples | model | why |
  |---|---|---|---|
  | mechanical | a migration, a lint rule, a pure function with golden vectors, a doc change | **Sonnet 5** | $2/$10 per MTok, 1M context on every plan; "Medium effort: … Comparable to Claude Sonnet 4.6 at high effort" |
  | subtle | the seams (`db.ts`, `model.ts`), identity keys, the gate, a refusal taxonomy, anything in `docs/domain/` | **Opus 5** | $5/$25; the cost of a wrong seam is a migration, not a diff |
  | planning with the founder | `/wayfinder`, `/to-spec`, `/to-tickets`, `/grilling` | **Fable 5** | "Lower effort settings … still perform well and often exceed `xhigh` performance on prior models" |
  | review | `/code-review` | inherits | level `medium`, or `high` on the seams (§3.7) |

  Escalate a class only on evidence: raise effort when the session "skipped a file, not running the
  tests"; raise the model when it "clearly tried and still got it wrong".
- **Timeouts.** Bash 600 s default / 900 s max (`.claude/settings.json`); `pnpm verify` fails fast, so
  a hung stage is visible in seconds. No session-level cap is configured — the human ends the session,
  and under A1 the job's `timeout-minutes` is the cap.
- **`/clear` discipline.** One ticket per session; `/clear` between tickets — "`/clear` costs
  nothing", and "A clean session with a better prompt almost always outperforms a long session with
  accumulated corrections". **Never `/compact` inside a build ticket**: compaction of a large context
  is itself a large request, and a ticket that needs it was mis-sized — record that on the issue
  (upstream's own numbers: ">100k tokens is normal … 150k … too big").

## 7. Measured, 2026-08-16 (WSL2 Ubuntu 24.04, Node v24.19.0, pnpm 9.15.1)

- `pnpm verify` **11.4–13.4 s** — typegen 0.4 · typecheck 2.4 · lint 0.9 · test 2.6–4.6 ·
  schema-drift 0.6 · ruff 0.0 · pytest 0.4 · build 4.1. Was 13.5–14.9 s before #91.
- `pnpm test:db`: see `genesis-ii.md` §7. Vitest suite: 36 tests, 6 files, 2.4 s.
- CI (`ubuntu-latest`, cold): whole job ~80 s, of which `pnpm verify` ~24 s.
- One PR through the protected gate: ~1.5–2 min from push to mergeable. A PR produces **two**
  `verify` check-runs on one commit, created up to 25 s apart; both gate the merge.
- **The dispatcher, verified live 2026-08-16** on smoke issue #107, with no Anthropic secret set:
  run `31941273131` detected `SECRET_MISSING` and could announce none of it (`gh` has no git
  remote before `actions/checkout` — `docs/lessons/gh-infers-the-repo-from-a-git-remote-that-may-not-exist.md`);
  run `31941479863`, after the fix, **refused by name, posted the comment, and removed the label**.
  Three further runs were correctly **skipped** by the `if` guard when an issue was labelled
  `harness`, `wayfinder:task` and `ready-for-human`. Also measured: re-applying a label already
  present fires **no** event, which is why a refusal removes it.

## 8. Metrics watched

Recorded in the PR body of each build ticket (the tracker is mutable state; the working tree is not):

| metric | source | why |
|---|---|---|
| startup context | founder's `/context`, once per environment change | the budget in §6 |
| `pnpm verify` wall time | its own output, in the PR | ADR-0007: slower is a defect |
| minutes and tokens per ticket | `/usage` at session end | the only honest wall-time number |
| tickets merged per day | GitHub | throughput, against the map's remaining tickets |
| defects that reach review | `/code-review` findings that changed the diff | the executor's first-pass yield (expect low: the best published figure for issue-driven work is 10–20%) |
| **defects that reach `main`** | a revert, a follow-up fix, or a new `docs/lessons/` file | the only metric that can fail this spec |

First observations, 2026-08-16 (the harness building itself, so they are a floor rather than a
sample of real tickets): eight tickets merged in one session; `pnpm verify` 11.2–13.4 s throughout;
one defect reached `main` — the dispatcher's mute gate (#108), caught by the first smoke run and
fixed the same session, which is the loop working rather than failing. The dispatcher is live and
has executed no build ticket: its `SECRET_MISSING` path is the only one exercised.

## 9. Exit criteria

1. A brand-new session, told only "read `CLAUDE.md`, run the frontier query in `docs/tracker.md`, take
   the first row", completes a build ticket end to end — claim, branch, clause, verify, review, PR,
   CI, merge — without asking the founder anything except the merge.
2. Ten consecutive build tickets merged with **zero defects reaching `main`**.
3. Median minutes per ticket and median cost per ticket recorded for those ten.
4. `pnpm verify` still under 20 s and startup context still under 15k at ticket ten.

Failing 2 twice in a row retires this spec's autonomy claim and returns execution to attended
sessions — that is the honest stop condition, and it is cheaper than any recovery mechanism.

## 10. The build issues that realise this spec

| # | issue | needs an amendment? |
|---|---|---|
| 1 | **this spec** — `docs/specs/harness.md`, accepted 2026-08-16 | no |
| 2 | `docs/tracker.md`: the build-ticket contract (`## Clause`, `## Verification`, `## Out of scope`), the `arc:<name>` label, and the build-session flow a fresh session follows from claim to merge; `CLAUDE.md` gains the one line it lacks | no |
| 3 | **the refusal-coverage test**: every closed reason-code enum in the repo is exercised by name inside `pnpm verify`, so CLAUDE.md's "refuses or defers with a named reason" gets the mechanical enforcement its siblings have | no |
| 4 | the dispatcher workflow (§5.A1) — `.github/workflows/agent.yml` | A1 **accepted**; built 2026-08-16 by founder direction, inert until a ticket carries the label |
| 5 | the dispatch section of `docs/tracker.md` — the independence test (§5.A2), how a ticket is dispatched, and the one-line switch from serial to parallel | A2 **accepted**; the switch stays serial until ten tickets have merged |

All five were opened and merged by the session that wrote this spec — issues **#95, #97, #99, #105,
#110** — together with two the spec did not foresee: **#103**, accepting the amendments, and
**#108**, the dispatcher's gate being unable to *post* its refusal (found by running it, not by
reading it). Two operational preconditions remain the founder's, and the workflow refuses
`SECRET_MISSING` by name without them: the **Claude GitHub App** installed on the repository, and
an **`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` secret**.
