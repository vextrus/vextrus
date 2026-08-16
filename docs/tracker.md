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
The sub-issue commands above follow GitHub's documented API and were not exercised at founding
— no map exists yet.

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
