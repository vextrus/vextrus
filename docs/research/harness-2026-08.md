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

---

# Addendum — 2026-08-16, the fourth (final) foundation session

**Question.** Not "what is best practice" (§1–§9 answered that) but: **how do we plan the whole takeoff
module and then execute the many small tickets it emits — autonomously, each in a fresh small context,
with review, in the shortest honest wall time?** §1–§9 stand unedited; where a newer page contradicts
them the correction is flagged `CORRECTS §N` in place. Four background subagents did the wide reading,
primary sources first; raw notes were scratch. Quotes are exact; a line marked *(inference)* is ours.
Docs pages carry no dates — they carry version gates (`Requires v2.1.NNN`), recorded where given;
`anthropics/claude-code` CHANGELOG was v2.1.233 at fetch.

## 10. Planning at module scale (the wayfinder chain, read as source)

Sources: the plugin at `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.2.3/`
(`skills/engineering/{wayfinder,to-spec,to-tickets,implement,triage}/*`, `skills/in-progress/loop-me/`,
`docs/engineering/*.md`, `README.md`, `CHANGELOG.md`), verified byte-identical to `mattpocock/skills@main`
on 2026-08-16 (curl + diff); `github.com/mattpocock/skills` issues via `gh` (#476, #508, #518, #554,
#628, #630, #657, #703, #716, #747, #808, #823, #826, #828, #855, #856, #859, #860). Pocock's two X
posts were not fetchable (HTTP 402); the aihero.dev changelog pages 404.

- **A map has no size limit and no nested-map concept.** The skill's only stop condition is semantic —
  "the map is done when the way is clear — nothing left to decide before someone goes and does the
  thing" — and its only exit is `/to-spec #<map>` over the *whole* map. Growth is absorbed by resolution,
  not by splitting: "The map is an **index**, not a store"; "loaded once per session. Open tickets are
  **not** listed". Sub-maps, maps-of-maps and parallel maps are **absent from every Pocock source read**;
  the one sentence about a second effort is sequential — out-of-scope work "returns only if the
  destination is redrawn, and then as a fresh effort, not a resumption".
- **The docs page is where module-scale scoping is discussed, and it argues *against* one wide map**:
  "I charted 27 tickets, and by the time I got to the thirteenth, the rest no longer made sense … maps
  scoped to one defined epic behave better than a sprawling 'implement V1' … Wayfinder is
  'prototypemaxxing', not 'planmaxxing'." Field reports on the tracker: a healthy map at 13/16 (#747);
  "seven grilling children under one map, then eight implement tickets" (#856); "six wayfinder maps on
  one repo. Four reached their destination" (#859); Pocock's own ~100 sessions against one central map
  (course planning, tweet snippet).
- **So `docs/tracker.md`'s five-decision rule is a local answer to a gap the skill leaves open**, not a
  contradiction of it: the skill's own instrument for the same problem is a *smaller destination* plus a
  fresh effort afterwards. Open issues #703 ("evidence-building" mode), #823 (no terminal closeout for a
  cleared map), #859 (`next:to-spec` labels) all ask for incremental build arcs the skill has no shape
  for. *(inference: for a whole module the defensible reading is **several sequential maps, one per
  arc**, each charted from its own destination and each emitting builds — not one module-wide map, and
  not a formal parent-map/child-map hierarchy the skill would not understand.)*
- **What is written where, on each resolution** (this is the cross-session state): map body headings are
  `## Destination` · `## Notes` · `## Decisions so far` · `## Not yet specified` (fog) · `## Out of
  scope`; resolving a ticket = post a resolution comment → close → append one line to Decisions-so-far
  (`- [<ticket title>](link) — <one-line gist>`) → create newly surfaced tickets and wire edges in a
  second pass → clear the graduated fog patch → for out-of-scope, close with a line under Out of scope.
  **Nothing is written to Notes on resolution** — Notes are chart-time. "Assets created while resolving
  a ticket are linked from the issue, not pasted in." Claim = assignee, set *first*. One ticket per
  session, "with the exception of research tickets" (AFK, resolved by a subagent).
- **The ticket shape `/to-tickets` emits, verbatim:** `## Parent` · `## What to build` ("the end-to-end
  behaviour this ticket makes work, from the user's perspective — not layer-by-layer") · `## Acceptance
  criteria` (checkboxes) · `## Blocked by`. Slicing rules: "Each slice cuts a narrow but COMPLETE path
  through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer · A
  completed slice is demoable or verifiable on its own · Each slice is sized to fit in a single fresh
  context window · Any prefactoring should be done first." And: "avoid specific file paths or code
  snippets — they go stale fast."
  **Measured against Anthropic's own advice this template is one field short.** best-practices: "The most
  useful specs are self-contained: they name the files and interfaces involved, state what is out of
  scope, and end with an end-to-end verification step that proves the feature works." The plugin's ticket
  names no files (deliberately), has no out-of-scope field (only the spec and the triage Agent Brief do),
  and its acceptance criteria "may pass before work starts" (docs page, #595). *(inference: a Vextrus
  build ticket therefore carries, beyond the template, the **domain clause it implements** and **one
  machine-checkable verification line** — the command whose exit code decides.)*
- **`implement` is 15 lines and does less than its name suggests**: "Use /tdd where possible … Run
  typechecking regularly … the full test suite once at the end. Once done, use /code-review … Commit
  your work to the current branch." No fetch step, **no PR mode**, **no ticket close** ("If nothing gets
  closed, nothing ever becomes visibly unblocked", docs page, #508), no parallelism ("One invocation,
  one ticket. Batch dispatch … and subagent fan-out … neither exists").
- **`ready-for-agent` names an executor that the plugin does not ship.** "AFK" means "driven by the
  agent alone"; the docs say "so an AFK runner picks them up" and "AFK agents that poll" — **the runner
  is something the user supplies**. `loop-me` (in-progress, not installed) is a grilling session that
  writes workflow specs — it is *not* a script and does not re-prompt Claude. The one in-progress skill
  that launches Claude is `claude-handoff` (`claude --bg`), also unshipped.
- **Field failures worth designing against:** claim-by-assignee has a read→claim→resolve TOCTOU window,
  and the map body "is maintained by rewriting the whole map body", so one session's edit "clobbered
  another session's freshly appended decision line" (#476, two sessions resolved one ticket "one second
  apart"); a resolution eight tickets in left four open tickets stale (#828); "Nothing stops" (#716).
- **Numbers the sources give** (all single field reports or static budgets — *no source gives ticket size
  vs success as a controlled measurement, nor tickets-per-spec, nor sessions-per-map*): ticket "sized to
  one 100K token agent session"; ">100k tokens is normal … 150k … too big"; a 26-ticket stack sliced
  *by layer* took "roughly twenty agent runs per closed ticket, about three quarters of them rework";
  grilling "Same 13 questions land in ~3 rounds instead of 13"; plugin text cost — wayfinder 2,620
  tokens, triage 1,510 (+2,850), to-tickets 1,170, to-spec 584, implement 67.

### 10.1 The graph-engineering asks, scored against map + Issues DAG + frontier + verify

Simmons (drjoshcsimmons.com, 2026-07-04) asks for: "boring nodes, typed edges, checkpointed state";
"An edge is a typed transition that carries state"; "State is an object with a schema, checkpointed
every time you cross an edge"; "Put budget in the state. Tokens, dollars, and wall-clock time"; "Treat
humans as nodes"; "Evaluate trajectories, not just outputs"; "an agent loop is a scheduler with a ready
set of exactly one". Anthropic's harness-design post (2026-03-24) asks for planner/generator/evaluator,
a negotiated "sprint contract", communication "via files", and context resets with "a structured
handoff".

**Present already:** nodes = issues, typed by label; two native, UI-visible edge types (sub-issue parent,
`blocked_by`); humans-as-nodes = the HITL ticket types; checkpoint at each edge crossing = claim →
resolution comment → close → one map line, and for a build ticket commit → PR → verify → CI; the ready
set > 1 = the frontier query; planner/generator/evaluator = wayfinder+to-spec+to-tickets / one fresh
implement session / `pnpm verify` + CI + `/code-review` + human merge; sprint contract = the ticket's
acceptance criteria + cited clause; state outside the model = Issues (mutable) + git (immutable).

**Genuinely lacking:** (a) **budgets per node** — no token/dollar/wall-clock field on any issue and
nothing enforced at any edge (the only sizing is prose); (b) **mid-ticket checkpointing** — state is
checkpointed only at ticket boundaries, and "an abandoned claim is unassigned with a comment saying
where it stopped" is manual prose, with no retry semantics and no failure policy; (c) **atomic claim**
— the frontier query is a read, not a lock; (d) **trajectory logs** — nothing persists the path
(tracker: "one paragraph, no transcript"); verify/CI/review grade the diff; (e) **semantic edges beyond
two** (supersedes, implements, derived-from are body prose); (f) **terminal states** visible to a query
(map closeout, ticket-closed-by-implement). Of these, only (a) and (c) bite at the scale we are about to
run; (d) is a cost with no demonstrated benefit on a small repo and is declined below.

## 11. Every execution surface Anthropic ships, and the one piece that is missing

Sources: `code.claude.com/docs/llms.txt` and the pages `github-actions`, `headless`, `cli-reference`,
`routines`, `scheduled-tasks`, `claude-code-on-the-web`, `agents`, `commands`, `workflows`,
`agent-teams`, `sub-agents`, `tools-reference`, `agent-view`, `permission-modes`, `sandboxing`, `costs`,
`best-practices`, `worktrees`, `code-review`, `whats-new/2026-w32`; `anthropics/claude-code-action`
(`action.yml`, `docs/usage.md`, `docs/faq.md`, `docs/capabilities-and-limitations.md`, release v1.0.193,
2026-08-14); `platform.claude.com/docs/en/managed-agents/github`.
P1 = a custom agent file · P2 = a second hook · P3 = a script that runs Claude (spec §3's three bans).

| surface | machinery in the repo | fresh ctx | state | can it pick the frontier row? | bans touched |
|---|---|---|---|---|---|
| `claude-code-action@v1` on `issues.labeled` | 1 workflow + 1 secret (App installed) | yes, per run | Actions log; branch | **no** — GitHub's event is the pick; `blocked_by` needs a `gh` step | **P3** |
| Cloud sessions (`claude --cloud`, claude.ai/code) | none | yes ("clones the repo fresh every session") | claude.ai session list | no — needs a human or an API call per session | none in repo |
| `/batch` (bundled) | none | yes, per unit | parent session + worktrees | no — decomposes one instruction, never reads Issues | none (P3 if `-p`-wrapped) |
| Dynamic workflows `.claude/workflows/*.js` | a committed JS file | yes per `agent()` | script file under `~/.claude` | takes a list as `args`; something must compute it | **P3** |
| Agent teams (experimental) | env flag | yes per teammate | `~/.claude/teams/…` — **a second task list beside Issues** | self-claims off its *own* list; "In non-interactive mode with `-p` … Claude doesn't spawn teammates" | none, but duplicates the tracker |
| Subagent `isolation: worktree` | a `.claude/agents/*.md` file, or `--agents` JSON | yes | parent session | no | **P1** (file) |
| `Agent(isolation: "remote")` | — | — | — | — | **undocumented**: in the tool schema, on no docs page and not in the CHANGELOG — do not design on it |
| Headless `claude -p [--bare]` | zero if typed; a saved script is P3 | yes | local session files | no — the shell picks | **P3** once saved |
| Routines (cloud) | none in repo | yes ("Each run creates a new session") | claude.ai, not git | GitHub triggers are **Pull request and Release only — no `issues` event**; a scheduled run (min interval 1 h) can poll with `gh` | none in repo; is a re-prompting scheduler |
| `/loop`, `ScheduleWakeup` | `.claude/loop.md` | **no — same session** | `.claude` task file | could poll, in one growing context | committed prompt-loop |
| `claude --bg` (agent view, preview) | none | yes ("Every prompt … starts its own new session") | `~/.claude/jobs/<id>/state.json` | no | none in repo |

**Details that decide the design.** The Action: "Claude doesn't create PRs by default. Instead, it
pushes commits to a branch and provides a link to a pre-filled PR submission page" — because that
"ensures your repository's branch protection rules are still adhered to"; it "Cannot merge, rebase, or
execute git operations beyond pushing commits" and "cannot approve pull requests"; `--max-turns` goes in
`claude_args`, and the job's `timeout-minutes` is the wall-clock cap. CI runs on its pushes only when it
authenticates as the Claude App (a `GITHUB_TOKEN` push triggers nothing). Routines: "A green status …
does not mean the task in your prompt succeeded." `--max-budget-usd` and `--max-turns` exist **only in
print mode** (`-p`); `--max-budget-usd` counts subagent spend and refuses further spawns at the cap
(v2.1.217+). `--bare` "skip[s] auto-discovery of hooks, skills, plugins, MCP servers, auto memory, and
CLAUDE.md" — so a `--bare` executor would run without this repo's law.

**The missing piece, stated exactly.** *Nothing Anthropic ships reads GitHub Issues as a queue.* Routines'
GitHub triggers are PR/Release only; the Action fires per event and knows nothing of `blocked_by`;
`/batch`, workflows and agent teams decompose their own task lists; budget and turn caps live only in
`-p`. So the loop "pick the frontier row → claim it → run a fresh bounded session → PR → wait for
`verify` → squash-merge → repeat" needs a **picker + launcher**, and every option is one of three:
**GitHub as picker** (an event fires the Action), **a cloud scheduler as picker** (a Routine polls, ≥1 h),
or **a shell as picker** (a loop the founder types, or commits — the latter is P3).

### 11.1 How Anthropic's own long-running builds dispatched work

- **C compiler** (2026-02-05): 16 agents, each a Docker container running "an infinite loop" in bash;
  "When it finishes one task, it immediately picks up the next"; **the claim is a lock file** — "Claude
  takes a 'lock' on a task by writing a text file to `current_tasks/`", and "git's synchronization forces
  the second agent to pick a different one". "nearly 2,000 Claude Code sessions", "two weeks", "just
  under $20,000", "2 billion input tokens and … 140 million output tokens" *(inference: ≈$10 and ≈1.07M
  tokens per session)*, "100,000-line compiler". The brake: "Having 16 agents running didn't help because
  each was stuck solving the same task."
- **Long-running harness** (2025-11-26): an initializer session then coding sessions; the *agent* picks —
  "Read the features list file and choose the highest-priority feature that's not yet done"; state is
  `claude-progress.txt` + a 200-feature JSON with pass/fail; "It is unacceptable to remove or edit tests."
- **Harness design** (2026-03-24): planner → generator → evaluator, "Communication was handled via
  files"; the plan's order is the scheduler. Numbers: solo "20 min, $9" vs harness "6 hr, $200"; a DAW
  build "3 hr 50 min, $124.70" (planner $0.46; build rounds $71.08/$36.89/$5.88; QA rounds $3–4). Caveat
  in their own words: "worth the cost when the task sits beyond what the current model does reliably
  solo", and "every component in a harness encodes an assumption about what the model can't do".
- **Large-scale code migrations** (claude.com/blog, 2026-07-16): dispatch was mechanical — "A batch
  script decides what's done by checking whether the translated file exists on disk, then slices the
  pending files into batches"; "resumable by construction"; two adversarial reviewers plus a third on
  disagreement; ≈1M LOC in under two weeks, 5.9B input / 690M output tokens.

In all four, the dispatcher is a **script or a file convention**, never a model deciding what to do next
— and in every case the *state* that survives is a file, not a transcript.

## 12. The evaluator

- **"Nearly perfect" is a requirement, not a compliment.** C-compiler post: "Claude will work
  autonomously to solve whatever problem I give it. So it's important that the task verifier is nearly
  perfect, otherwise Claude will solve the wrong problem." How it was reached: high-quality test suites,
  verifiers and build scripts, "watching for mistakes Claude was making, then designing new tests as I
  identified those failure modes" — and, late, a CI regression guard, because "Claude started to
  frequently break existing functionality each time it implemented a new feature".
- **The brake, verbatim** (best-practices): "A reviewer prompted to find gaps will usually report some,
  even when the work is sound, because that is what it was asked to do. Chasing every finding leads to
  over-engineering: extra abstraction layers, defensive code, and tests for cases that can't happen. Tell
  the reviewer to flag only gaps that affect correctness or the stated requirements, and treat the rest
  as optional." **No numeric threshold or confidence cut-off is published anywhere in the docs**; the one
  confidence lever is the review's effort level: "At `low` and `medium`, the review reports only the
  findings it's most confident in, so you see fewer false positives; `high` through `max` broaden
  coverage and may include findings the review is less sure about."
- **What a ticket must carry** (best-practices): "The most useful specs are self-contained: they name the
  files and interfaces involved, state what is out of scope, and end with an end-to-end verification step
  that proves the feature works" — then "start a fresh session to execute it". Also: "Have Claude show
  evidence rather than asserting success"; "If you can't verify it, don't ship it."
- **`/goal`'s condition anatomy** is the sharpest published definition of a machine-checkable done:
  "One measurable end state: a test result, a build exit code, a file count, an empty queue"; "A stated
  check: how Claude should prove it, such as '`npm test` exits 0' or '`git status` is clean'";
  "Constraints that matter … 'no other test file is modified'". Its evaluator is "a small fast model",
  "doesn't run commands or read files independently", verdicts *Not yet met / Met / Impossible*,
  ≤4,000 chars, and it "eventually stops the run with the goal still set" if Claude stalls.
- **`/code-review` mechanics.** "The review runs as a background subagent with its own context window";
  in a terminal it is "a forked subagent" — and a fork "inherits the parent's system prompt, tools, and
  conversation history exactly, so its first request reads the parent's cache", i.e. it starts warm.
  It "follows your `CLAUDE.md`". Local cost: "Duration: seconds to a few minutes; Cost: counts toward
  normal usage". `--comment` posts inline PR comments; `--fix` applies findings. `ultra`: "roughly 5 to
  10 minutes", "typically $5 to $25", "every reported finding is independently reproduced and verified",
  diff cap 500 files / 8,000 lines, CI form `claude ultrareview` (exit 0/1/130). Managed GitHub Code
  Review (Team/Enterprise only): "$15-25", "20 minutes on average", and its check run "always completes
  with a neutral conclusion so it never blocks merging".
  **CORRECTS §4** ("Since v2.1.215 Claude no longer runs the `/verify` and `/code-review` skills on its
  own"): the code-review page now reads "Claude can start `/code-review` on its own … From v2.1.215
  through v2.1.222, Claude never started `/code-review` on its own in any configuration." To pin it
  user-only: `"skillOverrides": {"code-review": "user-invocable-only"}`. `/verify` is still user-only.
- **Claude 5 changes the evaluator's shape.** Opus 5 guide: "Claude Opus 5 verifies its own work without
  being told to. If your prompt contains explicit verification instructions … remove them … The same
  applies to legacy harness scaffolding that adds separate verification steps"; on review prompts, "If
  your review prompt says 'only report high-severity issues' … the model may follow that instruction
  literally and report less; ask it to report everything and filter in a separate pass instead";
  "Accuracy holds at lower effort settings, which supports a fast pass at review time and a more thorough
  pass later"; and "do not use subagents to verify or double-check your own work". Fable 5 guide:
  "Separate, fresh-context verifier subagents tend to outperform self-critique"; "Before reporting
  progress, audit each claim against a tool result from this session … this nearly eliminated fabricated
  status reports"; "Skills developed for prior models are often too prescriptive for Claude Fable 5 and
  can degrade output quality." *(inference, and it is the load-bearing one: the verifier belongs in
  **code** (`pnpm verify`) and in a **fresh reviewer**, never as instructions in the implementer's
  prompt.)*
- **What an eval case looks like** (Demystifying evals for AI agents, 2026-01-09): "20-50 simple tasks
  drawn from real failures is a great start"; "A good task is one where two domain experts would
  independently reach the same pass/fail verdict"; "Everything the grader checks should be clear from the
  task description; agents shouldn't fail due to ambiguous specs"; "Make your graders resistant to
  bypasses or hacks." *(inference: our golden refusal cases — an unaffirmed scale, an unmapped unit, a
  missing rate, a malformed geometry spec — are exactly this shape, and they belong in vitest, where they
  are already inside `pnpm verify`.)*

## 13. Speed and cost per ticket

- **Prices** (platform.claude.com/docs/en/about-claude/pricing, per MTok, fetched 2026-08-16):
  Fable 5 $10 in / $50 out (cache write 5m $12.50, read $1); Opus 5 $5 / $25 (read $0.50); Sonnet 5
  **$2 / $10** (read $0.20) — "announced at launch as introductory pricing through August 31, 2026, is
  now the standard price. The previously scheduled increase to $3/$15 … will not occur"; Haiku 4.5
  $1 / $5. All Claude 4.6+ models "include the full 1M token context window at standard pricing".
  Tokenizer: "Claude 4.7 and later models … use a newer tokenizer … produces approximately 30% more
  tokens for the same text" *(inference: Opus 5, Sonnet 5 and Fable 5 share it; a Haiku token count of a
  file under-reads them by ~30%)*.
