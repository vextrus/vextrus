# Handoff — the second founding, session 1 (2026-08-16)

**State:** branch `genesis-ii` (orphan; no merge base with `main`), five commits on top of the
carried domain law, pushed to `origin/genesis-ii`. `pnpm verify` green in 3.9 s (re-run 4.8 s);
`pnpm test:db` green (5 tests, live Postgres); `pnpm checkup` fit. Five follow-on issues open
(#64–#68). Nothing else is in flight.

## Done

| Phase | What exists |
|---|---|
| Ground | `docs/domain/` read in full; the old tree read where it informed a decision (`git show main:<path>`). |
| Market | `docs/research/market-2026-08.md` (299 lines): four investigations + one adversarial check. Identity still unoccupied; basis/coverage unoccupied, refusal marginally occupied; BD SoR unoccupied and the unified schedule at feasibility stage; the 2026 US wave aims at none of this; **both carried BD claims (PWD zone columns, e-GP +10% ceiling) confirmed against the primary documents** after a first pass had contradicted them. |
| Differentiators | Ruled in the spec §2: identity **narrowed** (re-origined/re-authored/scanned delta + priced propagation), trust **holds**, SoR **narrowed** (register join + PPR-2025 ceiling-and-threshold model). |
| Spec | `docs/specs/genesis-ii.md` (244 lines): thesis, rulings, the two root causes and the two rules that bind, architecture by ADR, scope fence, verification measured with the machine, tracker + map rule + first slice (RCC column concrete), assumptions named. |
| ADRs | `docs/adr/0001–0007`: five re-derived, **0006 the model seam** (new), 0007 verification. Nothing about workflow. |
| Domain law | `docs/domain/bd-authority.md` §10 — dated amendment with the verified PWD column labels and the gazetted PPR 2025 gates (Schedule 18 formula). |
| Harness | `CLAUDE.md` 5.2 KB; `.claude/settings.json` (deny list, skills off, timeouts, one SessionStart checkup hook); `docs/tracker.md` (GitHub Issues in `gh`; frontier query run live); `docs/lessons/` (7 files); `docs/CONTEXT.md`; `docs/agents/` config for the mattpocock skills. |
| Skeleton | Next shell · strict TS · ESLint guardrails with fail-closed tests (module boundaries, tenant seam, model seam, `localeCompare`, `toLocaleString`) · `src/core`: tenant seam, **model seam** (`callModel`, fixture replay, proposals with resolvable source keys), EntityGraph Zod mirror, comparator · four module folders · Drizzle schema (tenants, users, memberships, projects, `model_calls` ledger) with RLS in the schema and composite tenant FKs · migration 0000 · live seam test · `cad/` ported verbatim (35 tests) · `scripts/{verify,checkup,db-migrate,db-drift}.mjs`. |
| Hand-off | Issues #64 register spine, #65 ingest (blocked by #64), #66 auth + tRPC root, #67 model live transport + recorders, #68 CI. Frontier query in `docs/tracker.md` returns 64, 66, 67, 68. |

## Not done, deliberately

- **No takeoff map.** Charting starts by naming the destination with the founder (`/wayfinder`);
  the spec carries the map rule (≤5 decisions before a build arc) and the first slice.
- **No auth, no tRPC root, no CI, no live model transport** — each is an open issue.
- **`next build` outside verify** until a route earns it (ADR-0007).
- **`main` untouched.** It still holds the first founding's tree.

## Unverified / worth a look

- `.claude/settings.json` MCP deny names use the server-level form (`mcp__claude_ai_Gmail`); confirm they prune in `/context`.
- The sub-issue `gh api` commands in `docs/tracker.md` follow GitHub's documented API but were not exercised (no map exists yet). Native dependencies and the frontier query were.
- PWD SoR 2018 edition column shape; the 64-district → PWD column map has no published authority (an authored dataset row when the book module lands).

## Making `genesis-ii` the new `main`

There is no merge base, so **a PR cannot be opened** (GitHub refuses unrelated histories) and a
merge would union the two trees rather than replace one with the other. Do not force-push. The
clean operation is a **branch rename**, which keeps the old tree under a new name and moves the
default branch without rewriting any history:

```sh
# on GitHub — old tree kept as genesis-i, this tree becomes main, default branch follows
gh api -X POST repos/vextrus/vextrus/branches/main/rename -f new_name=genesis-i
gh api -X POST repos/vextrus/vextrus/branches/genesis-ii/rename -f new_name=main
gh repo edit vextrus/vextrus --default-branch main
# locally — rename the same two branches and re-point their upstreams
git fetch origin --prune
git branch -m main genesis-i && git branch -u origin/genesis-i genesis-i
git branch -m genesis-ii main && git branch -u origin/main main
```

After that, `HANDOFF.md` is deleted in the first PR on the new `main`: it is a session
hand-off, not permanent documentation, and the issues carry everything it says.

## The next concrete act

Run the frontier query in `docs/tracker.md`; take **#64 (the register spine)** first; then #65.
#66, #67, #68 are independent and can follow in any order. One PR per issue; `pnpm verify` and
`pnpm test:db` green before each; cite the domain clause implemented; a lesson only with a dated
cost. When all five are closed, the skeleton is production-grade and the takeoff map can be
charted with the founder.

## Working with Claude Fable 5 on this repo

From Anthropic's *Prompting Claude Fable 5* guide (fetched 2026-08-16), applied here:

- **Effort `xhigh` for build sessions**, `high` for reviews and research, `medium`/`low` for
  routine chores. Give the whole task in the first turn — the spec, the issue, the constraints —
  and let it run; interactive drip-feeding costs tokens and quality.
- **Say why, not only what.** "I'm building X for Y; they need Z; with that in mind: …" — the
  model connects the task to the domain law instead of inferring intent.
- **The memory is `docs/lessons/`** — one paid-for fault per file. Fable performs better with
  a place to write learnings; the repo already tells it where and in what shape.
- **Ground progress claims** — every report audited against a tool result (now in `CLAUDE.md`).
- **De-prescribe.** Skills and prompts written for older models are often too prescriptive and
  reduce Fable's output quality; state goals, constraints and how to verify, not steps. Never
  ask it to reproduce its reasoning in the response (that trips a `reasoning_extraction`
  refusal).
- **Delegate wide investigation to subagents and keep working**; never delegate checking its own
  work.
- **Autonomous runs get the autonomy reminder** (in the prompt below); interactive sessions get
  the boundary — assessment first, fix when asked.
- **Longer turns are normal** — a build session may run for a long time in one turn; that is
  the model gathering context, building and self-verifying.

## The next session's brief (paste as the first message, Fable 5, effort xhigh)

> I'm rebuilding Vextrus, an AI-native construction takeoff and estimating product for
> Bangladesh (drawing → quantity → rate → estimate → bid), as a startup foundation that has to
> hold at scale. The second founding is on `main` (formerly `genesis-ii`; if the rename in
> `HANDOFF.md` has not been done yet, work on `genesis-ii` and target PRs there): read `CLAUDE.md`,
> `HANDOFF.md`, `docs/specs/genesis-ii.md` and the ADRs first, and `docs/domain/` before you
> touch anything that implements it. The domain law is the law; issues cite the clause.
>
> **Your task: close the five open follow-on issues, in frontier order, as five pull requests
> into `main`.** Run the frontier query in `docs/tracker.md`; take #64 (the register spine),
> then #65 (ingest, blocked by #64), then #66, #67, #68 in whatever order you judge. For each:
> claim by assignee, branch `issue-<n>-<slug>`, implement exactly what the issue says citing the
> domain clause, `pnpm verify` and `pnpm test:db` green, one PR with a body that names the
> clause and the assumption you took, then merge it before starting the next (`gh pr merge
> --squash`). Record a lesson only with a dated, observed cost. Do not open new issues beyond
> what an issue's own body asks for; if you find work outside them, list it at the end for me.
>
> Boundaries: no product feature code beyond the issues; no workflow machinery, no script that
> runs Claude, no hooks beyond the SessionStart checkup; never guess (refuse or defer with a
> named reason); decimal at the seam and `numeric` in the DB; every query through the tenant
> seam; every model call through `callModel`; lakh/crore; never edit a landed migration; never
> weaken a check. Do not chart the takeoff map — that is a conversation with me and it comes
> next.
>
> Don't add features, refactor, or introduce abstractions beyond what the issue requires; do the
> simplest thing that works well; validate at system boundaries only. Delegate wide, independent
> investigation to subagents and keep working; never to check your own work.
>
> You are operating autonomously. I am not watching and cannot answer mid-task, so asking "Shall
> I…?" blocks the work. For reversible actions that follow from this brief, proceed. Before
> ending your turn, check your last paragraph: if it is a plan, a question, or a promise about
> work not done, do that work now. End only when the five issues are closed and merged or you are
> blocked on something only I can provide. Before reporting progress, audit each claim against a
> tool result; report only what you can point to evidence for.
>
> When the five are merged: update `docs/specs/genesis-ii.md` §7 with the new `pnpm verify`
> wall time (it will grow with `next build`), delete `HANDOFF.md`, and end with a short
> re-grounding message — outcome first, in plain sentences, leaving behind the working shorthand
> — plus a one-paragraph proposal for the destination statement of the takeoff map (RCC column
> concrete to a signed certificate) that I can react to before we run `/wayfinder` together.
