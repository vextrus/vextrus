# `localeCompare` flips frozen ordinals

**Summary:** identity is derived from sorted strings (`identity.md` §4–§5). `localeCompare` with
no locale sorts by the runtime's environment and ICU orders lowercase before uppercase; measured
to flip a mark family's ordinals and its registered spelling. Sort machine strings by code units.

**Observed:** 2026-08-13. One machine, one `LANG` apart: `B1 BA BÄ BZ` became `B1 BA BZ BÄ`;
`c1`/`C1` in one family registered as `c1#1, C1#2` on one machine and `C1#1, c1#2` on another —
frozen ordinals that were not frozen.

**Fix:** `compareCanonical` from `src/core/order.ts`, or a bare `.sort()` (already code-unit
order). `localeCompare` is a lint error; the boundaries test proves the rule fires. Postgres is
pinned `C.UTF-8` for the same reason. A list a person reads takes `Intl.Collator("<locale>")`,
deliberately, and never shares a comparator with identity.
