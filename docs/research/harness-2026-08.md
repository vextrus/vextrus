# The harness, re-examined — Claude Code with Fable 5 / Opus 5, August 2026

**Date:** 2026-08-16. **Question:** what is the current, documented best practice for running an
agentic coding harness on Claude Code with the Claude 5 family, and which of it earns a place in
this repository under `docs/specs/genesis-ii.md` §3 (zero custom agents; hooks = one `SessionStart`
checkup; no script that runs Claude; nothing justified by a workflow it would enable later)?
**Sources:** primary only — `code.claude.com/docs`, `platform.claude.com/docs`,
`anthropic.com/engineering`, `claude.com/blog`, the `anthropics/claude-code` CHANGELOG (v2.1.233 at
fetch), and, for the field's vocabulary, the posts that coined the terms. Two subagents did the wide
reading (their raw notes are longer than this file; what is here is what a decision turns on).
Docs pages carry no publication dates — they carry version gates (`Requires v2.1.NNN`), recorded
where the docs give them. **Applied:** §7 below. **Measured:** §8. **Proposals for the founder:** §9.

## 1. The one-line summary

Anthropic's own direction is *less harness, not more*: "We removed over 80% of Claude Code's system
prompt for models like Claude Opus 5 and Claude Fable 5 with no measurable loss"
(claude.com/blog, 2026-07-24). The best-practices doc now opens with "give Claude a way to verify
its work" — a check that returns pass or fail — and the largest measurement of harness configuration
in the wild (arXiv 2602.14690, 2,853 repositories, 2026-02-16) finds context files dominate and are
"often the sole mechanism"; skills and subagents are rarely adopted. Anthropic's own usage research
(~400k sessions, 2026-06-16) finds *expertise*, not machinery, moves verified success from 15% to
28–33%. This repository — one `pnpm verify`, a lean `CLAUDE.md`, the law in `docs/domain/`, mutable
state in Issues — is already the shape the evidence favours. What follows is the detail and the
handful of changes that survived it.

## 2. CLAUDE.md and memory (code.claude.com/docs/en/memory, /best-practices)

- CLAUDE.md is "delivered as a user message after the system prompt", advisory, not enforced:
  "Settings rules are enforced by the client regardless of what Claude decides to do. CLAUDE.md
  instructions shape Claude's behavior but are not a hard enforcement layer." Enforcement belongs
  in hooks — or, in this repo, in lint rules and CI, which are enforcement of the same kind with
  no session dependence (spec §7: every NEVER names its mechanical enforcement).
- Size: "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce
  adherence." Stated in four places. The pruning test: "For each line, ask: *Would removing this
  cause Claude to make mistakes?* If not, cut it." Failure mode named: "The over-specified
  CLAUDE.md … Claude ignores half of it." `/doctor` (v2.1.206+) proposes trims of anything
  derivable from the codebase.
- Include: commands Claude can't guess, conventions that differ from defaults, repository
  etiquette, gotchas. Exclude: anything derivable by reading code, file-by-file descriptions,
  "write clean code". Add a line when "Claude makes the same mistake a second time", "a code review
  catches something Claude should have known", "you type the same correction … that you typed last
  session".
- `@path` imports load in full at launch: "helps organization but doesn't reduce context". Only
  `.claude/rules/*.md` with `paths:` frontmatter and skills defer. Path-scoped rules and nested
  CLAUDE.md are lost after compaction until a matching file is read again; the root CLAUDE.md is
  re-injected.
- **Auto memory** (`autoMemoryEnabled`, default `true`): Claude-written "learnings and patterns"
  in `~/.claude/projects/<repo>/memory/` — machine-local, unreviewed, not in git, not seen by CI
  or another machine, not inherited by subagents; the first 200 lines / 25 KB of `MEMORY.md` load
  every session. The changelog never dates its introduction.
- Claude 5 prompting (platform.claude.com …/prompting-claude-opus-5, …/migration-guide): "remove
  explicit verification or self-check instructions carried over from prompts tuned for earlier
  models; leaving them in causes over-verification"; visible responses run longer on Opus 5 and
  lowering effort "reduces thinking volume without reliably shortening the visible response —
  prompt explicitly for conciseness"; Opus 5 "delegates more readily than earlier models" — cap it
  or say when to delegate. Fable 5 usage guidance (code.claude.com/docs/en/model-config): "Describe
  the outcome, not the steps"; "Skip the verification reminders". The still-live best-practices
  line endorsing "IMPORTANT / YOU MUST" emphasis is older than this and unreconciled with it; the
  model-specific guidance is the newer.
