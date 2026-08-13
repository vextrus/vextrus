# Identity — the Quantity Register's spine

Re-derived 2026-08-12 from the legacy decision record. This file is why a drawing revision
produces a *delta* instead of a do-over — the product's deepest moat. Get this wrong and every
downstream link (pricing, estimates, bids, and any future module) orphans itself.

## 1. The invariant

The Quantity Register is the system of record for physical scope. **No module may originate a
quantity** — every stage inherits an object, enriches it, emits it. Every figure traces to a
register row by reference; one that cannot is a defect. A unit conversion is not origination
*only because* it carries its derivation: source value, source unit as written, canonical unit,
factor, and the factor's provenance; "convert of no input" is no output, never a zero.

## 2. The identity key

```
(project, discipline, level, element type, mark, ordinal)
```

- **No coordinates.** Measured on the legacy fixture set: five drawings of one building shared
  zero coincident vertices; position is unavailable as a key. `drawingId` is provenance, never
  key.
- **No labels, no mutable attributes.** A level is referenced by **surrogate id**; its label,
  ordinal and height are all non-identifying (a QS may rename `MEZZ`; a rename that re-keys the
  ledger orphans every link on that level). Storey height, concrete grade and rebar spec are
  things a later act may *correct* — they participate in diffs, **never in identity**.
- **The ordinal is frozen at first registration** and inherited through pairing. An ordinal
  derived from a content signature migrates when the geometry changes — the exact defect the
  freeze exists to prevent. A mark rename is an authored event, never automatic detection.

**Identity is a double-count guard, not a recognition engine.** Each quantity kind has exactly
one authoritative discipline; a second sighting of the same physical scope is **refused at the
door**, kept as unpriceable evidence in a **separate table with no join from any bill** (a
status flag on the register table was disqualified: one forgotten `WHERE` from
over-measurement). A matcher was rejected because a wrong merge *silently deletes* quantity.
Discipline is drawing-scoped, machine-proposed, human-confirmed, and **fails closed** — an
unconfirmed drawing is not walked at all.

**Authority splits in two:** quantities are additive → exclusive authority per kind.
Attributes are not → their own authority may name a different sheet (the general-note sheet
supplies fy/cover/mortar while measuring nothing), and disagreement is *declared*, never
silently resolved.

## 3. Key grammars (principles, not literals)

Every derived row key is **content-derived with zero minted ids** — no UUIDs, no DB sequences,
no timestamps — so an identical re-derivation reproduces the identical key multiset:

- **View key** = view class + caption anchor **source key** (`cad-ingestion.md` §2 — a
  `scheme:key` token; an unprefixed one reads as `DXF_HANDLE`) (row ids re-mint on every partition
  rebuild; the key, not the row id, rides in downstream keys).
- **Placement key** = view key + mark + world coordinates **quantized to 0.1 drawing unit**.
- **Instance row key** = placement key + level *surrogate id* (typed so a bare label string
  does not compile), with a lawful-null level slot naming its basis (`FOUNDATION` /
  `UNRESOLVED`). Level-null rows are scoped per view — no silent cross-view union.
- **Bar row key** = member row key + role + diameter + sequence. Absence rows share the
  grammar (`absent|<member>|<role>`) so every (member × role) partition is decidable.
- **The one-hop carry:** authoring a level moves an instance key exactly once,
  `@unregistered:<label>` → `<levelId>`; on rebuild a miss looks one hop back so filed human
  dispositions move with the key. Exactly one hop exists.

## 4. Pairing across revisions (duplicate marks)

Split-section members carry the same mark on several rows. A by-mark map collapses them to an
arbitrary representative — measured in the legacy as an 82.6%-phantom-money class. The law:

- Rows of a mark family sort by a canonical **content signature of authored inputs only**
  (length, breadth, count — fixed-precision strings), then key `mark#i` (1-based); singletons
  keep the bare mark.
- Correctable attributes (height, grade, rebar spec) are **excluded from the signature**.
- Tie-break for identical signatures is the row's own id — the only axis no correction can
  touch — so ordinals freeze at first registration and never move.

