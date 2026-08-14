# Entity-index probe

The measurements in `.wayfinder/takeoff/tickets/11-the-entity-index.md` came from these scripts.
They are **probes, not pipeline code** — nothing here ships, nothing here is imported by `src/`
or `cad/`, and `pnpm verify` does not run them.

`bench.mjs` creates and drops a throwaway **`vextrus_probe`** database. It never touches
`vextrus`, never writes a migration, and is not a second schema writer (ADR-0002): the candidate
tables exist only inside that scratch database.

The corpus is **not committed** — it is 220 MB of synthetic DXF and JSON. `gen_sheet.py`
regenerates it into `.data/entityindex/`, deterministically (`PYTHONHASHSEED=0`, seeded jitter).

```sh
mkdir -p .data/entityindex

# one sheet at the per-sheet bar: ~10K originals, extracted by the real CLI
(cd cad && uv run --with ezdxf python ../docs/research/probes/entity-index/gen_sheet.py \
    --originals 10000 --seed 0 --out ../.data/entityindex/sheet-00.dxf)
(cd cad && uv run python -m vextrus_cad ingest ../.data/entityindex/sheet-00.dxf \
    -o ../.data/entityindex/sheet-00.entitygraph.json)

# the pathological single file: 500K originals in one model space
(cd cad && uv run --with ezdxf python ../docs/research/probes/entity-index/gen_sheet.py \
    --originals 500000 --seed 7 --out ../.data/entityindex/mega.dxf)
(cd cad && uv run python -m vextrus_cad ingest ../.data/entityindex/mega.dxf \
    -o ../.data/entityindex/mega.entitygraph.json)

node docs/research/probes/entity-index/bench.mjs artifact .data/entityindex/sheet-00.entitygraph.json
node docs/research/probes/entity-index/bench.mjs artifact .data/entityindex/mega.entitygraph.json
node docs/research/probes/entity-index/bench.mjs load .data/entityindex/sheet-00.entitygraph.json 50
node docs/research/probes/entity-index/bench.mjs query
node docs/research/probes/entity-index/bench.mjs lod
node docs/research/probes/entity-index/bench.mjs incremental .data/entityindex/sheet-00.entitygraph.json
```

`load` replicates one extracted sheet 50 times on a disjoint offset grid. That is what a
50-sheet set of one building looks like to an index — same species of content, disjoint extents,
one project — and it keeps the extractor's real original-to-derived ratio instead of an assumed
one.

## What each subcommand answers

| subcommand | the ticket question it feeds |
|---|---|
| `artifact` | is the artifact itself a memory wall? what does the derived cap do at scale? |
| `load` | §5 ingest throughput — `COPY` vs batched insert, and each candidate's disk cost |
| `query` | §1 spatial mechanism — latency **and correctness** per candidate |
| `lod` | §4 the viewer's query — how much of a viewport is sub-pixel at each zoom |
| `incremental` | §5 again, in the real shape: one sheet at a time into an already-indexed table |

## PostGIS

`bench.mjs load` runs `create extension postgis`, which needs the extension present. It is **not**
in the `postgres:16` compose image and **not** in `postgresql-contrib`; on the native lane it is
`apt-get install -y postgresql-16-postgis-3` (76.6 MB installed, pulling libgdal/libgeos/libproj).
Installing it is a probe-time act — it is deliberately not in `scripts/provision.sh`, because
whether the product depends on PostGIS is exactly what the ticket has to rule.
