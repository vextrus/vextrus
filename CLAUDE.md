# Vextrus

AI-native construction takeoff → cost database → estimation → bidding. Reads 2D CAD drawings,
produces quantities a professional can sign, prices them from Schedule-of-Rates data, prepares
the bid. Bangladesh first; built to travel. *Drawing to estimate to bid.*

## The invariant

The **Quantity Register** is the system of record for physical scope. No module may originate a
quantity — every stage inherits an object, enriches it, emits it; every figure traces to a
register row. Identity is `(project, discipline, level, element type, mark, ordinal)`, ordinal
frozen at first registration; no coordinate, label or correctable attribute enters a key.

## The governing sentence

**A partial faulty estimate is more harmful than no estimate.** Measure less, completely, and say
so. Over-measurement is a hard block, never a disclosure. Every refusal carries a named reason;
silence is the only condemned state. **AI proposes; code resolves; a human disposes.**

## Commercial guardrail

Pre-first-customer: no live customer may be claimed. "Edison" is a competitor and an internal
benchmark only — never a client, never demo content, never in this repo. Never claim BIM,
module counts or agent counts.

## NEVER — each names its mechanical enforcement

- NEVER query outside the seam — `forTenant(ctx)` / `runAsSystem(reason)`. Importing the driver
  or `db/schema` elsewhere is a lint error; RLS refuses what slips past. A bare handle is a
  breach even when RLS saves you.
- NEVER call a model outside `callModel` (`src/core/model.ts`). Importing the SDK elsewhere is a
  lint error; a proposal without resolvable source keys is refused, never returned (ADR-0006).
- NEVER hardcode a rate, tax rate, zone mapping or measurement threshold — all effective-dated
  data. Reviewed on the diff.
- NEVER guess: an unaffirmed scale, an unmapped unit, a missing rate, a malformed geometry spec
  **refuses or defers with a named reason**. No silent defaults, no bounding-box fallbacks, no
  ×1 fallthroughs. Reason codes are closed enums, never prose.
- NEVER floats for money or quantities — decimal at the seam, `numeric` in the DB.
- NEVER Western grouping — lakh/crore (`৳1,00,00,000`). `toLocaleString` is a lint error;
  format through a document formatter with a stated locale. `localeCompare` is a lint error —
  identity sorts by code units (`compareCanonical`).
- NEVER edit a landed migration — supersede it. `pnpm db:migrate` is the only schema writer.
- NEVER weaken a check, delete a test or edit a fixture to green a build.

## The feedback loop

```
pnpm verify    # tsc → eslint → vitest → ruff → pytest; fail-fast, uncached; exit code = contract
pnpm test:db   # the live seam test — run it after touching db/ or src/core/db.ts
pnpm checkup   # the machine, not the tree; runs once at SessionStart
```

Postgres runs natively on `localhost:5544` — no Docker, no compose (ADR-0002). Web: `pnpm dev`
on 3210. Only `pnpm verify` output is evidence; a check run any other way is a claim.

## Where things live

- `docs/domain/` — **the law**: quantity contract, identity, measurement rules, BD authority,
  formulas, CAD ingestion. Code implements these; issues cite the clause.
- `docs/specs/genesis-ii.md` the founding spec · `docs/adr/` decisions that constrain product
  code, superseded never edited · `docs/CONTEXT.md` commercial truth, glossary, BD rules ·
  `docs/lessons/` one paid-for fault per file — read when something is broken and the code looks
  right · `docs/research/` the market.
- **Work is tracked in GitHub Issues** — see `docs/tracker.md` for the frontier query, claiming
  by assignee, blocking by sub-issue, labels. Versioned and immutable goes in git; mutable and
  concurrent goes in Issues. Never a ticket, claim or number in the working tree.

## Working here

- One issue per session. Cite the domain clause you implement. `pnpm verify` before every commit.
- Nothing about campaigns, loops, conductors or dispatch belongs in this repo. If you are
  writing a script that runs Claude, stop.
- Delegate only wide, independent investigation; never to check your own work.
- Where a reading is ambiguous, take the most defensible one, name the assumption in the issue
  or PR, and finish. Unfinished and said so beats a guess reported as done.
- Before reporting progress, audit each claim against a tool result from this session; report
  only what you can point to evidence for. When the founder is describing a problem or thinking
  out loud, the deliverable is your assessment — report and stop; fix when asked.
- A lesson is recorded only with a dated, observed cost — one file, named for the fault. Update
  rather than duplicate; delete what turns out wrong.

## Agent skills

### Issue tracker

GitHub Issues on `vextrus/vextrus`, driven with `gh`. See `docs/tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name (`needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `docs/CONTEXT.md` + `docs/adr/` + `docs/domain/`. See `docs/agents/domain.md`.