- Explore and Plan subagents "skip your CLAUDE.md files and the parent session's git status" —
  anything a delegated reader must know rides in the delegation prompt.

## 3. settings.json, permissions, `/context` (…/settings, /permissions, /context-window, /costs)

- Precedence: managed → CLI → local → project → user; arrays merge and deduplicate across scopes,
  scalars override. `disallowedTools` is **not** a settings key (a CLI flag and frontmatter field
  only); `permissions.deny` is the settings form.
- Evaluation "deny, then ask, then allow — the first match … determines the outcome". **A bare
  tool name in `deny` (`Bash`, `Bash(*)`, a bare-name glob such as `mcp__*`) removes the tool from
  Claude's context entirely**; a scoped rule (`Bash(rm *)`) leaves the schema and blocks the call.
  MCP forms: `mcp__server` (every tool of the server), `mcp__server__*`, `mcp__server__tool`;
  claude.ai connectors appear as `mcp__claude_ai_<server>__<tool>`. So the server-level deny names
  this repo already carries (`mcp__claude_ai_Gmail` …) are the documented form and do prune —
  there is no MCP-specific sentence, only the generic bare-name rule plus `mcp__*` as a worked
  example (recorded as an inference, not a quote).
- Levers that reduce startup context, in the docs' words: bare-name deny (the only lever that
  prunes a tool schema); `disable-model-invocation: true` on a skill or `skillOverrides: off`
  ("reduces context cost to zero for skills you only trigger yourself"); `disableBundledSkills`;
  MCP tool search on by default (names only until used); prefer CLI tools — "`gh` … still more
  context-efficient than MCP servers because they don't add any per-tool listing";
  `includeGitInstructions: false` removes the git workflow text *and the git status snapshot*;
  keep CLAUDE.md under 200 lines; delegate reads to subagents; `/clear` between tasks.
- `/context [all]` is the measurement — "a live breakdown by category … including which CLAUDE.md
  and auto memory files loaded"; `/cost` is an alias of `/usage`. The docs' representative
  startup numbers (labelled illustrative): system prompt 4,200 · auto memory 680 · environment 280
  · MCP names 120 · skill descriptions 450 · user CLAUDE.md 320 · project CLAUDE.md 1,800.
  There is no `/stats` command.
- Effort: default `high` on Opus 5, Sonnet 5 and Fable 5 on the API and in Claude Code; `xhigh`
  is the default only on Opus 4.7. Anthropic's 2026-07-07 post: "for most tasks you should use the
  model's default effort level". `effortLevel` in settings accepts `low|medium|high|xhigh` (not
  `max`). Changing effort mid-conversation invalidates the prompt cache. Thinking is on by default
  across the 5 family and cannot be turned off on Fable 5.
- Costs published: "$13 per developer per active day", "$150–250 per developer per month", "below
  $30 per active day for 90% of users"; background token use "under $0.04 per session".
- v2.1.233: TodoWrite / TaskCreate tools are off by default on Sonnet 5, Fable 5, Opus 4.8+
  (`CLAUDE_CODE_ENABLE_TODO_TOOLS=1` restores them). Opus 5 needs Claude Code ≥ v2.1.219.

## 4. Hooks, skills, subagents, plugins (…/hooks, /skills, /sub-agents, /plugins)

