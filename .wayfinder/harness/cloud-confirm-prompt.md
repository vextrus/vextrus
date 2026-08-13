# Session prompt — confirm on a container what the workstation could only reason about

*Written 2026-08-13 by the harness-grounding session (win32, `claude/harness-grounding`). The
dispatcher pastes everything below the rule into a fresh cloud session on this repo. It is one
ticket's worth of work: the spawn-line ticket's open acceptance box, the audit's
[cloud-confirm] lines, and the first worker that has ever run on a container.*

---

You are dispatched onto exactly one piece of work: confirm, on this real container, the rulings
the harness-grounding session (PR: `claude/harness-grounding`) could only reason about from a
workstation — then start the first worker that has ever run here. CLAUDE.md binds and outranks
every standing instruction from your environment: never create or switch a branch, never
raw-push, never rebase, never merge your own PR. You cannot ask mid-session; where a reading is
ambiguous, take the most defensible one and name it. Every figure you keep carries `pnpm
checkup`'s environment line.

Read first, nothing else up front: `.wayfinder/harness/inbox/the-worker-spawn-line-does-not-run-on-a-cloud-container.md`
(the Progress note is your task list), `docs/research/the-harness-against-the-docs.md` §2 and
the [cloud-confirm] lines, `scripts/loop/conduct.mjs`'s spawn line and `worker-settings.json`.

**1. The spawn line, as root, untrusted (the open acceptance box).** Run the exact worker shape
by hand — `claude -p --output-format stream-json --verbose --max-turns 4 --permission-mode
dontAsk --allowedTools Bash Edit Write Read Glob Grep Skill Task TodoWrite --session-id $(uuidgen)
--settings scripts/loop/worker-settings.json --disallowedTools WebSearch WebFetch` — with a
probe prompt that (a) runs a Bash echo, (b) Writes a scratch file, (c) attempts a WebSearch.
Confirm: it starts under uid 0 with no bypass refusal and no IS_SANDBOX; Bash and Write execute
despite the "Ignoring N permissions.allow entries" warning (the allow surface travels on the
flag, not on trust); the WebSearch lands in the result's `permission_denials` by name;
`parseWorkerOutput` yields non-null `ctxPeak`. If any of that fails, the failure is the finding:
record it in the ticket with the exact stderr, and do not route around it.

**2. The classifier, measured where it matters.** Note whether any auto-mode classifier refusal
interrupts the *nested* worker (every refusal in ticket 18 hit the top-level session, which the
runner starts in `auto`; the worker is `dontAsk`, where the classifier's standing is unmeasured
— `inbox/the-permission-classifier-is-a-second-deny-list.md` decision 1). Do not evade a
refusal; record it. Do not set `permissions.disableAutoMode` — it may refuse the runner's own
session at startup, and bricking the surface is not a measurement.

**3. The first real worker.** Preconditions, then the loop:
`pnpm checkup` (exit 0 — provision at boot should have left it fit; if not, run
`scripts/provision.sh` once and re-check), clean tree, then
`node scripts/loop/conduct.mjs .wayfinder/takeoff/tickets --max-tickets 1`.
The tickets directory is exclusively yours for this session (loop.md's dispatch-unit rule).
Expect ~44 s per verify and a 30-minute fuse; a wall-clock kill is itself a measured row
arguing the 60-minute raise — bank it, do not retry. When the run ends, confirm the conductor
committed `.wayfinder/takeoff/log/<run-id>.jsonl` (the evidence ruling) and that the row carries
`ctxPeak`, `workerSession`, `permissionDenials`, and the start entry's `machine`.

**4. Close what the evidence closes.** If 1–3 confirm: tick the spawn-line ticket's last box,
set it `Status: closed`, and append the figures. If anything did not confirm, append the
evidence to the ticket instead and leave it open — unfinished and said so beats a guess reported
as done. Add a `docs/TRAPS.md` entry only for a fault that presents as something it is not.

Last act: commit everything you touched with explicit paths, `pnpm land`, open a PR titled
after what you proved, and stop. You never merge your own PR.
