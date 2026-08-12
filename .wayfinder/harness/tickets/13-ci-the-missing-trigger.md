# CI — the missing trigger

wayfinder:grilling
Status: closed
Claimed by:
Blocked by:

## Objective

Decide whether CI exists, what fires it, and what it runs — then hand the building of it to a
spec. This ticket produces a decision, not a workflow file.

## What forced it

Three separate threads converge here, and none of them can advance without this one.

- **ADR-0007 refers work to a CI that does not exist.** `test:db` and Playwright are both placed
  "in CI"; `.github/workflows` is absent. The contract names a lane with nothing in it.
- **Ticket 07 could not chart a single per-commit capability, for want of an invoker.** Its
  ranking was staleness × invoker, and with no CI anywhere, everything that would run *per commit*
  scored zero and was declined — the new-contributor path, Linux-native behaviour, the lot. That
  is not a judgement about their value; it is the absence of anything to trigger them.
- **Ticket 06 named CI as the seam that would make the merge gate mechanical.** Until it exists,
  *"verify ran on this head"* is a human-read claim in a PR comment, and *"branch up to date"* is
  unenforceable — GitHub offers that setting only as a sub-option of required status checks.

The shape of the answer is already unusual and the grilling should start from it: **the script is
already written.** `pnpm parity` — checkup → verify → `test:db` → a `next dev` boot probed for 200
— runs on every cloud session and is the Linux-native check in full. What is missing is not a
thing to run but something to *run it, unasked, on a commit*.

## The question

1. **Does the cloud sandbox count as the lane, or is CI a thing beside it?** Every cloud session
   already runs `pnpm parity` from `provision.sh`. The gap is that a session is opened by a human
   with a ticket, not by a push. Is "a session per commit" a sane trigger, or an abuse of one?
2. **What does it run?** `pnpm parity` entire, or `verify` only, with `test:db` and the dev probe
   left to provisioning? ADR-0007 puts Playwright outside the verify lane — does CI inherit that,
   or is CI precisely where e2e was always going to live?
3. **What does it gate?** ADR-0010's merge protocol is currently honour-based. A required status
   check would make it mechanical — but the same ADR ruled that the click stays human. A check
   that gates the *button* without taking it is the target; confirm that is what required checks
   actually do.
4. **What does it cost?** Ticket 09 measured a container provisioning itself from empty in ~83s
   and `parity: ok in 57s`. A per-commit run is that, every commit, against a repo with no
   customer yet.

## Folded in from the map's fog

**When the build stage stops being cheap.** `next build` is verify's fifth stage and grows with
every route — 6.7s → 15.2s at ticket 01, 16–25s across ticket 09's runs. The standing ruling is
*re-measure, not relax*, but nothing re-measures it and no threshold is stated. That is the same
missing invoker wearing a different hat, so it is decided here or not at all: does CI carry a
timing budget, and does exceeding it fail a run or merely report?

## Guardrails

- **This ticket decides; it does not build.** A workflow file is `/to-spec` and `/to-tickets`
  territory. The map ends at the decision.
- Do not weaken `pnpm parity` to make it affordable per commit. If the full gate is too expensive
  to run on every push, the ruling is *which subset runs when*, stated as such — not a quieter
  gate pretending to be the same one.
- Nothing here may claim a customer, a deployment target, or a release process (`docs/CONTEXT.md`).

## Resolution

**CI is ruled: GitHub Actions, running the provisioner rather than a recipe of its own.**

> **Corrected 2026-08-12 by [ticket 15](15-secrets-and-git-identity.md).** This sentence read
> *"CI exists"*, which is what a ticket that decides a thing says when it forgets it did not build
> it. Ticket 15 went looking for the workflow to explain why its PR had no checks and found
> `.github/` absent from the tree and from `main` — the build had been handed to `/to-spec` and
> never done. **Now built** (`.github/workflows/ci.yml`): everything below except the `db:replay`
> step, which is held with its reason in the file, because the drill is red at head on ticket 10's
> unrepaired `0010`. **It goes green on a hosted runner — 77s, `parity: ok in 46s`, all four legs
> run.** The first run failed in 16s on a **provisioner** defect: `corepack enable` was `|| true`,
> and a runner is the first *non-root* machine this provisioner has met, so the pnpm shim never
> landed, the cause went to `/dev/null`, and the script died two lines later on
> `pnpm: command not found`. That is this ruling's own prediction on run one — *if `provision.sh`
> cannot stand up a runner, that is a provisioner defect and the right place to find it is here* —
> and it is what a workflow with its own `setup-node` would have hidden. The supersession clause
> was already written conditionally — *"takes effect when the check exists"* — so ADR-0010 and its
> amendment need no correction; only this claim did.

