import tseslint from "typescript-eslint";

/**
 * The guardrails that must fail closed. Every rule here enforces a NEVER in CLAUDE.md that the
 * typechecker cannot see; `src/__tests__/boundaries.spec.ts` proves each one fires, so a rule
 * that silently stops firing turns verify red instead of opening a hole.
 *
 * Rules match import strings, not resolved paths, so the convention is: cross-folder imports
 * always use the `@/` alias; inside a module, relative imports.
 */

// ADR-0001: modules are folders behind one public index; deep imports are banned everywhere.
const DEEP_MODULE_IMPORT = {
  group: ["**/modules/*/**"],
  message:
    "Deep module imports are banned. Import from the module's public index '@/modules/<name>'; inside a module, use relative imports.",
};

// ADR-0005: the dependency points inward — core never imports a module.
const ANY_MODULE_IMPORT = {
  group: ["**/modules/**"],
  message: "src/core may not import from modules — the dependency points inward only (ADR-0005).",
};

// ADR-0004: the only query paths are the seam's. Importing the driver or the schema anywhere
// else is how a bare, unscoped handle gets minted.
const DB_SEAM_MESSAGE =
  "Only src/core/db.ts may import the database driver or schema — every query goes through forTenant()/runAsSystem() (ADR-0004).";
const DB_DRIVER_IMPORT = {
  group: ["postgres", "drizzle-orm/postgres-js"],
  message: DB_SEAM_MESSAGE,
};
// `regex`, not `group`: gitignore-style groups do not see a `../../db/schema/core` path.
const DB_SCHEMA_IMPORT = {
  regex: "(^|/)db/schema(/|$)",
  message: DB_SEAM_MESSAGE,
};

// ADR-0006: every model call passes through src/core/model.ts.
const MODEL_SDK_IMPORT = {
  group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/**"],
  message: "Only src/core/model.ts may import the model SDK — every model call goes through callModel() (ADR-0006).",
};

// identity.md §4–§5: identity is derived from sorted strings, so the comparator is part of the
// identity law. localeCompare depends on the runtime's locale and ICU build (measured to flip a
// mark family's frozen ordinals). Use compareCanonical from '@/core/order' or a bare .sort().
const NO_LOCALE_COMPARE = {
  selector: "MemberExpression[property.name='localeCompare']",
  message:
    "localeCompare depends on the runtime's locale — use compareCanonical from '@/core/order' (or a bare .sort()). A human-facing sort takes Intl.Collator with a stated locale, deliberately.",
};

// CLAUDE.md: lakh/crore, never Western grouping. Number formatting is a document concern and
// goes through a formatter that states its locale; a bare toLocaleString defaults to the
// runtime's and prints 1,000,000 where the document must read 10,00,000.
const NO_TO_LOCALE_STRING = {
  selector: "CallExpression[callee.property.name='toLocaleString']",
  message:
    "toLocaleString() defaults to the runtime locale — format numbers and dates through a document formatter with a stated locale (lakh/crore, DD MMM YYYY).",
};

export default tseslint.config(
  {
    ignores: ["node_modules/**", ".next/**", ".next-verify/**", "cad/**", "db/migrations/**", "next-env.d.ts"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "db/**/*.ts", "scripts/**/*.mjs"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_MODULE_IMPORT, DB_DRIVER_IMPORT, DB_SCHEMA_IMPORT, MODEL_SDK_IMPORT] },
      ],
      "no-restricted-syntax": ["error", NO_LOCALE_COMPARE, NO_TO_LOCALE_STRING],
    },
  },
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_MODULE_IMPORT, ANY_MODULE_IMPORT, DB_DRIVER_IMPORT, DB_SCHEMA_IMPORT, MODEL_SDK_IMPORT] },
      ],
    },
  },
  {
    // The two seams are the only files allowed to touch what everyone else is banned from.
    files: ["src/core/db.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_MODULE_IMPORT, ANY_MODULE_IMPORT, MODEL_SDK_IMPORT] },
      ],
    },
  },
  {
    files: ["src/core/model.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_MODULE_IMPORT, ANY_MODULE_IMPORT, DB_DRIVER_IMPORT, DB_SCHEMA_IMPORT] },
      ],
    },
  },
  {
    // The migration lane and the seam test are the owner-role tools; they read the schema directly.
    files: ["db/**/*.ts", "scripts/**/*.mjs"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DEEP_MODULE_IMPORT, MODEL_SDK_IMPORT] }],
    },
  },
);
