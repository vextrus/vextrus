# The tracker — GitHub Issues, driven with `gh`

Work that changes over time — tickets, claims, state, blocking, priority — lives in this
repository's GitHub Issues (`vextrus/vextrus`). Work that is versioned and immutable — domain
law, ADRs, specs, lessons — lives in git. Nothing mutable is ever tracked in the working tree:
numbers are allocated by GitHub, the claim is the assignee, state is open/closed, blocking is a
native relationship. None of it can conflict on a merge.

`gh` is a CLI: zero tool schema in a session's startup context, which is the one cost that
measured. Not Linear, not an MCP server. Everything below is a shell command a session runs.

## Labels

| label | meaning |
|---|---|
| `needs-triage` · `needs-info` · `ready-for-agent` · `ready-for-human` · `wontfix` | the five triage roles (`docs/agents/triage-labels.md`) |
| `wayfinder:map` | a map: one issue holding Notes / Decisions-so-far / Fog; its tickets are sub-issues |
| `wayfinder:research` · `wayfinder:prototype` · `wayfinder:grilling` | decision tickets — a resolution is a ruling, not code |
| `wayfinder:task` | a build ticket — emits code against a spec, cites the domain clause |
| `arc:<name>` | which build arc a ticket belongs to — the unit `/to-spec` is pointed at, one arc at a time (`docs/specs/harness.md` §3.1) |
| `spine` · `takeoff` · `book` · `estimate` · `bid` · `harness` | area |

## Everyday operations

```sh
gh issue create --title "..." --label ready-for-agent,takeoff --body-file body.md
gh issue view <n> --comments
gh issue list --state open --label ready-for-agent --json number,title,labels,assignees
gh issue comment <n> --body "..."
gh issue edit <n> --add-label ready-for-agent --remove-label needs-triage
gh issue close <n> --comment "..."
```

`gh` infers the repo from `git remote`. Every comment states the ruling, the evidence that
forced it, and the alternative put and rejected — one paragraph, no transcript.

## Wayfinding operations

A **map** is one issue labelled `wayfinder:map`; every ticket is a **sub-issue** of it (GitHub's
native parent/child, visible in the UI). Blocking is GitHub's native **issue dependency**
(`blocked by`), also visible in the UI. The map body carries three headings — Notes,
Decisions so far (one line per resolved ticket, with a link to its resolution comment), Fog.

Sub-issue and dependency endpoints take the **database id** of the related issue, not its
number: `gh api repos/{owner}/{repo}/issues/<n> --jq .id`.

```sh
OWNER=vextrus REPO=vextrus
dbid() { gh api "repos/$OWNER/$REPO/issues/$1" --jq .id; }

# create the map
gh issue create --label wayfinder:map --title "Map: <destination>" --body-file map.md

# create a ticket and attach it as a sub-issue of map M
N=$(gh issue create --label wayfinder:research,takeoff --title "..." --body-file t.md | grep -o '[0-9]*$')
gh api --method POST "repos/$OWNER/$REPO/issues/$M/sub_issues" -F sub_issue_id="$(dbid "$N")"

# ticket N is blocked by ticket B
gh api --method POST "repos/$OWNER/$REPO/issues/$N/dependencies/blocked_by" -F issue_id="$(dbid "$B")"

# claim — the session's first write; a claimed ticket has an assignee
gh issue edit "$N" --add-assignee @me

# resolve — the ruling as a comment, close, then one line under the map's Decisions-so-far
gh issue comment "$N" --body-file ruling.md
gh issue close "$N"
```

### The frontier query

The frontier is: open, unblocked (every blocker closed), unclaimed (no assignee), in map order.
Run it as `scripts`-free shell — the JSON is GitHub's:

```sh
OWNER=vextrus REPO=vextrus M=<map number>
gh api --paginate "repos/$OWNER/$REPO/issues/$M/sub_issues?per_page=100" \
  --jq '.[] | select(.state=="open") | select((.assignees|length)==0)
        | select(((.issue_dependencies_summary.blocked_by) // 0)==0)
        | "\(.number)\t\(.labels|map(.name)|join(","))\t\(.title)"'
```

`issue_dependencies_summary.blocked_by` counts **open** blockers only, so it is the live gate.
For a repo-wide frontier without a map (build tickets from `/to-tickets`), drop the sub-issue
scope:

```sh
gh api --paginate "repos/$OWNER/$REPO/issues?state=open&labels=ready-for-agent&direction=asc&per_page=100" \
  --jq '.[] | select(.pull_request==null) | select((.assignees|length)==0)
        | select(((.issue_dependencies_summary.blocked_by) // 0)==0)
        | "\(.number)\t\(.labels|map(.name)|join(","))\t\(.title)"'
```

