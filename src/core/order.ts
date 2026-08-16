/**
 * The one comparator for machine-canonical strings.
 *
 * Identity is derived from sorted strings (identity.md §4–§5: a mark family's ordinal is its
 * 1-based index in content-signature order; the semantic is canonical JSON with sorted keys), so
 * the comparison function is part of the identity law. Code units, never `localeCompare`: an
 * absent locale resolves against the runtime's environment, and ICU orders lowercase before
 * uppercase where code units order uppercase first — measured to flip a mark family's frozen
 * ordinals (`c1#1, C1#2` against `C1#1, c1#2`, see docs/lessons/). A bare `.sort()` is already
 * this order. Nothing a person reads is sorted with this: that takes `Intl.Collator("<locale>")`,
 * deliberately, and never shares a comparator with identity.
 */
export function compareCanonical(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
