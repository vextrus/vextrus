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

## Progress — 2026-08-13, harness-grounding session (workstation; container confirmation owed)

Both faults are ruled; the container demonstration remains, so this stays open.

1. **bypassPermissions is gone from the spawn line** — replaced with
   `--permission-mode dontAsk --allowedTools <declared surface>`, which the uid-0 refusal does
   not apply to. Not IS_SANDBOX (unsupported incantation, per this ticket's own guardrail), not
   a non-root user (a provisioning step nothing else needs). Decisive new evidence: CLI 2.1.229
   *silently forces* a nested session's mode to default wherever CLAUDE_CODE_SUBPROCESS_ENV_SCRUB
   is set — stderr says "Declare allowedTools explicitly" — so bypass was already a no-op on
   every machine, and the ruled line is the CLI's own named repair. Proven on the workstation at
   63e088a: Bash and Write execute, denials land in permission_denials, exit 0.
2. **Trust is routed around, not pre-accepted**: the worker's allow surface travels on the spawn
   line (a CLI source), so the untrusted-workspace behavior of ignoring *project* allows stops
   mattering. No supported pre-acceptance exists (docs/research/the-harness-against-the-docs.md).
3. **conduct.mjs refuses by name**: an empty-stdout worker now halts with event `spawn-fail`,
   the CLI's stderr tail in HALT.md, and a TRAPS pointer — never a gate-fail blaming the ticket.

**What the cloud session must confirm** (the acceptance box that stays open): on a real
container, as root, untrusted workspace — (a) the dontAsk worker starts and can Bash/Edit/Write;
(b) permission_denials carries any refusal by name; (c) the --settings worker surface applies
(WebSearch denied); (d) hooks fire (SessionStart checkup) in the nested -p session.
