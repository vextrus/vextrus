# ADR-0001 — Single TypeScript application; Python CAD ingestion as a CLI

**Date:** 2026-08-12 · **Status:** accepted (founding)

## Context

The legacy repo (`vextrus-erp`) was a pnpm/turbo monorepo: 22 NestJS modules, 30+ packages,
compiled dist consumed across package boundaries, a resident Python FastAPI CAD service. The
measured consequences: one new entity cost 22 files across 4 packages; tickets had a 12–49-file
floor that caused 12 "ticket too big" halts in one campaign; turbo and incremental tsc caches
returned false greens (`FULL TURBO` on live type errors, poisoned dist replays); the CAD
service sat outside the verification contract while holding load-bearing domain constants, and
its service-start discipline cost multiple sessions. The 2026 field consensus for agent-built
products is TypeScript strict end-to-end with the smallest possible build machinery; feedback
latency is the dominant quality lever.

## Decision

- One Next.js (App Router) application: UI, tRPC API, domain modules, and a tsx-run worker in
  one typed graph. No workspace packages, no build orchestrator, no DI framework, no CQRS
  buses. Typecheck is a single `tsc --noEmit` over one tsconfig — there is no dist and no
  incremental state to corrupt.
- Modules are folders (`src/modules/{takeoff,book,estimate,bid}` over `src/core/`), each with
  one public `index.ts`, boundaries enforced by ESLint import rules with a fail-closed fixture
  test (the legacy learned boundary plugins fail silently open when misconfigured).
- Python 3.13 (uv-managed) lives in `cad/` for DXF/DWG ingestion only, invoked as a CLI
  subprocess: file in → versioned EntityGraph JSON out. Pure, stateless, fixture-tested,
  inside `pnpm verify` (ruff + pytest). No resident service, no health endpoint, no env-lane
  selection. LibreDWG `dwg2dxf` (subprocess-only) is the production DWG lane; ODA File
  Converter is dev-only and banned from shipped artifacts; AGPL PDF libraries are banned and a
  license test enforces it.

## Consequences

- A one-concept change is a one-folder diff plus at most one schema file — the ticket-size
  floor that ground the legacy rebuild cannot recur structurally.
- No caches exist to lie; `pnpm verify` output is always evidence.
- We give up per-package build caching and independent deployability. At four modules and one
  team this costs nothing; if the app ever needs splitting, the module folders and their
  single-interface rule are the extraction seams.
- Python startup cost per ingestion invocation (~100ms) is accepted; ingestion is seconds-long
  anyway and jobs run in the worker.
