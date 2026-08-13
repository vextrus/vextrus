# The worker spawn line does not run on a cloud container

wayfinder:grilling
Status: closed
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

- [x] Both faults ruled, with the reason, and a nested worker demonstrably started on a cloud
      container by the ruled mechanism.
- [x] `conduct.mjs` refuses by name rather than producing a null-stdout worker.
- [x] `docs/TRAPS.md` carries both, since both present as a broken worker and are neither.

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

## Progress — 2026-08-13, container confirmation (closed)

Machine, carried by every figure below: `2026-08-13T17:42:19Z · linux x64 · node v24.19.0 ·
claude/worker-spawn-container-confirm-qrvqlo@ef91b76 · postgres via native (no docker daemon)`
— Claude Code CLI **2.1.231**, uid 0, workspace untrusted (`hasTrustDialogAccepted: false`),
runner-ambient `IS_SANDBOX=yes` (absent from PID 1 — injected per session, not container state).
`uuidgen` does not exist on this image; the session UUID went onto `--session-id` from node's
`crypto.randomUUID()` — same flag, same shape.

The exact spawn line ran by hand six times (probes A–F), then the first real worker ran through
`conduct.mjs`. (a)–(d) all confirmed; three movements found on the way:

1. **The ruled mechanism works, and not by incantation.** The dontAsk worker starts as uid 0 on
   the untrusted workspace — exit 0, full stream — and starts identically with
   `env -u IS_SANDBOX` (probe B). Bash executes (`probe-bash-ok uid=0`), Write executes, the
   SessionStart hook fires (checkup ran in the nested `-p` session), and `parseWorkerOutput`
   yields non-null `ctxPeak` (23,343 / 24,540 / 22,681 / 22,618 across probes; window 1e6). The
   trust warnings print exactly as measured at 6c6e001 ("Ignoring 12 permissions.allow
   entries", "Ignoring 1 permissions.additionalDirectories entry") and cost nothing: the allow
   surface travels on the flags.
2. **Movement: the ENV_SCRUB forcing now catches every mode (CLI 2.1.231).** stderr says
   "Permission mode forced to default — CLAUDE_CODE_SUBPROCESS_ENV_SCRUB is set
   (allowed_non_write_users hardening)" for `dontAsk` too, and the init event confirms
   `permissionMode: "default"`. Measured consequences: the uid-0 `bypassPermissions` refusal is
   unreachable under the scrub (probe E: bypass *starts*, forced to default, exit 0 — the
   exit-1/empty-stdout shape cannot reproduce here); un-allowed schema-present tools with
   permissive defaults still execute (probe B: the runner-injected `SendMessage` ran), so
   forced-default is not fail-closed the way literal dontAsk would be; and unscoped
   `--allowedTools` entries execute anywhere (probe C: `Write` landed a file in `/tmp` although
   trust ignores `additionalDirectories` — flag allows are not bounded by the workspace). The
   spawn line stands: what it names is what runs, which is the property the loop needs.
3. **Movement: socat joined bubblewrap as a scrub dependency (~2.1.231).** With bubblewrap
   0.9.0 alone the worker starts but **every Bash call fails**: "Sandbox is required but failed
   to initialize: Sandbox dependencies not available: socat not installed. Restart to retry." —
   and `dangerouslyDisableSandbox: true` is refused the same way (probe A, exact text). Ruled
   the ticket-18 way at 449b7c7: provision.sh installs socat beside bubblewrap, checkup reports
   it, conduct.mjs preflights it by name (a worker that starts and cannot Bash burns its turns
   and fails every gate blaming the ticket), TRAPS carries it.
4. **Movement: a settings/flag deny is a prune, not a denial.** WebSearch/WebFetch are absent
   from the init tool schema; the worker's own ToolSearch finds nothing; `permission_denials`
   stays `[]`. Denial-by-name lands only for a schema-present, un-allowed, ask-default tool —
   probe D (allows narrowed to Read Glob Grep) recorded
   `{tool_name: "Write", tool_use_id, tool_input}` and the file was not created. So on the real
   spawn line `permissionDenials: []` reads "nothing was refused", pruned tools never appear
   there, and the init tool list is where "which tool was missing" lives for them.
5. **Classifier (the second-deny-list ticket, decision 1):** no auto-mode classifier refusal
   interrupted any nested session — six probes and the first conducted worker, zero "Blocked by
   classifier" events, all under the worker's actual (forced-default) mode.
6. **The first real worker ever run here advanced its ticket.** Run `2026-08-13T17-52-09`
   (start machine `linux x64 · node v24.19.0 · 449b7c7`): frontier chose
   `10-the-design-system.md`; worker session `d8fdb1dd-3552-48a6-9956-c379249006be`;
   **advance** with all four gates true — 93 turns, $3.82, wall 964s (~16 min, inside the
   30-minute fuse: no wall-clock-kill row to bank toward the 60-minute argument),
   `ctxPeak` 135,417 of a 1,000,000 window over 171 calls (under the 150,000 line),
   `testDamage` none. `permissionDenials` fired by name in the real run — two Bash calls with
   `dangerouslyDisableSandbox: true` refused, the hardening holding inside a real worker with
   the sensor recording it. The conductor committed its own evidence
   (`.wayfinder/takeoff/log/2026-08-13T17-52-09.jsonl` at 2b660a6); the worker closed its
   ticket honestly at efe1778, with a named deviation (no throwaway branch — CLAUDE.md forbids
   branch creation) and a named environment fault it could not remove, only route the scanner
   around (the /dev/null dotfiles; probe F confirmed they exist *only inside* the nested
   session's bubblewrap namespace — TRAPS carries it).

Still unconfirmed from the workstation audit's [cloud-confirm] list (outside this ticket's
scope): `enableAllProjectMcpServers` under trust gating (no `.mcp.json` exists to test),
`autoMode` settings-key honor, and `permissions.disableAutoMode` — deliberately untested, since
it may refuse the runner's own `auto` session at startup, and bricking the surface is not a
measurement.
