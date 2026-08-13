# The cloud campaign — parallel sessions, mechanical landing, unattended arcs

**Status:** items 8.1–8.5, 8.7 and 8.10 are landed; 8.6 is half-landed and half-refused by GitHub;
**8.8 and 8.9 are deliberately not built** — they rest on measurement 6.1, which can only be taken
in a cloud session, and building a dispatch mechanism against an unmeasured seam is the guess this
spec exists to avoid. See §8. Written from a local exploration session on
`2026-08-13T07:29:15Z · win32 x64 · node v24.12.0 · main@00c6ce3 +dirty · postgres via compose ·
Debian 16.14-1.pgdg13+1`, against the completed first parallel wave (PRs #16–#24, takeoff tickets
01–09).

Supersedes nothing on its own. It proposes amendments to ADR-0010 and ADR-0008 and a successor to
`docs/specs/loop.md`; each is marked. The cloud-side measurements it owes are named in §8 and are
**not** guessed here.

---

## 1. What was measured

The first parallel wave is the only real data there is. Nine tickets, nine branches, nine PRs,
all merged 2026-08-13 between 06:00Z and 07:12Z.

**The merge conflicts were one file, one region, six times out of seven.** Replaying every
session-side merge with `git merge-tree --write-tree <p1> <p2>`:

| merge commit | PR | conflicted paths |
|---|---|---|
| `861ee17` | #18 | `.wayfinder/takeoff/MAP.md` |
| `5d59bc5` | #19 | `.wayfinder/takeoff/MAP.md` |
| `5210d0b` | #20 | `.wayfinder/takeoff/MAP.md` |
| `98aa85f` | #21 | `.wayfinder/takeoff/MAP.md` |
| `b25406a` | #22 | `.wayfinder/takeoff/MAP.md` |
| `5e1af40` | #23 | `.wayfinder/takeoff/MAP.md` |
| `e31caae` | #24 | *(none — clean)* |

Nothing else conflicted. Not once. `docs/domain/identity.md` was edited by three PRs,
`quantity-contract.md` by three, `cad-ingestion.md` by two — every one auto-merged. Git's 3-way
merge handled every genuine prose edit in the repo and failed only on the one structure that
guarantees failure: **an append-only bullet list where every ticket appends at the same line.**
The conflicting hunks in every case sit at the tail of *Decisions so far*, on the boundary with
*Not yet specified* (base `8b80356`, branch hunk `@@ -108,6 +108,20 @@`, main hunk
`@@ -104,10 +104,36 @@`).

