# The harness for an unattended machine

wayfinder:grilling
Status: closed
Claimed by: dispatcher (review session, 2026-08-12)
Blocked by:

## Objective

Fifteen tickets made the cloud *machine* correct. This one asks the other half: which parts of
the harness still assume a **person is present** — a workstation, a chair, someone to answer a
prompt or read an evidence comment — now that nearly every session is an unwatched container.

## What forced it

The effort's own destination is *parity and legibility*, and its standing preference is to retire
prose into mechanism. Both were applied to the machine and never to the session protocol, which
is still almost entirely prose: don't work on `main`, merge before you verify, don't push red,
check in when unsure. Prose is exactly what an unattended session is worst at honouring, because
there is nobody to catch it when it doesn't.

## Resolution

**The rule that has never once executed is worse than the rule nobody wrote down.** Five findings,
all measured on a cloud container at `9436eb7` before anything was changed; the ruling in full is
[ADR-0011](../../../docs/adr/0011-the-cloud-session-is-the-default.md).

- **`.githooks/pre-push` had never run on Linux.** It is committed, and that is all it was: git
  reads `.git/hooks`, `core.hooksPath` is repository-local config no clone carries, and the file
  was mode `644` — so a non-executable hook at an unread path is skipped in silence. ADR-0008
  calls this guard "safety by mechanism, not by instruction"; on this platform it was neither, and
  the campaign guard it exists for would have let every worker push. **Cured at the provisioner**:
  `provision.sh` sets `core.hooksPath`, then reads it back and tests the executable bit, and
  **refuses the provision** if either did not take — ticket 08's rule that the thing asserted must
  be the thing measured. Then the hook was given the second guard it should always have had: a
  push to `main` is refused, with a named override, because *never `main`* was prose in CLAUDE.md
  and prose does not survive a session that mis-reads it. Proven both ways on a real push, not a
  dry run: refused on `HEAD:main`, silent on the session branch.
- **`main` is unprotected on GitHub** (`"protected": false`, read from the API). ADR-0010's
  amendment retires the SHA-stamped evidence comment "when the check exists" — the workflow exists
  and is green on four runs, but nothing *requires* it, so the button is gated by the dispatcher's
  eye alone. **Not fixed here and deliberately not papered over**: branch protection is an
  administrative act this session cannot perform, and it is now the one named human step in the
  landing path.
- **A session was told to check in and cannot.** `AskUserQuestion` is denied (ADR-0007's context
  trim) and no one watches a container mid-run, while CLAUDE.md's closing section said to check in
  when readings differ. Ruled in favour of the deny: **assume, name, finish** — take the most
  defensible reading, state it in the work and the PR, stop only when proceeding would be unsafe
  or the result useless if wrong. That is the governing sentence applied to instructions rather
  than quantities.
- **`ask` permission rules stall instead of gating.** `git push`, `git reset`, `rm -r` prompt a
  human who is not there. Their subjects are covered mechanically now — `main` by the hook,
  landing by the click, a bad reset by the reflog. **Recommended, not landed:** the permission
  classifier refuses an agent editing its own permission rules, which is the correct behaviour,
  so the exact diff is recorded for the dispatcher instead of applied.
- **The citable fingerprint carried no commit.** `checkup`'s environment line named time,
  platform, node and Postgres path — everything that varied except the tree. Now
  `branch@sha +dirty`, read locally, no network: ticket 07's citability rule finally complete.

**Rule 6 became a command.** `pnpm land` = fetch → merge `origin/main` → `pnpm verify` on the
merged tree → push, refusing a dirty tree, a conflicted merge, a red verify and `main` itself,
with backoff on the two network calls. ADR-0010 is unchanged in substance; what changes is that
its three subtle failure modes — rebase instead of merge, verify the pre-merge tree, push red —
are refusals rather than reading comprehension. Node and not bash, because it also runs on the
Windows workstation where `bash` from PowerShell is WSL (ADR-0008's own trap).

**Put and rejected:**

- *Repair in the SessionStart hook* — rejected again, on ticket 12's reasoning, but the cheap
  repair is now **named**: when the *only* BROKEN line is the database and the machine is on the
  native path, `checkup` reads the cluster's own status and prints the ~2s
  `pg_ctlcluster … start` before the ~60s provisioner. The map asked exactly this question and
  left it open. Reporting a cheaper repair is still reporting.
- *Making the unwired hook a BROKEN line in `checkup`* — rejected: fitness is defined as verify,
  `test:db` and dev being able to run, and an unwired hook stops none of them. It is an `INFO`
  on the git line, and the **provisioner** is what enforces it. Widening "fit" to mean "correctly
  configured" is how a checkup becomes a second verify.
- *A second CI job that stops the Docker daemon to exercise the native path* — put, and left as
  the map's open item rather than smuggled in here. It is a real gap with a real design question
  (an unrequired red is the unread signal ticket 13 refused `schedule` to avoid), and it deserves
  its own measurement rather than a rider on a review session.
- *Keeping the response-style section of CLAUDE.md* — rejected: the platform prompt already
  carries it, and derivable content is what ADR-0007's cap exists to exclude. Cutting it paid for
  `land`, `checkup`, the two Postgres paths and the no-one-is-watching rule, and the file came out
  **smaller**: 5,410 → 5,287 chars of repo-authored content (5,961 with the injected Next.js
  block), against a ≤6,000 cap.

Also corrected while in the file: CLAUDE.md's `DB:` line said *compose-managed*, which is false on
every cloud container and was the single sentence a cloud session was most likely to read first
about its own database.

`pnpm verify` green **32.8s** before the changes and **39.2s** after, on this container at
`9436eb7` — the delta is the build stage (19.8s → 21.1s) on a machine ticket 13 measured at a
2.2× spread for its own history, and nothing here adds a stage. `checkup` fit in **1.4s** in hook
mode, 2.5s bare.
