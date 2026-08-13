# The harness against the docs

**Date:** 2026-08-13 · **Machine:** the dispatcher's workstation, `win32 x64 · node v24.12.0 ·
main@f0aacb2`, Claude Code CLI **2.1.229** (native `claude.exe`) · branch `claude/harness-grounding`

Every setting in this harness was written against an assumption, some of them months old in CLI
time. This audit grounds each one in three independent sources, dated today:

1. **Official docs** at `code.claude.com` (settings, permissions, sandboxing, headless, hooks,
   skills, MCP references), fetched 2026-08-13.
2. **The settings JSON-Schema** at `json.schemastore.org/claude-code-settings.json` — the file
   `.claude/settings.json`'s own `$schema` line points at — fetched 2026-08-13.
3. **The installed CLI binary**, grepped for the identifier. A name with zero occurrences in the
   binary cannot do anything, whatever any doc or memory says. This is the tiebreaker.

Verdicts: **[dead]** does nothing, **[documented]** justified from a source above, **[undocumented,
live]** present in the binary but in no doc — works today, no contract tomorrow, **[cloud-confirm]**
cannot be settled from a workstation.

---

## 1. `.claude/settings.json`

### The one dead setting — found, and fixed in this commit

**`env.CLAUDE_CODE_INCLUDE_GIT_INSTRUCTIONS = "false"` is dead.** Zero occurrences in the
2.1.229 binary. The control that exists is the top-level setting `includeGitInstructions`
(boolean, documented in the settings reference) or the env var
`CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` (3 occurrences in the binary). The repo has been
"suppressing" the built-in git/PR workflow instructions with a variable that no code reads —
every session, local and cloud, has been carrying those instructions the whole time. This also
retroactively explains part of §9 of `docs/research/what-fills-a-cloud-session.md`: some of the
"runner's" git instruction text is the CLI's own, and the repo's off-switch was never on.

Fixed here: the dead env key is removed and `"includeGitInstructions": false` is set at top
level, which is the documented spelling.

### Documented and standing — the defended settings that survive

| setting | verdict |
|---|---|
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` | **[documented]** — sandboxing.md documents the scrub *and* its bubblewrap requirement on Linux/WSL. #33's ruling (keep the setting, provision the dependency) is now backed by the vendor doc, not just the measurement. |
| `BASH_MAX_OUTPUT_LENGTH=50000` | **[documented]** — and the documented **default is 30,000, max 150,000**. So this line is a *raise*, not a tightening: deleting it would lower the cap. #33 measured nothing ever reaching 12.5k; keep, and know what it is. |
| `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` | **[documented]**, present in binary. Keep. |
| `attribution.commit` | **[documented]** (`attribution.commit`/`.pr`/`.sessionUrl` in the schema and settings reference). |
| `autoMemoryEnabled: false`, `showTurnDuration: true` | **[documented]**. |
| `skillOverrides` | **[documented]**, including exactly the repo's `"off"` value (`on` / `name-only` / `user-invocable-only` / `off`). |
| `permissions.defaultMode: bypassPermissions` | **[documented]**. Note: the cloud runner starts top-level sessions in `auto` regardless (measured, #33 §4) — this key governs local sessions and spawned workers, not the runner's choice. |
| per-tool MCP denies (`mcp__Claude_Code_Remote__create_session`, …) | **[documented]** — a deny naming a whole tool removes it from context (prunes the schema); only *argument-scoped* rules like `Bash(x:*)` block-without-pruning. ADR-0013's measured pruning is the documented behavior. Written down here because the docs' "scoped denies do not prune" line is easy to misread as covering these. |
| `includeCoAuthoredBy` | not used by this repo — correct, since it is **deprecated** in favor of `attribution`. Nothing to do. |

### Undocumented but live — keep with eyes open

- **`CLAUDE_CODE_NO_FLICKER=1`** — 15 occurrences in the binary, zero in any doc. Cosmetic TUI
  behavior. It works today and has no contract tomorrow; it is also the definition of a setting
  nobody can justify from documentation. **Candidate to drop; the dispatcher's call.** Left in
  place because removing a cosmetic key was not worth a line of this session's budget.
- **`CLAUDE_CODE_MAX_OUTPUT_TOKENS=128000`** — 10 occurrences in the binary, absent from the
  docs' env-var reference. #33 measured it inert (nothing approaches it). Keep as a backstop,
  know it is uncontracted.

### Inert today, load-bearing later

- **`enableAllProjectMcpServers: true`** with **no `.mcp.json` in the repo** — a pre-approval
  for a file that does not exist. Keep: on an unattended container it is the only way a future
  committed `.mcp.json` could ever be approved (nobody is there to click). Caveat, docs v2.1.196+:
  project-scope MCP approval is **gated on workspace trust**, so on an untrusted cloud workspace
  even this flag may not connect servers. **[cloud-confirm]**
- **`permissions.additionalDirectories: ["/tmp"]`** — documented, and documented to be **ignored
  in an untrusted workspace**, which is exactly what #33 measured ("Ignoring 1
  permissions.additionalDirectories entry"). Nothing in the loop may rely on it on a container
  until trust is solved (see the spawn-line ticket).

### New levers the docs offer that this repo has not ruled on

- **`permissions.disableAutoMode: "disable"`** — removes `auto` from the mode cycle and *rejects
  `--permission-mode auto` at startup*. This looks like the off-switch for the permission
  classifier (`inbox/the-permission-classifier-is-a-second-deny-list.md`) — and it is also a
  plausible way to make every cloud session **fail to start**, since the runner launches them in
  `auto`. Do not set it blind; it is the first thing the next cloud session should test.
- **`autoMode` settings key** — the classifier's allow/soft-deny rules are customizable
  ("typically in managed settings"; whether project scope is honored is undocumented).
  **[cloud-confirm]** before the classifier ticket is ruled.
- **`--permission-mode dontAsk`** — auto-denies anything not pre-approved. A fail-closed,
  non-interactive mode that is not `bypassPermissions` and therefore not subject to the uid-0
  refusal. This is the candidate worker mode; item 5's commit acts on it.
- **`--session-id <uuid>`** — documented; a spawner that assigns each worker its own session id
  is the documented fix for the nested-transcript fault
  (`inbox/a-nested-claude-writes-into-its-parents-transcript.md`), replacing the "clear the env
  var" incantation that ticket 18 ruled against.
- **`--max-budget-usd`** — a cost cap exists in print mode now. Noted, not adopted: "cost is
  logged, never a gate" is loop law (ADR-0008), and this audit does not overturn law.
- **`claude agents --json`** — a scriptable listing of background/cloud sessions; the first
  observability primitive a conductor can poll without parsing a TUI.

### The §9 complaint that documentation reverses

The runner's `Claude-Session:` commit trailer, called "a URL line the repo never asked for" in
#33 §9, is the documented `attribution.sessionUrl` behavior (default `true`) and is
**controllable** — set `"sessionUrl": false` to remove it. Ruling: **keep it.** A trailer linking
a commit to the session that produced it is run evidence of exactly the kind item 6 exists to
preserve. The complaint is withdrawn rather than the trailer.

## 2. Trust, root, and the spawn line — the facts that bound item 5

- **`hasTrustDialogAccepted`** is internal (11 binary occurrences, no doc). There is **no
  documented way to pre-accept workspace trust** for automation. In `-p` mode the dialog is
  *skipped*, and project `permissions.allow` + `additionalDirectories` stay ignored;
  `deny`, `ask`, and `env` still apply. So a worker on a fresh container **never** runs under the
  repo's allow list via trust — the spawner must pass its allow surface explicitly
  (`--allowedTools` / `--settings`), which does not depend on trust.
- **The uid-0 refusal of `bypassPermissions` is real and undocumented** — the docs never state
  it; the measured refusal (#33 §1) stands as the only source. `IS_SANDBOX` appears in the binary
  6 times and in no doc: using it would be an unsupported incantation, which is what the
  spawn-line ticket's guardrail already says.
- **`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` default is now 3, not 1.** The `=1` measured on the
  cloud container is the *runner's explicit setting*, not a platform constant. #33's "the saving
  is one level deep by construction" holds only where the runner sets it.

## 3. Everything else swept, briefly

- **`.claude/settings.local.json`** — `spinnerTipsEnabled: false`, documented, local, harmless.
- **hooks** — `SessionStart` is a documented event; hooks **do run in `-p` mode** (documented),
  so every headless worker pays the ~400-token checkup line. That is deliberate and stays: it is
  the fitness verdict, and cloud-campaign §7 already defended it.
- **`.githooks/pre-push`** — pure git, no Claude API surface to go stale against. Sound.
- **`scripts/provision.sh`** — the bubblewrap phase now matches sandboxing.md exactly. The docs
  also name **socat** as required for sandbox *network* isolation on Linux; the scrub alone
  demonstrably does not need it (#33 §5 succeeded with bubblewrap 0.9.0 alone). Noted; not
  installed; becomes real only if `sandbox.network` is ever turned on.
- **`.github/workflows/ci.yml`** — holds no Claude coupling at all (by design) and no Anthropic
  credential (by ruling). Nothing to ground.
- **skills** — every frontmatter key in use (`name`, `description`, `argument-hint`,
  `disable-model-invocation`) is documented. The newer surface (`context: fork`, `agent`,
  `background`, `allowed-tools`) is available and unused; item 4 considers `allowed-tools` for
  the worker's skills.
- **stream-json parsing** (`usage.mjs`) — the shapes it reads (`type: "assistant"` usage,
  `type: "result"` with `num_turns` / `total_cost_usd` / `modelUsage`) are the documented ones,
  and the result object now also carries **`permission_denials`** — which `conduct.mjs` should
  log the day workers run `dontAsk` (item 5).

## 4. What this audit did not do

It did not re-measure anything ADR-0013 or #33 measured, did not touch the deny list (item 3's
commit does), did not change the worker spawn (item 5's), and could not confirm any
**[cloud-confirm]** line — those are enumerated for the container session that follows this one.
