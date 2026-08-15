# Which headless library sits under the owned components

wayfinder:grilling
Status: open
Blocked by:
Claimed by:

## Objective

Ticket 10 ruled the **shape** of the component stack and deliberately deferred the **vendor**:
headless behaviour underneath, every pixel and token owned, never a styled library. The vendor
was left open because nothing in the product uses a dialog, a combobox or a listbox yet, and
choosing one against zero usage is choosing on taste.

This ticket is taken by **the first ticket that needs a focus-trapped dialog or a combobox**, with
that component in front of it — not before.

## The decision

1. **Which library.** The resolving session's lean was **React Aria Components**, on the grounds
   that it is the only candidate with real `Table`/`GridList` keyboard semantics, which is what a
   dense register needs and what Radix notably lacks. That is a lean, not a ruling: it was made
   without a single real interactive surface to test it against. Radix, Base UI and shadcn/ui
   (copy-in source, so "headless plus a styling head start" rather than a styled library) are all
   live.
2. **What it costs `pnpm verify`.** The bar is 90s and the gate was 16.3s when ticket 10 closed,
   so there is room — but it is a budget that only spends one way, and the measurement belongs in
   this ticket's resolution rather than in a later surprise.
3. **Whether the choice is reversible.** A headless library reaches into every interactive
   component's internals. Name what it would cost to change vendors after five surfaces exist,
   because that number is what the decision is actually worth.

## Guardrails

- Ticket 10's ruling binds and is not re-opened here: **no styled library**, tokens declared once
  in `globals.css`'s `@theme`, all appearance owned.
- Whatever lands must survive the `?mono=1` test — every status a triple of glyph, word, colour
  (`quantity-contract.md` §6, and ticket 10's two-layer enforcement).
- The instrument is keyboard-driven for eight hours a day. Keyboard and focus behaviour is the
  thing being bought; if a candidate does not clearly beat owning it outright, own it outright.