ADR-0010 predicted exactly this ("the first friction in real concurrency will be `MAP.md`
conflicts") and treated it as acceptable friction. At two sessions it is. At nine it is the whole
problem, and **the next wave is ten** (`node scripts/loop/frontier.mjs .wayfinder/takeoff/tickets
--list` → 10, 11, 12, 13, 17, 19, 20, 23, 24, 25). Fourteen of the seventeen open takeoff tickets
are `wayfinder:grilling`; every one of them ends by appending a decision line to `MAP.md`. Run
them as-is and the arithmetic is nine guaranteed conflicts, serialized.

**A silent ticket-number collision already happened, and git could not see it.** On
`claude/raster-to-geometry` at `ba219d7` the session created
`23-the-effective-resolution-gate.md` and `24-the-dimension-annotation-lane.md`. On
`claude/vector-pdf-entity-graph` at `785cff6` a different session created
`23-the-lane-fidelity-declaration.md` and `24-who-decomposes-a-pdf-page.md`. Two 23s and two 24s.
Because the filenames differ, git sees four unrelated file additions and merges them **without a
conflict** — the collision is invisible to every mechanism in the repo, and was repaired by hand
during resolution (the tree now carries 23, 24, 25, 26). A `Blocked by:` line naming
`23-...md` written on one branch would have pointed at the other branch's ticket after the merge,
and `frontier.mjs` would have answered confidently and wrongly. This is a fail-*open* defect in a
repo whose governing sentence forbids exactly that.

**Landing was serialized on a human, and every session was already dead.** `main` is protected
with `strict: true` and `enforce_admins: true`, required check `parity`. `strict: true` means
that the instant PR *n* merges, PRs *n+1…9* are out of date and cannot merge. Each session had
already done its `pnpm land` (fetch → merge → verify → push) and exited. So every subsequent PR
needed a **second actor** to re-land it, and the only actor in the system was the dispatcher.
The merge timestamps show the treadmill: 06:00, 06:06, 06:15, 06:28, 06:33, 06:44, 06:53, 06:59,
07:12 — nine merges, ~72 minutes, one at a time, a human in the loop for every one.

That is where the "agents refused to merge" friction actually came from. The refusal was correct
behaviour against a correctly-written rule; the fault is that the system had **no non-author
party capable of re-landing a PR**, so the only way forward was to argue the author session out
of its own instruction. A rule that has to be overridden two or three times per wave to make
progress is not a gate — it is a stall, and ADR-0011's amendment already ruled on stalls.

**The harness's own context cost is not the problem.** Repo-authored session context, measured
locally: `CLAUDE.md` 5,928 bytes (2.2k tokens as loaded, including the `next dev`-injected block;
ADR-0007's ≤6,000-byte cap holds), skills listing 854 tokens, SessionStart `checkup` output ~400
tokens. Total repo surface ≈ 3.5k of a 15.4k local startup. The cloud delta the dispatcher
measured (29.3k vs 15.4k) is ~9.7k of *Claude Code Remote* MCP tool schemas plus a larger platform
prompt — **none of it repo-authored, and none of it fixable by shaving CLAUDE.md.** Locally, MCP
schemas are deferred (10.1k, not counted in the 15.4k); in cloud they appear to be resident.

**The loop's caps rest on n=3.** `.loop/2026-08-12T05-24-16/log.jsonl`, three honest closes:
turns 30 / 59 / 73, wall 458s / 1,030s / 1,039s, cost $2.47 / $6.32 / $7.35. `MAX_TURNS = 150` is
2.05× the observed maximum — defensible. `WALL_CLOCK_MS = 30min` is **1.73×** the observed
maximum, on a fast local machine, for the cheapest ticket class in the repo. That is not a fuse,
it is a coin flip.

**Baseline health.** `pnpm verify` green in 16.1s at `main@00c6ce3` (the loop spec's "~4s" is
stale — `next build` at 8.0s is now over half of it). `pnpm checkup` reports **NOT fit for work**
on this machine: `pg profile — locale en_US.utf8, want C.UTF-8`. That is this workstation's fault,
not the tree's, and it would refuse a local campaign at preflight. It is why the campaign belongs
in the cloud.

---

## 2. Diagnosis — five distinct faults, only one of which is about merging

1. **A conflict-generating data structure** (`MAP.md § Decisions so far`) that every parallel
   session writes to. Cause of 6/7 conflicts. Nothing to do with agents, cloud, or Opus 5.
2. **Session-allocated identifiers** (`NN-` ticket filenames) with no allocator. Cause of one
   silent, git-invisible collision.
3. **No relander.** `strict: true` requires every non-first PR to be brought forward; the only
   party who can do it is the author session, which has exited. Cause of the human treadmill and,
   downstream, of the rule-override friction.
4. **A rule written for a world with no CI, still binding in a world with CI.** ADR-0010's "the
   click is the gate" was justified by *"nothing mechanical can confirm that a session ran
   verify"*. Its own amendment retired that sentence. What survived is the click as a **review**
   gate, which is a different and much weaker claim — and an unattended campaign has no reviewer
   awake to exercise it.
5. **A loop built for one sequential worker on one workstation**, whose safety model
   (`.loop/ACTIVE` blanket push-ban, one checkout, halt-the-world on any gate failure, one
   end-of-campaign mega-merge) is actively wrong for N containers each holding their own branch.

---

## 3. The merge rule — replace, do not delete

**Ruling: commit a changed CLAUDE.md, not the current deletion.**

The uncommitted diff removes the sentence and puts nothing in its place. That is worse than
either keeping it or replacing it, because it leaves the repo silent on the one thing the rule
was actually protecting: **an author must not close its own work.** With the sentence simply
gone, a session that opens a PR and merges it thirty seconds later violates nothing written down.

The principle worth keeping is the loop's founding law — *doer ≠ judge* (ADR-0008) — not the
human's finger. The click was only ever the *implementation* of that law for a repo with no CI
and no other actor. There are now two mechanical judges the author cannot touch: the `parity`
check running the whole gate on a tree GitHub resolved itself, and `strict: true` guaranteeing
that tree is current.

Proposed replacement for CLAUDE.md session-protocol item 6, final clause:

> **You never merge your own PR:** landing is not the author's act.

Landed at that wording — the longer draft naming the three landing parties (merge queue,
conductor, dispatcher) pushed the file to 6,039 bytes against ADR-0007's ≤6,000 cap, measured on
the whole file per ADR-0011. It sits at **5,998**. The parties belong in ADR-0010's amendment,
which is where a session looks them up; CLAUDE.md carries only the prohibition.

This is one sentence, same budget, and it is *true under automation*: it forbids self-merge
(preserving doer ≠ judge) without requiring a human to be awake (making AFK possible). A session
reading it in an unattended container is not put in the position of having to break it to finish.

**Put and rejected:**
- *Keep "the click is the human's".* Refuted by measurement: it was overridden 2–3 times in a
  single 72-minute wave, and it makes a 100%-AFK campaign definitionally impossible. ADR-0010's
  own reasoning against "merge is a human act on the human's machine" — *"a local-only merge rule
  would be a rule that gets broken"* — applies to itself.
- *Delete it, as currently staged.* Leaves self-merge unregulated. The failure mode is a session
  that verifies its own work, judges its own work, and lands its own work, which is the exact
  configuration ADR-0008 says produces autonomy-by-trust.
- *Say nothing in CLAUDE.md and enforce only mechanically.* Attractive (mechanism beats prose),
  but the mechanism — a merge queue ruleset — is a GitHub setting that no checkout carries and
  that a session cannot read. ADR-0011's rule is that a guard is mechanical *and* named; the
  sentence is the naming.

---

## 4. ADR-0010 revisited — what stands, what changes

Proposed as a second amendment to ADR-0010 rather than a new ADR: the decision structure is
unchanged, three clauses move.

**Stands, unchanged:**
- Merge, never rebase. A rebase invalidates the verify that justified the commits.
- Branch per session, dispatcher-created. A session never creates, renames or switches a branch.
- A session that finds an unexpected claim stops.
- The up-to-date requirement. It is now mechanical (`strict: true`) and it is what makes the
  landed tree the tested tree.

**Changes:**

| clause | today | proposed |
|---|---|---|
| *"the click is the human's and it is the gate"* | human presses merge | **the merge is mechanical and non-author**: merge queue, or the conductor via `gh pr merge --auto --squash`. The gate is `parity` + the review check (§6), both of which the author cannot touch. |
| *"the dispatcher sets `Claimed by:` on `main` at dispatch"* | a human edit + push to `main` | **the conductor claims via the GitHub contents API with the blob `sha` as an if-match precondition** — a compare-and-swap, atomic under N concurrent dispatchers, no checkout, no push, no `VEXTRUS_ALLOW_MAIN_PUSH`. The rule's *intent* (claims live where a second dispatch looks) is preserved and finally made race-free. |
| *"the loop's unit is the arc directory"* | one campaign owns a directory, workers self-select inside it | **the unit becomes the ticket again**, because the conductor now claims atomically on `main`. The arc-directory exemption existed only because there was no atomic claim; it goes away rather than being extended to N parallel workers, where it would be unsound. |

**Also proposed:** disable merge commits, squash only. History today is mixed (#16–#23 landed as
merge commits, #24 squashed). The boundary review's scope is `git diff <arc-start>..HEAD`; a
linear one-commit-per-ticket `main` makes that scope exact and makes `git log --oneline` a ticket
ledger. ADR-0010's own tree-identity argument (a squash of an up-to-date branch produces a
byte-identical `main` tree) already assumed squash.

---

## 5. Kill the conflict classes before the next wave

These are prerequisites, not improvements. Ten tickets are on the frontier and all ten write
`MAP.md`.

### 5.1 One file per decision

`MAP.md § Decisions so far` becomes `.wayfinder/<effort>/decisions/<NN>-<ticket-slug>.md`, one
file per closed ticket, each holding what a resolution owes: the ruling, the measurement that
forced it, the alternative put and rejected. `MAP.md` keeps *Destination*, *Notes*, the
non-functional bar, *Not yet specified*, *Out of scope* — the slow-moving parts. Two sessions
closing two tickets then write two different files and merge cleanly by construction. Existing
decision bullets migrate in one commit.

**The file's name is its ticket's file name** (`tickets/06-….md` → `decisions/06-….md`), so
nothing is allocated at close time and nothing can collide — the number was allocated once, when
the ticket was created. Charting-time rulings, which belong to no ticket, are one file
(`00-charting.md`): charting is one session's act and never runs concurrently.

**And deliberately no committed index file.** An `INDEX.md` listing every decision is a file every
closing session appends to — the same conflict, one level down. The directory listing is the
index, and it sorts correctly because the names are the tickets' names. *(Considered and dropped
while implementing: generating the index from each ticket's `## Resolution` lead paragraph. The
leads are not written as gists — ticket 07's is "Two files carry the detail; this holds the
rulings", 02/03/04's describe where the amendment landed — so extraction produces a worse index
than the prose being replaced.)*

*Put and rejected:* a `merge=union` driver in `.gitattributes` for `MAP.md`. It resolves the
mechanical conflict and produces silently interleaved prose with no conflict marker to warn
anyone — trading a loud failure for a quiet one, in a repo whose governing sentence names
silence as the only condemned state.

*Named consequence:* the same pattern is about to recur. Ticket 09 rules that **every rail ticket
appends its cases to the torture-corpus index**. If that index is one file, it becomes the next
`MAP.md` — worse, because its conflicts are in machine-read data rather than prose. It must be
file-per-case, or a directory the meta-test globs, from the day it is built. This constraint
belongs in ticket 09's acceptance list before ticket 13 opens.

### 5.2 No session allocates an identifier

A session that discovers new work writes `.wayfinder/<effort>/inbox/<slug>.md` — **slug only, no
number**. Distinct slugs are distinct files, so allocation collisions become git-visible
(same-slug = same path = a real conflict) instead of git-invisible. The conductor assigns the
number and moves the file into `tickets/` when it lands, in the same single-writer step that
writes claims. `frontier.mjs` ignores `inbox/`; the conductor refuses to promote an inbox ticket
whose `Blocked by:` names a file that does not exist.

*Put and rejected:* keep numbers and have the session pick `max+1` from `origin/main`. This is
exactly what produced the measured collision — every parallel session reads the same `max`.

### 5.3 A relander, because nobody is left to land

Two mechanisms were proposed, in order of preference. **The first is unavailable, so the second is
not a fallback — it is the mechanism.**

1. ~~**A merge queue.**~~ **Refuted by probe, 2026-08-13.** A queue would remove the whole §1
   treadmill: PRs are enqueued, GitHub builds the speculative merge, runs `parity` on *that*, and
   merges in order. It is configured through rulesets, and
   `POST /repos/vextrus/vextrus/rulesets` with a `merge_queue` rule returns **422, `Invalid rule
   'merge_queue'`**. A plain ruleset (a `deletion` rule on a throwaway ref pattern) was accepted
   and deleted in the same probe, so this is `merge_queue` specifically and not rulesets or
   permissions. The cause is ownership: GitHub restricts merge queues to **organization-owned**
   repositories, and `vextrus/vextrus` is user-owned (`owner.type: "User"`, public). **Moving the
   repo to an organization is the only route to a queue**, and it is a decision with consequences
   well outside this spec — named here, not taken.
2. **The relander.** Built: `scripts/reland.mjs` / `pnpm reland`. For each open PR whose
   `mergeStateStatus` is `BEHIND`, it calls GitHub's **update-branch** endpoint — the merge happens
   on GitHub, against the head GitHub resolved, and it merges rather than rebases (ADR-0010).
   `expected_head_sha` makes it optimistic-concurrent: if the branch moved since the listing, GitHub
   refuses rather than merging into a head nobody looked at. No checkout, so no working tree to
   corrupt and no second writer.

   It **never resolves a conflict**: `DIRTY` is reported and the PR left exactly as it is, for a
   session on that branch. A relander that resolves conflicts is a second doer, and ADR-0010
   already names the failure mode — resolving by discarding the other branch's work. It also
   leaves `BLOCKED` and `UNSTABLE` alone: those are up to date, and updating them would restart CI
   for no reason and hide why they are blocked.

---

## 6. The cloud campaign — successor to `docs/specs/loop.md`

The current loop is single-worker, one-checkout, local, and lands as one end-of-campaign merge
its own spec calls "the riskiest merge in the system". In the cloud, containers are the isolation
the old design had to fake. The shape inverts.

```
conductor (durable, non-interactive)
  ├─ claim ticket on main            (contents API, CAS on blob sha — atomic)
  ├─ dispatch cloud session          (own container, own branch claude/<slug>)
  │    └─ worker: PROMPT.md → implement → verify → commit → pnpm land → open PR → stop
  ├─ gates, out of process, on the PR:
  │    G1  parity check green on the head GitHub resolved       (mechanical)
  │    G2  ticket closed, zero unticked boxes, claim cleared    (mechanical)
  │    G3  no test file deleted or renamed in the PR diff       (mechanical)
  │    G4  review session: four charters, fails closed          (model, additive only)
  ├─ land: gh pr merge --auto --squash   (or enqueue) — never the author
  └─ on failure: quarantine the ticket, continue the campaign
```

**What changes from `loop.md`, and why each change is forced:**

- **Workers push and open PRs.** The `.loop/ACTIVE` blanket push-ban in `.githooks/pre-push` was
  correct for one checkout on one machine; against N containers each owning a branch it blocks the
  only path that works. Rescope it: the guard refuses pushes to `main` **always** (that clause
  stays and hardens), and refuses non-`main` pushes only when the *local* sequential conductor is
  running. The end-of-campaign mega-merge disappears — nine small merges already proved they land.
- **Doer ≠ judge is preserved by process boundary, not by context boundary.** The conductor never
  reads a worker transcript; it reads the PR, the check, and the tree. Unchanged law.
- **G4 is additive and may only refuse.** A review session (the `REVIEW.md` charters, scoped to
  one PR diff instead of an arc) posts a check that can block a merge and files `9N-fix-*` tickets.
  It can never approve *instead of* `parity`, never edit anything outside `.wayfinder/`, and never
  fix. An AI that can unblock a merge is trust wearing a gate's clothes; an AI that can only
  withhold one is a filter, and a filter that fails closed is compatible with the governing
  sentence.
- **Quarantine, not stop-the-world.** Today one gate failure halts the whole campaign. With
  independent tickets that throws away nine healthy sessions to preserve evidence about one. New
  policy: a failed ticket keeps its branch and PR untouched as evidence, gets `Status: halted` and
  a `## Stuck` note, and the campaign advances. **Runaway fuses, not trust settings:** stop the
  campaign on 3 consecutive halts, or a halt rate above 40% past 5 tickets, or the wall budget.
- **Concurrency is bounded by the graph and by the fuse.** Dispatch width = min(frontier size,
  configured width). Ten is the current frontier; start the first cloud campaign at **3** and
  raise it on measured evidence, because width is the one variable with no data behind it at all.
- **Caps, re-derived honestly.** n=3 is a maximum, not a p95, and saying "p95" of three samples
  is a guess wearing a statistic's clothes. Interim rule until n≥10: **cap ≥ 2× observed max**.
  `MAX_TURNS` 150 stands (2.05×). The wall fuse goes to **60 minutes** — 30 is 1.73× a local
  maximum, and a cloud container additionally pays provisioning and cold caches. Re-derive both
  from the first cloud campaign's `log.jsonl` and write the measured numbers back into this file.
- **Cost, logged and never a gate** (unchanged law). Observed $2.47–$7.35 per closed ticket,
  mean ~$5.4 (n=3, decision tickets, local). Seventeen open takeoff tickets is an order-of-magnitude
  estimate of ~$90–150. Useful for planning a wave; never a reason to stop one.

**The seam this spec does not close.** *How* the conductor dispatches a cloud session — the
concrete API or workflow that starts a container against a branch and a prompt — is not settled
here, and is not invented here. Two candidates: a GitHub Actions workflow (durable, credentialed,
observable, already where `parity` runs) or a long-lived cloud container running the conductor and
spawning siblings. The measurement that decides it must be taken **in a cloud session**, and it is
ticket 6.1 in §8. Everything above is independent of which one wins.

---

## 7. Context floor — measure the platform, stop shaving the repo

The repo contributes ≈3.5k tokens of session startup: `CLAUDE.md` (2.2k as loaded), the skills
listing (854), the `checkup` SessionStart line (~400). The cloud's extra ~14k is platform-side.
Cutting the repo's surface in half would buy ~1.7k of a 29.3k startup while costing the
damage-preventing instructions that are the only reason `CLAUDE.md` exists. **That is optimizing
the 12%.**

What is actually worth doing, in order:

1. ~~**Establish whether the cloud's MCP schemas can be deferred.**~~ **Answered — ADR-0013.**
   Not deferral: `permissions.deny` *prunes* the schema, and denying 15 of *Claude Code Remote*'s
   20 tools took the startup from 29.8k to 22.8k. It was indeed worth more than everything else on
   this list — and ticket 18 has since established that "everything else on this list" was worth
   very little, so this item's own framing was the error. See the closing paragraph.
2. **Keep the SessionStart hook.** ~400 tokens buys a fitness verdict on a machine nobody
   configured — the highest-value tokens in the startup, and this session is the proof: it opened
   with a named `BROKEN` on the pg locale.
3. **Leave `CLAUDE.md` at its cap.** ADR-0007's ≤6,000 bytes is holding at 5,928 and the
   replacement sentence in §3 is budget-neutral.
4. **Do not add agents, MCP servers, or always-on skills to buy convenience.** The single
   sentence in ADR-0008 that has aged best is that the heavy skills carry
   `disable-model-invocation: true` and cost nothing until invoked.

Stated plainly because it is the answer to the actual question: **the harness is already near its
floor. The remaining headroom is in the platform's hands, not the repo's.**

**Closed by ticket 18 — stop optimising startup context.** That paragraph was right and
understated. Measured on a cloud container at `6c6e001`: the window is **1,000,000 tokens**, not
the ~200k this section was written against, and the platform autocompacts at 80% of it. ADR-0013's
7k trim is therefore **0.7% of the window and 0.9% of the distance to the point where the platform
itself intervenes** — and a full working session on a real ticket peaked at 126,664 tokens, 12.7%
of the window.

What actually fills a session is not the repo's surface at all: roughly half is the model's own
generation (invisible — the transcript stores every `thinking` block with zero characters of
content), a third is tool return dominated by `Bash`, and everything the harness controls is a
rounding error. The repo's two nominal levers were measured and **neither has ever been reached**:
`BASH_MAX_OUTPUT_LENGTH` at 50,000 would have to be cut 5× before it clipped a single result, and
`pnpm verify`'s output is under 1,000 tokens on every path including all three reds — a red run
prints *less* than a green one, because verify fails fast. Delegation is the one lever that works,
measured at **4.1×** (a subagent absorbed 21,910 tokens of growth and returned 5,398), which
supports `CLAUDE.md`'s existing restriction rather than changing it.

**No further work on startup context is warranted**, including the 4.6k residue ADR-0013 left,
which needs a change at the environment runner in any case.
`docs/research/what-fills-a-cloud-session.md` has the tables.

---

## 8. Sequencing, and the measurements owed

Before dispatching the next wave (ten frontier tickets, all `MAP.md` writers):

- ~~**8.1** Split *Decisions so far* into `decisions/<NN>-<slug>.md`.~~ **Landed** on
  `claude/decisions-per-file`: ten decision files + `decisions/README.md`, `MAP.md` −130/+9,
  `.wayfinder/TRACKER.md` and `/wayfinder` updated so a closing session writes `decisions/` and
  **does not touch `MAP.md`**. *(§5.1 — the load-bearing one; without it the wave produced nine
  conflicts by arithmetic.)*
- ~~**8.2** Add the `inbox/<slug>.md` rule.~~ **Landed**: `scripts/wayfinder/promote.mjs`
  (`pnpm promote`) allocates past the highest existing number and rewrites `Blocked by:` edges
  that name an inbox slug, refusing as a whole rather than half-promoting; 17 tests, with
  `scripts/**/*.spec.mjs` joining the vitest lane. `.githooks/pre-push` refuses a numbered ticket
  added to an effort that already has them — exercised on seven cases in a scratch clone
  (refuse / override / new-map exempt / inbox / edit-not-add / main-push regression / ordinary
  code). `frontier.mjs` needed no change: `inbox/` is a sibling of `tickets/` and its read is not
  recursive. *(§5.2)*
- ~~**8.3** Amend ticket 09: the torture-corpus index is file-per-case.~~ **Landed** as an
  `## Amendment` on the closed ticket (its ruling 3 said *"a single committed index"*), with the
  decision file updated to match. Binding on the arc `/to-tickets` will write — cheapest before the
  frame exists, a rewrite once every rail cites it. *(§5.1)*
- ~~**8.4** Commit the replacement CLAUDE.md sentence.~~ **Landed** on the same branch;
  file at 5,998 bytes. *(§3)* — **8.5 now owes it a home**: until ADR-0010's amendment #2 lands,
  CLAUDE.md forbids self-merge and names no party who does it instead.
- ~~**8.5** Land ADR-0010 amendment #2.~~ **Landed**, closing the gap 8.4 opened. Rules the
  non-author merge, and rules the claim compare-and-swap and the arc-exemption's retirement with a
  stated take-effect condition — *when the conductor exists* — rather than as though built, the
  shape amendment #1 used for CI. Squash-only is ruled and flagged as a human repository action.
  *(§4)*
- **8.6** **Split by the probe.** *Squash-only:* **done** — `allow_merge_commit` and
  `allow_rebase_merge` are now false, `parity`/`strict`/`enforce_admins` verified unchanged
  afterwards. Reversible in one API call. *Merge queue:* **refused by GitHub**, see §5.3; it needs
  the repo moved to an organization, which is the dispatcher's call and not taken here. Classic
  protection therefore **stays** — there is no reason left to migrate it to a ruleset. *(§5.3)*
- ~~**8.7** Build the relander.~~ **Landed:** `scripts/reland.mjs` / `pnpm reland`, policy as a
  pure `classify(pr)` with 25 tests in the scripts lane. Promoted from fallback to primary by the
  merge-queue probe. *(§5.3)*

Then, for the AFK campaign:

- **8.11** ~~`frontier.mjs` is untested — the fail-closed query the whole tracker rests on.~~
  **Closed:** 22 CLI-level tests, driving the script rather than an extracted core because its exit
  codes are half its contract. Both fail-closed paths and the claim check were mutation-tested —
  each mutation turned exactly its own assertions red and nothing else, and `frontier.mjs` was
  restored byte-identical. A pure core can be extracted later, guarded by these.
- **8.8** Conductor v2 per §6 — claims by CAS, per-ticket PR, G1–G4, quarantine, fuses.
  **Still blocked, and 6.1's answer sharpened the reason rather than clearing it.** The dispatch
  call is now known by name and known to be unreachable; the in-container conductor is ruled out on
  credential lifetime, and the CI conductor needs a credential the repository does not have. So
  8.8 is blocked on a repository action (`inbox/dispatch-needs-a-credential-the-repo-does-not-have.md`),
  not on a measurement. **Re-ruled 2026-08-13:** the credential question is closed — not funded,
  and not needed: the conductor is the dispatcher's Linux host and the dispatch primitive is the
  Routine API (docs/research/the-dispatch-primitive.md); the successor spec is
  docs/specs/execution.md. Two further faults found by ticket 18 must be ruled before any worker
  runs unattended, and both are invisible until one does: the spawn line
  (`inbox/the-worker-spawn-line-does-not-run-on-a-cloud-container.md`) and the permission
  classifier (`inbox/the-permission-classifier-is-a-second-deny-list.md`). The parts that *are*
  mechanism-independent — the claim CAS, the gates, the quarantine policy — are specified in §6
  and cost nothing to hold.
- **8.9** The per-PR review session (`REVIEW.md` rescoped to one diff, fails closed, files only).
  **Unblocked from the credential seam, 2026-08-13:** under docs/specs/execution.md the judge is
  a local session on the conductor's host (no CI credential exists or is needed); a Routine with
  a GitHub PR trigger is the later cloud variant. It stays unbuilt until the execution spec is.
- ~~**8.10** Rescope `.githooks/pre-push`.~~ **No change needed, verified.** `.loop/` is
  gitignored and untracked (`git ls-files .loop` is empty), so `ACTIVE` exists only in the checkout
  running `conduct.mjs`. A cloud worker container never has the file and is never refused by it —
  the guard was already scoped by the marker's *location*. A comment now says so, because the
  obvious "fix" is to add a branch condition, which would weaken it. *(§6)*

**Measurements owed — each must be taken on the machine it describes, and quoted with its
`checkup` environment line:**

| # | question | where | status |
|---|---|---|---|
| 6.1 | What dispatches a cloud session non-interactively, with what credentials and what durability? | cloud | **Answered, and the answer is "not from here"** — see below |
| 7.1 | Can *Claude Code Remote*'s MCP schemas be deferred or disabled? What is the resulting startup? | cloud | **Answered** — ADR-0013: denied, not deferred; 29.8k → 22.8k |
| 6.2 | Turn / wall / cost distribution over ≥10 cloud closes → re-derive both caps. | cloud | **Unblocked 2026-08-13:** run logs now survive as committed `.wayfinder/<effort>/log/<run-id>.jsonl` (conductor-written); rows accumulate from the next campaign. **n=1 banked below.** |
| 6.3 | `pnpm verify` wall time on a cloud container. | cloud | **Answered: 43.9s** (n=3, `6c6e001`), `next build` 54% of it. No cold/warm distinction exists — every build is cold by design. `loop.md` corrected |
| 5.3 | Does a merge queue accept this repo's plan and ruleset shape? | GitHub | Refused by GitHub (§5.3); squash-only landed |
| 6.4 | Does dispatch width 3 produce zero conflicts after 8.1? Raise only on that evidence. | cloud | **Blocked on 6.1 and on 6.2's log problem** |

**6.1, answered.** The mechanism exists and is named — `mcp__Claude_Code_Remote__create_session`,
on the session-scoped MCP server the runner writes to `/tmp/mcp-config-<session>.json` — and it is
unreachable from a session of this repo by three independent controls (this repo's deny list; the
runner's `"permission_policy": "always_ask"` with no party to ask in an unattended container; a
model-side permission classifier that refused even reading its schema). Per ticket 18's guardrail
that was written up and **no workaround was built**.

The finding that decides the design is about credentials rather than permissions: the session's
OAuth token arrives as an inherited **file descriptor**
(`CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR=4`), not an env var and not a file, and the MCP endpoint
is scoped to this session's id. **There is no durable credential in the container.** So §6's first
candidate — a long-lived container running the conductor and spawning siblings — is not undecided,
it is **structurally unavailable**: the conductor cannot outlive the credential it would dispatch
with. The GitHub Actions candidate is ruled in but **unfunded**: `ci.yml` declares
`permissions: contents: read` and holds no Anthropic credential of any kind. Installing one is a
repository action and the dispatcher's call —
`inbox/dispatch-needs-a-credential-the-repo-does-not-have.md`.

**Concurrency limits stay unmeasured**, and deliberately: measuring what happens at the limit means
dispatching sessions, which none of the three controls permits and which ADR-0011 forbids on
principle.

**6.2, n=1, banked here because `.loop/` will not keep it.** One build ticket
(`takeoff/10-the-design-system`) run through the real worker path on a cloud container at
`6c6e001`, `MAX_TURNS` 150, 30-minute fuse:

| | measured | cap | headroom |
|---|---|---|---|
| turns | **118** | 150 | **1.27×** |
| wall | **20.7 min** | 30 min | **1.45×** |
| cost | **$5.48** | — | — |
| `ctxPeak` | **176,003** of a 1,000,000 window | line 150,000 | **over the line** |

The caps are tighter against a cloud build ticket than the local decision tickets they were
derived from: the interim rule here is *cap ≥ 2× observed max*, and `MAX_TURNS` 150 is 1.27× this
one observation rather than the 2.05× claimed. **This supports the wall fuse going to 60 minutes
with a number rather than an intuition, and it puts `MAX_TURNS` back on the list.** One
observation is not a distribution and this is not a re-derivation — it is the first row, and the
outcome was a `## Stuck`, not a close (`docs/research/what-fills-a-cloud-session.md` §2 has why,
and why it is not evidence of context degradation).

**Not decided here, and named so it is not mistaken for done:** whether the boundary review
survives as a separate arc-level pass once a per-PR review exists (they answer different
questions — one reads a diff, the other reads an accumulation — and collapsing them should be a
measured decision, not a convenience). And whether decision tickets, which are 14 of the 17 open,
belong in an automated campaign at all: every one of them ends in a *ruling*, and the loop's
founding law is that **the loop executes decided work; it never decides.** The most defensible
reading is that `wayfinder:grilling` tickets are dispatched in parallel but land as PRs a human
reads, while `arcs/` build tickets run fully unattended — and that the 100%-AFK target properly
belongs to the arc campaign that `/to-spec` and `/to-tickets` have not yet produced.
