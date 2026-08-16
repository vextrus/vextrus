# ADR-0001 — One TypeScript application; Python for CAD ingestion, as a CLI

**Date:** 2026-08-16 · **Status:** accepted (second founding; re-derives the 2026-08-12 decision)

## Context

The product is one typed graph: drawing → quantity → rate → estimate → bid, four modules over
one register. The legacy ERP that preceded it measured what happens when that graph is cut into
packages: one new entity cost 22 files across four packages, tickets had a 12–49-file floor,
build caches returned false greens, and a resident Python CAD service sat outside the
verification contract while holding load-bearing constants. The first founding chose the
opposite shape and it held; the four days since produced no evidence against it.

## Decision

- **One Next.js (App Router) application** — UI, tRPC API (ADR-0003), and domain modules in one
  `tsconfig`. No workspace packages, no build orchestrator, no DI container, no CQRS buses. Typecheck
  is one `tsc --noEmit`; there is no `dist` and no incremental state to go stale.
- **Modules are folders** — `src/modules/{takeoff,book,estimate,bid}` over `src/core/` — each with
  exactly one public `index.ts`. ESLint bans deep imports and bans core importing any module; a
  fixture test proves the rules fire (`src/__tests__/boundaries.spec.ts`).
- **Python 3.13 (uv-managed) lives in `cad/`** for one job: DXF/DWG (and later PDF/raster) in,
  versioned EntityGraph JSON out, as a CLI subprocess. Pure, stateless, fixture-tested, inside
  `pnpm verify` (ruff + pytest). Never a resident service. The artifact contract is mirrored in
  Zod at `src/core/entitygraph.ts`; both sides parse the same committed fixtures, so drift on
  either side goes red. Licences per `docs/domain/cad-ingestion.md` §1: LibreDWG subprocess-only,
  ezdxf, pypdfium2; AGPL PDF libraries banned, enforced by a test when a PDF lane lands.

## Consequences

- A one-concept change is a one-folder diff plus at most one schema file.
- No caches exist to lie; `pnpm verify` output is always evidence (ADR-0007).
- Per-package build caching and independent deployability are given up. At four modules and one
  team that costs nothing; the module folders and their single-index rule are the extraction
  seams if the app ever needs splitting.
- Python startup per ingestion (~100 ms) is accepted; ingestion is seconds-long and runs in a job.
