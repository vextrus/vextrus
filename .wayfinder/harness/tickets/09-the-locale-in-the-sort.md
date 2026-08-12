# The locale in the sort — JS ordering that an env var can move

wayfinder:grilling
Status: open
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
