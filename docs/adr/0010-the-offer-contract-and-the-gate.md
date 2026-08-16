# ADR-0010 — The offer contract: a rail proposes typed inputs, the gate resolves a pinned method and writes

**Date:** 2026-08-17 · **Status:** accepted · **Supersedes:** nothing. **Refines** ADR-0005, which
is not edited. Resolves decision ticket #135 on the takeoff map #128.

## Context

`measurement-rules.md` §8 rules the gate's shape in prose: a rail is a pure function returning
**offers**, the gate is the spine's **sole writer** of quantity lines, the rail owns **geometry**
and the spine owns **arithmetic**, and *done is the gate's return type*. It does not say what an
offer is in code — and every guarantee in that clause is a guarantee about a **type**. A rail that
can express a computed value has authored done no matter what the prose says.

Three clauses constrain the answer at once and are not independently satisfiable by convention:

- **`quantity-contract.md` §1** carries basis **per attribute** with a **role** (quantity-determining,
  item-selecting, or both) "declared once per algebra, never per row", and derives `quantityBasis`
  and `selectionBasis` weakest-wins over disjoint sets — neither stored.
- **`measurement-rules.md` §1** makes choosing a formula a **method**: "never configurable, typed as
  literals, enumerated by rule id + version, CI asserting a content hash of the implementation",
  against **parameters** which are per-project data pinned by a rule-set edition.
- **`identity.md` §6** requires a **human-auditable formula string + named variables** and a
  calibration reference that is **per measured attribute**, `NOT NULL` reading as non-empty set.

`SEED_METHODS` in `src/core/rule-set.ts` is deliberately empty — "a method enters this list the day
its implementation lands, with that hash, and not before". This ADR is what lets the first one land.
No gate or rail code exists: `src/modules/takeoff/` is `ingest.ts` and nothing else.

## Decision

### The offer carries inputs; the expression travels by reference

An offer names a **rule id and no version**. The gate resolves the version from the project's
pinned rule-set edition, refusing `METHOD_NOT_IN_EDITION` when the edition does not name it and
`METHOD_IMPLEMENTATION_MISSING` when the edition names a version the code registry lacks.

A transported expression — an AST the rail builds and the gate walks — is rejected. It cannot be
content-hashed per rule id, which is precisely what §1 demands of a method, and it lets a rail
author `count × L × B` where the method says `count × L × B × H` while remaining well-typed. A
rail naming its own *version* is rejected for a narrower reason: two rails could then price one
campaign under two versions of one method, and the edition key would certify that as one rule set.

The registry resolves `(rule id, version)` to an evaluator, its **formula template**, its declared
**variable names**, the **geometry variants** it accepts, and the **parameter keys** governing its
candidate channels. The gate evaluates in `Decimal` and **renders** §6's formula string from that
same template, so the printed string and the arithmetic cannot disagree.

### The offer's shape, and what it cannot express

- **Geometry is its own field**, holding `formulas.md` §1's discriminated union, with its own basis
  and calibration reference. It is not dissolved into scalars: §1's roll-up ranges over "determining
  attributes **and the geometry**", `formulas.md` §1's refusals are shape judgements (a stored plan
  area disagreeing with its own shoelace by >0.5%), and a method that declares which variants it
  accepts turns a slab-soffit method pointed at a frustum into a typed refusal rather than a
  plausible wrong number.
- **Two attribute channels, not one.** `bindings` are the method's declared variables;
  `selectors` are item-selecting attributes; an attribute whose role is *both* appears in each. The
  channels are consumed by different machinery — evaluator and catalogue selection — and they make
  §1's two roll-ups mechanical: `quantityBasis` is weakest over bindings plus geometry,
  `selectionBasis` weakest over selectors. The per-algebra role declaration becomes a **CI-checked
  assertion** that every declared attribute appears in the channel(s) its role names, so an
  attribute silently dropped from selection is a build failure rather than a right number at the
  wrong rate.
- **Every bound value carries `{ value, unit, basis, source }` and, where measured, a calibration
  reference** — never a bare number. Per-attribute basis and per-attribute calibration are §1's and
  §6's requirements read literally.
- **There is no field where a computed value could land.** No `value`, no `quantityBasis`, no
  `selectionBasis`, no line. A rail measures; it cannot combine.

### Units normalise at the gate

A binding carries its raw reading **and its unit**; the gate normalises in decimal and refuses
`UNIT_UNMAPPED`. Conversion is arithmetic, which §8 gives the spine, and CLAUDE.md makes an unmapped
unit a named refusal — which requires the unit to *reach* the refusing party. A rail converting
privately produces a number that arrives already plausible, so a wrong factor is invisible. The
line's variables print the raw reading and its unit beside the SI value.

### Deduction candidates are governed by the method, never the rail

A rail supplies **candidates** per channel — geometry, basis, source entity — and no sums. The
**method declaration** names the rule-set parameter governing each channel; the gate reads that
parameter from the pinned edition, partitions on **strictly greater**, and computes the deducted
sum, the ignored sum, both counts and the threshold in force into the line's variables. This is
what makes `measurement-rules.md` §2 enforced rather than decorative: were the rail to name the
threshold, it could route an opening at the duct threshold and deduct what the law retains. The
channel is generic — §3's dissimilar member ends and embedded ducts use the same machinery
unchanged.

### Refusal and non-offer are different acts, and a rail can only perform one

