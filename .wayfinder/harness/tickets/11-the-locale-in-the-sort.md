# The locale in the sort — JS ordering that an env var can move

wayfinder:grilling
Status: closed
Claimed by:
Blocked by:

## Objective

Thirteen sites sort with `String.prototype.localeCompare` and no explicit locale. Node resolves
that against the runtime's default locale, which comes from the environment. Decide what the
comparison for machine-canonical strings must be, and what stops the next one being written the
old way.

## What forced it

Ticket 05 pinned the *database's* collation to `C.UTF-8` on both Postgres paths, and found in
passing that the register never sorts text in SQL — it sorts in JavaScript. So the parity hazard
that ticket closed at the database layer is still open one layer above it, and unlike the
database one it is **not inert**: it sits on the frozen-ordinal path itself.

**Measured on this machine, 2026-08-12** — the same array, same Node, one environment variable
apart:

```
default             : B1 BA BÄ BZ C-1 C.10 c1 C1
LANG=sv_SE.UTF-8    : B1 BA BZ BÄ C-1 C.10 c1 C1
```

`BÄ` moves. Under `identity.md` §4 a mark family's members sort by content signature and the
ordinal is that 1-based index, **frozen at first registration** — so two machines differing only
in `LANG` can freeze different ordinals for the same drawing. That is an identity-key defect
reachable from a shell profile, and the architectural invariant says identity must be stable.

Byte order, for contrast, is a different order entirely, not a perturbation of the same one:

```
localeCompare : C 1 C_1 C-1 C.10 c1 C1 Cb CB
code unit     : C 1 C-1 C.10 C1 CB C_1 Cb
```

## The sites

`src/core/pairing.ts` — the load-bearing ones:

- **:133** inside `canonical()`, sorting object keys for the canonical JSON the **signature
  itself** is built from. Locale changes the key order, which changes the serialised string,
  which changes the signature — the value every other sort is keyed on.
- **:119–120** `sortByContent` — signature, tie-broken by placement key. **This is where the
  ordinal is derived.**
- **:111, :381–382, :436–437** output and pairing order.

`src/modules/takeoff/` — upstream of the keys the above compare: `placement.ts:592–593`
(`placementKey`, `handle`), `views.ts:371, 456, 488`, `grid.ts:204`.

Whether the upstream ones matter is part of the question: some feed a set that is later re-sorted,
some may decide a `viewKey` or a first-member spelling that reaches identity.

## The question

- **What replaces it for canonical strings.** `<`/`>` on code units, `Intl.Collator` with an
  explicit locale, or a named `compareCanonical()` helper the whole tree uses. Recommendation to
  argue with: a **single exported comparator** — one site to reason about, one site to test, and
  a name that says *this is a machine order, not a human one*.
- **Is a human-facing order needed anywhere?** If any of these thirteen feeds something a
  professional reads — a schedule, an export — that one wants a *stated* locale rather than
  code units, and the two kinds must not share a comparator.
- **What stops the regression.** An eslint rule banning bare `localeCompare` is the obvious
  mechanism; whether it is `no-restricted-syntax` or a property test that sorts under two locales
  and demands the same answer is the decision.
- **Does anything already frozen change?** If ordinals or signatures shift under the new
  comparator, that is a migration question, not just a code change. Check before deciding.

## Exit criteria

- [ ] The ruling in `## Resolution`: the comparator, its home, and which of the thirteen sites
      take it.
- [ ] The hazard is closed by mechanism, not prose — the regression cannot be written silently.
- [ ] Whether any existing signature or ordinal changes is *measured* and stated either way.
- [ ] `pnpm verify` green.

## Guardrails

- Identity is the invariant here, not tidiness: no change may make an ordinal derivable from
  anything but authored content, and none may renumber a frozen ordinal without saying so.
- `docs/domain/identity.md` is the law this implements; the ticket cites it, it does not amend it.
- Do not widen into "sort everything consistently". The sites that touch identity come first.

## Facts already gathered — 2026-08-12

