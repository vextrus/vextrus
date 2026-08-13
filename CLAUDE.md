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
pnpm verify     # tsc -> eslint -> vitest -> cad (ruff+pytest) -> next build; the exit code is
                # the contract, and only its output is evidence
pnpm db:replay  # wrote a migration? run it once before you commit — the only path on which a
                # migration meets rows written before it
pnpm land       # your last act: fetch main -> merge -> verify -> push (ADR-0010)
pnpm checkup    # the machine, not the tree; it reports, `scripts/provision.sh` repairs
```

Run verify, read the exit code, fix, repeat. Playwright e2e is outside this lane.

```
DB:  localhost:5544/vextrus — compose where a Docker daemon answers, a native cluster where
     none does (every cloud container); `pnpm checkup` says which one you are on.
Web: localhost:3210 (`pnpm dev` for a terminal; `pnpm dev:bg` runs it in the background and
     logs to `.data/dev.log` — `pnpm dev:stop` frees the port)
```

Your container is disposable and nothing outside git survives it — `.data/` included. A
measurement worth keeping is quoted into the ticket with the commit and machine it was taken
on; `checkup`'s environment line carries both.

## Pointers — read on demand, not up front

- `docs/domain/` — the domain law: quantity contract, identity, measurement rules, BD
  authority, formulas. **Code implements these; tickets cite them.**
- `docs/CONTEXT.md` commercial truth, glossary, BD rules · `docs/TRAPS.md` environment faults
  that present as build faults, read when debugging · `docs/specs/genesis.md` the founding
  spec · `docs/adr/` dated decisions, superseded and never edited.

## Session protocol

1. **One ticket per session.** `/clear` at the boundary. Never `/compact`.
2. Work larger than one session is charted with `/wayfinder` into `.wayfinder/<effort>/`,
   specced with `/to-spec`, ticketed with `/to-tickets`, then worked one ticket at a time or
   run by the loop (`docs/specs/loop.md`).
3. **Delegate only for large, genuinely independent investigation.** Never to verify your own
   work. One agent beats three.
4. **You work on the branch you were given.** Never `main`; never create, rename, or switch a
   branch — the push guard refuses `main`, and a refusal there means stop and report. You do
   not choose your ticket and never write `Claimed by:` — the dispatcher does both
   (`.wayfinder/TRACKER.md`).
5. **Nobody is watching while you work**, and you cannot ask mid-session. Where a reading is
   genuinely ambiguous, take the most defensible one, name the assumption in the work and in
   the PR, and finish. Stop only when proceeding would be unsafe or the result useless if
   wrong: unfinished and said so beats a guess reported as done.
6. **A session's last act:** `pnpm land` — fetch, merge `origin/main` (never rebase: it
   invalidates the verify that justified the commits), verify that exact tree, push. CI runs
   the whole gate on the pushed head — better evidence than your testimony (ADR-0010).
   **You never merge your own PR:** landing is not the author's act.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
