# checkup calls a reserved port free

wayfinder:task
Status: open
Blocked by:
Claimed by:

## Objective

`pnpm checkup` printed `[ok] port 3210 free` and, minutes later on the same machine, `pnpm dev`
died with `listen EACCES: permission denied 0.0.0.0:3210`. The port was inside Windows'
dynamically reserved block **3130–3229** (`netsh int ipv4 show excludedportrange protocol=tcp`).

The check tests whether anything is **listening**. The question it is asked is whether the port
can be **bound**. Those differ exactly when the answer matters — a reserved port has no listener,
so it looks maximally free right up until it refuses.

This is the harness effort's own failure mode, in the tool built to prevent it. The destination
says *"the workspace answers a session's questions mechanically instead of in prose"*, and
`checkup`'s promise is that a confused session measures instead of recalling a trap. Here it
measured, was believed, and was wrong — worse than silence, because `checkup: fit for work` is
the line that stops you reading `docs/TRAPS.md`. This is the **third** occurrence of the
reservation fault in four days (5433 → 5544 → 3210, TRAPS.md §Windows); the trap is well known
and the instrument still misses it.

## The work

Bind-test rather than listener-test, on every port `checkup` reports. Attempt an actual bind on
`0.0.0.0`, close immediately, and report what it learned:

- binds → `ok`
- `EADDRINUSE` → in use, and by what if cheaply knowable (today's answer, still correct)
- `EACCES` → **reserved**, which is a different repair and must say so: name the blocking range
  from the exclusion list and point at TRAPS.md's `netsh` cure, since "free" and "reserved" send
  you to opposite places

## Guardrails

- **Windows-only diagnosis, cross-platform check.** The bind test is portable; the
  `excludedportrange` lookup and the `netsh` repair are Windows'. On Linux an `EACCES` on a high
  port means something else and must not print the Windows cure.
- `checkup` runs in ~1s and describes rather than judges where it cannot assert a standard
  (ticket 15). A bind-and-close is microseconds and asserts something real, so it stays inside
  that budget and inside that rule.
- Do not widen this into a port allocator. The ports are fixed (3210, 5544); the defect is that
  the report is wrong, not that the numbers need managing.

## Acceptance

- [ ] `checkup` distinguishes free / in-use / **reserved**, by binding.
- [ ] The reserved line names the blocking range and the repair; `NOT fit for work` follows,
      because a port that cannot be bound is not fitness.
- [ ] Covered by a test that does not depend on a port being reserved on the test machine.
- [ ] TRAPS.md's third-occurrence note points here, and is trimmed to a pointer once this lands.
