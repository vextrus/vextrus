/**
 * The one comparator for machine-canonical strings.
 *
 * Identity is derived from sorted strings: `identity.md` §4 orders a mark
 * family's members by content signature and freezes the ordinal as that 1-based
 * index, and §5's semantic is a canonical JSON whose keys are sorted. So the
 * comparison function is part of the identity law, not a formatting detail.
 *
 * **Code units, never `localeCompare`.** The strings compared here are cut by
 * this system for this system — `620.0x450.0`, `plan:E6|C1|0.0|0.0`, DXF
 * handles, canonical JSON keys. None of them is language, so none of them wants
 * a linguistic order, and depending on one means depending on the environment:
 *
 * - `localeCompare` with no locale resolves against the *runtime's* default,
 *   which comes from the environment. Measured on one machine, one `LANG` apart:
 *   `B1 BA BÄ BZ` becomes `B1 BA BZ BÄ`.
 * - ICU orders lowercase before uppercase at the tertiary level where code units
 *   order uppercase first. `markFamily` folds `c1` and `C1` into one family, so
 *   this flips **both** their frozen ordinals and the spelling the family
 *   registers under: measured `c1#1, C1#2` against `C1#1, c1#2`.
 * - ICU's collation changes between versions, and a Node built `--without-intl`
 *   or with small-ICU does not have it at all. Code-unit order has no such
 *   dependency — it is the same argument that pinned Postgres to `C.UTF-8`
 *   rather than `en_US.utf8` (.wayfinder/harness ticket 05).
 *
 * `Array.prototype.sort()` with no comparator is already this order, so
 * `[...handles].sort()` needs nothing from here; use this where a comparator
 * has to be written out.
 *
 * **This is not for anything a person reads.** A schedule, an export, any list
 * ordered for a professional's eye wants a *stated* locale via
 * `Intl.Collator("<locale>")` — a deliberate, separate call, never this
 * function. Nothing in the tree needs one today; the day one does, it does not
 * share a comparator with identity.
 */
export function compareCanonical(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
