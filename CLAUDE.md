# Vextrus

AI-native construction takeoff → cost database → estimation → bidding. Reads 2D CAD drawings,
produces quantities a professional can sign, prices them from Schedule-of-Rates data, and
prepares the bid. Bangladesh first; built to travel. *Drawing to estimate to bid.*

## The Architectural Invariant

The **Quantity Register** is the system of record for physical scope. No module may originate a
quantity — every stage inherits an object, enriches it, emits it; every figure traces to a
register row. Element identity is deterministic `(project, discipline, level, element type,
mark, ordinal)` — the ordinal frozen at first registration — and must stay **stable across
drawing revisions**. No coordinate, label, or correctable attribute may enter an identity key.

## The governing sentence

**A partial faulty estimate is more harmful than no estimate.** Measure less, completely, and
say so — never measure more, partially, and stay quiet. Over-measurement is a hard block, never
a disclosure. Refusal always carries a reason; silence is the only condemned state.

## Commercial guardrail

Pre-first-customer; no live customer may be claimed. "Edison" is a competitor whose data is
internal benchmark only — never a client, never demo content, never in this repo. Never claim
BIM, module counts, or agent counts.

## NEVER

- NEVER query outside the tenant seam (`db.forTenant(ctx)` / `runAsSystem`) — a bare db handle
  is a cross-tenant breach even when RLS saves you.
- NEVER hardcode a tax rate, SoR rate, zone mapping, or measurement threshold — all are
  effective-dated data/config.
- NEVER guess: an unaffirmed scale, an unmapped unit, a missing rate, a malformed geometry spec
  **refuses or defers with a named reason** — no silent defaults, no bounding-box fallbacks,
  no ×1 fallthroughs.
- NEVER use floats for money or quantities — decimal at the seam, `numeric` in the DB.
- NEVER use Western K/M grouping — lakh/crore (`৳1,00,00,000`); `toLocaleString('en-US')` is
  banned; compact `L`/`Cr` never on a document.
- NEVER edit a landed migration — supersede with a new one. `pnpm db:migrate` is the only
  schema writer.
- NEVER weaken a check, delete a test, or edit a fixture to green a build.

## The feedback loop

```
pnpm verify        # tsc --noEmit -> eslint -> vitest -> cad (ruff+pytest); exit code is the contract
```

Run it, read the exit code, fix, repeat. Playwright e2e is outside this lane.

```
DB:  localhost:5544/vextrus  (compose-managed; pnpm db:migrate is the only writer)
Web: localhost:3210
```

## Pointers — read on demand, not up front

- `docs/specs/genesis.md` — the founding spec; why everything is the way it is.
- `docs/domain/` — the domain law: quantity contract, identity, measurement rules, BD
  authority, formulas. **Code implements these; tickets cite them.**
- `docs/CONTEXT.md` — commercial truth, glossary, Bangladesh rules.
- `docs/TRAPS.md` — environment faults that present as build faults. Read when debugging.
- `docs/adr/` — dated decisions; superseded, never edited.

## Session protocol

1. **One ticket per session.** `/clear` at the boundary. Never `/compact`.
2. **`pnpm verify` is the contract.** Run it; read the exit code; fix; repeat.
3. Work larger than one session is charted with `/wayfinder` into `.wayfinder/<effort>/`,
   specced with `/to-spec`, broken into arc tickets with `/to-tickets`, and either worked one
   ticket at a time or executed by the loop (`docs/specs/loop.md`).
4. **Delegate only for large, genuinely independent investigation.** Never to verify your own
   work. One agent beats three.

## How to work here

Keep responses focused and brief; spend the response on the answer, not the preamble.
Match written documents to what the task needs — no filler sections or redundant summaries.
Deliver what was asked, at the scope intended. Make routine judgment calls yourself and
check in only when different readings lead to materially different work. Finish the whole
task; stop short of what wasn't asked.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
