import tseslint from "typescript-eslint";

/**
 * Boundary law (ADR-0001, ADR-0007):
 *  - Deep module imports are banned everywhere: `modules/<name>/...` paths are
 *    unimportable except via the module's public `@/modules/<name>` index.
 *    Inside a module, use relative imports.
 *  - `src/core` may not import from modules at all — the dependency points
 *    inward only.
 * The rules match import strings, not resolved paths, so the convention is:
 * cross-folder imports always use the `@/` alias. A relative escape that dodges
 * the alias is the known residual hole; tighten with dependency-cruiser if it
 * ever bites (`src/__tests__/boundaries.spec.ts` proves the rules fail closed).
 */
const DEEP_MODULE_IMPORT = {
  group: ["**/modules/*/**"],
  message:
    "Deep module imports are banned. Import from the module's public index: '@/modules/<name>'. Inside a module, use relative imports.",
};

/**
 * Identity is derived from sorted strings (identity.md §4–§5), so the
 * comparison function is part of the identity law. `localeCompare` resolves an
 * absent locale against the runtime's environment, and ICU orders case the
 * opposite way from code units — measured to flip a mark family's frozen
 * ordinals and its registered spelling, `c1#1, C1#2` against `C1#1, c1#2`
 * (.wayfinder/harness ticket 09). The rule is absolute so it needs no judgment
 * to apply: `compareCanonical` from `@/core/order`, or a bare `.sort()`, which
 * is already code-unit order.
 *
 * A sort a *person* reads is the designed exception and does not exist yet: it
 * would take `Intl.Collator` with a stated locale, deliberately, and never
 * share a comparator with identity.
 */
const NO_LOCALE_COMPARE = {
  selector: "MemberExpression[property.name='localeCompare']",
  message:
    "localeCompare depends on the runtime's locale and ICU build — use compareCanonical from '@/core/order' (or a bare .sort(), already code-unit order). A human-facing sort takes Intl.Collator with a stated locale instead.",
};

const ANY_MODULE_IMPORT = {
  group: ["**/modules/**"],
  message: "src/core may not import from modules — the dependency points inward only (ADR-0005).",
};

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-verify/**",
      "cad/**",
      "db/migrations/**",
      "e2e/**",
      "next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "db/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DEEP_MODULE_IMPORT] }],
      "no-restricted-syntax": ["error", NO_LOCALE_COMPARE],
    },
  },
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_MODULE_IMPORT, ANY_MODULE_IMPORT] },
      ],
    },
  },
);
