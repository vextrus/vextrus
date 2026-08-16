import { Decimal } from "decimal.js";

/**
 * The formula template a method declares (identity.md §6: every emitted line carries a
 * **human-auditable formula string plus named variables**; ADR-0010: *the gate renders §6's
 * formula string from the same registry template it evaluates, so the printed string and the
 * arithmetic cannot disagree*).
 *
 * The template is the arithmetic — data, walked once to evaluate and once to print — so the two
 * readings are the same object rather than two hand-kept spellings of it. This is **not** the
 * transported AST ADR-0010 rejects: that rejection is about *who authors* the expression. A rail
 * may not, and cannot — an offer names a `ruleId` and carries no expression. A method's template
 * lives inside the method file the verify stage content-hashes, so changing the arithmetic without
 * bumping the version is a red build, which is exactly what measurement-rules.md §1 asks of a
 * method.
 *
 * Residual, named rather than hidden: the *interpreter* below is shared code outside the hashed
 * method files, so a change to what `PRODUCT` means — or to the precision it works at — moves no
 * method hash. It is pinned by the golden vectors in `__tests__/formula.spec.ts` instead, one of
 * which fails if the precision moves.
 */

/**
 * The precision measurement arithmetic runs at. `decimal.js` defaults to **20 significant digits**
 * and rounds every product to it, which is a silent loss on a bill face: five dimensions of six
 * significant figures each is thirty digits, and the tail that falls off is money nobody can trace.
 * A cloned constructor rather than `Decimal.set`, because the default is global mutable state that
 * any import could move underneath a measurement.
 *
 * 60 digits is not a tolerance — nothing rounds to it in practice; it is headroom well past any
 * product of drawing dimensions. Documents round for presentation at the catalogue's fixed
 * precision (work-items.ts); the register keeps the full number.
 */
export const MEASUREMENT_PRECISION = 60;
export const MeasurementDecimal = Decimal.clone({ precision: MEASUREMENT_PRECISION });

/**
 * One node kind, because one method exists. A node enters this union with the method that needs
 * it — the discipline `SEED_METHODS` states for methods and `GEOMETRY_VARIANTS` for shapes: a
 * construct naming arithmetic nothing performs is a fiction the edition key would then certify.
 * `formulas.md` §2's other volumes (sums, a deducted difference, the prismoidal frustum) arrive
 * with their own methods.
 */
export type Formula =
  | { readonly node: "VARIABLE"; readonly name: string }
  | { readonly node: "PRODUCT"; readonly terms: readonly [Formula, Formula, ...Formula[]] };

/** A named variable — the name printed on the line and the key the gate binds a value to. */
export function variable(name: string): Formula {
  return { node: "VARIABLE", name };
}

/** A product of two or more terms. Associative, so the rendering needs no parentheses. */
export function product(first: Formula, second: Formula, ...rest: readonly Formula[]): Formula {
  return { node: "PRODUCT", terms: [first, second, ...rest] };
}

/**
 * The declared variable names, in the order they appear in the template, each once. Derived from
 * the template rather than declared beside it: a hand-kept list is a second spelling of the same
 * fact, and the one that goes stale prints a variable the arithmetic never read.
 */
export function formulaVariables(formula: Formula): readonly string[] {
  const names: string[] = [];
  const walk = (node: Formula): void => {
    if (node.node === "VARIABLE") {
      if (!names.includes(node.name)) names.push(node.name);
      return;
    }
    for (const term of node.terms) walk(term);
  };
  walk(formula);
  return names;
}

/**
 * The human-auditable string (identity.md §6). `print` decides what a variable reads as: the
 * default prints its name (`count × L × B × H`), and passing a value printer produces the same
 * sentence with the numbers in it — one template, two readings.
 */
export function renderFormula(formula: Formula, print: (name: string) => string = (name) => name): string {
  if (formula.node === "VARIABLE") return print(formula.name);
  return formula.terms.map((term) => renderFormula(term, print)).join(" × ");
}

/**
 * The arithmetic, in decimal — never a float (CLAUDE.md). `resolve` is **total**: the caller
 * (`evaluateMethod`) refuses a missing or unknown binding by name before evaluating, so there is
 * no lookup failure to swallow here and no default to fall through to.
 */
export function evaluateFormula(formula: Formula, resolve: (name: string) => Decimal): Decimal {
  if (formula.node === "VARIABLE") return resolve(formula.name);
  return formula.terms
    .map((term) => evaluateFormula(term, resolve))
    .reduce((acc, term) => acc.mul(term));
}
