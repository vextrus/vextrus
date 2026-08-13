# ADR-0013 — The cloud startup context is a budget, and `deny` is the only lever on it

**Date:** 2026-08-13 · **Status:** accepted

## Context

ADR-0007 trimmed the startup context on the assumption that a thinner prompt is a sharper
session; ADR-0011 then made the cloud container the default surface. Nobody had measured what
the second decision cost the first. A fresh cloud session on this repo reports **29.3k** at
`/context`; the same repo on the terminal CLI reports **15.4k**. The cloud session starts with
roughly twice the prompt, on a machine where nobody is watching the quality.

Measured on a cloud container at `7df440b`, 2026-08-13, by running `claude -p` headless
against the container's own injected config and reading `usage` off the JSON result. The
control was re-run at the end and reproduced to the token, so these are exact, not sampled:

| Variant | Prompt tokens | Δ |
|---|---|---|
| A — repo settings only (the local shape) | 18,193 | — |
| B — A + the runner's `--mcp-config` | 26,179 | **+7,986** |
| C — B + the runner's `--append-system-prompt` (the real cloud session) | 29,837 | **+3,658** |
| D — C, six synced skills off | 28,970 | −867 |
| E — C, whole `Claude_Code_Remote` server denied | 22,926 | −6,911 |
| F — C, 15 of its 20 tools denied | 24,681 | −5,156 |
| J — C, 15 tools + synced skills + 3 cloud-only tools denied | 22,839 | **−6,998** |

Where the excess comes from, in order of size:

- **The `Claude_Code_Remote` MCP server is ~8k and is never deferred.** The environment runner
  writes `/tmp/mcp-config-<session>.json` with all 20 tools listed explicitly, each carrying a
  `permission_policy` — an explicit tool list pins the schemas eagerly. The `github` server in
  the same file declares no tool list, is server-advertised, and its 57 tools land behind
  `ToolSearch` as names alone (22.4k *not* loaded). The cost is the explicit list, not MCP.
- **The runner appends 15,026 characters of system prompt** (~3.7k) via `--append-system-prompt`:
  the remote-environment description, the GitHub integration and PR-activity protocol, the
  repository scope, the branch instructions, the model-identity block.
- **Six skills are synced from claude.ai** — `docx`, `pdf`, `pptx`, `xlsx`, `skill-creator`,
  `morning` — under `CLAUDE_CODE_SYNC_SKILLS=1`, into `~/.claude/skills/synced/`. None of them
  has anything to do with this repo; their descriptions alone cost 867 tokens.
- **The cloud tool preset is wider** than the terminal's, and a few of its additions
  (`ShowOnboardingRolePicker`, `SuggestSkills`, `ListAgents`) are meaningless in an unattended
  container.

The load-bearing finding: **`permissions.deny` prunes the schema, it does not merely refuse the
call.** That is why the existing deny list already keeps `AskUserQuestion` and `Artifact` out of
the prompt entirely, and it is what makes any of this reachable from the repo. Denying an MCP
tool by its full `mcp__server__tool` name works the same way.

## Decision

1. **The repo trims what the repo can reach, and only that.** `--mcp-config` and
   `--append-system-prompt` are CLI flags written by the environment runner; no file in this
   tree is read before them, so the 3.7k appended prompt is not negotiable from here. It is
   named in this ADR so the next session stops looking for a switch.
2. **`Claude_Code_Remote` is denied down to five tools**, not off. Kept: `add_repo` and
   `register_repo_root` (the only way to reach a repo the container was not cloned with),
   `send_later`, `subscribe_pr_activity`, `unsubscribe_pr_activity`. The last three are kept
   *because the appended system prompt instructs the session to use them* on any PR it opens —
   denying the whole server would leave a session under standing instructions it cannot obey,
   which is a worse failure than 2.4k of schema. Everything else — session spawning, tagging,
   titling, archiving, trigger CRUD, environment and repo listing — is denied: ADR-0011 already
   denied `CronCreate`/`ScheduleWakeup`/`RemoteTrigger`, and this is the same decision reaching
   the MCP surface.
3. **Synced skills are off by name** in `skillOverrides`, alongside ADR-0008's existing set. The
   sync itself is an account setting outside the repo; the override is the repo-side answer and
   survives whatever the account does.
4. **The measurement method is the artifact.** `claude -p "say ok" --output-format json` with
   the container's own `--mcp-config` and `--append-system-prompt`, summing `input_tokens +
   cache_creation_input_tokens + cache_read_input_tokens`, is exact and repeatable — where
   `/context`'s own table is not, since it lists deferred tools it does not actually load
   (they sum to more than the total it reports).

## Consequences

- A fresh cloud session starts at **22.8k instead of 29.8k**, a 23% trim — still 4.6k above the
  terminal, and the whole of that residue is the appended system prompt plus the five kept MCP
  tools. That is the floor from the repo side; closing it further needs a change at the
  environment runner, not here.
- A session that needs `create_session`, a trigger, or a session listing now gets a permission
  refusal rather than a missing tool. That is the intended reading of ADR-0011: an unattended
  container does not spawn fleets or schedule itself.
- `/context`'s "MCP tools (deferred)" line is informational, not spend. A future reader
  optimising against that number will chase 22.4k that was never in the prompt.
- The numbers are pinned to Claude Code 2.1.42 and this environment image. The runner's appended
  prompt and tool preset move without notice; when `/context` disagrees with 22.8k, re-take the
  table above rather than trusting it.
