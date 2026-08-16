# Vextrus

AI-native construction takeoff, estimating and bidding. Reads 2D CAD drawings, produces
quantities a professional can sign, prices them from Bangladesh Schedule-of-Rates data, prepares
the bid. Bangladesh first; built to travel.

- Start here: `CLAUDE.md`, then `docs/specs/genesis-ii.md`.
- The domain law: `docs/domain/`. Decisions: `docs/adr/`. Work: GitHub Issues (`docs/tracker.md`).

```sh
cp .env.example .env      # Postgres 16 native on localhost:5544 (no Docker)
pnpm install && pnpm db:migrate
pnpm verify               # tsc → eslint → vitest → ruff → pytest, fail-fast, uncached
pnpm test:db              # the live tenant-seam test
pnpm dev                  # http://localhost:3210
```