- Node's ICU on this machine: **78.2** on the Node 22 a session actually runs, **78.3** on the
  Node 24 the provisioner installs (ticket 08's fault A). They agreed on the probe above, so ICU
  *version* skew is a live axis but not a demonstrated break; the `LANG` axis is demonstrated.
- The probe locales `en-US`, `sv`, `bn` agree on pure-ASCII marks and diverge on `Ä` — so the
  exposure depends on what a drawing's marks actually contain, which is worth measuring rather
  than assuming for Bangladesh drawings.
- This Node is full-ICU (`icu_small: false`). A small-ICU or `--without-intl` build collapses
  `localeCompare` toward code-unit order, which is a third divergence axis and an argument for
  not depending on ICU at all here.

## Resolution — 2026-08-12

**Code units, behind one named comparator, at all thirteen sites, with an absolute lint rule.**
`compareCanonical(a, b)` in `src/core/order.ts` is the only comparator for machine-canonical
strings in this tree; bare `localeCompare` is now an eslint error everywhere under `src/` and
`db/`.

### The measurement that forced it

The hazard was made to fire. Same batch, same Node, comparator swapped underneath — one mark
family whose members are spelled `C1` and `c1`, which `markFamily` folds into one family:

```
localeCompare : c1->c1#1  C1->c1#2
code unit     : C1->C1#1  c1->C1#2
```

**Both the frozen ordinals and the spelling the family registers under flip.** Under
`identity.md` §4 the ordinal is frozen at first registration and the key form is what a
professional reads, so this is an identity defect, not a formatting one.

The ticket led with the wrong axis, and the measurement corrected it. `LANG` *does* move the
order — `B1 BA BÄ BZ` becomes `B1 BA BZ BÄ` under `sv_SE.UTF-8` — but `en-US`, `sv` and `bn`
agree on pure-ASCII marks, so the `LANG` axis only bites strings carrying non-ASCII. What bites
plain ASCII is **case**: ICU orders lowercase before uppercase at the tertiary level, code units
order uppercase first. So the live environment axis is **how Node was built** — full-ICU,
small-ICU, `--without-intl` — not what `LANG` says. This machine already carries two ICU
versions (78.2 on the Node 22 a session runs, 78.3 on the Node 24 the provisioner installs).

Two further facts settled the direction:

- **Nothing is frozen.** `SELECT count(*) FROM register_objects` → **0**. No ordinal is
  renumbered by this change and there is no migration; this was the cheapest moment the decision
  would ever be available.
- **The house order was already chosen, twice, differently.** Inside `sightingSemantic()`,
  twelve lines apart: `handles: [...].sort()` (code unit) and `.sort(([a], [b]) =>
  a.localeCompare(b))` (ICU). Picking code units makes the canonical form internally consistent
  rather than introducing a new convention.

### Why code units and not `Intl.Collator` with a stated locale

The alternative was put: pin the locale explicitly. It closes the `LANG` axis and leaves the
ICU-**version** and ICU-**build** axes open, for strings that are `620.0x450.0` and
`plan:E6|C1|0.0|0.0` — cut by this system, for this system, and not language. Code units depend
on no library at all. It is the same argument that pinned Postgres to `C.UTF-8` rather than
`en_US.utf8` one ticket earlier: byte order is stable across library upgrades, linguistic order
is not.

### All thirteen, not the identity-bearing five

Inspection found only five sites that can reach identity — `pairing.ts:119–120` (the ordinal),
`:133` (the canonical keys the signature is built from), `:436–437` (which prior pairs with which
sighting), and `:111`/`:381–382` (what gets emitted). Two that the ticket suspected turned out
inert: `views.ts:488` sorts views by bounds then `id`, and no `viewKey` derives from view *order*;
`placement.ts:592` sorts instances before `familyIdentities`, which re-sorts on a total order over
unique keys, so input order cannot survive.

Converted all thirteen anyway, because **the third exit criterion is a mechanism, and a rule with
eight exemptions is not one**. "No bare `localeCompare` in this tree" needs no judgment to apply;
"no bare `localeCompare` except in these eight places" is a list someone maintains, and the next
author reading two adjacent sorts with two different comparators learns that the choice is
arbitrary. The cost of the wide reading was zero: nothing frozen, and `src/app`, `src/components`
and `src/server` contain **no collation at all**, so no human-facing sort was disturbed.

The exception is designed rather than discovered: a sort a person reads takes `Intl.Collator`
with a **stated** locale, deliberately, and never shares a comparator with identity. That is
written into `order.ts`'s doc comment and the lint message. Nothing needs one today.

### The mechanism

- `src/core/order.ts` — `compareCanonical`, with the measurements above in its doc comment so the
  reason survives the next reader.
- `eslint.config.js` — `no-restricted-syntax` on
  `MemberExpression[property.name='localeCompare']`, over `src/**` and `db/**`. Absolute.
- `src/__tests__/boundaries.spec.ts` — three cases proving the rule **fails closed**, in the file
  that already exists because a boundary plugin once silently reported zero violations twice.
  Flags `localeCompare` in core and in a module; passes `compareCanonical` and a bare `.sort()`.
- `src/core/__tests__/register.spec.ts` — the case-spelling family pinned as a contract:
  `C1#1, c1#2`. This test fails under `localeCompare`, which is the point of it.

### Proven, not claimed

- The flip was reproduced before the change and is now pinned by a test that would catch its
  return.
- Lint rule proven to fire and proven not to over-fire (3 cases, green).
- **No existing signature or ordinal changed**: the whole suite passed unmodified — the canonical
  JSON keys are lowercase-initial ASCII identifiers (`anchor`, `elementType`, `family`, `handles`,
  `levelBasis`, `levelId`, `mark`, `signature`, `viewKey`), on which the two orders agree — and
  `register_objects` holds no rows.
- `pnpm verify` green in **36.6s**.
