# ADR-0016 — The non-colour channel is enforced, not observed

Date: 2026-08-16
Status: accepted
Implements: `quantity-contract.md` §6 (the certificate rides every export channel and is never
carried by colour alone)
Relates to: ADR-0015 (why an honour-based remedy is not available in this repo)

## Context

`quantity-contract.md` §6 already forbids the certificate being carried by colour alone — a tint
dies in greyscale and in print, and a bill is printed, faxed, photographed and exported far more
often than it is read on the screen it was made on. That clause has been in the domain law since
the map was charted and has never had a mechanism.

Ticket 10's prototype turned it into something checkable. Every status renders as a **triple** —
glyph, then word, then colour — and `?mono=1` strips colour from the whole surface. All three
shells and all three candidate surfaces pass it today. That is the first time the clause has been
*verified* rather than asserted, and verifying it exposed the real question: whether passing today
means anything tomorrow.

Two facts decide it.

- **The repo already has this shape of enforcement.** `eslint.config.js:63` carries
  `no-restricted-syntax` for `NO_LOCALE_COMPARE`, and `src/__tests__/boundaries.spec.ts` exists to
  prove the lint rules fail closed rather than to test the code they guard. So a lint rule plus a
  meta-test that proves it bites is an established pattern here, not a new mechanism.
- **Honour-based remedies have been measured failing in this repo.** ADR-0015 records #44's
  session disclosing its own violation, correctly and unprompted, and the next human reading that
  disclosure and reverting the wrong line anyway. A convention that depends on someone noticing
  has already been tried at higher stakes.

## Decision

**1. A status reaches the screen only through a mark component.** `BasisMark`, `CoverageMark`,
`CauseMark`, `BlockingMark` and their successors are the single declaration site for what a status
looks like — the Genesis F6 argument (one declaration site for a vocabulary) applied to the thing
that actually carries the certificate.

**2. A table-driven unit test asserts the triple, for every enum member.** Each mark renders a
glyph *and* the word, for every value of its enum, driven off the enum itself — so adding a basis
value without a glyph goes red rather than shipping a colour-only status. It is milliseconds, it
needs no browser, and it rides `pnpm verify` without threatening ADR-0007's 90s bar.

**3. A lint rule forbids a status colour token outside the marks module, with a meta-test proving
it bites.** Decision 2 alone proves the component is correct, not that nobody rendered a bare
coloured `<span>` beside it. The `NO_LOCALE_COMPARE` shape and the `boundaries.spec.ts` shape are
copied rather than invented.

**4. Design tokens are declared once, in `globals.css`'s `@theme` block, and consumed as Tailwind
utilities.** Never re-declared inline, never a parallel TypeScript palette. Ticket 10's prototype
is the counter-example on purpose: it holds three palettes in `theme.ts` and threads them through
inline `style={}`, because a CSS `@theme` block can hold exactly one palette and the prototype had
to hold three at once. That is a prototype artifact and must not be folded into production.

**5. No styled component library, ever. Headless behaviour may ride underneath; every pixel and
token is owned.** A styled library is a second design system arguing with this one forever, which
defeats the register this ticket exists to settle. A headless library declares behaviour, not
vocabulary, so decision 4's objection does not reach it. The vendor is deliberately unnamed —
see `.wayfinder/takeoff/inbox/the-headless-component-vendor.md`.

## Rejected

- **A greyscale visual snapshot test.** The most direct expression of the rule and the worst
  mechanism for it: it needs a browser, it is slow against the 90s bar, and it goes red on every
  legitimate layout change — which trains people to re-baseline without looking. A check people
  learn to dismiss is worse than a convention, because it launders the dismissal.
- **Convention plus code review.** ADR-0015's measurement rules it out: disclosure worked, was
  unprompted and correct, and did not help.
- **The unit test alone, without the lint boundary.** It proves the mark is right and says nothing
  about the surface that ignored the mark. The gap is exactly where the violation would appear.
- **Naming the headless vendor now.** Nothing in the product uses a dialog, combobox or listbox
  yet; a vendor chosen against zero usage is chosen on taste. The lean on record is React Aria
  Components — the only candidate with real `Table`/`GridList` keyboard semantics — and it is a
  lean, not this ADR's decision.

## Consequences

- The marks module becomes a chokepoint every new status routes through, and the first surface
  that wants a one-off tint pays friction that is deliberate but real.
- Decisions 2 and 3 are **not built by this ADR** — wayfinder plans, it does not do. They are
  ticket 10's implementation and land with the first real surface, alongside folding the tokens
  into `globals.css`. Until then this ADR is prose, and `?mono=1` on the prototype route is the
  only standing check there is.
- `pnpm verify` gains two cheap checks and no browser dependency. The gate measured 16.3s on the
  branch that ruled this, against a 90s bar.
