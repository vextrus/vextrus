# The build regression check — where `next build` belongs

wayfinder:task
Status: closed
Claimed by:
Blocked by:

## Objective

`pnpm build` can fail on a tree where `pnpm verify` is green. Decide where that check lives and
wire it there. The decision is a scope question about ADR-0007's contract, so it is settled with
a measurement, not a preference.

## What forced it

2026-08-12: a cloud session reported `pnpm build` failing at static prerender on a clean tree at
4871e55 — `TypeError: Cannot read properties of null (reading 'useContext')` on `/_global-error`
under Node 24, and `reading 'length'` on `/` under Node 22. Cause was `NODE_ENV=development` in
the sandbox environment, which pulls React's development bundles into the production prerender.
Not an app fault, and no code changed. But **verify was green the whole time** — the contract
could not see a whole class of failure, and it took a human round-trip to find out.

The trap is now recorded (`docs/TRAPS.md`, "Next.js and the build"); this ticket is about the
check, not that instance.

## The measurement that decides it

Cold `next build` on this tree, Node v24.12.0, `.next` removed first: **8s**.
`pnpm verify` at the same commit: **14.7s** (typecheck 6.8 · lint 2.2 · test 4.8 · cad ~1).

So a fifth stage lands verify at roughly 23s — inside ADR-0007's <60s founding target and its
<90s at-scale target, with the whole margin still to spend on real tests. That is the number the
ruling has to answer to; re-measure before deciding, since 8s is a founding-size app and this
stage grows with every route.

## The question, stated fairly

- **In verify.** Every session catches it, and it stays honest with the "exit code is the whole
  contract" principle. Costs ~55% more wall clock on the lever ADR-0007 names as dominant for
  quality, and it is the *only* stage that would compile the whole app on every run.
- **Pre-push / CI only.** Verify stays fast; the check runs where a slow check is affordable.
  Costs the founding property that one command is the contract, and admits a second lane whose
  green a session cannot cite.
- **Neither — leave it manual.** Rejected on the evidence above unless the measurement moves:
  it is what produced this ticket.

Note the tension to resolve, not paper over: ADR-0007 keeps stack-dependent stages out of verify
because green must not depend on daemons. `next build` needs no daemon (it prerendered fine with
no database reachable), so it does not breach that rule — but it is the first stage that would
make verify sensitive to the *ambient environment* rather than the tree alone, which is exactly
how this bug entered.

## Exit criteria

- [x] A ruling, with its measurement, recorded in this ticket's `## Resolution`.
- [x] The check wired where the ruling puts it; running it on a clean tree passes.
- [x] A deliberately broken prerender (temporary, reverted) is caught by the new lane — the
      check is proven to fire, not just proven to exist.
- [x] If the ruling puts it in verify: ADR-0007 amended (never edited — amendment section, as
      the startup-context trim was), with the before/after verify duration written in.
- [x] `pnpm verify` green, and its total duration recorded here.

## Guardrails

- The verify contract is not weakened to make room — no caching, no fail-slow, no skipped stage.
- `NODE_ENV` is not set by the check; Next chooses its own mode per command.
- If the ruling is CI, CI does not become a place where a red build is tolerated because verify
  is green.

## Resolution

**2026-08-12 — `next build` is the fifth stage of `pnpm verify`,** run last, into its own
`distDir`, deleted before every run.

**The measurement, re-taken on this tree (4e48871, Node v24.12.0):**

| | |
|---|---|
| verify, four stages | **6.7s** — typecheck 2.6 · lint 1.2 · test 2.2 · cad 0.7 |
| cold `next build` (dist dir removed) | **8.3s** |
| warm `next build` | 5.7s |
| **verify, five stages** | **15.2s** |

The ticket's earlier figures (14.7s verify, 8s build) were a cold-machine run; the build number
held, verify's was ~2× high. The ruling is unaffected — 15.2s sits well inside ADR-0007's <60s
founding target, and the cold/warm delta is only 2.6s, so there was no reason to buy speed with
a cache the founding rule forbids.

**Alternative put and rejected:** pre-push/CI only. Rejected on two counts. There is no CI in
this repo yet (`.github/workflows` does not exist), so "put it in CI" is not a place a check can
be put today — it is a second ticket wearing this one's clothes. And it costs the founding
property that one command is the contract: a session could cite a green verify while the app did
not build, which is exactly the failure this ticket exists because of. The cost of the ruling is
real and named — verify is 2.3× slower, and this is the only stage that compiles the whole app.

**Proven to fire, not just to exist:** `JSON.parse("{")` in `/login` (reverted) passed typecheck,
lint, vitest and cad, then failed the build stage — `Error occurred prerendering page "/login"`,
exit 1.

**What was wired:**
- `scripts/verify.mjs` — `build` stage, last; per-stage `env` and a `before` hook so it can clear
  its output first.
- `next.config.ts` — `distDir: process.env.NEXT_DIST_DIR ?? ".next"`. Verify builds into
  `.next-verify`: cold every run, and it cannot clobber a running `next dev`'s `.next`.
- `.gitignore` and `eslint.config.js` ignore `.next-verify` (lint read the build output as source
  on the first run — caught by verify itself).
- ADR-0007 amended (appended, not edited) with the before/after table.
- CLAUDE.md's feedback-loop line names the fifth stage.

**Exit criteria:** all met. `pnpm verify` green in **15.2s**.

**Left standing for a later ticket:** ADR-0007 still refers stack-dependent checks to "CI" that
does not exist. That is the map's open fog, not this ticket's scope.

**One side effect, kept rather than fought:** `next build` rewrites `tsconfig.json`'s `include`
to add `.next-verify/types/**/*.ts` (as it already does for `.next/types`). Committed with the
work, the same way the Next-authored CLAUDE.md block is — reverting it only re-creates it. Verify
is green from a clean state with `.next-verify` absent (15.3s), so the typecheck stage does not
depend on the directory existing.
