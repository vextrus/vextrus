# Vextrus

AI-native construction takeoff → cost database → estimation → bidding.
*Drawing to estimate to bid.*

Start here: [`CLAUDE.md`](CLAUDE.md) · [`docs/specs/genesis.md`](docs/specs/genesis.md) ·
[`docs/domain/`](docs/domain/)

```
pnpm install
docker compose up -d      # postgres on :5544
pnpm db:migrate
pnpm verify               # tsc → eslint → vitest → cad; exit code is the contract
pnpm dev                  # web on :3210
pnpm worker               # ingest worker: drains the queue, runs the cad CLI
```
