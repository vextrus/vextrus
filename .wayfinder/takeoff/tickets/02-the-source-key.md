# The source key — provenance when there is no DXF handle

wayfinder:grilling
Status: closed
Blocked by:
Claimed by:

## Objective

`cad-ingestion.md` §2 rules that **"the DXF handle (`h`) is THE stable provenance key"** — every
schedule cell, note reading and measurement cites handles. Charting admitted vector PDF and
raster PDF as first-class lanes. **Neither has handles.** This ticket generalises §2 without
weakening it, and the amendment is written into the domain file as part of the resolution.

## The decision

1. **The scheme.** A source key becomes `(scheme, key)` with a closed scheme vocabulary —
   `DXF_HANDLE`, and one each for vector-PDF and raster-derived evidence. What generates the
   PDF key? Charting proposed a **content-derived** digest (page + operator-path, quantized),
   explicitly **never an ordinal counter**, because `identity.md` §3 requires that an identical
   re-derivation reproduce the identical key multiset — a counter re-mints on re-ingest and
   orphans every citation. Confirm or replace that construction.
2. **Quantization.** A content digest over floating-point path coordinates is unstable unless
   quantized. §3 already quantizes placement keys to 0.1 drawing unit. What is the analogous
   figure for PDF user-space, and what happens when two distinct paths collide after
   quantization — refuse, or disambiguate by an ordinal *within* the collision set?
3. **Raster.** Under the ruling in ticket 03, raster geometry is machine-vectorized and carries
   basis `INTERPRETED`. Its source key must survive re-vectorization of the same page — or must
   it? If the vectorizer is not deterministic, a re-run orphans citations, and that consequence
   must be named rather than discovered.
4. **Storage.** Register sightings, refusals and cited-handle arrays all currently store bare
   handle strings. Does the scheme ride in the column, in a separate column, or in a prefix?

## Guardrails

- `identity.md` §1: every figure traces to a register row **by reference**; §3: zero minted ids,
  no UUIDs, no DB sequences, no timestamps in any derived key.
- `identity.md` §5: the *semantic* carries cited evidence handles deliberately — a row whose
  numbers are unchanged but whose evidence moved must re-present. Whatever the key becomes, this
  must keep working.
- The closed `takeoff-core` work stores DXF handles today. This is a migration, not a rewrite —
  existing rows must remain valid under the generalised scheme.

## Blocks

Ticket 17 (AI architecture — proposals cite source keys and code verifies they resolve) and
19 (member-type registry — every schedule cell cites its sources).

## Resolution

Ruled 2026-08-13. The amendment is landed in `cad-ingestion.md` §2 (rewritten) and §3 (two
paragraphs appended), with `identity.md` §3's view key and §5's semantic reworded from *handle*
to *source key*. No code changed: this is a decision ticket, and the build lands in tickets 06,
07 and 11.

Grounding fact that shaped every ruling: **the PDF lane is greenfield.** `cad/pyproject.toml`
depends on `ezdxf` alone; there is no `pypdfium2`, no vectorizer, no PDF code. Source keys are
stored bare today in five places — `registerObjectSightings.handles`, `RefusedSightingSubject`,
`View.handles`, `Placement.handles`, and inside the semantic (asserted literally at
`revision-delta.dbspec.ts:223`) — and, decisively, **a source key is a substring of an identity
key**: the view key is `view class + caption anchor handle` (`views.ts:471`).

### The ruling

1. **The atom is the EntityGraph original entity, defined per-lane by the extractor and by
   nothing else.** One pdfium page object; one vectorizer-emitted primitive. *Forced by:*
   charting's "the EntityGraph is the one interface"; `cad-ingestion.md` §3's existing
   `h`/`src` discriminator, which already has this shape and needed only its key type widened;
   and the view key, which requires a single caption anchor per view — an atom coarser than one
   entity leaves a PDF sheet unable to key a view at all, turning this ticket into a rewrite of
   `identity.md` §3. *Rejected:* a key naming a content-stream byte range that several entities
   share (then "resolve this key" no longer returns one thing to highlight, which ticket 17's
   verifier and the canvas both need), and per-lane atoms with downstream branching on scheme
   (the direct violation of the one-interface ruling).
2. **Three schemes, split by the minting extractor** — `DXF_HANDLE` (ezdxf), `PDF_OBJECT`
   (pdfium), `RASTER_TRACE` (the vectorizer). *Forced by:* §1 routes DWG through `dwg2dxf` to
   DXF, so a DWG upload carries real handles — the scheme is therefore not a property of what
   the QS uploaded. Scheme rides **per key, not per drawing**, forced by the hybrid page: a
   scanned detail pasted onto a drafted sheet mints both content-derived schemes from one page,
   so a `scheme` column on `drawings` cannot hold the answer. *Rejected:* collapsing
   `PDF_OBJECT` and `RASTER_TRACE` into one `DIGEST` scheme — they carry different stability
   warranties, and under ticket 03 a raster citation is what makes a line `INTERPRETED`, so one
   scheme would force the basis rule into a second lookup that goes stale.
3. **The digest is over page index + object type + resolved page-space geometry, and nothing
   else.** Colour, width, dash, fill and font are excluded (`identity.md` §2: anything a later
   act may correct never enters a key — a re-export with a changed pen table would otherwise
   re-mint every key over a change that moved no geometry). Text's string *is* its geometry.
   Page index, never page label. **Form XObjects take §3's INSERT law verbatim**: the instance
   is the original and mints the key, contents are derived carrying `src`. *Forced by:* a form
   placed twice has byte-identical raw operator streams, so a raw-stream digest collides on
   every repeated detail — a guaranteed failure on the first real drawing. *Rejected:* raw
   operator-stream digests, and binding attributes into the key.