- Hooks: ~30 events now (`SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolBatch`, `Stop`,
  `SubagentStop`, `PreCompact`, `InstructionsLoaded`, `ConfigChange`, `WorktreeCreate` …); five
  handler types (`command`, `http`, `mcp_tool`, `prompt`, `agent`); exit 2 blocks on blocking
  events; `SessionStart` stdout is added to context (this repo's checkup line) and cannot block.
  Anthropic's framing: "Put guardrails in hooks. An instruction like 'never edit `.env`' in
  CLAUDE.md … is a request, not a guarantee. A `PreToolUse` hook that blocks the edit is
  enforcement." A `Stop` hook running a check is the docs' third gating tier — and "Claude Code
  overrides the hook and ends the turn after 8 consecutive blocks", so it is not a hard gate.
  Context cost of hooks: "Zero, unless the hook returns output".
- Skills: `.claude/skills/<name>/SKILL.md`; descriptions load at start (~450 tokens in the docs'
  example), the body on invoke — and **the body then stays in context for the rest of the
  session**, re-attached after compaction (5,000 tokens per skill, 25,000 total). Keep under 500
  lines. `.claude/commands/` is merged into skills, not deprecated. Since v2.1.215 Claude "no
  longer runs the `/verify` and `/code-review` skills on its own". `skillOverrides` does not
  apply to plugin skills.
- Subagents: `.claude/agents/*.md` (frontmatter `model`, `tools`, `effort`, `isolation:
  worktree` …). Built-ins: Explore (read-only, skips CLAUDE.md), Plan, general-purpose. "Since
  context is your fundamental constraint, subagents are one of the most powerful tools available";
  results reach Claude as summaries (Anthropic: "often 1,000–2,000 tokens"), and "Claude Code scans
  each subagent's final report before Claude reads it". Depth and concurrency caps moved three
  times between v2.1.212 and v2.1.224 — do not hard-code them. v2.1.232 removed the startup tip
  suggesting custom subagents.
- Plugins: standalone `.claude/` for "personal workflows, project-specific customizations";
  plugins for "sharing with teammates … reusable across projects". "Start with standalone
  configuration in `.claude/` … convert to a plugin when you're ready to share." Trigger: a second
  repository needs the same setup.

## 5. Verification, worktrees, headless, CI (…/best-practices, /worktrees, /headless, /github-actions)

- The first substantive section of best-practices: "Claude stops when the work looks done. Without
  a check it can run, 'looks done' is the only signal … Give Claude something that produces a pass
  or fail, and the loop closes on its own." "The check is anything that returns a signal … a test
  suite, a build exit code, a linter." "Have Claude show evidence rather than asserting success."
  "If you can't verify it, don't ship it." — `pnpm verify` is this shape exactly.
- Four gating tiers: in-prompt → `/goal <condition>` (a session-scoped evaluator; "It doesn't run
  commands or read files independently") → `Stop` hook (8-block override) → a verification
  subagent ("so the agent doing the work isn't the one grading it"), with the brake: "A reviewer
  prompted to find gaps will usually report some, even when the work is sound".
- Worktrees (`--worktree`, subagent `isolation: worktree`), checkpoints (`/rewind`; "Changes made
  through Bash commands … are not captured. This isn't a replacement for git."), headless
  (`claude -p`, `--bare` "will become the default for `-p`"; without `--bare` a `-p` run executes a
  project's hooks in a folder never trusted), the fan-out `for … do claude -p … done` pattern, and
  the Claude Code GitHub Action are all documented — and all are, in this repository, a script that
  runs Claude. Recorded; not recommended.
- Engineering posts that bear on harness shape: *Harness design for long-running application
  development* (2026-03-24: planner / generator / evaluator over files; "Separating the agent
  doing the work from the agent judging it proves to be a strong lever"; solo 20 min / $9 vs
  harness 6 h / $200, "worth the cost when the task sits beyond what the current model does
  reliably solo"); *Building a C compiler with a team of parallel Claudes* (2026-02-05: "it's
  important that the task verifier is nearly perfect"; "16 agents running didn't help because each
  was stuck solving the same task"); *Effective context engineering* (2025-09-29, still current:
  "the smallest possible set of high-signal tokens"); *Effective harnesses for long-running agents*
  (2025-11-26: "It is unacceptable to remove or edit tests"). "Claude Code: Best practices for
  agentic coding" (2025-04-18) now 308-redirects into the docs page; citing it cites a redirect.

## 6. "Loop engineering", "graph engineering" — what the field means (Aug 2026)

Both are third-party coinages from X/blog discourse; **Anthropic uses neither** (its words are
*agentic harness*, *agentic loop*, *context engineering*, *evaluator*, *verification*;
`code.claude.com/docs/llms.txt` has no page for either term).

- **Loop engineering** — Addy Osmani, addyosmani.com/blog/loop-engineering, 2026-06-07: "replacing
  yourself as the person who prompts the agent. You design the system that does it instead."
  Anatomy: automations (cron/Actions), worktrees, skills, connectors, sub-agents (to separate
  doing from verifying), external state on disk (Markdown progress files, AGENTS.md, Linear
  boards). Antecedents he credits: Steinberger ("designing loops that prompt your agents") and
  Boris Cherny (Acquired Unplugged, 2026-06-02, "my job is to write loops" — a video, wording
  approximate). Evidence: primary but unmeasured; Osmani's own guardrail is "if I relied entirely
  on automated loops … my product's quality would suffer". Counterweight: Ronacher, *The Coming
  Loop*, 2026-06-23 ("we treat it, we monitor it … but we do not necessarily comprehend it").
  Ancestor: Huntley's Ralph loop, 2025-07-14 — `while :; do cat PROMPT.md | claude-code; done`.
- **Graph engineering** — Josh C. Simmons, 2026-07-04: "designing agentic systems as explicit
  graphs instead of implicit loops" (typed edges, checkpointed state, budgets in state, trajectory
  evaluation). Went viral off a Steinberger tweet (17–18 Jul) widely reported as satire about
  buzzword churn; LangChain (2026-07-22) called it "the latest term to come out of X's AI content
  factory"; Turing Post: "a loop is already a graph". Three competing meanings (orchestration
  graph · graph of loops · GraphRAG knowledge graph); only the last has numbers, and they are
  retrieval numbers (multi-hop 53% vs 43%; simple lookup graphs *lose*; ~331k tokens per global
  query vs 880). At least two fabricated statistics circulated within 48 h. **Zero controlled
  results for either discipline on a small-repo coding task.**
- What each recommends that this repo already has: a pass/fail verifier (`pnpm verify`); external
  mutable state (Issues, which is Osmani's Linear board); spec as law (`docs/domain/`); typed edges
  (ADRs superseded never edited, sub-issue blocking, lessons named for the fault); bounded stop
  conditions with named reasons; "don't grade your own work" (CLAUDE.md: delegate investigation,
  never your own review). What each recommends that §3 forbids: schedulers that re-prompt Claude,
  `.claude/loop.md`, `.claude/agents/`, Stop hooks, agent teams, dynamic workflows
  (`.claude/workflows/*.js`), worktree fan-out. What is additive without machinery: plan mode
  before large diffs; a spec then a fresh session (this repo's wayfinder → build-session shape);
  `/clear` after two failed corrections; `/code-review` in a fresh subagent before a PR; golden
  refusal cases as ordinary tests (the evals post's "20–50 tasks drawn from real failures").

## 7. What was applied, and why each earned its place

Everything below passed the gate: no custom agent, no second hook, no script that runs Claude,
nothing for a later workflow. Each is a docs recommendation with a repo-specific reason.

| change | source | why here |
|---|---|---|
| `pnpm verify` gains a schema-drift stage (#78) and CI a landed-migration guard (#85) | best-practices "give Claude a way to verify"; hooks doc "if a rule must hold every time, make it enforcement" | Two NEVERs had prose where the docs want enforcement; both are now mechanical without a hook — verify and CI are enforcement layers with no session dependence |
| `CLAUDE.md` names the new enforcement; the verify line names the whole lane | memory doc: commands Claude can't guess; each NEVER names its mechanism (spec §7) | 97 lines, 5.4 KB — under the 200-line target; nothing added that the code could tell |
| `autoMemoryEnabled: false` kept, and now stated as a decision | memory doc (auto memory is machine-local, unreviewed, not in git) | `docs/lessons/` is the memory surface — dated, observed cost, reviewed in a PR, visible to CI and every machine; a second, invisible memory would fork the record |
| `.claude/settings.json` deny list confirmed as the pruning form; nothing added | permissions doc (bare-name deny prunes; server-level MCP names are valid) | The measured lever is already pulled; adding names for tools this build does not surface would be cargo |
| `docs/agents/domain.md` rewritten for this repo | memory doc (Explore/Plan skip CLAUDE.md; skills read `docs/agents/*`) | Template text described a generic repo; the file now routes to law, ADRs, lessons and CONTEXT — what a skill or a delegated reader needs |
| `docs/tracker.md`: `/wayfinder`, `/to-tickets`, `/triage` are founder-invoked | skills doc (`disable-model-invocation`) | A fresh session reading "run `/wayfinder`" cannot; the file now says who invokes them |
| `docs/lessons/README.md`: the second occurrence is a cost | memory doc triggers ("the same mistake a second time") | Compatible with "dated, observed cost"; names when the cost is already paid |

Declined, though allowed: `.claude/rules/` (CLAUDE.md is under the target; splitting buys nothing
and path-scoped rules vanish on compaction); `@import` (no context saving); an `AGENTS.md` alias
(no second tool reads this repo); project skills under `.claude/skills/` (every repeatable
procedure here is a `package.json` script, which costs no context); a plugin (one repository);
`effortLevel`/`model` pins (the docs say use the default); `/goal` (session-scoped and lawful, but
its evaluator cannot run `pnpm verify`, so it would grade pasted output — the commit-time verify
already gates).

## 8. Measured (2026-08-16, WSL2 Ubuntu 24.04, Node v24.19.0, pnpm 9.15.1)

- `pnpm verify`: **13.5–14.7 s** across the session's runs (last, on this branch: 14.7 s) —
  typecheck 2.4 · lint 0.8–0.9 · test 2.7–4.1 · **schema-drift 0.6** · ruff 0.0 · pytest 0.4 ·
  build 6.2–7.6. One stage joined the lane this session (#78's probe); #85 is CI-only.
- `pnpm test:db`: 25 tests, 6 files, ~3.9 s (was 22 / 5).
- CI (ubuntu-latest, cold), the `pull_request` run on PR #86: `pnpm verify` 24.2 s; whole job
  77 s (checkout with history, the landed-migration guard — "landed migrations untouched" —
  setup, install, verify, migrate, test:db).
- SessionStart hook: `node scripts/checkup.mjs --hook` **0.27 s**, one line, ~15 tokens
  (`checkup: machine fit (15 checks ok) — pnpm checkup for detail`).
- `CLAUDE.md`: 97 lines, 5,357 bytes (~1,350 tokens at 4 chars/token — an estimate; the token
  counter needs an API key this session does not hold).
- Tools visible to this session's model at start: 11 loaded (Agent, AskUserQuestion, Bash, Edit,
  ListAgents, Read, ReportFindings, SendUserFile, Skill, ToolSearch, Write) + 17 deferred behind
  ToolSearch (schemas not loaded); no MCP tools present. Skills visible: 11 plugin skills, 4
  bundled; the founder-invoked skills (`/wayfinder`, `/to-tickets`, `/triage`, `/to-spec`,
  `/implement`, `/grill-with-docs`) are `disable-model-invocation: true` and cost nothing.
- **Startup context, measured by the founder in a fresh session (2026-08-16, `/context`):
  13.9k / 1M** — system tools 6.7k · system prompt 3.5k · memory files 2.0k · skills 1.6k ·
  messages 61 · free 986.2k; system tools *deferred* 9.7k (not in context). A session cannot take
  this number of itself (`/context` is a slash command; a shell `claude -p` would be a script that
  runs Claude), so it is the founder's measurement. The first founding's cloud number for the deny
  lever was 29.8k → 22.8k; the rebuilt environment starts at 13.9k. Remaining lever: the loaded
  tool set (6.7k) — the founder's list to consider is AskUserQuestion, EnterPlanMode/ExitPlanMode,
  EndConversation, LSP; note that `EndConversation` "can't be removed while any other tool
  remains" (permissions doc), the plan-mode tools are already deferred (names only), and
  AskUserQuestion is what the HITL skills (`/wayfinder`, `/grilling`, `/code-review`,
  `/to-tickets`) use to speak with the founder — deny it only in a settings scope that never runs
  a HITL session. Measure before and after each deny.

## 9. Proposals for the founder (not merged; each is forbidden by §3 or is a repo setting)

1. **A `PreToolUse` hook refusing Edit/Write on any file under `db/migrations/` that exists in
   HEAD.** The docs' own enforcement form for a NEVER. *Recommendation: refuse.* With #85 the NEVER
   is enforced at CI, and verify's drift stage covers the schema side; a second hook would buy
   minutes of earlier feedback at the price of the one-hook rule.
2. **A `Stop` hook running `pnpm verify`.** The docs' third gating tier. *Recommendation: refuse.*
   14 s per turn end, overridden after 8 blocks, and verify already runs before every commit and
   on every push; Opus 5 / Fable 5 verify unprompted (migration guide).
3. **A custom evaluator subagent (`.claude/agents/reviewer.md`).** Anthropic's strongest measured
   lever for *long unattended runs*. *Recommendation: refuse.* The bundled `/code-review` runs in
   a fresh subagent with zero custom agents; the harness post's own caveat is that the evaluator
   pays "when the task sits beyond what the current model does reliably solo".
4. **Branch protection on `main`: require the CI job to pass before merge (and, if wanted,
   require a PR).** Not a §3 matter — a repository setting that changes how the founder pushes.
   *Recommendation: accept the status check.* One command:
   `gh api -X PUT repos/vextrus/vextrus/branches/main/protection -F required_status_checks[strict]=true -f required_status_checks[contexts][]=verify -F enforce_admins=false -F required_pull_request_reviews= -F restrictions=` (or the Rules UI). This session merged on local
   evidence, as the brief specified, and checked CI after the fact.
5. **Remove the `vercel` and `claude` GitHub Apps from the repository** (queued check-suites on
   every commit). Needs org-admin scope; UI path in PR #84.
6. **Spec §3 wording:** no amendment proposed. The evidence gathered this session supports the
   rule as written; every recommendation that needs machinery is justified in its source by runs
   of hours and hundreds of dollars against greenfield code, which is not this repository's work.