First row wins (oldest first). Claim it before reading further. Run at founding, 2026-08-16,
against issues #64–#68: it listed 64, 66, 67, 68 and correctly omitted #65, which is blocked by
#64 through a native dependency (`gh api --method POST …/issues/65/dependencies/blocked_by`).
Of the sub-issue commands above, the read side was exercised on 2026-08-16 (`dbid` returned
#64's database id; `GET …/issues/64/sub_issues` returned `[]`); the `POST …/sub_issues` attach
follows GitHub's documented API and is first exercised the day a map exists.

## The build ticket

`/to-tickets` emits `## Parent` · `## What to build` · `## Acceptance criteria` · `## Blocked by`.
A build ticket in this repo carries **three more sections**, because a fresh session's only
guaranteed context is the ticket body (`docs/specs/harness.md` §3.2):

- **`## Clause`** — the numbered section of `docs/domain/` (or the ADR) this ticket implements.
  Not a paraphrase: `identity.md §4`, `quantity-contract.md §2.2`. A ticket that cannot name one
  is a decision ticket wearing the wrong label.
- **`## Verification`** — *the command whose exit code decides*, plus the named refusal cases that
  must fire and anything that must not change. One measurable end state, a stated check, the
  constraints that matter. Example: *`pnpm verify` green; a level with no scheme row throws
  `LEVEL_ORDINAL_UNMAPPED`; no migration under `db/migrations/` is modified.* Acceptance criteria
  say what the feature does; this says how a machine knows.
- **`## Out of scope`** — what the session must leave alone. Absent from the upstream template;
  present in every spec Anthropic's best-practices calls useful.

Emitted tickets carry `wayfinder:task`, their area label, `arc:<name>`, and `ready-for-agent`.

## The build session — claim to merge

One ticket, one session, one branch, one PR. `/clear` between tickets; never `/compact` inside one
(a ticket that needs it was mis-sized — say so on the issue).

```sh
gh issue view <n> --comments                 # the whole context; read the cited clause next
gh issue edit <n> --add-assignee @me         # the claim, before any code is read
git checkout -b issue-<n>-<slug>
# implement the clause
pnpm verify                                  # the contract; only its output is evidence
pnpm test:db                                 # if db/ or src/core/db.ts moved
# /code-review  — medium; high when the diff touches db/, db/migrations/, src/core/db.ts, src/core/model.ts
git commit -m "<area>: <what changed> (#<n>)"
git push -u origin issue-<n>-<slug>
gh pr create --base main --head issue-<n>-<slug> --title "…" --body-file <file>
```

**The PR body** states: the clause implemented, the assumption named (there is always one), the
evidence (`pnpm verify` wall time and result), what `/code-review` found and what was left, and the
metrics of `docs/specs/harness.md` §8. A finding blocks the PR only if it names a correctness defect
or a stated requirement the diff misses; the rest is recorded, not chased.

**The merge gate.** `main` is protected: required check `verify`, `enforce_admins: true`, linear
history, no force-push, no direct pushes for anyone. A pull request produces **two `verify`
check-runs** on the same commit — one for the `push` event, one for `pull_request` — created up to
half a minute apart (measured 25 s, 2026-08-16), and **both** gate the merge. So the wait has three
conditions, each of which cost a wasted merge attempt to learn: read the SHA from the **pushed
branch**, never `HEAD` (a session that has moved to `main` would read `main`'s green runs and call it
its own); wait for **both** runs to exist, not merely for no run to be incomplete (an empty list
satisfies that); and **bound the loop** — a workflow that fails validation attaches no check-run at
all (`docs/lessons/a-workflow-run-with-no-jobs-is-a-validation-error.md`).

```sh
sha=$(git rev-parse "origin/$(git branch --show-current)")   # the pushed head, not HEAD
for i in $(seq 1 60); do                                     # bounded: 10 min, then report and stop
  runs=$(gh api "repos/vextrus/vextrus/commits/$sha/check-runs" \
    --jq '[.check_runs[] | select(.name=="verify")] | "\(length) \([.[] | select(.status=="completed")] | length)"')
  [ "$runs" = "2 2" ] && break
  sleep 10
done
gh api "repos/vextrus/vextrus/commits/$sha/check-runs" \
  --jq '.check_runs[] | select(.name=="verify") | "\(.status) \(.conclusion)"'   # both must say: completed success
gh pr merge <pr> --squash --delete-branch
```

A run that ends `failure`, `cancelled` or `timed_out` is `completed` too, so read the conclusions —
the loop proves the runs finished, never that they passed.

**Never `gh pr merge --admin`** — it bypasses the gate the founder installed. A red CI is a defect to
fix on the branch, never a reason to reach for the flag. Then close the ticket if the PR did not, and
add the Decisions-so-far line if it belongs to a map.

Two `gh` calls fail on this repo with a "Projects (classic) is being deprecated" GraphQL error —
`gh pr edit --body-file` and `gh pr checks`. Use `gh api -X PATCH repos/vextrus/vextrus/pulls/<n> -F
body=@file` and the check-runs query above.

## Rules that keep the tracker honest

- **A map that resolves more than five decisions without emitting a build arc is charted too
  wide.** Narrow it and build. Charting starts with naming the destination, which is a
  conversation with the founder — no session charts alone.
- One ticket per session; the claim is the assignee; an abandoned claim is unassigned with a
  comment saying where it stopped.
- A resolution names the domain clause it changes; if it changes the law, the change is a
  dated amendment in `docs/domain/` in the same PR.
- Pull requests are not a request surface (no external PRs are triaged); `/triage` reads that
  flag from `docs/agents/issue-tracker.md`.
- `/wayfinder`, `/to-tickets`, `/to-spec`, `/triage`, `/implement` and `/grill-with-docs` are
  **founder-invoked** (`disable-model-invocation: true` in the plugin): a session cannot start
  them itself and their text costs no context until typed. Charting a map is `/wayfinder` with the
  founder at the keyboard, never a session alone.
