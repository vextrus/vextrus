# The cloud campaign — parallel sessions, mechanical landing, unattended arcs

**Status:** proposed, except §5.1 and §3 — those landed together as 8.1 and 8.4 on
`claude/decisions-per-file`. Written from a local exploration session on
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

Two mechanisms, in order of preference:

1. **A merge queue.** `vextrus/vextrus` is public and `allow_auto_merge` is true, so a queue is
   available — but it is configured through **rulesets**, and `GET /repos/vextrus/vextrus/rulesets`
   returns `[]` today; the branch is on classic protection. Migrating protection to a ruleset with
   a merge queue makes the entire §1 treadmill vanish: PRs are enqueued, GitHub builds the
   speculative merge, runs `parity` on *that*, and merges in order. No human, no re-land, and the
   up-to-date guarantee gets *stronger*.
2. **A conductor-side relander**, and worth building anyway as the fallback that depends on no
   GitHub plan feature: for each open campaign PR that is behind and `mergeable`, merge
   `origin/main` into it and push. Deterministic, no model involved. Where the merge conflicts,
   it must **not** resolve — it re-dispatches a session against that branch with the conflict as
   its task, or files a halt. A relander that resolves conflicts is a second doer, and ADR-0010
   already names the failure mode: resolving by discarding the other branch's work.

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

1. **Establish whether the cloud's MCP schemas can be deferred.** Locally, MCP tools cost 0 tokens
   until fetched (10.1k sits in the deferred pool, outside the 15.4k). In cloud, *Claude Code
   Remote* reads as resident at 9.7k. If deferral or selective disabling is available there, that
   single setting is worth more than every other item on this list combined. **Unknown from a
   local session; measure it, do not assume it.**
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

---

## 8. Sequencing, and the measurements owed

Before dispatching the next wave (ten frontier tickets, all `MAP.md` writers):

- ~~**8.1** Split *Decisions so far* into `decisions/<NN>-<slug>.md`.~~ **Landed** on
  `claude/decisions-per-file`: ten decision files + `decisions/README.md`, `MAP.md` −130/+9,
  `.wayfinder/TRACKER.md` and `/wayfinder` updated so a closing session writes `decisions/` and
  **does not touch `MAP.md`**. *(§5.1 — the load-bearing one; without it the wave produced nine
  conflicts by arithmetic.)*
- **8.2** Add the `inbox/<slug>.md` rule and teach `frontier.mjs` to ignore it. *(§5.2)*
- **8.3** Amend ticket 09's acceptance list: the torture-corpus index is file-per-case. *(§5.1)*
- ~~**8.4** Commit the replacement CLAUDE.md sentence.~~ **Landed** on the same branch;
  file at 5,998 bytes. *(§3)* — **8.5 now owes it a home**: until ADR-0010's amendment #2 lands,
  CLAUDE.md forbids self-merge and names no party who does it instead.
- **8.5** Land ADR-0010 amendment #2. *(§4)*
- **8.6** Migrate `main` from classic protection to a ruleset with a merge queue; squash-only.
  Verify `parity` remains required and `enforce_admins` equivalent stays on. *(§5.3)*
- **8.7** Build the relander (deterministic, refuses to resolve conflicts). *(§5.3)*

Then, for the AFK campaign:

- **8.8** Conductor v2 per §6 — claims by CAS, per-ticket PR, G1–G4, quarantine, fuses.
- **8.9** The per-PR review session (`REVIEW.md` rescoped to one diff, fails closed, files only).
- **8.10** Rescope `.githooks/pre-push`. *(§6)*

**Measurements owed — each must be taken on the machine it describes, and quoted with its
`checkup` environment line:**

| # | question | where |
|---|---|---|
| 6.1 | What dispatches a cloud session non-interactively, with what credentials and what durability? | cloud |
| 7.1 | Can *Claude Code Remote*'s MCP schemas be deferred or disabled? What is the resulting startup? | cloud |
| 6.2 | Turn / wall / cost distribution over ≥10 cloud closes → re-derive both caps. | cloud |
| 6.3 | `pnpm verify` wall time on a cloud container (local: 16.1s at `00c6ce3`; the ~4s in `loop.md` is stale). | cloud |
| 5.3 | Does a merge queue accept this repo's plan and ruleset shape? | GitHub |
| 6.4 | Does dispatch width 3 produce zero conflicts after 8.1? Raise only on that evidence. | cloud |

**Not decided here, and named so it is not mistaken for done:** whether the boundary review
survives as a separate arc-level pass once a per-PR review exists (they answer different
questions — one reads a diff, the other reads an accumulation — and collapsing them should be a
measured decision, not a convenience). And whether decision tickets, which are 14 of the 17 open,
belong in an automated campaign at all: every one of them ends in a *ruling*, and the loop's
founding law is that **the loop executes decided work; it never decides.** The most defensible
reading is that `wayfinder:grilling` tickets are dispatched in parallel but land as PRs a human
reads, while `arcs/` build tickets run fully unattended — and that the 100%-AFK target properly
belongs to the arc campaign that `/to-spec` and `/to-tickets` have not yet produced.
