/**
 * The entity-index probe: what a derived Postgres index of drawing contents costs at the
 * 50-sheet / 500K-original bar, and which spatial mechanism earns its place.
 *
 * Not pipeline code. It talks to a throwaway `vextrus_probe` database it creates itself, never
 * to `vextrus`, and `pnpm verify` does not run it. See README.md for the run order and for the
 * numbers it produced.
 */

import { readFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import postgres from "postgres";

const ADMIN = "postgres://vextrus:vextrus_dev_password@localhost:5544/postgres";
const PROBE = "postgres://vextrus:vextrus_dev_password@localhost:5544/vextrus_probe";

const TILE = 2000.0; // drawing units (mm) — a 2 m tile
const ROW = 4294967296; // the tile key's row stride: tx * ROW + ty
const TENANT = "11111111-1111-1111-1111-111111111111";
const PROJECT = "22222222-2222-2222-2222-222222222222";
const ingestId = (s) => `33333333-3333-3333-3333-${String(s).padStart(12, "0")}`;

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const rss = () => `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)} MB`;
const n = (x) => Number(x).toLocaleString("en-IN");

/**
 * The bbox every candidate indexes on. TEXT is approximated from its world height and string
 * length — the extractor emits no glyph extents, and a viewer culls on the same approximation.
 */
function bboxOf(e) {
  switch (e.t) {
    case "LINE":
      return [Math.min(e.p1[0], e.p2[0]), Math.min(e.p1[1], e.p2[1]),
              Math.max(e.p1[0], e.p2[0]), Math.max(e.p1[1], e.p2[1])];
    case "LWPOLYLINE": case "POLYLINE": case "SOLID": {
      const xs = e.pts.map((p) => p[0]), ys = e.pts.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    case "CIRCLE": case "ARC":
      return [e.c[0] - e.r, e.c[1] - e.r, e.c[0] + e.r, e.c[1] + e.r];
    case "TEXT": case "MTEXT":
      return [e.p[0], e.p[1], e.p[0] + e.text.length * e.height * 0.6, e.p[1] + e.height];
    case "INSERT":
      return [e.p[0], e.p[1], e.p[0], e.p[1]];
    default:
      return null; // DIMENSION: provenance only, no geometry of its own
  }
}

/* ------------------------------- the candidates ------------------------------ */

/** One identical row shape under three spatial mechanisms: only the mechanism differs. */
const COMMON = `
  tenant_id   uuid    not null,
  project_id  uuid    not null,
  ingest_id   uuid    not null,
  source_key  text,
  is_original boolean not null,
  src         text,
  layer       text    not null,
  etype       text    not null,
  color       char(7) not null,
  minx double precision not null, miny double precision not null,
  maxx double precision not null, maxy double precision not null,
  geom  jsonb not null`;

const CANDIDATES = {
  gist_box: {
    table: "ix_gist",
    ddl: `create table ix_gist (id bigint generated always as identity, ${COMMON},
            bbox box generated always as (box(point(minx,miny), point(maxx,maxy))) stored)`,
    index: [`create index ix_gist_bbox on ix_gist using gist (bbox)`],
  },
  tile_key: {
    table: "ix_tile",
    // The cheap form of a quantized tile key: the tile of the bbox *centre*, plus the bbox for
    // exact filtering. `query` measures what that centre costs in correctness.
    ddl: `create table ix_tile (id bigint generated always as identity, ${COMMON},
            tile bigint not null)`,
    index: [
      `create index ix_tile_tile on ix_tile (tile)`,
      `create index ix_tile_cover on ix_tile (tile, layer) include (etype, minx, miny, maxx, maxy)`,
    ],
  },
  postgis: {
    table: "ix_gis",
    ddl: `create table ix_gis (id bigint generated always as identity, ${COMMON},
            env geometry(Polygon) generated always as
              (st_makeenvelope(minx, miny, maxx, maxy)) stored)`,
    index: [`create index ix_gis_env on ix_gis using gist (env)`],
  },
};

const COLS = `tenant_id, project_id, ingest_id, source_key, is_original, src, layer, etype, color, minx, miny, maxx, maxy, geom`;

/* -------------------------------- artifact cost ------------------------------- */

function artifactCost(path) {
  const bytes = readFileSync(path);
  console.log(`artifact ${path}: ${mb(bytes.byteLength)} on disk, rss before parse ${rss()}`);
  let t = performance.now();
  const graph = JSON.parse(bytes.toString("utf-8"));
  console.log(`  JSON.parse: ${(performance.now() - t).toFixed(0)} ms, rss after ${rss()}`);
  console.log(`  entities ${n(graph.entities.length)} (original ${n(graph.counters.original)}, ` +
    `derived ${n(graph.counters.derived)}, explode_truncated ${graph.counters.explode_truncated})`);
  const lost = Object.values(graph.counters.lost_by_type).reduce((a, b) => a + b, 0);
  if (lost) console.log(`  LOST TO THE CAP: ${n(lost)} entities — ${JSON.stringify(graph.counters.lost_by_type)}`);
  t = performance.now();
  let withGeom = 0;
  for (const e of graph.entities) if (bboxOf(e)) withGeom++;
  console.log(`  bbox over every entity: ${(performance.now() - t).toFixed(0)} ms (${n(withGeom)} with geometry)`);
  const fanout = (graph.counters.original + graph.counters.derived) / graph.counters.original;
  const per = bytes.byteLength / graph.entities.length;
  console.log(`  ${per.toFixed(0)} bytes/entity · derived fan-out ×${fanout.toFixed(2)} → a 500K-original ` +
    `set projects to ${mb(per * 500000 * fanout)} of artifact JSON`);
}

/* ---------------------------------- the load --------------------------------- */

function* rows(graph, sheets, extent) {
  const cols = Math.ceil(Math.sqrt(sheets));
  for (let s = 0; s < sheets; s++) {
    const ox = (s % cols) * extent * 1.2;
    const oy = Math.floor(s / cols) * extent * 1.2;
    for (const e of graph.entities) {
      const b = bboxOf(e);
      if (!b) continue;
      const [minx, miny, maxx, maxy] = [b[0] + ox, b[1] + oy, b[2] + ox, b[3] + oy];
      yield {
        ingest: ingestId(s),
        sourceKey: e.h === null ? null : `DXF_HANDLE:${e.h}`,
        isOriginal: e.src === null, src: e.src, layer: e.layer, etype: e.t, color: e.color,
        minx, miny, maxx, maxy,
        tile: Math.floor((minx + maxx) / 2 / TILE) * ROW + Math.floor((miny + maxy) / 2 / TILE),
        geom: JSON.stringify(e),
      };
    }
  }
}

const tsv = (r, withTile) =>
  [TENANT, PROJECT, r.ingest, r.sourceKey ?? "\\N", r.isOriginal ? "t" : "f", r.src ?? "\\N",
   r.layer, r.etype, r.color, r.minx, r.miny, r.maxx, r.maxy, r.geom,
   ...(withTile ? [r.tile] : [])].join("\t") + "\n";

function sheetExtent(graph) {
  let extent = 0;
  for (const e of graph.entities) {
    const b = bboxOf(e);
    if (b) extent = Math.max(extent, b[2], b[3]);
  }
  return extent;
}

async function load(path, sheets) {
  const graph = JSON.parse(readFileSync(path, "utf-8"));
  const extent = sheetExtent(graph);
  console.log(`one sheet spans ${extent.toFixed(0)} drawing units; laying ${sheets} out disjointly\n`);

  const admin = postgres(ADMIN, { max: 1, onnotice: () => {} });
  await admin`drop database if exists vextrus_probe`;
  await admin`create database vextrus_probe`;
  await admin.end();
  const sql = postgres(PROBE, { max: 1, onnotice: () => {} });
  await sql`create extension if not exists postgis`;

  for (const [name, spec] of Object.entries(CANDIDATES)) {
    await sql.unsafe(spec.ddl);
    const withTile = name === "tile_key";
    const cols = withTile ? `${COLS}, tile` : COLS;

    let t = performance.now();
    let count = 0;
    const stream = await sql`copy ${sql.unsafe(spec.table)} (${sql.unsafe(cols)}) from stdin`.writable();
    await pipeline(
      Readable.from((function* () {
        for (const r of rows(graph, sheets, extent)) { count++; yield tsv(r, withTile); }
      })()),
      stream,
    );
    const copyMs = performance.now() - t;

    t = performance.now();
    for (const ddl of spec.index) await sql.unsafe(ddl);
    await sql.unsafe(`analyze ${spec.table}`);
    const indexMs = performance.now() - t;

    const [{ heap, idx, total }] = await sql`
      select pg_table_size(${spec.table})::bigint heap, pg_indexes_size(${spec.table})::bigint idx,
             pg_total_relation_size(${spec.table})::bigint total`;
    console.log(`${name.padEnd(9)} COPY ${n(count)} rows in ${(copyMs / 1000).toFixed(1)}s ` +
      `(${n(Math.round(count / (copyMs / 1000)))} rows/s) · index build ${(indexMs / 1000).toFixed(1)}s · ` +
      `heap ${mb(Number(heap))} + idx ${mb(Number(idx))} = ${mb(Number(total))} ` +
      `(${(Number(total) / count).toFixed(0)} B/row)`);
  }

  // the alternative to COPY: batched multi-row INSERT through the same driver
  await sql.unsafe(`create table ix_ins (id bigint generated always as identity, ${COMMON})`);
  const BATCH = 1000;
  let batch = [], count = 0;
  const t = performance.now();
  const flush = async () => {
    if (batch.length) { await sql`insert into ix_ins ${sql(batch)}`; count += batch.length; batch = []; }
  };
  for (const r of rows(graph, sheets, extent)) {
    batch.push({ tenant_id: TENANT, project_id: PROJECT, ingest_id: r.ingest,
      source_key: r.sourceKey, is_original: r.isOriginal, src: r.src, layer: r.layer,
      etype: r.etype, color: r.color, minx: r.minx, miny: r.miny, maxx: r.maxx, maxy: r.maxy,
      geom: r.geom });
    if (batch.length === BATCH) await flush();
  }
  await flush();
  const insMs = performance.now() - t;
  console.log(`insert    ${n(count)} rows in ${(insMs / 1000).toFixed(1)}s ` +
    `(${n(Math.round(count / (insMs / 1000)))} rows/s, batches of ${BATCH})`);
  await sql.end();
}

/* --------------------------------- the queries -------------------------------- */

async function viewports(sql) {
  const [e] = await sql`select min(minx) minx, min(miny) miny, max(maxx) maxx, max(maxy) maxy from ix_gist`;
  const w = e.maxx - e.minx, h = e.maxy - e.miny;
  return [["whole set", 1], ["4 sheets", 4], ["one sheet", 8], ["quarter", 16],
          ["a corner", 40], ["a bay", 200]]
    .map(([name, div]) => ({ name, div, x1: e.minx, y1: e.miny, x2: e.minx + w / div, y2: e.miny + h / div }));
}

async function query() {
  const sql = postgres(PROBE, { max: 1, onnotice: () => {} });
  const vs = await viewports(sql);
  console.log("Every candidate answers the same viewport. `→` is the row count it returned;\n" +
    "the exact answer is the one a bbox-overlap predicate gives.\n");

  const plans = {
    gist_box: (v) => sql`select count(*) from ix_gist where bbox && box(point(${v.x1},${v.y1}), point(${v.x2},${v.y2}))`,
    postgis: (v) => sql`select count(*) from ix_gis where env && st_makeenvelope(${v.x1},${v.y1},${v.x2},${v.y2})`,
    tile_key: (v) => sql`
      select count(*) from ix_tile
       where tile between ${Math.floor(v.x1 / TILE) * ROW + Math.floor(v.y1 / TILE)}
                      and ${Math.floor(v.x2 / TILE) * ROW + Math.floor(v.y2 / TILE)}
         and minx <= ${v.x2} and maxx >= ${v.x1} and miny <= ${v.y2} and maxy >= ${v.y1}`,
  };

  for (const v of vs) {
    const out = [];
    for (const [name, run] of Object.entries(plans)) {
      await run(v);
      const t = performance.now();
      let seen = 0;
      for (let i = 0; i < 5; i++) seen = Number((await run(v))[0].count);
      out.push(`${name} ${((performance.now() - t) / 5).toFixed(1)}ms → ${n(seen)}`);
    }
    console.log(`${v.name.padEnd(10)} ${out.join("  ·  ")}`);
  }

  console.log("\n-- what the tile key's centre-tile drops, and what correctness would cost --");
  const v = vs.find((x) => x.name === "a corner");
  const missed = await sql`
    select etype, count(*)::bigint c, round(max(maxx - minx)::numeric, 0) widest
      from ix_tile
     where minx <= ${v.x2} and maxx >= ${v.x1} and miny <= ${v.y2} and maxy >= ${v.y1}
       and tile not between ${Math.floor(v.x1 / TILE) * ROW + Math.floor(v.y1 / TILE)}
                        and ${Math.floor(v.x2 / TILE) * ROW + Math.floor(v.y2 / TILE)}
     group by etype order by 2 desc`;
  for (const r of missed) console.log(`  dropped ${n(r.c)} × ${r.etype}, widest ${n(r.widest)} units`);
  const [cover] = await sql`
    select sum(greatest(1, (floor(maxx/${TILE}) - floor(minx/${TILE}) + 1)
                         * (floor(maxy/${TILE}) - floor(miny/${TILE}) + 1)))::bigint covering,
           count(*)::bigint entities from ix_tile`;
  console.log(`  fix A — one row per covered tile: ${n(cover.covering)} rows for ${n(cover.entities)} entities ` +
    `(×${(Number(cover.covering) / Number(cover.entities)).toFixed(2)})`);
  const [{ pad }] = await sql`select max(greatest(maxx - minx, maxy - miny)) pad from ix_tile`;
  const [{ swept }] = await sql`
    select count(*)::bigint swept from ix_tile
     where tile between ${Math.floor((v.x1 - pad) / TILE) * ROW + Math.floor((v.y1 - pad) / TILE)}
                    and ${Math.floor((v.x2 + pad) / TILE) * ROW + Math.floor((v.y2 + pad) / TILE)}`;
  console.log(`  fix B — pad the range by the widest entity (${n(Math.round(pad))} units): sweeps ${n(swept)} rows ` +
    `to answer a query whose true answer is small`);

  console.log("\n-- the viewer's real question: materialise the rows, not count them --");
  const one = vs.find((x) => x.name === "one sheet");
  for (const [name, table, pred] of [
    ["gist_box", "ix_gist", sql`bbox && box(point(${one.x1},${one.y1}), point(${one.x2},${one.y2}))`],
    ["postgis", "ix_gis", sql`env && st_makeenvelope(${one.x1},${one.y1},${one.x2},${one.y2})`],
  ]) {
    const t = performance.now();
    const r = await sql`select source_key, layer, etype, color, minx, miny, maxx, maxy, geom
                          from ${sql.unsafe(table)} where ${pred}`;
    console.log(`  ${name}: ${n(r.length)} rows in ${(performance.now() - t).toFixed(0)} ms ` +
      `(${mb(Buffer.byteLength(JSON.stringify(r)))} as row JSON)`);
  }
  await sql.end();
}

/* ------------------------------ level of detail ------------------------------- */

async function lod() {
  const sql = postgres(PROBE, { max: 1, onnotice: () => {} });
  const PX = 1920;
  console.log("A viewport is painted into 1920 px. An entity whose bbox is under one pixel in\n" +
    "both axes cannot be told from a dot, so it is the honest thing for the server to drop.\n");
  console.log("zoom".padEnd(11), "viewport".padEnd(13), "in view".padEnd(12), "sub-pixel".padEnd(16), "painted".padEnd(10), "query");
  for (const v of await viewports(sql)) {
    const perPx = (v.x2 - v.x1) / PX;
    const t = performance.now();
    const [r] = await sql`
      select count(*)::bigint total,
             count(*) filter (where (maxx-minx) < ${perPx} and (maxy-miny) < ${perPx})::bigint sub
        from ix_gist where bbox && box(point(${v.x1},${v.y1}), point(${v.x2},${v.y2}))`;
    const ms = performance.now() - t;
    const total = Number(r.total), sub = Number(r.sub);
    console.log(v.name.padEnd(11), n(Math.round(v.x2 - v.x1)).padEnd(13), n(total).padEnd(12),
      `${n(sub)} (${((sub / total) * 100).toFixed(0)}%)`.padEnd(16), n(total - sub).padEnd(10),
      `${ms.toFixed(0)} ms`);
  }
  const [d] = await sql`select count(*) filter (where is_original)::bigint o,
                               count(*) filter (where not is_original)::bigint d from ix_gist`;
  console.log(`\noriginal ${n(d.o)} · derived ${n(d.d)} — ` +
    `${((Number(d.d) / (Number(d.o) + Number(d.d))) * 100).toFixed(0)}% of the index would be paint`);
  await sql.end();
}

/* ------------------------- incremental, per-sheet load ------------------------ */

async function incremental(path) {
  const graph = JSON.parse(readFileSync(path, "utf-8"));
  const extent = sheetExtent(graph);
  const setup = postgres(PROBE, { max: 1, onnotice: () => {} });
  await setup`drop table if exists ix_incr`;
  await setup.unsafe(`create table ix_incr (id bigint generated always as identity, ${COMMON},
    bbox box generated always as (box(point(minx,miny), point(maxx,maxy))) stored)`);
  await setup.unsafe(`create index ix_incr_bbox on ix_incr using gist (bbox)`);
  await setup.unsafe(`create index ix_incr_ingest on ix_incr (ingest_id) where is_original`);
  await setup.unsafe(`create unique index ix_incr_key on ix_incr (ingest_id, source_key) where source_key is not null`);
  console.log("table pre-indexed (gist bbox · ingest partial · unique (ingest, source key))\n");

  const sheetTsv = (s) => {
    const ox = (s % 8) * extent * 1.2, oy = Math.floor(s / 8) * extent * 1.2;
    let out = "";
    for (const e of graph.entities) {
      const b = bboxOf(e);
      if (!b) continue;
      out += tsv({ ingest: ingestId(s), sourceKey: e.h === null ? null : `DXF_HANDLE:${e.h}`,
        isOriginal: e.src === null, src: e.src, layer: e.layer, etype: e.t, color: e.color,
        minx: b[0] + ox, miny: b[1] + oy, maxx: b[2] + ox, maxy: b[3] + oy,
        geom: JSON.stringify(e) }, false);
    }
    return out;
  };
  const copySheet = async (sql, s) =>
    pipeline(Readable.from([sheetTsv(s)]), await sql`copy ix_incr (${sql.unsafe(COLS)}) from stdin`.writable());

  let t = performance.now();
  for (let s = 0; s < 10; s++) await copySheet(setup, s);
  const serial = performance.now() - t;
  console.log(`serial:   10 sheets in ${(serial / 1000).toFixed(1)}s → ${(serial / 10 / 1000).toFixed(2)}s/sheet ` +
    `→ ${((serial / 10 * 50) / 1000).toFixed(0)}s for 50 sheets`);
  await setup.end();

  for (const workers of [4, 8]) {
    const t0 = postgres(PROBE, { max: 1, onnotice: () => {} });
    await t0`truncate ix_incr`;
    await t0.end();
    const pool = Array.from({ length: workers }, () => postgres(PROBE, { max: 1, onnotice: () => {} }));
    t = performance.now();
    await Promise.all(pool.map(async (sql, w) => {
      for (let s = w; s < 40; s += workers) await copySheet(sql, s);
    }));
    const par = performance.now() - t;
    console.log(`parallel: 40 sheets on ${workers} workers in ${(par / 1000).toFixed(1)}s → ` +
      `${(par / 40 / 1000).toFixed(2)}s/sheet effective`);
    await Promise.all(pool.map((s) => s.end()));
  }
  const fin = postgres(PROBE, { max: 1, onnotice: () => {} });
  const [r] = await fin`select count(*)::bigint c from ix_incr`;
  const [z] = await fin`select pg_total_relation_size('ix_incr')::bigint t`;
  console.log(`\n${n(r.c)} rows, ${mb(Number(z.t))} total, ${(Number(z.t) / Number(r.c)).toFixed(0)} B/row ` +
    `→ a 50-sheet project projects to ${(Number(z.t) / Number(r.c) * 1491750 / 1024 ** 3).toFixed(2)} GB`);
  await fin.end();
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "artifact") artifactCost(args[0]);
else if (cmd === "load") await load(args[0], Number(args[1] ?? 50));
else if (cmd === "query") await query();
else if (cmd === "lod") await lod();
else if (cmd === "incremental") await incremental(args[0]);
else {
  console.error("usage: bench.mjs artifact <path> | load <path> [sheets] | query | lod | incremental <path>");
  process.exit(2);
}
