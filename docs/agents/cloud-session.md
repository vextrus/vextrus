# Cloud sessions

A cloud session is this session on Anthropic's infrastructure: same repo, same `CLAUDE.md`, same
`pnpm verify`. What it does not get is your machine — no Postgres on 5544, no Node 24, no `.env`,
no `cad/.venv`. Two committed files close that gap, and one field in the environment dialog
carries values the tree cannot hold.

| Piece | Where it lives | When it runs |
| --- | --- | --- |
| Setup script | the environment dialog at `claude.ai/code`, copied from `scripts/cloud-setup.sh` | once per environment, as root, before Claude Code launches; the filesystem is then snapshotted and later sessions skip it |
| Environment variables | the environment dialog, `.env` format | copied into the session's environment at startup |
| Session bootstrap | `scripts/cloud-session.sh`, run by the `SessionStart` hook in `.claude/settings.json` | every session, cloud and local — a no-op unless `CLAUDE_CODE_REMOTE=true` |

The split is the snapshot's: it keeps files, never processes, and never the checkout, which is
cloned fresh per session. So toolchains and the cluster's data directory are the setup script's;
`.env`, `pnpm install`, `uv sync`, starting the postmaster and `pnpm db:migrate` are the
bootstrap's. `pnpm checkup` runs last, as it does here, and names anything still BROKEN.

## Configure the environment

At [claude.ai/code](https://claude.ai/code), select the cloud icon above the message box →
**Add cloud environment** (or the gear on an existing one).

**Name:** `vextrus`

**Network access:** `Trusted`. The default allowlist carries every registry this repo reaches:
`nodejs.org` (Node 24), `registry.npmjs.org` (pnpm), `pypi.org` + `files.pythonhosted.org`
(ezdxf, ruff, pytest), `archive.ubuntu.com` and `ppa.launchpad.net` (apt, deadsnakes). Move to
`Custom` **with the default list included** only if `uv python install 3.13` and the deadsnakes
fallback both fail in the setup log; then add `astral.sh`.

**Environment variables** — paste exactly this:

```
DATABASE_URL=postgres://vextrus_app:vextrus_app_dev_password@localhost:5544/vextrus
MIGRATE_DATABASE_URL=postgres://vextrus:vextrus@localhost:5544/vextrus
AUTH_DATABASE_URL=postgres://vextrus_auth:vextrus_auth_dev_password@localhost:5544/vextrus
BETTER_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef
BETTER_AUTH_URL=http://localhost:3210
NEXT_TELEMETRY_DISABLED=1
```

These are `.env.example`'s dev values against a cluster that exists only inside the session VM.
Anyone who can use the environment can read this field, and there is no secrets store, so
nothing else goes in it — no `ANTHROPIC_API_KEY` (a cloud session is already authenticated; a
model call goes through `callModel`), no `GH_TOKEN` (the GitHub proxy injects real credentials
and `gh` works without one), no `NODE_ENV` (set, it makes `next build` prerender with React's
dev bundles — `pnpm checkup` calls that BROKEN), and no `VEXTRUS_STORAGE_ROOT` (absolute and
per-checkout; the bootstrap sets it from `CLAUDE_PROJECT_DIR` and writes it into `.env`).

**Setup script:** paste the contents of `scripts/cloud-setup.sh`. Edit the file here, in a PR,
and re-paste — the dialog holds a copy, this repo holds the source. Changing the field makes the
next session rebuild the snapshot, which is how a change to it lands.

## Start a session

```sh
claude --cloud "…"        # from a checkout, at the pushed branch — the VM clones the remote
/remote-env               # once, to make this environment the CLI's default
claude --teleport         # pull a cloud session back into this terminal
```

Or from [claude.ai/code](https://claude.ai/code) with the repository and environment selected.
`/web-setup` links the local `gh` token and creates the first environment if you have none.

## What differs from a terminal session

- **Permission modes**: Accept edits, Plan, Auto. No Manual, no Bypass — `.claude/settings.json`
  `permissions` still applies, and the `deny` list is what keeps campaign-shaped tools out.
- **`main` is protected the same way.** The VM pushes only to the session's working branch, so
  the flow in `docs/tracker.md` is unchanged: branch, PR, wait for every `verify` check-run.
- **`gh` is installed by the setup script**, not by the image. GraphQL through the proxy is
  restricted to pull-request operations; `gh api repos/{owner}/{repo}/...` is the REST fallback.
- **Resources**: 4 vCPU, 16 GB, 30 GB disk, Ubuntu 24.04 x86_64. `pnpm verify` fits.
- **Only `pnpm verify` output is evidence** — that does not change because the machine is rented.
