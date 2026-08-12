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
