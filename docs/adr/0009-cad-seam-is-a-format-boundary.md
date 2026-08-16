# ADR-0009 — The `cad/` seam is a format boundary: extraction in Python, interpretation in TypeScript

**Date:** 2026-08-16 · **Status:** accepted · **Supersedes:** nothing. **Refines** ADR-0001, which
is not edited. Resolves decision ticket #132 on the takeoff map #128.

## Context

ADR-0001 gives `cad/` one job — "DXF/DWG (and later PDF/raster) in, versioned EntityGraph JSON
out, as a CLI subprocess" — and `cad-ingestion.md` §6 puts the BD notation parsers "beside their
consumer **in the app**, not in `cad/` — the pipeline stays geometry/spatial-only". Neither
sentence says which lane runs the five stages that sit between them: §5 schedule-table
reconstruction, §7 the view law, §8 the grid backbone, §9 instance placement, §10 the extraction
convention profile. Each is defined by a clause that names no language.

`pnpm verify` grades both lanes (ruff + pytest, tsc + vitest), so verifiability does not decide
it. Three facts do.

**The dependency chain runs the wrong way for a Python §8.** §8 derives the grid *only* from
layout-plan evidence, filtered **before** detection; layout-plan is §7's classification; §7
classifies by caption grammar (en+bn stems), which §6 already places in the app. A grid stage
inside `cad/` needs an answer the app owns.

**§2 already says where derived state is rebuilt.** Its scoping rule for a source key reads: "the
re-derivation it protects is the **rebuild of derived state from the artifact**, not a re-run of
the extractor." Anything rebuildable is therefore downstream of the CLI by construction.

**Neither lane is equipped with spatial tooling today.** `cad/` depends on `ezdxf` and nothing
else — no numpy, no shapely, no scipy (`cad/pyproject.toml`, measured 2026-08-16); the app carries
no geometry library either. "Python has the libraries" is not a fact about this repo; it is a
proposal to add dependencies, and it must win on its own merits.

## Decision

- **The seam is a format boundary, and the CLI is one-shot.** `cad/` exists because ezdxf,
  pdfium and LibreDWG are Python. It converts file formats into one geometry vocabulary and
  stops: §§1–4 and nothing else. It is invoked **once per drawing revision** and is **never fed
  app-produced input** — there is no second pass, no negotiated protocol, no stage that reads
  back a decision the app made.
- **§5, §7, §8, §9, §10 and §11 run in TypeScript, in `src/modules/takeoff/`. No stage is
  split.** They read the artifact and never re-open the drawing.
- **The key grammars stay in `src/core/identity.ts`; the judgement does not.** `book`, `estimate`
  and `bid` never classify a view, so §7 in `src/core/` would make core the home of takeoff's
  judgement — ADR-0001's seam inverted.
- **The §7 decision site is enforced by construction, not by detection.** The closed view
  vocabulary is exported as a **branded type** from one `src/modules/takeoff/views.ts`, with the
  sole exported predicate beside it, and an ESLint rule making the view-type literals a lint error
  anywhere else — so a second decision site cannot be *written*. The rule gets a fixture test
  proving it fires, as `src/__tests__/boundaries.spec.ts` already does for the module boundaries;
  a check nobody proved fires is not a check.
- **The §7–§9 partition is stored and rebuilt per ingest, not computed per read.** `identity.md`
  §3 already presumes this — "row ids re-mint on every **partition rebuild**; the key, not the row
  id, rides in downstream keys" is a sentence about stored rows being replaced. The one-hop level
  carry (`@unregistered:<label>` → `<levelId>`) has to move *filed human dispositions* across a
  rebuild, and no disposition can attach to a value a function returns. The scope register stays a
  query (`quantity-contract.md` §2.2) because it reads register rows that are already stored; the
  partition is what makes those rows exist.
- **§9's placement constants are rule-set edition parameter values; §10's seed is pinned by
  nothing.** They are different species. A footprint band that rejects a real column *deletes
  quantity*, so §9's content-scaled shares are parameter values in `identity.md` §8's sense —
  pinned, signed, and voidable by the machinery ticket #129 built. §10's seed is barred by the
  ablation law (`resolve(census, {})` deep-equals `resolve(census)`) from changing any outcome, so
  pinning it would place a key in the signature that by law affects nothing, and a no-op seed edit
  would void signatures for nothing. What enters the edition for §10 is the **resolver**, as a
  `(rule id, version)` pair.
