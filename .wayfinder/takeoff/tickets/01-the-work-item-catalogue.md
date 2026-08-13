# The work-item catalogue — the coverage denominator without a book

wayfinder:grilling
Status: closed
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

## Resolution

**The spine-owned enumeration is a platform-owned, code-derived table at *quantity-kind* grain
— `work_item_catalogue`, primary-keyed on the kind value itself — and the certificate is a
query over `catalogue × scope register` where scope rows are keyed `(element class × kind)`.**

### 1. Grain — kind, not SoR item

A row is one quantity kind (`measurement-rules.md` §4's `chapter × dimension, named for the
trade`) carrying description, unit, and bn name. Dozens of rows, not thousands. Many book items
later join *up* to one catalogue row.

**The measurement that forced it:** the ticket's own guardrail bans editions and effective
dates, and at SoR-item grain that guardrail is incoherent rather than merely restrictive.
`bd-authority.md` §4 establishes that item descriptions are edition-scoped ("SoR 2022" denotes
three distinct rate sets, descriptions carrying measurement conventions inline) and §1 makes
the description *the method of measurement*. An edition-free SoR-grain description is a
description that does not know which method it states. Kind grain is the only grain at which a
description is edition-independent, because the kind enum is code-owned and closed. Secondary:
§4 already names this join axis — *match on trade first (kind → chapter)* — so the catalogue
sits on the axis the matcher uses rather than building a parallel one.

**Rejected:** SoR-item grain (the de-priced book). It reconstructs `book/` inside the spine,
requires editions to be coherent, and makes the certificate unreadable — see §3 below, where
kind grain is what makes a full-catalogue denominator affordable.

### 2. `RATE_MODIFIER` — pricing-only; not in the catalogue, and not a kind

The kind enum stays trade-pure. An added-rate item carries **its base's kind** plus an
`isRateModifier` role column in `book/`; the certificate query filters on that column.

**The measurement that forced it:** `measurement-rules.md` §4 refutes the alternative with its
own definition. `kind = (chapter × dimension), named for the trade`, and `AREA`/`LENGTH`/
`COUNT` are banned because *"a kind that names a dimension instead of a trade is the defect
class that produced a measured 20.2× overcharge."* `RATE_MODIFIER` names neither chapter, nor
dimension, nor trade — it names a **pricing role**. Admitting it as a kind value is that same
category error one step further out. §4's stated purpose for the class survives intact: the
failure it guards against (an added-floor item tagged as RCC-volume, entering the denominator,
demanding a quantity nobody can measure) is still prevented — the class simply sits on the
pricing side of the seam, where §6 already puts its subject matter (*"one excavation object
with a depth and a lead; the pricing seam emits base + banded add-items, all inheriting"*).
Under `identity.md` §1, a thing that **inherits** rather than **originates** a quantity has no
claim on the register's denominator.

**Rejected:** (a) a `RATE_MODIFIER` catalogue row — it puts a permanently unmeasurable row in
the coverage denominator, so every certificate carries either a standing absence or a standing
silent exclusion, and §2 makes absence the money. (b) `RATE_MODIFIER` as a kind enum value with
no catalogue row — the category error above, plus it breaks §4's two-way totality assert by
construction.

**Amends `measurement-rules.md` §4** (this ticket is a named amendment vehicle — MAP Notes).

### 3. The denominator — the whole catalogue, every project, narrowed only by act

No project-scoped selection table, no fourth project pin. Every catalogue row is in the
denominator of every project, in one of three states: measured (has lines), declared out of
scope (**human act**, `NOT_IN_PROJECT_SCOPE`), or `NOT_ESTABLISHED` (machine default, the loud
state). A project with no piling reads "piling — `NOT_ESTABLISHED`" until a QS puts their name
on the exclusion.

**The measurement that forced it:** the ticket poses a dilemma — over-broad makes every project
look 5% covered; under-broad hides absence. The first horn is already dead by law.
`quantity-contract.md` §6: *"No coverage percentage prints on the certificate (by count
meaningless, by value it would originate quantities outside the register)."* There is no ratio
for an over-broad denominator to distort. Over-breadth therefore costs **reading length**;
under-breadth costs the thing the module exists to catch. Against the governing sentence that
is not close — and kind grain (§1) is what makes it affordable: dozens of readable rows where
SoR grain would have been thousands.

Narrowing is an **attributed act, never a pin**: `refusalCauses` already makes
`NOT_IN_PROJECT_SCOPE` human-only on the grounds that *"a machine can rarely establish
absence"*; a pin that filters the denominator is a silent exclusion with no actor, which is
`identity.md` §8's condemned shape pointed the other way (*"a fallback makes 'the rule set in
force' a query result that widens under a signed bill"*); and `quantity-contract.md` §8's
absence census (*"name the evidence or lose the cause"*) has nothing to census if the
exclusions were machine-authored.

**Rejected:** a project-scoped catalogue selection, for the reasons above.

### 4. Home — platform-owned, code-derived, no tenant fork

`work_item_catalogue` is the codebase's **first platform-owned table** (verified: every table in
`db/schema/core.ts` is tenant-scoped, and `db/rls.ts` emits only the tenant-isolation shape).
It is seeded by migration from the closed kind enum, with §4's totality assert holding both
ways in CI. No per-tenant copy-down, and **no attributed-override slot in this map**.

**The measurements that forced it:**

- `identity.md` §8's copy-down pattern does not apply — **its precondition is absent.** §8
  governs *"rules a human may author"*. Catalogue rows are the closed, code-owned kind enum.
- **The join forces it.** PWD/LGED SoRs are national; a book item has no tenant. A tenant-forked
  catalogue makes the join key carry a `tenant_id` the book side cannot supply.
- **Widening under signature is answered without an edition.** Code-derived content can only
  widen by migration + deploy behind CI's totality assert, never by data drift; and §7 already
  handles the artifact — the certificate is computed at publish and bound into one
  server-generated PDF, so a later-added kind **supersedes** the bill rather than silently
  invalidating it.
- **The description settles it.** A catalogue row's description states the method of *the
  measurement we performed* ("RCC in columns, gross section, no deduction for reinforcement;
  formwork and rebar measured separately"). `measurement-rules.md` §1: methods are *"never
  configurable, typed as literals"*. A tenant-editable method statement is a configurable
  method. What is code cannot be tenant-forked data.

This dissolves the ticket's guardrail tension with `bd-authority.md` §1. **There are two
descriptions, not one:** the catalogue's states what we measured (edition-free, ours, code); the
book item's states what the contract pays for (edition-scoped, PWD's, `book/`). Both are
load-bearing methods of measurement; neither is a label. The join is where they are compared —
*did we measure what this item pays for?* — a check the split creates rather than loses.

**Cost accepted:** `db/rls.ts` grows a second emission shape (read-only to `vextrus_app`, no
tenant policy), which becomes the pattern `book/` inherits.

**Rejected:** per-tenant copy-down (`identity.md` §8 pattern) — precondition absent, and it
breaks the join.

### 5. The join key — `kind`, natural, no surrogate

`book_items.kind → work_item_catalogue.kind`. The catalogue's PK **is** the kind value.

- `book/` items carry `kind NOT NULL` — which §4 rules independently (*"the rate book carries
  the same kind as a platform-owned column"*) — plus `isRateModifier` from §2 above. The column
  §4 already mandates becomes the FK unchanged: **no migration re-keys either side.**
- **The dimension lock is the catalogue's `unit` column.** §4: *"match on trade first; the
  dimension lock has the final veto; never on dimension alone."* Trade-first is the join; the
  veto is a compatibility check against a column that already exists the day `book/` lands.
- Natural key over surrogate, per `identity.md` §3 (*"content-derived with zero minted ids"*): a
  surrogate on a code-derived table re-mints on reseed and drags every book FK with it. Kind is
  already stored as text across the register (`quantity_lines.kind`), so this adds no new class
  of value.

### 6. The condition that makes kind grain safe — scope rows key `(class × kind)`

**Ruled here because §1 is unsafe without it.** `bd-authority.md` §4: *"Formwork: sqm of contact
area, priced by structural member (12 sub-items by member type)... A single 'formwork m²' total
is not a PWD-billable quantity."* At kind grain, formwork-contact-area is one row — so "formwork
to columns measured, formwork to beams not" would sit inside a row reading *measured*. That is
absence hiding, which is the money.

`quantity-contract.md` §2's scope register (*"every element class present in a drawing that
produced no line"*) read at **element-class** grain goes silent here: the beam produced *a* line
(concrete), so it is not absent. Read at **`(class × kind)`**, the beam against
formwork-contact-area produced no line and surfaces as `NOT_ESTABLISHED`.

Two corroborations that this is the intended grain, not an invention: §8 already sets the dip
sample's draw unit at **`(register object × quantity kind)`**, reasoning that *"systematic errors
are present in every member of their class"* — a missing formwork rule is exactly such an error,
and boundary and sampling instruments agreeing on grain is the expected state. And §7 requires
the coverage gate be *"enumerated, in full"*, which `(class × kind)` is from ingestion and a
per-member-type catalogue would not be.

**The certificate's two sources, with a clean division of labour:** the **catalogue** enumerates
what work exists in the world and catches the **missing sheet** (nothing ingested, so ingestion
has nothing to report); the **`(class × kind)` scope rows** catch the **missing rule** (sheet
ingested, object registered, one kind never fired against it). Per-line `coverage` (§2.1) is the
third, innermost instrument — it lives on the bill face, not the certificate.

**Concession stated plainly:** the catalogue cannot itself answer *"was formwork measured to
PWD's 12 sub-items?"* Nothing edition-free can; the honest home for that question is the book
join in §5.

**Amends `quantity-contract.md` §2 and §6** — `book` → work-item catalogue as the enumeration,
and the scope-row grain.

### Consequences for other tickets

- **13 (the rail gate)** — a rail's definition of done is now checkable against `(class × kind)`
  scope rows; a rail that registers an object and fires no kind against it is visibly incomplete
  without the rail declaring anything.
- **16 (the bill and certificate)** — the certificate query is `catalogue × scope register`, two
  sources, no percentage, no prose.
- **`db/rls.ts`** — needs its second (platform-owned, read-only) emission shape before the
  catalogue migration lands.
