# The permission classifier is a second deny list, and the repo does not configure it

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

Ticket 18 §4 asked for the deny list to be confirmed by a session that ran a whole ticket under
it. It was, and it held: exactly 5 of `Claude_Code_Remote`'s 20 tools reached the prompt, and no
denial from `.claude/settings.json` surfaced mid-ticket.

What did surface was a **different control**. Running in `Auto` permission mode on a cloud
container at `6c6e001`, a model-side classifier refused three Bash commands that
`permissions.allow` permitted:

- reading the session's OAuth token file descriptor (6.1 evidence gathering),
- writing workspace trust into `/root/.claude.json`,
- spawning the nested worker session that the whole §2 measurement depended on.

Each returned *"Blocked by classifier"* with an instruction to stop and ask the user. **The
session could not proceed until a human switched permission mode to `Accept edits`.**

That is the failure ticket 18 §4 exists to prevent — *"a refusal surfacing mid-ticket in an
unattended container"* — arriving through a door the repo does not control and had not looked at.
On an unattended container there is nobody to switch the mode, and `AskUserQuestion` is denied,
so the correct behaviour is not even available: the session would stop with the ticket unfinished
and no way to say so to anyone.

This is squarely under conductor v2, whose workers are unattended by definition and whose whole
job is spawning sessions — the exact action the classifier refused.

## The decision

1. **What permission mode does an unattended worker run in, and is the classifier active there?**
   `.claude/settings.json` sets `defaultMode: bypassPermissions` and `conduct.mjs` passes
   `--permission-mode bypassPermissions`; whether that suppresses the classifier is **unmeasured**
   — every classifier refusal here happened in the top-level session, which the runner started in
   `Auto`. Measure it before designing around it.
2. **Can a refusal be made legible to a conductor?** A classifier block is a tool error, not an
   exit code. A worker that hits one mid-ticket should leave a `## Stuck` note naming it, which is
   `PROMPT.md`'s existing shape — confirm a worker actually does that rather than looping.
3. **Does this change what a cloud session may be asked to do?** The three refused actions were
   all legitimate measurement, and two of them were *about* the sandbox. If a session cannot
   inspect its own environment, environment tickets have to be written differently — with the
   dispatcher taking the readings, or with the measurement narrowed to what the classifier allows.

## Guardrails

- Do not attempt to evade the classifier. Every refusal in ticket 18 was accepted and recorded;
  that is the behaviour this ticket wants preserved, not optimised away.
- Do not assume `bypassPermissions` disables it. That assumption is the whole risk.

## Acceptance

- [ ] Measured: whether the classifier refuses under the worker's actual permission mode.
- [ ] A stated rule for what an unattended session does when it is blocked and cannot ask.
- [ ] `docs/TRAPS.md` carries it — a classifier block reads like a permissions misconfiguration
      and is not one.

## Progress — 2026-08-13, container session (decision 1 measured; ticket stays open)

Decision 1's measurement exists. On a cloud container (`2026-08-13T17:42:19Z · linux x64 ·
node v24.19.0 · claude/worker-spawn-container-confirm-qrvqlo@ef91b76`, CLI 2.1.231, uid 0):
**no classifier refusal interrupted any nested worker** — six hand-run probe sessions and the
first real conducted worker (run `2026-08-13T17-52-09`, 93 turns), zero "Blocked by classifier"
events in any stream.

One correction to the question as asked: the worker's actual mode is not `dontAsk`. CLI 2.1.231
forces every nested mode to `default` wherever `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` is set (the
spawn-line ticket carries the measurement), so what was measured is the classifier's standing
under *forced-default with explicit `--allowedTools`* — which is the mode every worker actually
runs in. Every refusal ticket 18 recorded hit the top-level session, which the runner starts in
`auto`; none has ever hit a nested worker. The real worker did meet two refusals, and they were
*permission* denials, recorded by name in the run log's `permissionDenials` — a shape a
conductor can read, unlike a classifier block, which remains unobserved in a nested session.

The first acceptance box stays unticked deliberately: what was measured is absence over seven
sessions, not presence of a suppression mechanism — and the mode measured is forced-default,
not the literal `dontAsk` the box was written against. The stated rule for
blocked-and-cannot-ask (decision 2) and the TRAPS entry remain owed.