## 5. Semantic vs identity — the carry law

Every derived row also carries an order-normalized **semantic** (canonical JSON of its content
*including its cited evidence source keys*). The semantic is the **invalidator, never the key**:
unchanged semantic → human dispositions carry forward across a rebuild; changed semantic → the
row re-presents for disposition. Lineage is inside the semantic deliberately — a row whose
numbers are unchanged but whose cited evidence moved must re-present, or a stale lineage rides
forward invisibly.

## 6. What hangs off a register row

- **Quantity lines** — one per (object × kind × level): SI value (full precision, `numeric`),
  human-auditable formula string + named variables, basis roll-ups, coverage, work-item
  selection **beside** the machine's derivation (`selectionBasis`; a QS pick never erases the
  machine's answer), mapping rule id + **edition** (a rule edit bumps the edition and cannot
  touch a priced line), calibration reference (**NOT NULL**), provenance references.
- **Attributes** — on the register object, referenced never copied, each with basis + role +
  corroboration (`AGREED | CONFLICTED_RESOLVED | UNCORROBORATED`). Project-level facts live in
  a **project attribute table** keyed (project, attribute, key); a drawing is *evidence* for a
  fact, not its home. Transcription takes effect on a **per-sheet human act** (auto-applied
  regex parses of notes are banned — a misparse is a silent swing on every bar). Precedence
  between disagreeing sheets is declared per (attribute, key), an attributed act, both readings
  persisting.
- **Quantity↔bill links** with revision + staleness fields — the detector between an issued
  document and a moved quantity.

## 7. The act log

- **Append-only, human-only.** An act = a human write that changes what the machine would
  derive, **plus** any human act a signature relies on as evidence (the dip sample records *a
  human looked and found nothing wrong*). Machine authorship needs no log — it is basis + rule
  id + pinned rule set, checkable rather than believable.
- Recorded **at the granularity performed** (a confirm-all is one act with N subjects).
- **Act row and state change commit in one transaction or neither**, enforced at the seam.
- An audit trail beside materialised state, **not** an event source — the register is the
  system of record, never a projection.
- **Before-images are rejected.** A human never overwrites a machine value; they add a
  **competing observation** with its own basis and a declared precedence. Agreeing readings
  corroborate (and bump the edition); disagreeing ones **suspend the fact pending
  re-affirmation** — this shape recurs everywhere (attributes, scope rows, note readings).
- **Repudiation — the one disagreement suspension cannot hold.** Confirming machine-vectorized
  geometry (basis `INTERPRETED`) admits two disagreements, not one. *That measurement is wrong*
  is two readings of a number and suspends, above, unchanged. *That is not a column* — it is a
  hatch, a leader, a scanning artefact — denies the object, and suspension parks an **attribute**
  while leaving the register object standing: a suspended phantom still occupies a row, which is
  the pile-cap exemplar (`quantity-contract.md` §4) reproduced, and a phantom is over-measurement
  — a hard block, never a disclosure. A repudiated object therefore moves to the **separate table
  with no join from any bill** that §2 already chose for a second sighting, for the same stated
  reason: a status flag on the register is one forgotten `WHERE` from over-measurement.
  Repudiation is **human-only**, consistent with §2's one-way presence recogniser — it is an act,
  never a recogniser's verdict.
- A deferral carries: actor, timestamp, a **closed cause enum shared with the machine's own
  refusals** (one taxonomy, two originators), a scope reference, and a note that is never
  itself the exclusion.

## 8. Rules and signatures

- Rules a human may author are **data**: versioned, clause-cited, project-scoped by copy-down
  from a tenant template (never nullable fallback — a fallback makes "the rule set in force" a
  query result that widens under a signed bill), **fork never mutate**. Methods stay code,
  enumerated by (rule id, version), with CI asserting the version against a content hash of the
  implementation.
- The signature attaches to the **boundary + rule set in force**, one per bill boundary,
  **voiding whole** (partial invalidation is cancelling-errors at governance altitude). Signing
  is its own permission; credential captured write-once; structured verdict
  (`RELIABLE | RELIABLE_WITH_QUALIFICATIONS | NOT_RELIABLE`) with mandatory prose.
