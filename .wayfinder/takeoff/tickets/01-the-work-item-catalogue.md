# The work-item catalogue — the coverage denominator without a book

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

The destination terminates in a Certificate of Measured Coverage. `quantity-contract.md` §6
says that certificate **is** a query over **book × scope register**, and §2 says the book is the
enumeration an absence is declared against. But `book/` is out of scope. Charting split the
book's two jobs: the **enumeration** (what work items exist) is spine-owned; the **pricing**
stays in `book/`. This ticket rules what the spine-owned enumeration actually *is*.

## The decision

1. **Shape.** A work item is at minimum `(kind, description, unit)`. `measurement-rules.md` §4
   forbids a null kind "ever" and requires `RATE_MODIFIER` as a first-class class — but
   `RATE_MODIFIER` is a *pricing* concept. Does the rate-less catalogue carry it, or is the
   modifier/base distinction pricing-only and therefore out?
2. **Home and seeding.** Genesis §4 puts the closed quantity-kind enum in `src/core/`. The
   catalogue is data, not enum. Is it a spine table seeded per tenant by copy-down (the
   `identity.md` §8 pattern for rules — *fork never mutate*, never nullable fallback), or a
   platform-owned table with attributed override (the §4 pattern for kind on book items)?
3. **The denominator problem.** A certificate says "of the items this catalogue enumerates, I
   measured these and not those." With no rate book, what populates the catalogue for a given
   project — every item in it, or a project-scoped selection? An over-broad catalogue makes
   every project look 5% covered; an under-broad one hides absence, which is the money.
4. **Forward compatibility.** When `book/` lands, a priced book item must *join* to a catalogue
   row without a migration that re-keys either. State the join key now.

## Guardrails

- `measurement-rules.md` §4 binds: kind is `(chapter × dimension) named for the trade`;
  dimension-named kinds are illegal; CI asserts totality both ways.
- `bd-authority.md` §1: the item **description is the method of measurement** in Bangladesh.
  A description is therefore load-bearing data, not a label.
- `quantity-contract.md` §2's cause taxonomy already exists in `enums.ts` (`refusalCauses`) —
  reuse it; a new enum value is a migration and needs a reason.
- No rates, no zones, no editions, no effective dates. The moment one appears, this has become
  `book/` and the split has failed.

## Blocks

Ticket 13 (the rail gate) and 16 (the bill and certificate) both need this ruled.
