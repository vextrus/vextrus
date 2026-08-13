# The dispatch primitive

**Date:** 2026-08-13 · **Machine:** the dispatcher's workstation, `win32 x64 · node v24.12.0 ·
main@f0aacb2`, CLI 2.1.229, logged in via claude.ai, subscription **max** (verified:
`claude auth status`) · branch `claude/harness-grounding`

**The question the whole conductor design rests on:** can a Claude Code cloud session be started
programmatically from *outside* a container — from a terminal on a machine holding a subscription
credential?

**The answer: yes, through exactly one supported surface — and it is not the one anybody
guessed.** Not the CLI, not the OAuth token, not an API key: a **routine**, fired over HTTP with
a per-routine bearer token.

---

## 1. Every surface, enumerated

| surface | creates a cloud session? | credential | scriptable? | status |
|---|---|---|---|---|
| **Routine fire API** — `POST api.anthropic.com/v1/claude_code/routines/{trig_…}/fire` | **yes** — returns `claude_code_session_id` + URL | per-routine bearer token (`sk-ant-oat01-…`), minted once in the web UI | **yes — it is a curl** | documented, **experimental** (`anthropic-beta: experimental-cc-routine-2026-04-01`) |
| `claude --cloud "<task>"` | yes | subscription login | **no — tested here**: from a non-TTY it refuses by name: *"--cloud requires an interactive terminal. Non-interactive invocations … would silently ignore --cloud."* | documented, interactive-only |
| `claude --teleport <id>` | no — pulls an existing cloud session down | subscription login | n/a | documented |
| `claude --environment ccpool_…` | yes, onto a *self-hosted* environment | subscription login | same TTY constraint as `--cloud` | documented |
| claude.ai/code web UI, mobile app | yes | subscription login | no | documented |
| `mcp__Claude_Code_Remote__create_session` (the `/v2/ccr-sessions/<id>/mcp` server) | yes, from *inside* a session | session-scoped OAuth fd | unreachable — denied by this repo, `always_ask` by the runner, and session-bound credentials (#33 §7) | internal, undocumented |
| Agent SDK (TS/Python) | **no** — runs the agent loop on *your* host | `CLAUDE_CODE_OAUTH_TOKEN` supported | yes, but it is local execution, not cloud dispatch | documented |
| `claude -p` headless | no — local session | subscription login or `claude setup-token` | yes | documented; this is today's loop |
| GitHub Actions `claude-code-action` | no — runs on the GitHub runner, not Anthropic's cloud | repo secret (API key or OAuth token) | yes | documented — and **ruled out** by the dispatcher: no secret will be installed |
| Managed Agents API (`/v1/sessions`) | Anthropic-hosted, but a different product | **API key only** | yes | beta — ruled out: no API key will be funded |

## 2. The Routine API, in the detail a conductor needs

A routine is a saved configuration on claude.ai/code — a prompt, repositories, connectors — that
runs unattended on a schedule, **on GitHub events**, or when fired over HTTP. The fire endpoint:

- **Auth:** `Authorization: Bearer <per-routine token>`. Minted in the web UI (routine → *Add
  another trigger* → *API* → *Generate token*), shown once, one routine only, no read access,
  regeneration revokes the old one. It is neither the subscription OAuth nor an API key — the
  credential-lifetime trap that killed the in-container conductor (#33 §7) does not apply,
  because the token lives with the dispatcher, not with a session.
- **Payload:** optional body `{"text": "…"}`, free-form, ≤ 65,536 characters, passed to the
  session alongside the routine's saved prompt. **This is the dispatch envelope** — ticket path,
  branch name, claim id all fit with room for the whole ticket text.
- **Returns immediately** with `claude_code_session_id` and `claude_code_session_url`; it does
  not stream or wait. Observability afterward is the PR, the branch, and CI — which is exactly
  the evidence a doer≠judge conductor is allowed to read anyway.
- **No idempotency key.** A retried POST is a second session. The conductor must record the
  session id it got and never blind-retry a timeout.
- **Fuses come built in:** a per-account daily run allowance and the subscription usage limit,
  both surfacing as `429` + `Retry-After`. A conductor that sleeps on `Retry-After` is obeying a
  platform fuse, not inventing one.
- **Experimental.** Shapes can change behind dated beta headers (two previous versions keep
  working). An unattended system built on it must treat a `400 invalid_request_error` on the
  beta header as "the platform moved", halt dispatch, and say so.

**What was not tested here, and why:** firing one. The token requires creating a routine in the
web UI first — a dispatcher click this session cannot and should not perform. Everything up to
the click is documentation; everything after it is a curl. The follow-up cloud/dispatcher session
should mint one routine and fire it once as the first act of the campaign's n=1.

## 3. The ranking, by what has to become true

**(a) A persistent Linux host the dispatcher owns — WSL2 or a small VPS — running today's loop
with headless `claude -p` workers.** What has to become true: **nothing new.** The loop has
already closed three tickets this way (`cloud-campaign.md` §1, n=3). A fresh `provision.sh` on
WSL2/VPS creates the Postgres cluster at C.UTF-8, so `pnpm checkup` passes where this Windows
workstation's locale keeps it NOT-fit. `claude login` once on that host (same subscription) and
the credential lives where the conductor runs. Workers are the only kind whose context
instrumentation exists at all — `ctxPeak` comes from `--output-format stream-json`, which no
cloud session exposes to an outside caller.

**(b) The same host driving cloud workers over the Routine API.** The primitive **exists** —
condition (1) is met on documentation, one click short of met on test. What has to become true:
one routine + token (a dispatcher click, once); the item 3 and item 5 safety holes closed before
any unattended cloud worker; run evidence that outlives the container (item 6), because a cloud
worker's only artifacts are its branch, PR and commits; and acceptance that the API is
experimental, with the halt-on-header-change rule above.

**(c) Everything else** is ruled out, not ranked: GitHub Actions by the dispatcher's no-secret
ruling (and it is not Anthropic-hosted compute anyway), the in-container conductor on credential
lifetime (#33 §7, unchanged), Managed Agents on the no-API-key ruling.

## 4. The winner

**(a), and it is not a consolation.** It is the only candidate that requires nothing to become
true, it has already closed tickets, and it is also (b)'s host: the conductor process, the claim
writer, the relander and the evidence collector live on the dispatcher's Linux host under either
answer. Adopting (a) now forecloses nothing — when the dispatcher mints a routine token, (b)
becomes one more spawn path inside the same conductor (`fire` instead of `spawn claude -p`), with
the same gates reading the same PRs. `docs/specs/execution.md` (item 2) is written against
exactly that shape: one conductor, two worker transports, the local one first.
