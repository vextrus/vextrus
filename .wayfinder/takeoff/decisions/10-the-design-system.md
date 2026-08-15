# The design system — what a quantity surveyor's instrument looks like

Ruled 2026-08-16, attended `/grilling`, in front of the running prototype.
Full reasoning, measurements and rejected alternatives: [ticket 10](../tickets/10-the-design-system.md).
Constitutional half: [ADR-0016](../../../docs/adr/0016-the-non-colour-channel-is-enforced-not-observed.md).

**The prototype was rebuilt first.** Three variants that each decided four things at once made
"which one" unanswerable — the honest answer was always one direction's chrome with another's
structure, and nothing could express it. Rebuilt as two separable axes (surface × shell) with the
directions as presets on the grid, plus density as a third axis, every shell showing every surface.

- **Register and canvas — `duo × stage`, off-grid.** Light chrome, dark viewport, the drawing as
  the page with the worklist docked beside it. Tone from one direction, structure from another;
  no preset. Accepted cost, measured: **2.6 subjects visible at a time in English, 2.3 in Bangla**.
- **Density — compact (28/36 row · 13px data · 11px label), ruled in English.** Bangla steps its
  type (+1px, 1.7 leading), never its row height. Forced by the measurement that **the Bangla
  penalty grows as the scale loosens** — +13.5% at compact, +21.4% at comfortable — so ruling in
  Bangla to buy parity costs English ~15% *and* widens the gap it was meant to close.
- **Quoted source strings never break across lines.** A verbatim quotation split in half is a
  small lie about what the drawing says.
- **Numerals — Western everywhere, both languages; grouping stays lakh/crore.** Forced less by the
  signed-document argument than by the discovery that **the prose-count/figure boundary cannot be
  stated**: the prototype renders five such cases under four different policies, none of them
  decided by anyone. Ruled against an unestablished fact — nothing in the repo governs script on a
  document — so `inbox/egp-script-and-numeral-requirements.md` was minted; statute outranks this.
- **Colour never alone — a standing requirement, both layers**: a table-driven unit test that every
  mark renders glyph *and* word for every enum member, plus a lint boundary keeping status colour
  tokens inside the marks module with a meta-test proving it bites. Convention was rejected on
  ADR-0015's measurement; a greyscale snapshot test was rejected as a check people learn to dismiss.
- **Enum values on a bilingual document — both, code subordinate**, on the certificate as well as
  on screen. A translation is contestable; a stable identifier is not.
- **The stack — tokens declared once in `globals.css`'s `@theme`; no styled library ever; headless
  behaviour may ride underneath; components owned.** Vendor deliberately unnamed (lean: React Aria
  Components) — `inbox/the-headless-component-vendor.md`, taken by the first ticket that needs a
  focus-trapped dialog.

**Left undone on purpose:** the prototype still contradicts these rulings. It is the exhibit that
produced them, and overwriting it with its own conclusions destroys the primary source. Folding
the winner into production is implementation, and belongs to the first real surface.

Unblocks tickets 14, 15 and 16.