- **A project record** pins config (book edition, rule set, multiplier scheme) as a
  **precondition of campaign creation**; facts (level stack, attributes) stay authorable from
  inside a campaign as *readings*. A campaign = a measurement effort against a pinned drawing
  **set** revision (§9) producing at most one issued bill. One edition, two consequences:
  unsigned → stale (freshness gate); signed → **voids whole**.
- A surface beside the measurement flow may never write a **quantity**; it may write a project
  fact, against the project boundary. Reference surfaces are read-only.

## 9. The drawing-set revision

*Amendment, 2026-08-13.* §8 said a campaign pins "a drawing revision", singular. §2 already
contradicted it — authority splits in two, so a general-note sheet supplies fy/cover while
measuring nothing — and `quantity-contract.md` §8 already voids a signature on "a new revision
of **any cited drawing**", plural. A campaign pins a **set**.

**The manifest.** A drawing-set revision is an immutable, unordered set of
`(drawing, drawing revision)` pairs — surrogate ids on both axes, never a sheet number, title or
issue date (§2: no labels, no mutable attributes). It is **content-addressed**: its key is a
digest over its member pairs in canonical sort order, so an identical pinned set *is* the
identical set revision. §3's zero-minted-ids law extends from derived row keys to this **citation
scope key**, for the same reason it exists there: minted, "did any cited evidence move?" becomes
a diff query instead of a key comparison, and re-pinning an unchanged set would void a signature
that nothing invalidated. The pinning **act** is still an act (§7) with actor, timestamp and
cause — the act is minted, the scope it names is derived.

**The manifest is the citation list.** Every member is cited by the campaign whether or not it
produced a quantity; an attribute-authority sheet cites exactly as hard as a measured one. There
is no second list, so the two cannot diverge, and `quantity-contract.md` §8 reads its cited
drawings off the manifest.

**Mutation: advance, never drift.** Adding, removing or re-revving a member yields a *new* set
revision; an in-flight campaign's pin does not follow it. A campaign advances only by an
**authored re-pin** — one act naming the outgoing and incoming set revision keys and the member
changes between them. Three consequences are stated at the act, before it commits:

- rows whose cited evidence moved re-present (§5);
- an added member widens the scope register's denominator (`quantity-contract.md` §2.2), so a
  line that was `COMPLETE` may become `PARTIAL_DECLARED` — this alone forbids an implicit re-pin;
- a signature on the outgoing set **voids whole** (§8). A re-pin under a signature is permitted
  and voids it: never silently blocked, never silently applied.

A campaign never **forks** across set revisions. Two campaigns over one project scope reopen the
double-count door §2 closes at the register, and two lineages would both claim first
registration for one ordinal. A superseded pin is history, like a superseded placement.

**The pairing domain is the set revision, not the drawing.** Pairing (§4) runs over
`(prior set revision's live sightings) × (new set revision's sightings)` per mark family. The
identity key carries no drawing (§2: `drawingId` is provenance), so a member **re-sheeted**
between revisions keeps its identity and its ordinal, and re-presents for disposition because its
cited evidence source keys moved (§5). Treating a re-sheet as removal-plus-registration is a
defect: it retires an ordinal for no physical reason. Precedence stays drawing-local first — exact placement
key, then nearest unclaimed prior of the same view within the carry bound — and only then the
same family sighted from *another* drawing of the prior set, so a re-sheet can never take a prior
that a sibling still stands on. The double-count guard is untouched: it acts **within** one set
revision, where a second sighting of the same scope still refuses at the door as
`DUPLICATE_IDENTITY`.

**Partial re-issue re-presents nothing by itself.** Re-issue only the plumbing sheets and the
structural rows' cited evidence has not moved: semantics unchanged, filed dispositions carry, no
re-presentation (§5). Row-level re-presentation is governed by the **semantic**; boundary-level
validity by the **manifest**. The two are independent, and both are honest: a bill signed over
the old set is void because its citation scope changed, while structural scope already disposed
is not made to be disposed twice.