- **Effort.** Defaults are `high` on every model that supports effort (Opus 4.7 alone defaults `xhigh`);
  the scale "is calibrated per model, so the same level name does not represent the same underlying value
  across models". Opus 5: "Start with `high`, the default … use `low` and `medium` liberally as your
  primary control for token cost and response time **wherever your evals show quality holds**"; "changing
  effort does not reliably shorten responses, so prompt for length instead". Fable 5: "Lower effort
  settings … still perform well and often exceed `xhigh` performance on prior models." Sonnet 5: "Medium
  effort: … Comparable to Claude Sonnet 4.6 at high effort." The 2026-07-07 blog: "for most tasks you
  should use the model's default effort level"; raise effort when Claude "skipped a file, not running the
  tests"; switch model up when it "clearly tried and still got it wrong"; on routine work a larger model
  "consumes more tokens with extra verification steps at a higher per-token price", but on harder
  multi-step tasks "the total cost per task can come out lower".
- **Prompt caching.** Minimum cacheable prompt is **512 tokens for Opus 5, Fable 5 and Mythos 5**
  (1,024 for Sonnet 5 and Opus 4.8; 4,096 for Opus 4.6/4.5 and Haiku 4.5). On a subscription the TTL is
  **1 h automatically**; subagents "use the five-minute TTL even on a subscription". Cache reads cost
  0.1×; "Cache reads are not deducted against your rate limit (ITPM)". Invalidators inside Claude Code:
  model switch, **effort change** ("Changing it mid-session recomputes the entire request"), fast mode,
  MCP connect/disconnect, `/compact`, a Claude Code upgrade, and **denying an entire built-in tool
  mid-session** ("Built-in tool definitions load into the system prompt layer"). Scope, and this is the
  one that shapes fan-out: "the cache is effectively scoped to one machine and directory … two sessions
  in different directories build different prefixes and miss each other's cache. **That includes
  worktrees of the same repository**"; "Sessions you run in parallel in the same directory build matching
  prefixes and read each other's cache. Sequential sessions share the prefix only when the git status
  snapshot at startup matches." *(inference: a worktree fan-out forfeits cache sharing; a fresh session
  per ticket in the same directory writes ~14k startup tokens at 1.25× ≈ $0.09 on Opus 5, ≈$0.035 on
  Sonnet 5 — negligible. Conversation length, not session count, drives cost.)*
