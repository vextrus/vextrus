# The worker spawn line does not run on a cloud container

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

`scripts/loop/conduct.mjs` spawns its worker with
`claude -p … --permission-mode bypassPermissions`. Measured on a cloud container at `6c6e001`,
that command **cannot start there**, for two reasons that have nothing to do with the loop:

1. **The container runs as `uid 0`.** The CLI refuses: *"--dangerously-skip-permissions cannot be
   used with root/sudo privileges for security reasons"* — exit 1, **empty stdout**, so
   `parseWorkerOutput` returns all-nulls and the run looks like a worker that produced nothing.
   Every measurement in `docs/research/what-fills-a-cloud-session.md` had to set `IS_SANDBOX=1`
   to get a worker to start.
2. **The workspace is untrusted.** `/root/.claude.json` carries
   `hasTrustDialogAccepted: false`, so a nested session prints *"Ignoring 12 permissions.allow
   entries from .claude/settings.json"* and *"Ignoring 1 permissions.additionalDirectories
   entry"*. The `env` block and `deny` still apply; **the allow list a worker runs under is not
   the one the repo wrote.**

ADR-0011 made the cloud container the default surface. The loop's spawn line has never run on it.

## The decision

1. **What replaces `bypassPermissions` on a root container?** `IS_SANDBOX=1` is an undocumented
   environment flag and using it is exactly the "invisible incantation every spawner must
   remember" that ticket 18 §4 ruled against for `ENV_SCRUB`. Running the worker as a non-root
   user is the other candidate and costs a provisioning step. Rule it with a reason.
2. **Who accepts the trust dialog, and is a repo allowed to?** Writing
   `hasTrustDialogAccepted: true` into `/root/.claude.json` is a machine action; `provision.sh`
   is where machine actions live. But a provisioner that grants a workspace its own trust is a
   provisioner that disables a safety prompt — state the reading.
3. **Should `conduct.mjs` preflight both?** It now preflights `bwrap` and refuses by name. These
   two deserve the same treatment: an empty-stdout worker is the least diagnosable failure the
   loop has, and a campaign would blame its first ticket.

## Guardrails

- Do not paper over it with `IS_SANDBOX=1` inside `conduct.mjs` without ruling §1 first — that is
  the `ENV_SCRUB` mistake with a different variable name.
- Do not build the conductor (ticket 18's guardrail still stands).

## Acceptance

- [ ] Both faults ruled, with the reason, and a nested worker demonstrably started on a cloud
      container by the ruled mechanism.
- [ ] `conduct.mjs` refuses by name rather than producing a null-stdout worker.
- [ ] `docs/TRAPS.md` carries both, since both present as a broken worker and are neither.
