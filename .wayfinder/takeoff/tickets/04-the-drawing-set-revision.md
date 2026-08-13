# The drawing-set revision — what a campaign pins

wayfinder:grilling
Status: closed
Blocked by:
Claimed by:

## Objective

`identity.md` §8 says a campaign is a measurement effort against **"a pinned drawing revision"**
— singular. A real takeoff reads a general-note sheet, a column schedule, several floor plans
and a foundation plan, and §2 *requires* that: authority splits in two, so attributes may come
from a sheet that measures nothing. Meanwhile `quantity-contract.md` §8 already voids a
signature on "a new revision of **any cited drawing**" — plural, and already assumed. The
singular is an under-specification. Charting ruled it becomes an **immutable drawing-set
revision**; this ticket rules the mechanism and writes the amendment.

## The decision

1. **The manifest.** A set revision is an immutable list of `(drawing → revision)` pairs. Is it
   content-addressed (a hash of the pairs, so an identical set is the same revision) or minted?
   `identity.md` §3's zero-minted-ids law governs derived *row keys* — does a set revision count?
2. **Mutation.** Adding, removing or re-revving a member creates a *new* set revision. What
   happens to an in-flight campaign — does it move, fork, or refuse?
3. **The delta.** `takeoff-core` ticket 08 computes a delta drawing-to-drawing and pairs on
   sighting rows scoped per drawing. Set-to-set changes the pairing domain: a member that moved
   *between sheets* between revisions is currently a removal plus a registration. Is that
   correct (honest) or a defect (an ordinal lost for no physical reason)?
4. **Partial re-issue.** Only the plumbing sheets are re-issued. Does the structural scope
   re-present at all? `identity.md` §5's semantic carry says a row re-presents when its cited
   evidence moves — which it did not. State the rule.

## Guardrails

- No coordinates, labels or mutable attributes in any identity key (`identity.md` §2). A set
  revision is provenance and scope, never part of the element identity key.
- The manifest **is** the citation list `quantity-contract.md` §8 needs; if the two can diverge,
  the design is wrong.
- This is a named extension of closed `takeoff-core` work, which pinned single revisions. Say in
  the resolution what it changes there.

## Blocks

Ticket 21 (the run graph) and the MEP-authority fog both wait on this.

## Resolution

Ruled 2026-08-13. The amendment is `identity.md` §9 (new), with §8's "a pinned drawing revision"
corrected to "a pinned drawing **set** revision" and one clause added to `quantity-contract.md`
§8 naming the manifest as its citation list.

**Assumption named (this ticket is `wayfinder:grilling`, and no human was present).** It was
worked as an AFK session under `CLAUDE.md` §5: the most defensible reading was taken, and it is
defensible because all four sub-decisions were forced by clauses already in force rather than by
preference — each ruling below names the clause that left no second option. The one place a live
human could still move the answer is the re-pin-under-signature door (see "put and rejected").

1. **The manifest is content-addressed.** Key = digest over `(drawing, drawing revision)`
   surrogate-id pairs in canonical sort order; identical set ⇒ identical set revision. §3's
   zero-minted-ids law extends from derived row keys to citation scope keys. *What forced it:*
   the guardrail that the manifest **is** `quantity-contract.md` §8's citation list. Minted, "did
   any cited evidence move?" is a diff query rather than a key comparison, and re-pinning an
   unchanged set voids a signature that nothing invalidated — the two lists diverge, which the
   guardrail declares wrong by construction. The pinning *act* is still minted (§7); the act is
   minted, the scope it names is derived.

2. **Mutation: advance, never drift.** A new set revision never moves an in-flight campaign's
   pin. The campaign advances by an **authored re-pin** act naming outgoing key, incoming key and
   member changes, with three consequences stated before commit: rows whose evidence moved
   re-present (§5); an added member widens the scope register's denominator
   (`quantity-contract.md` §2.2), so a `COMPLETE` line may become `PARTIAL_DECLARED`; a signature
   on the outgoing set voids whole. *What forced the choice against **fork*** — the option a
   version-control instinct reaches for first — is `identity.md` §2: two campaigns over one
   project scope reopen the double-count door, and two lineages both claim first registration for
   one ordinal. Fork buys branching and pays with the invariant. *Against **refuse*** (freeze the
   campaign until a new one is opened): a re-issue mid-takeoff is the normal case in Bangladesh,
   and a rule that forces a new campaign per re-issue makes the delta — the moat — unreachable in
   exactly the situation it exists for.

3. **The pairing domain lifts from the drawing to the set revision.** A member re-sheeted between
   revisions keeps its identity and its ordinal and re-presents for disposition; removal-plus-
   registration is a **defect**. *What forced it:* §2 says `drawingId` is provenance, never key —
   an ordinal that dies because a sheet was renumbered is an identity key that absorbed
   provenance. Precedence stays drawing-local first (exact placement key → nearest unclaimed
   prior of the same view within the carry bound) and only then same-family-from-another-drawing,
   so a re-sheet cannot take a prior a sibling still stands on. The double-count guard is
   untouched because it acts *within* a revision: a second sighting of one scope still refuses at
   the door as `DUPLICATE_IDENTITY`.

4. **Partial re-issue re-presents nothing by itself.** Plumbing-only re-issue leaves structural
   rows' cited evidence unmoved ⇒ semantics unchanged ⇒ dispositions carry, no re-presentation
   (§5). The apparent conflict with §8's void rule dissolves because the two run on different
   levels: **the semantic governs row-level re-presentation, the manifest governs boundary-level
   validity.** A signature over the old set is void (its citation scope changed) while already
   disposed structural scope is not disposed twice.

**The alternative put and rejected, on the door a human could still move:** make a re-pin under a
signature *refuse* rather than void — the bill is a signed document and quietly invalidating it
feels worse than blocking. Rejected because §8 already rules the signature "voids whole" on a new
revision of a cited drawing; a refusal would make the void unreachable while the drawings on the
QS's desk have already changed, which is the silence the governing sentence condemns. The void is
loud and named at the act; it is not silent.

**What this changes in closed `takeoff-core`.** Nothing landed becomes wrong; two things extend.
(a) `src/core/pairing.ts`'s `pairRevision` pairs against priors of *this drawing* — its prior set
gains a fourth precedence tier (same family, another drawing of the prior set revision) below the
existing three. (b) `db/schema/core.ts` has `drawings` → `drawing_revisions` (per-drawing `seq`)
but no set: a `drawing_set_revisions` table plus its membership table is a new migration, keyed
by the content digest, with the campaign's pin FK'd to it. `register_object_sightings` keeps its
`(project, drawing, ingest, placement)` unique — a sighting stays drawing-scoped evidence; only
*pairing* is set-scoped. No landed migration is edited (ADR-0002/`CLAUDE.md`).

**Graduated fog:** none yet. MEP discipline authority still waits on ticket 21, which this
unblocks.