### The ruling

**One job, two commands.** Checkout (`fetch-depth: 0`) → `bash scripts/provision.sh` →
`pnpm db:replay`. The first is the whole gate by construction: `provision.sh`'s last act is
`parity.sh`, so checkout-and-provision *is* checkup → verify → `test:db` → a `next dev` boot
probed for 200. The workflow holds **no project knowledge** — no setup recipe, no Node version,
no Postgres service block, no stage list, no path filter. It cannot drift from what a session
runs because there is nothing in it to drift. A stage added to `verify` tomorrow is picked up
with no YAML change.

**Triggers:** `pull_request` → `main`, `push` on `main`, `workflow_dispatch`. No `schedule` —
nothing consumes a 3am result, and an unread red is worse than no signal (ticket 07's
staleness × invoker, applied to CI's own triggers). The `push` run is a **canary**, not a gate:
by the time it fires there is nothing left to block, and its job is to make *"is `main` broken,
or is it me?"* a lookup instead of an investigation — the question ticket 09 burned a session on.

**What it gates:** the PR run becomes a **required status check with "require branches to be up
to date before merging"**. That sub-option exists only once a required check does, which is why
ADR-0010 could not have it. Both halves of that ADR's merge protocol become mechanical: the tree
that was tested is provably the tree that lands. **The check unblocks the button; the human still
presses it** — confirmed as what required checks actually do, which was the ticket's question 3,
and it is exactly the target ADR-0010 described.

**`db:replay` runs unconditionally, and the skip lives in the script.** It already derives its
baseline from git history, so it is the thing best placed to say *"this commit adds no migration,
nothing to replay"* and exit 0. CI calls it blindly. This is the one check in the repo whose
failure is silent by design — a mangled register row is a wrong quantity, not a red build — and
it was the only one left honour-based (`CLAUDE.md`: *"wrote a migration? run it once"*). Ticket 10
built the drill without an invoker; this supplies it. `fetch-depth: 0` is load-bearing: Actions
shallow-clones by default, and the drill would fail on a **missing parent** rather than on a bad
migration.

**No timing budget** — CI reports stage timings, and nothing gates on them.

### The measurements that forced it

**The timing ruling was forced by a 2.2× spread on one commit.** Same tree, same container,
minutes apart:

| | build | verify total |
|---|---|---|
| during provisioning (machine's first touch of its own image) | 57.5s | **90.3s** |
| warm, minutes later | **23.5s** | **41.4s** |

A threshold tight enough to catch real route growth (say 60s) would have failed the first run and
passed the second, on identical source — a red whose cause is the machine's history, naming no
repair. That is precisely the unwritten latency assertion ticket 09 spent a session deleting, and
writing a new one into CI four tickets later would re-introduce the fault under a better name
(ticket 12 already ruled wall-clock *"a consequence, no target"*). The honest growth figure is
**8.4s → 23.5s** warm across this effort's life, still inside ADR-0007's <60s. What
*"re-measure, not relax"* actually lacked was never a threshold but a **series**: a green run on
every `main` commit makes the build stage's history queryable, so *"when it dominates"* becomes
something you can see rather than something you must remember to check.

**The cost premise in question 4 was wrong.** `vextrus/vextrus` is a **public** repo, so
GitHub-hosted standard runners are free and unmetered. The usual reason to refuse per-commit CI
does not apply, and "what does it cost" resolves to wall-clock only — provision-from-empty plus
parity, expected 2–4 minutes, well inside "a human reads the PR later" and irrelevant to sessions,
which already run parity locally.

**Playwright is a non-subject.** ADR-0007 places e2e "on demand + CI", but there is no Playwright
dependency, config, or spec in this repo — it exists only in prose (`CLAUDE.md`, ADR-0007,
`genesis.md`, this ticket). The ticket's sub-question "does CI inherit e2e, or is CI where it
lives" has no subject to decide about, and inventing a placement for vapour is how ADR-0007
acquired the dangling reference in the first place.

### Alternatives put and rejected

- **A cloud session per commit, the sandbox as the lane.** Zero parity risk — same image sessions
  work in. Rejected: nothing fires a session on a push, so the trigger would itself be a workflow,
  leaving Actions in the picture *plus* ~83s of provisioning before any work. It also fails the
  same test as a self-hosted runner: an invoker that needs a machine to be up is not unattended.
- **A workflow with its own setup recipe** (`actions/setup-node`, a `postgres:16` service block).
  The conventional shape, and rejected as a **second provisioner** — two recipes for one machine,
  drifting apart, each proving something about itself. That divergence is the thing this effort
  exists to kill. If `provision.sh` cannot stand up a runner, that is a provisioner defect and the
  right place to find it is here.
- **Two jobs, a fast `verify`-only check plus slow full parity.** Rejected: the fast one is a
  strict subset, so it never says anything the slow one won't, and it is two checks that can
  disagree about one tree.
- **`push` on every branch.** Rejected: under ADR-0010 every session branch becomes a PR, and
  GitHub fires `push` *and* `pull_request` for the same commit — two runs, two checks, one tree.
- **`pull_request` only, no `main` canary.** Tempting, since ADR-0010's arithmetic says a green
  up-to-date PR implies a green `main`. Rejected because that implication holds only when the
  branch really contained `main`'s tip, and it also gives up the known-good `main` baseline.
- **Required check without require-up-to-date.** Rejected: keeps the exact hole the seam was named
  to close — a green check on a stale branch still lands merged-red, which ADR-0010 called "likely,
  not exotic" now that `next build` is in the lane.
- **Advisory first, required later.** A reasonable first week and not the ruling: an advisory check
  nobody enforces decays into an unread red, which is the `schedule` objection wearing a different
  hat. Put and declined in favour of (a) straight.
- **A failing timing threshold**, and **a `db:replay` path filter in YAML** — both rejected above.
- **Re-opening ticket 07's declined per-commit candidates.** Its ranking was staleness × invoker
  and everything per-commit scored zero *for want of an invoker*; that premise is now false.
  Declined anyway: ticket 07 is closed and its reasoning was sound on the facts it had, and
  re-ranking a closed ticket's declines because a later ticket changed the world is how a map that
  has reached its destination starts growing again. What runs in CI beyond parity belongs to
  whichever effort wants it.

### Known limitation, named rather than papered over

**`ubuntu-latest` ships a Docker daemon, so CI takes the compose path.** It therefore exercises
the path the Windows workstation already exercises, and the **native-Postgres branch — the one
every cloud session actually runs — still has no unattended exerciser.** Forcing native by hiding
the daemon was considered and rejected: it is a lie told to the detector ticket 05 built, and a
detector fed a false premise stops being evidence. Left as fog rather than a ticket, because every
route to closing it depends on a measurement not yet taken — starting with whether `provision.sh`
goes green on a hosted runner at all.

### What this ticket hands on

- **The build is `/to-spec` → `/to-tickets`.** This ticket writes no YAML; the map ends here.
- **ADR-0010 gains a dated amendment** (written with this resolution): the required check
  supersedes the SHA-stamped evidence comment, because that comment's stated reason — *"nothing
  mechanical can confirm that a session ran verify"* — stops being true. A CI run is strictly
  better evidence: it runs on a machine the session cannot touch, at the head SHA, on a tree
  GitHub resolved itself, and it runs the whole gate rather than the one leg a session chose to
  paste. A session still runs `pnpm verify` locally — fast feedback and don't-push-red — it just
  stops testifying. **The supersession takes effect when the check exists**, not when this ticket
  closes; until the workflow lands, the evidence comment remains the only mechanism there is.
- **The native-path gap** graduates to *Not yet specified*.
