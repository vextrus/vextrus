# Dispatch needs a credential the repo does not have

wayfinder:grilling
Status: closed
Blocked by:
Claimed by:

## Objective

6.1 is answered as far as a session can answer it
(`docs/research/what-fills-a-cloud-session.md` §7). The mechanism exists —
`mcp__Claude_Code_Remote__create_session`, on the session-scoped MCP server the runner writes to
`/tmp/mcp-config-<session>.json` — and it is unavailable to a session of this repo by three
independent controls: the repo's own deny list, the runner's `"permission_policy": "always_ask"`
on all 20 tools with no party to ask, and a model-side permission classifier.

The finding that outlives the tool name is about **credentials, not permissions**:

> The session's OAuth token arrives as `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR=4` — an inherited
> **file descriptor**, not an environment variable and not a file on disk — and the MCP endpoint
> is scoped to *this* session's id. **There is no durable credential in the container.**

Therefore `cloud-campaign.md` §6's first candidate — *"a long-lived cloud container running the
conductor and spawning siblings"* — is not undecided. It is **structurally unavailable**: a
conductor inside a cloud session holds credentials bound to its own session that vanish with it,
so it cannot outlive the thing it would dispatch with.

The second candidate is ruled in but unfunded. `.github/workflows/ci.yml` declares
`permissions: contents: read` and holds no Anthropic credential of any kind.

## The decision

This ticket is **the dispatcher's, not a session's** — installing a credential in a repository is
a repository action.

1. **Is a GitHub Actions conductor funded?** It needs an Anthropic credential as a repository
   secret, and a decision about which one (API key vs OAuth token) and at what scope. Until that
   exists, 8.8 and 8.9 are blocked on a purchase order, not on a measurement.
2. **What does the workflow's permission set become?** `contents: read` is deliberate and stated
   in `ci.yml`. A conductor writes: it claims tickets by CAS on `main`, opens PRs, posts checks.
   That is a different, larger grant and belongs in its own workflow rather than widening
   `parity`'s.
3. **Does G4's review session share it?** 8.9 is a Claude session running in CI and needs the
   same credential. If only one is funded, say which.
4. **Concurrency limits are unmeasured and stay so.** Measuring what happens at the limit means
   dispatching sessions, which none of the three controls above permits and which ADR-0011
   forbids on principle. Note it as unmeasured rather than leaving the question looking open.

## Guardrails

- Ticket 18 forbade building a dispatch workaround and none was built. Do not build one here
  either: without §1 answered there is nothing to build against.
- Do not re-derive the deny list to make `create_session` reachable. ADR-0011's reading — an
  unattended container does not spawn fleets — is the reason it is denied, and this ticket does
  not disturb it.

## Acceptance

- [x] Funded or not funded, stated, with the credential named and scoped if funded.
- [x] `cloud-campaign.md` 8.8 and 8.9 re-blocked on this ticket by name, or unblocked.
- [x] The in-container conductor is recorded as ruled out on credential lifetime, so the next
      session does not re-open it.

## Resolution

Ruled by the dispatcher, 2026-08-13: **not funded.** No API key will be bought and no Anthropic
secret of any kind will be installed in the repository — the GitHub Actions conductor is dead,
not deferred. The conductor runs where a subscription credential already lives: the dispatcher's
own persistent Linux host (docs/research/the-dispatch-primitive.md).

The question this ticket thought it was asking dissolved on research: the programmatic path to a
cloud session is the Routine API, whose per-routine bearer token is held by the dispatcher's
host, never by the repository. 1) Not funded, stated. 2) cloud-campaign 8.8/8.9 re-pointed at
docs/specs/execution.md. 3) The in-container conductor stays ruled out on credential lifetime
(#33 §7) — recorded there, in the primitive doc, and here.
