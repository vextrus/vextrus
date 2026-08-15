# The architectural rail's element vocabulary

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

Graduated from MAP fog by ticket 13, which ruled that the kind axis rides a code-owned
**`bears`** relation on `(element class × kind)` and that kind→discipline and kind→algebra are two
independent total maps. That makes the question sharp: `bears` cannot be written without knowing
which element classes the architectural set registers, and `enums.ts` carries **nine structural
classes only** (`src/core/enums.ts:23`).

The fog said *"whether a wall is one object bearing both kinds or two, is not yet a sharp
question."* It is now, because 13 answered the half that was blocking it: a class **bears** many
kinds, and object→kind is explicitly not 1:1 (assertion 5 of 13's synthetic face rail). So the
wall is one object — but that is 13's ruling on the *mechanism*, not a ruling on this vocabulary,
and the classes themselves are still unnamed.

## The decision

1. **Which element classes the architectural set registers.** `elementTypes` is nine structural
   values and adding to it is an ADR-0002 migration. Name the architectural classes, on the same
   grounds `tie_grade_beam` was ruled one class with two drawing names — two enum values let one
   physical member register twice and defeat the double-count guard.
2. **What a wall bears.** 13's example is one architectural sheet originating brick volume
   (member algebra) and finish area (face algebra). Confirm the `bears` rows and check the
   identity key still holds: the class is in the key, the kind is not.
3. **Whether a *space* is a register object.** `measurement-rules.md` §8 defines the face algebra
   as *"a face of a space"*, and 13's assertion 2 says the offer's subject need not be a single
   object. If a space is a subject, it needs identity under `identity.md` — and its ordinal must
   be stable across revisions like every other.
4. **Openings.** The opening schedule is the authority and *"a face with no schedule is not
   measured at all"* (§2). Whether an opening is a register object in its own right, or an
   attribute of the face it deducts from, decides where the deducted/ignored sums in 13's
   variables block get their provenance references.

## Guardrails

- **13's rulings bind and are not re-opened**: the rail returns offers, the gate is the sole
  writer, `bears` is code-owned and identical for every project, and nothing mutable enters the
  identity key (`identity.md` §2).
- The face rail's slice is what **proves** 13's lift. If this vocabulary forces the gate to
  change, that is 13's acceptance test failing — record it as such rather than quietly patching
  the gate.
- `measurement-rules.md` §3's defer-never-bounding-box law is absolute: a surface that is not a
  closed outline defers with a reason.
