# ADR-0007 — The verification contract and the thin harness

**Date:** 2026-08-12 · **Status:** accepted (founding)

## Context

The legacy harness reset measured all of this the hard way: attention degrades past ~150K
tokens; a 48K startup context produced worse work than a 13K one; in-session hooks generated
544 error events and a median 49s commit latency; nine custom agents amplified over-delegation;
slow or cache-poisoned verification made sessions dishonest. Verification latency is the
dominant quality lever ("an 8-second suite makes a careful collaborator; a 12-minute one makes
a confident guesser"), and green exit codes alone are gameable — the counter is an independent
review pass and mechanical "never weaken a check" enforcement, not more prompt text.

## Decision

- **One command:** `pnpm verify` = `tsc --noEmit` → eslint → vitest → cad (ruff + pytest),
  fail-fast, no caching anywhere. Target <60s at founding, <90s at scale — slower is a defect.
  Its exit code is the whole contract. Playwright e2e lives outside the lane (on demand + CI).
- **Boundaries fail closed:** ESLint import rules keep modules behind their `index.ts`; a
  fixture violation test asserts the rule actually fires.
- **Thin harness:** CLAUDE.md ≤6,000 chars holding only non-derivable, damage-preventing
  content; `docs/CONTEXT.md` and `docs/TRAPS.md` read on demand; ADRs never edited, only
  superseded. Zero custom agents, zero hooks at founding — anything restored must earn its
  place with a measurement, one thing at a time.
- **Work decomposition:** `.wayfinder/<effort>/` local-markdown maps and tickets; one ticket
  per session, `/clear` at the boundary, never `/compact`; a ticket too big for one session is
  a graph defect — split the node, never stretch the session.
- **Review is separate from generation:** the diff gets a fresh-context review pass; tests are
  never deleted, renamed, or weakened to pass — enforced in review mechanically, not by prompt.

## Consequences

- The repo is the harness: quality comes from the environment (boundaries, fast verify, seam
  tests), and the standing context stays under ~2K tokens of harness-controlled content.
- We deliberately give up hook-based gates, fan-out workflows, and rich session memory — the
  legacy measured each as net-negative. The map on disk replaces memory; sequential depth
  replaces parallel breadth.
- Every foundation phase ends with a measurement written back into the spec; an unmeasured
  phase is not done.

## Amendment — 2026-08-12: startup-context trim

First `/context` measurement in this repo: **31.6K** (system tools 21.4K, built-in skills
2.6K, memory 1.8K). Applied in `.claude/settings.json`, following the legacy reset's measured
deny-list and Anthropic's Claude-5-era context-engineering guidance (progressive disclosure;
"the team removed over 80% of Claude Code's system prompt for Opus 5 and Fable 5 with no
measurable performance loss"):

- **20 tools denied** (the legacy 16 + `EnterWorktree`/`ExitWorktree` — one writable checkout
  per branch — with `Workflow` and `Artifact` carrying the largest schemas; denying `Workflow`
  is a structural commitment against context blow-ups, not just a token saving).
- **12 bundled skills off** via `skillOverrides`; kept: `code-review` (the review pass the
  loop and `/implement` cite), `simplify`, `security-review`, and `claude-in-chrome`
  (browser verification of UI work) — ~540 tokens retained of ~2.6K.
- **Auto-memory off** — the blog recommends it; our own legacy measurement (21 memory files
  loaded every session, net-negative) wins until a new measurement says otherwise. The map on
  disk is the memory.
- **Pragmatic allow-list** carried from the legacy's measured denial log (144 denials = 144
  failed turns + workarounds), with `ask` retained on `git push`, `git reset`, `rm -r`.
- Git system-prompt instructions trimmed (`CLAUDE_CODE_INCLUDE_GIT_INSTRUCTIONS=false`).

Re-measure `/context` in a fresh session after any harness change and record it here; run
`claude doctor` periodically to rightsize skills and CLAUDE.md. An unmeasured trim is a guess.

## Amendment — 2026-08-12: `next build` joins the contract

A cloud session found `pnpm build` failing at static prerender on a tree where `pnpm verify` was
green (`NODE_ENV=development` in the sandbox pulling React's dev bundles into the production
prerender). No stage could see that class of failure, and finding it cost a human round-trip.
`next build` needs no daemon — it prerenders with no database reachable — so it does not breach
the fail-closed rule that keeps stack-dependent stages out of the lane.

**`pnpm verify` is now five stages:** typecheck → lint → vitest → cad → **build**, build last so
the cheap stages report first. Measured on this tree at 4e48871, Node v24.12.0:

| | before | after |
|---|---|---|
| verify | 6.7s (typecheck 2.6 · lint 1.2 · test 2.2 · cad 0.7) | **15.2s** (+ build 8.4) |

Still inside the <60s founding target, with the margin left to spend on real tests. Build is the
stage that grows with every route; when it dominates, the ruling is re-measured, not relaxed.

Two properties the stage has to keep:

- **Cold, always.** It builds into `.next-verify` (`distDir` via `NEXT_DIST_DIR`), deleted before
  each run — no caching, per the founding rule, and 2.6s cheaper than the warm/cold ambiguity is
  worth. The separate directory also means verify never fights a running `next dev` for `.next`.
- **Proven to fire.** A deliberately broken prerender (`JSON.parse("{")` in `/login`, reverted)
  passed all four original stages and failed the build stage with exit 1.

It is the first stage sensitive to the *ambient environment* rather than the tree alone — which
is precisely the point, since that is how the bug entered. `NODE_ENV` is not set by the check;
Next chooses its own mode per command.