- **A rail contributes a candidate absence by not offering.** Its return type is
  `{ offers, observations }`; an observation carries a **rail-local closed enum** code, keyed by
  `(element class × quantity kind)` with an optional register-object reference and its source
  entity. Rail-local because `quantity-contract.md` §2.2 requires the rail's *own vocabulary* while
  CLAUDE.md requires a closed enum — a rail-local enum is both, and can never be coerced into a
  cause, whose taxonomy carries originator legality. `(class × kind)` because that is §2.2's residue
  grain and §8's dip-sample draw unit; an observation keyed only by an object cannot be joined to
  the cell whose absence it explains, and a rail that sighted a class with no measurable instance
  has no object to point at.
- **There is no `absent()` constructor anywhere.** Empty `offers` says nothing rather than denying
  something — §2.2's one-way valve as a property of the output type.
- **Malformed geometry is a non-offer, not a gate refusal.** It is a geometry judgement, which §8
  gives the rail, and it must reach the residue as evidence so the certificate declares the
  unmeasured scope. The gate's `refused` arm is for **contract** violations only: unknown method,
  method not in edition, missing implementation, missing or unknown binding, unmapped unit,
  non-finite decimal. A rail that cannot measure must not be able to launder that into a refusal the
  gate owns.

### Done is a total verdict, written in one transaction

The gate returns `{ published, refused, queued }`, **total over the offers handed in** — the three
arms sum to the input, and CI asserts it. Refusals are not thrown: a caught exception silently
shortens a bill, and *a partial faulty estimate is more harmful than no estimate*. Lines and
observation rows commit in **one transaction**, and the verdict returns after commit — a crash
between them would publish lines whose absences say nothing.

The gate writes an observation row carrying rail id, code, `(class × kind)` and source entity, and
**nothing about disposition, review state or assignment**. The review queue's shape is an open
question on the map and this ruling does not pre-empt it.

### The method content hash is over the implementation file

One method per file under a fixed directory, hashed whole, the manifest committed beside
`src/core/rule-set.ts`, and a `pnpm verify` stage refusing drift. Changing a method's arithmetic
without bumping its version is a red build; the bump moves the edition key, which is the governed
event `identity.md` §8 describes.

Hashing the function source via `Function.prototype.toString` is rejected: it hashes post-transform
source, so a bundler upgrade would void every method with no rule change. Hashing only the
registry's *declaration* — template, variable names, geometry variants, parameter keys — is rejected
for the opposite and worse reason: it fixes the interface while leaving the arithmetic free to
change underneath a stable version, which is the laundering §1's hash exists to stop. Accepted cost:
a comment edit in a method file forces a version bump.

### The gate lives in `src/core/`; the boundary test fails closed

`src/__tests__/boundaries.spec.ts` already proves core may not import a module, so a gate in
`src/core/` **structurally cannot** depend on a rail — a gate in `src/modules/takeoff/` would sit in
the same module as the rails it polices. Rails implement a core-declared interface and are passed
in; a takeoff-side orchestrator composes them and calls the gate.

The boundary test gains a case asserting the **quantity-line writer is unimportable from
`src/modules/**`**: the offer type, the rail interface and the observation type are importable, the
write path is not, failing closed the way the driver and SDK cases already do.

## Alternatives rejected, by name

- **A typed AST the gate walks.** Reads §8's "the offer carries the inputs and the expression
  combining them" literally, and defeats §1's hash: an expression the rail authors is a method the
  rail authors. §8's sentence is amended rather than obeyed.
- **A named formula whose version the rail supplies.** One campaign, two versions of one method, one
  edition key certifying both.
- **One flat attribute set partitioned by a role table at the gate.** The role table then routes
  rather than checks, so an attribute missing from the table is silently absent from
  `selectionBasis` — a right number at the wrong rate, §1's named 20.2× class.
- **SI-only bindings, the rail converting.** Puts unaudited arithmetic in the geometry owner and
  makes `UNIT_UNMAPPED` unreachable.
- **A rail-supplied partition of deductions, gate-rechecked.** The gate's check becomes a second
  opinion on the rail's own answer; §2's threshold is decorative by construction.
- **The gate returning a write plan for a caller to commit.** "The spine's sole writer" with extra
  steps — a rail's write path wearing a caller's name.
- **One shared observation enum across all rails.** Re-centralises the vocabulary §2.2 deliberately
  left rail-local, and drifts toward being a cause taxonomy under a different name.
- **The gate in `src/modules/takeoff/`.** Places the writer inside the module whose rails it must
  refuse, and makes the boundary a convention rather than a lint error.

## Consequences

- **`SEED_METHODS` stops being empty.** The first method — RCC rect-prism column concrete — lands
  with this contract, with its file hash, moving the seed's key.
- **Adding a method is a governed event, not a code edit.** Implementation, hash, edition entry and
  key move together, and a project measures under a method only after its edition names it.
- **A rail cannot report absence, only fail to report presence.** The residue query stays the sole
  author of causes, and rail evidence rides it.
- **The certificate's arithmetic has one source.** The printed formula string and the evaluated
  number come from the same registry template.
- **What is given up:** a rail may never express a quantity the method registry has no formula for.
  A new shape is a new method — code, hashed, versioned, adopted by an edition — never a rail's
  arithmetic. That is the point.
- *Assumption named:* the offer's **level** field is left shaped but unruled — where level expansion
  for vertical classes happens is decision ticket #134, still open on the map, and this ruling does
  not pre-empt it.