- **Session hygiene.** "`/clear` costs nothing"; "`/compact` reads the conversation it summarizes, so
  compacting a large context is itself a large request"; "Unexpectedly high spend … usually traces back
  to long sessions that were never cleared or to Opus left as the default model"; and, on repeated
  correction: "If you've corrected Claude more than twice on the same issue in one session … Run `/clear`
  and start fresh with a more specific prompt. A clean session with a better prompt almost always
  outperforms a long session with accumulated corrections."
- **Subagent model and effort.** Frontmatter `model` ("`sonnet`, `opus`, `haiku`, `fable`, a full model
  ID … or `inherit`") and `effort`; resolution order is `CLAUDE_CODE_SUBAGENT_MODEL` → per-invocation
  `model` → frontmatter → main conversation. Concurrency: 20 by default
  (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, v2.1.217+), spawn depth 3. costs page: "For simple subagent
  tasks, specify `model: haiku`." A background subagent keeps only Read/Grep/Glob/Bash/Edit/Write/
  WebFetch/WebSearch/Skill/ToolSearch/Monitor/SendMessage/… and **never gets `AskUserQuestion`**.
- **Published usage numbers.** costs: "around $13 per developer per active day and $150-250 per developer
  per month, with costs remaining below $30 per active day for 90% of users"; background usage "under
  $0.04 per session"; "Agent teams use approximately 7x more tokens than standard sessions when teammates
  run in plan mode". Usage research (2026-06-16, ~400k sessions / ~235k people): a typical session is
  "about four" turns and "around 10 actions on average" per prompt; verified success 15% (novice) vs
  28–33% (intermediate/expert); humans make "about 70%" of planning decisions, Claude "80%" of execution
  decisions.
- **Worked estimate for one small ticket** *(inference, list prices, Opus 5)*: 14k startup × 1.25 ≈
  $0.09; ~10 turns re-reading a 30–60k prefix at $0.50/MTok ≈ $0.15–0.30; 20–40k output at $25/MTok ≈
  $0.50–1.00; a `/code-review medium` fork ≈ $0.30–0.80. **Order $1–2.50 per ticket on Opus 5, ~40% of
  that on Sonnet 5** — dominated by output tokens, which effort and a conciseness instruction cut.
- **Parallelism limits.** API tiers: Start = 1,000 RPM / 2M ITPM per model (Fable 5 lower: 500k ITPM);
  "Rate limits are applied separately for each model"; "only uncached input tokens count toward your
  ITPM". Subscription: a session limit resetting every five hours plus "a weekly usage limit that applies
  across all models"; no hours-per-week figures are published. Cloud sessions: "shares rate limits with
  all other Claude and Claude Code usage … There is no separate compute charge for the cloud VM." Local
  subagents: 20 concurrent, depth 3. Agent view: "10 parallel ≈ 10× quota".

## 14. The third-party discourse, read critically

- **Ralph** (ghuntley.com/ralph, 2025-07-14): `while :; do cat PROMPT.md | claude-code; done`, one task
  per loop, state in `PROMPT.md` / `fix_plan.md` / `AGENT.md` / `specs/*`, tests before push, "restrict
  build/test to 1 subagent". Evidence: anecdote ("$50k … for $297"; "6 repos overnight"). **The official
  `ralph-loop` plugin is not what Ralph is**: read from source, it is a **Stop hook that re-injects the
  identical prompt into the *same* session** (context accumulates until compaction), default **unlimited**
  iterations, and its README concedes the completion promise is exact-match so "Always rely on
  --max-iterations as your primary safety mechanism" — while open issues #81825–#81829 (2026-07-28) show
  `--max-iterations 08` parsed as octal (unbounded), the hook never looping on 2.1.x, and the promise not
  whitespace-normalised. *(The transferable content — one task per iteration, plan on disk, a mechanical
  gate before commit, a hard cap — this repo already has; the loop itself adds unattended re-prompting.)*
- **Spec-driven development.** GitHub Spec Kit (129k stars, pushed 2026-08-14) converges on a task row of
  exactly the shape we need: `- [ ] T014 [US1] Implement [Service] in src/services/x.py (depends on T012,
  T013)`, `[P]` for parallelisable, phases Setup → Foundational → per-story, "Include exact file paths".
  Kiro: `requirements.md` (EARS) / `design.md` / `tasks.md`, dependency graph run in "waves". **Neither
  publishes any outcome evidence.**
- **"Harness engineering"** (openai.com/index/harness-engineering, 2026-02-11) — **primary not fetchable
  (403)**; from three independent secondary quotations: AGENTS.md ~100 lines as a *map* not a manual;
  `docs/` as source of truth; custom linters and structural tests in CI to "enforce invariants rather
  than micromanage implementations"; recurring background "garbage collection" tasks against golden
  principles; ~1M lines in ~5 months with "zero lines written by human hands". Self-reported, one
  greenfield product, no control.
- **Hashimoto** (2026-02-05): "AGENTS.md as a failure log" — "Each line in that file is based on a bad
  agent behavior, and it almost completely resolved them all"; "one clear task per session"; "If you give
  an agent a way to verify its work, it more often than not fixes its own mistakes". Self-reported
  first-pass hit rate on raw issues: **10–20%**.
- **Numbers that bound expectations.** METR time horizons (raw `benchmark_results_1_1.yaml`, TH 1.1, 228
  tasks): Opus 4.6 p50 719 min [317, 3634] but **p80 70 min [27, 170]**; Mythos Preview p50 1045 / p80
  186; **no Opus 5 or Fable 5 row exists**, and no primary leaderboard (SWE-bench Pro, Terminal-Bench 2)
  carries one either — third-party "80.3% / 95%" figures for the Claude 5 family are untraceable and are
  not used here. METR's own developer RCTs: −19% (2025, i.e. *slower*) → −18% [−38, +9] and −4% [−15, +9]
  (late 2025), "only very weak evidence". MirrorCode (2026-04-10): Opus 4.6 reimplemented a 16,905-line
  CLI at 99.95% of 2,001 tests, but needed "a precise, programmatically checkable specification — an
  atypical development scenario"; a 61k-line target was unsolved after 1B tokens (~$550). Agent PRs at
  scale (arXiv 2607.04697, 33,596 PRs): merge-conflict rate **19.8% within one agent vs 41.7% across
  agents**. Naive decomposition can be worse than monolithic; re-running only the failed subtask is the
  win (arXiv 2605.15425).
- **Issue-driven products in the wild** all converge on one shape: **issue → isolated env → branch →
  draft PR + run log → human verdict**, one PR per task, a hard wall-clock cap (Copilot's is 59 minutes),
  and the repo's own CI as the gate. **Nobody publishes an acceptance rate** for issue-assigned work.
- **What recurs *and* has evidence:** a mechanical, complete verifier as the precondition; small
  independent units, one per session; state on disk (not in context) with a session-start ritual that
  reads it; doer ≠ grader; invariants enforced by lint/CI rather than prose; hard bounds with a named
  stop; the human owning the verdict at a low expected first-pass yield. **Popular and evidence-free:**
  unattended re-prompt loops on a permanent codebase; multi-agent fan-out by default; "graph engineering"
  as a discipline; spec-kit-style pipelines; the "20× cost for dramatically better quality" claim
  (uncontrolled, n=2 apps).

## 15. What this addendum changes in §1–§9

- §4's line "Since v2.1.215 Claude no longer runs the `/verify` and `/code-review` skills on its own" is
  **superseded for `/code-review`** — see §12. `/verify` remains user-only.
- §8's remaining-lever paragraph is **acted on**: issue #89 denies `SendUserFile` and `ListAgents` by bare
  name and drops the no-op `EndConversation` entry (the tools-reference is explicit that a deny naming it
  "ha[s] no effect" while any other tool remains). `AskUserQuestion` stays — it is how the HITL skills
  speak to the founder, and §13 records that **no subagent ever gets it**, so a delegated reader cannot
  ask a question in any case.
- §9's proposal 4 (branch protection) and 5 (GitHub Apps) are **done** (2026-08-16). Proposals 1–3
  (migration `PreToolUse` hook, `Stop`-hook verify gate, custom evaluator subagent) are re-examined in
  `docs/specs/harness.md` §6 with this addendum's evidence; the recommendation on all three is unchanged.
