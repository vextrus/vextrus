# ADR-0011 — The cloud session is the default surface

**Date:** 2026-08-12 · **Status:** accepted

## Context

ADR-0007 founded the harness on a Windows workstation with a human in the chair, and ADR-0010
still describes a dispatcher who reads an evidence comment before clicking. From now on nearly
every session is a cloud container: a machine nobody is looking at, holding a checkout nobody
configured, running until it is reclaimed. The harness effort (`.wayfinder/harness`) closed
fifteen tickets making that machine *correct* — provisioned, probed, reported on. What it did
not re-examine is the part of the harness that assumes a person is present.

Measured on a cloud container at `9436eb7`, before any of the changes below:

- **The one mechanical guard in the repo had never run.** `.githooks/pre-push` is committed,
  but git reads `.git/hooks`; `core.hooksPath` was unset and the file was mode `644`. ADR-0008
  calls it "safety by mechanism, not by instruction" — on Linux it was neither.
- **`main` is unprotected on GitHub** (`"protected": false`). ADR-0010's amendment retires the
  SHA-stamped evidence comment in favour of a required check, "when the check exists". The
  workflow exists and goes green; the *requirement* does not, so the merge button today is
  gated by nothing but the human's own eye.
- **A session cannot ask a question.** `AskUserQuestion` is denied (ADR-0007's context trim) and
  no one is watching a container mid-run, while CLAUDE.md instructed sessions to "check in".
- **`ask` permission rules are a stall, not a gate.** `git push`, `git reset` and `rm -r` were
  set to prompt. A prompt in an unattended session is a container burning wall-clock until
  someone happens to look.
- **The citable fingerprint carried no commit.** `checkup`'s environment line named the time,
  platform, node and Postgres path — everything that varied except which tree it ran on.

## Decision

1. **A guard is mechanical or it does not exist.** `scripts/provision.sh` sets
   `core.hooksPath` and *asserts* it — reading the value back and testing the executable bit —
   and refuses the provision if either fails, the same "never report a machine you did not
   deliver" rule ticket 08 applied to the Node shadow. `pre-push` now also refuses a push to
   `main`, with a named override (`VEXTRUS_ALLOW_MAIN_PUSH=1`) because a guard with no door
   gets uninstalled instead of respected.
2. **A session's last act is a command, not a procedure.** `pnpm land` = fetch → merge
   `origin/main` → `pnpm verify` on the merged tree → push, refusing on a dirty tree, a
   conflicted merge, a red verify, and on `main`. ADR-0010's rule is unchanged; what changes is
   that following it is one word and the three subtle ways to get it wrong are now refusals.
3. **A session assumes, names, and finishes.** Where a reading is genuinely ambiguous, take the
   most defensible one, state it in the work and in the PR, and complete the task; stop only
   when proceeding would be unsafe or would make the result useless if wrong. This is the
   governing sentence applied to instructions instead of quantities: a named assumption is a
   disclosure, silence is the condemned state.
4. **Evidence is shaped, not remembered.** `.github/pull_request_template.md` asks for the
   ruling, the measurement with its machine and commit, the rejected alternative, and the
   verify/CI result — the four things a dispatcher needs before clicking.
5. **The workflow declares `permissions: contents: read`.** It reads a checkout and reports a
   status; a job that runs `provision.sh` should not hold a write credential it never uses.

## Not decided here, and named so it is not mistaken for done

- **Branch protection is a human action.** Requiring the `ci` check on `main`, with "require
  branches to be up to date", is what makes ADR-0010's amendment true. Until it is set, the
  amendment's supersession rests on the dispatcher reading the check by eye.
- ~~**The `ask` permission rules should go.**~~ **Landed the same day, on the dispatcher's
  explicit instruction** (see the amendment below). The first attempt was refused by the tool
  classifier — an agent may not rewrite its own permission rules unprompted, which is correct —
  and the refusal is why the change is recorded here rather than made silently.

## Consequences

- The three rules a session is most likely to break under pressure — don't touch `main`, merge
  before you verify, don't push red — stop depending on a session reading CLAUDE.md carefully.
- `pnpm land` becomes the only sanctioned push path, so a session that pushes by hand is a
  visible deviation rather than an indistinguishable one.
- CLAUDE.md shrank while gaining four subjects (`land`, `checkup`, the two Postgres paths, the
  no-one-is-watching rule): 5,410 → **5,287** chars of repo-authored content, 5,961 with the
  `next dev`-injected block that arrives whether we want it or not. ADR-0007's ≤6,000 cap
  holds, measured on the whole file.
- What was cut to pay for it: a *How to work here* section of response-style guidance that the
  platform prompt already carries. Derivable content is what the cap exists to keep out.

## Amendment — 2026-08-12: the permission surface stops being a second gate

Ruled by the dispatcher, in session, after the clause above was written: **a permission prompt is
not one of this repo's gates and must not behave like one.** The gates are named and mechanical —
`pnpm verify`'s exit code, the pre-push hook, the `ci` check, the human's merge click — and each
one works whether or not anybody is looking. A prompt does the opposite: it converts a routine
step into a stall whose only resolution is a person, which in a container nobody is watching is
indistinguishable from the session hanging.

- **`ask` is gone**, and the granular `Bash(...)` allow-list with it: under
  `defaultMode: bypassPermissions` it decided nothing, and on a machine placed in a stricter mode
  it decided the wrong thing — a session repairing a dead Postgres cluster or re-running the
  provisioner would sit behind a prompt for a command the harness itself tells it to run. The
  allow-list is now the tool names, `Bash` among them.
- **`deny` is unchanged, and stays a context decision, not a safety one** (ADR-0007). Two entries
  are load-bearing for autonomy rather than against it: `AskUserQuestion` and the plan-mode pair
  block on a human by construction, and this repo's answer to ambiguity is decision 3 above —
  assume, name, finish.
- **`BASH_DEFAULT_TIMEOUT_MS` is raised to 600s.** `provision.sh` (~70–100s), `pnpm parity`
  (~61–101s) and `pnpm land` (fetch + verify + push) all live well inside the old 120s default
  *until a machine is cold*, at which point the tool kills the repair the harness just prescribed.
- `additionalDirectories: ["/tmp"]` and `enableAllProjectMcpServers` follow the same rule: a
  scratch directory and a repo-declared MCP server are things a session is expected to use.

**What this does not touch.** Every mechanical refusal in the repo is still refusing: the push
guard on `main`, the loop's `.loop/ACTIVE` guard, `land`'s four refusals, `verify`'s exit code,
`provision.sh`'s assertions. Removing the prompts *raises* the value of those, because they are
now the only things that say no — and unlike a prompt, none of them needs a person awake.