- **Text crosses the seam raw.** `cad/` never applies §6's AutoCAD escape stripping (`%%C`→Ø,
  `%%D`→°); the artifact carries the string verbatim and the app's parsers grade on top of it, as
  §11's raw-retention law requires. §2's "decoded string" means the file's own character decoding,
  which ezdxf resolves, and never AutoCAD's formatting escapes.
- **EntityGraph advances to `version: 2`**, so the chosen side never needs to re-open the drawing.
  Four additions, all of which the app cannot derive from v1:
  1. **A space marker per entity** — model space, or the named paper layout. §7 partitions "every
     model-space original entity" and v1 records no such distinction.
  2. **A layout inventory** — per-layout bbox (§4), and the count of layouts **dropped as
     content-less**. A drop nobody counted is the silent loss §3's own law forbids.
  3. **The robust-extents record** — the extents, and the count of entities rejected by §4's
     2nd–98th inter-percentile window. It is a fidelity fact of the species §3 requires be visible.
  4. **A flatten point-cap counter** — §4 flattens curves "at fixed tolerance with a point cap",
     and unlike `explode_truncated` a tripped cap currently says nothing.

  The bump is **purely additive and re-mints no key** (keys are DXF handles, untouched), so there
  is no data migration and no re-disposition under `identity.md` §5.
- **The ruling is format-agnostic.** When the PDF and raster lanes arrive, pdfium and the
  vectorizer emit the same EntityGraph and §7–§10 run unchanged. The seam does not move per source
  format; that is what makes §3's "the EntityGraph is the one interface" true rather than aspirational.
- **No entity census field.** §10's resolver is pure over a census the app computes from the
  entities; shipping the census as an artifact field would create a second place the census is
  defined.

## Alternatives rejected, by name

- **A stage boundary negotiated per clause** — spatial stages in Python, text stages in TS. It
  requires a second CLI pass fed with the app's view classification, which turns a pure CLI into a
  two-way protocol and gives the version-pinned extractor identity a second surface to be wrong on.
- **§8 or §9 in Python behind a "views" input file.** Same defect, dressed as a file. The moment
  `cad/` reads an app-produced document, "an identical re-derivation reproduces the identical key
  multiset" (`identity.md` §3) acquires a second input nobody pinned.
- **§10 in Python, emitting role-tagged entities.** The convention profile makes a *semantic*
  claim — this layer carries bar linework — and that claim must be re-resolvable and showable to a
  human under the ablation law. A claim minted inside an immutable artifact cannot be re-resolved
  without a re-ingest.
- **§5 kept in Python as the single exception**, on the ground that schedule reconstruction is pure
  clustering. Rejected because §11 admits schedule evidence only after view-membership filtering,
  so the exception re-acquires the same dependency at its consumer, having bought nothing.

## Consequences

- **A stage can be improved without a re-ingest.** This is the ruling's largest practical effect.
  Inside `cad/`, a better view classifier would be a declared re-ingest minting a new key multiset,
  and `identity.md` §5 would make every raster- and geometry-derived row re-present for disposition
  though its numbers never moved. In TS it is a partition rebuild and costs nothing.
- **TypeScript acquires real spatial code** — 1-D gap clustering, bbox containment, point-in-circle,
  nearest-intersection, footprint banding. *Assumption named:* none of §5–§10 needs a polygon
  boolean or a solver, so no geometry dependency is implied on either lane. §9's
  "containment/merge expansion" is the one place that assumption could break; if it proves to be a
  true polygon union rather than a tolerance-expanded containment test, that is a new decision, and
  it is a decision about a *library*, never about moving the seam.
- **`cad/` stops growing.** Its remaining work is lanes, not stages: the LibreDWG DWG lane, the PDF
  lane, the vectorizer. Each lands as a source format behind the same artifact.
- **The artifact is the whole contract, so a gap in it is a hard stop**, not a nuisance — the app
  has no fallback of re-reading the DXF. This is why v2's four fields are part of this ruling and
  not a later convenience.
- **What is given up:** the option of ever using a Python spatial library for measurement work, and
  the option of shipping a stage that reads a drawing directly. Both are given up deliberately.

## Two loose ends this ruling does not close

- `cad-ingestion.md` §1 and §12 both cite **ADR-0012** (the two-pass audited LibreDWG lane, the
  207 + 4 sanity number). No ADR-0009 through 0012 exists in `docs/adr/`. This ADR takes **0009**,
  the next free number; the dangling citations are recorded here and left for the ticket that lands
  the DWG lane.
- ADR-0001 promises a licence test "when a PDF lane lands", and ADR-0008 records that it has come
  due. Unchanged by this ruling and tracked on the map as "The licence test ADR-0001 promised, and
  the renderer pin".
