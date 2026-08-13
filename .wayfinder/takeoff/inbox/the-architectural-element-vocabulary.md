# The architectural element vocabulary — what the architectural set registers

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

MAP's *Not yet specified* held this as fog that would *"graduate once ticket 13 rules what a rail
owes the spine"*. 13 has ruled, and it settled the half that made the question unaskable: a brick
wall is **one register object bearing two kinds** — member volume and face area — because two
objects are two sightings of one physical scope, which the door refuses as `DUPLICATE_IDENTITY`
(`identity.md` §2). The remaining half is now sharp.

`src/core/enums.ts` carries nine **structural** `elementTypes`. The architectural set registers
objects the structural set never sights, and 13's `bears` relation is keyed
`(element class × kind)` — so the vocabulary is now the input to rail selection, not a labelling
convenience.

## The decision

1. **Which classes.** What does the architectural set register — wall, space/room, opening,
   floor finish, ceiling, roof? A class earns its place by bearing a kind under `bears`; a class
   that bears none is a sighting with no measurement path.
2. **The face's subject.** `measurement-rules.md` §8's face algebra measures *a face of a space*.
   Is the register object the **space** (faces derived from it) or the **wall** (a face per
   side)? The identity key `(project, discipline, level, element type, mark, ordinal)` needs a
   **mark** for whichever it is, and a space's mark is a room number that a revision may renumber
   — `identity.md` §2 bans mutable attributes from the key, so this is a real constraint and not
   a naming preference.
3. **Where the two algebras meet on one object.** A wall's member volume and its two face areas
   are three lines on one object. `identity.md` §6 keys lines `(object × kind × level)`, which
   admits one face-area line per wall, not two. Either the faces are separate objects (and the
   door's duplicate guard must be shown not to fire), or the kind axis splits, or the line's
   subject is finer than the object.

## Guardrails

- **No coordinates, no labels, no correctable attributes in the identity key** (`identity.md`
  §2), and the ordinal freezes at first registration.
- 13's `bears` relation is **code-owned** — this vocabulary is a code change under a CI totality
  assert, never per-tenant data.
- A class added here widens the scope register's denominator (`quantity-contract.md` §2.2): every
  new class is a new set of `NOT_ESTABLISHED` cells until a rail fires. That is the intended
  cost, not a reason to be sparing.

## Blocks

The face rail's slice, which is what proves 13's gate lifted.