4. **Quantize to 0.001 pt** (points via `UserUnit`), fixed-precision decimal, half-even.
   *The measurement that forced it:* inside one file there is no jitter to absorb — same bytes
   through the same code is bit-identical, and CTM composition noise runs ~1e-9 pt against page
   coordinates of ~1e3 pt, six orders of headroom. So **this quantum is a collision policy, not
   a stability dial**, unlike §3's 0.1 drawing unit, whose measured justification is that five
   drawings of one building shared zero coincident vertices. *Rejected:* reasoning by analogy
   from 0.1 drawing units and picking a quantum "large enough to be safe" — large is less safe
   here, since every widening manufactures collisions.
5. **A source key is scoped to `(file bytes, extractor identity)`.** Not across files, not
   across extractor versions. Cross-revision continuity stays the identity key's job
   (`identity.md` §4 pairing). *Rejected:* cross-file stability — it would be a second, weaker
   pairing mechanism beside the one that works, and would force quantization to absorb unbounded
   export jitter.
6. **Collisions collapse to one original, counted per page and per object type.** At 0.001 pt a
   collision is coincidence within 0.00035 mm — one mark on the page, usually a double-drawn
   line, and one line drawn twice is one entity. *Forced by:* §3's law that a tripped cap must
   say so with **per-type** counters, the named legacy defect being a single global scalar the
   census could not decompose. *Rejected:* an ordinal within the collision set — it is a counter
   placed exactly where the digest has stopped distinguishing anything, and it would put a
   non-self-authenticating discriminator on the one class of keys where evidence is already
   ambiguous. *Also rejected:* refusing — coincident paths are ordinary CAD-export output, and
   refusing them measures less *and* keeps less evidence about why.
7. **Content-derivation's real warrant is self-authentication, not counter re-minting.** Under
   ruling 5 a plain stream ordinal would also re-derive identically, so charting's stated
   rationale no longer bites. The property actually bought: a digest is verified by recomputing
   it over the object a claim cites, whereas "index 417" checks only against a count — true of
   every number below it, so a model hallucinating a plausible integer passes. **Ticket 17
   depends on this**, and the amendment states it as the rationale.
8. **No cross-version survival for `RASTER_TRACE`.** Vectorization runs once per ingest and
   freezes into the immutable artifact, so it cannot orphan a citation within an ingest's life —
   the re-derivation `identity.md` §3 protects is the rebuild from the artifact, not a re-run of
   the extractor, a distinction the DXF lane never had to draw. Determinism within a pinned
   extractor identity is still required and gated by a torture-corpus fixture (vectorize twice,
   identical key multiset), without which a 50-sheet parallel ingest cannot agree with itself.
   A vectorizer upgrade is a **declared re-ingest**: `identity.md` §5 then does its stated job
   and every raster-derived row re-presents though its numbers are unchanged. *Rejected:*
   pursuing cross-version stability — matching old primitives to new is a matcher, and
   `identity.md` §2 rejected matchers because a wrong merge silently deletes quantity.
9. **Storage: a prefix, `scheme:key`, one opaque token — not a second column.** *Forced by:* the
   view key. A `{scheme, key}` object cannot be concatenated into an identity key without
   inventing a flat form anyway, leaving two representations and a rule about which is canonical.
   The prefix is that flat form. No column changes type anywhere. **No data migration:** an
   unprefixed token **reads as `DXF_HANDLE`**, a read-side legacy rule in one parse function,
   while every write is prefixed unconditionally. *Rejected:* rewriting historical `handles` and
   semantics — `vextrus_app` holds `GRANT SELECT, INSERT` and no UPDATE on evidence
   (`0009_register-sightings-rls.sql:17`), so that rewrite reaches around the exact grant
   ADR-0004's shape exists to enforce. *Also rejected:* leaving DXF bare permanently as an
   unprefixed scheme — the special case would then live at every consumer instead of one parser.

### Consequences named rather than left to be discovered

- **A pdfium upgrade re-mints every `PDF_OBJECT` key**, since its page-object decomposition is
  the atom. Bounded, versioned and testable, and detectable only because ruling 5 pins extractor
  identity — but real, and accepted knowingly.
- **`ingests` needs an extractor-identity column** (version + parameter-set hash, per scheme —
  one artifact may carry two). It has `artifactSha256`, `lostByType`, `unsupportedByType`,
  `explodeTruncated` and **no version field of any kind** today. A build ticket owes this.
- **After collapse, counting keys no longer answers "did we see everything."** The census
  reconciles as `objects seen = distinct keys + collapsed`; a testable invariant, stated so a
  later session reads the discrepancy as designed rather than "fixing" it into a global counter.
- **A rebuild after this lands re-mints view and placement keys**, because the prefixed token
  changes the string they embed. Append-only already defines the behaviour — a restated
  placement files a new sighting and the superseded one stays as history — so nothing corrupts.
  It costs one re-present through the disposition queue, which is the safe direction under the
  governing sentence, and it is free in practice pre-first-customer.
- **Upgrading the vectorizer is operationally expensive** — it re-presents every scan-derived
  row on a project. Priced deliberately: pin hard, upgrade rarely.
- **ML vectorizers are admissible only under deterministic kernels and a fixed seed.** Stated
  now, while the vectorizer is still unchosen, rather than discovered after one is picked.
