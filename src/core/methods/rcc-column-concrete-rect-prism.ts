import { product, variable } from "../formula";
import type { MethodDeclaration } from "../methods";

/**
 * **RCC rectangular-prism column concrete** — `count × L × B × H` (formulas.md §2, *Rect prism*).
 * The first method in force (measurement-rules.md §1: a method is code, never configurable,
 * enumerated by `(rule id, version)` with CI asserting a content hash of the implementation).
 *
 * One method per file under this directory, and **this whole file is the hashed artifact**
 * (ADR-0010): `pnpm verify`'s `methods:hash` stage digests it against `src/core/methods.manifest.json`,
 * so changing the arithmetic without bumping `version` is a red build, and the bump moves the
 * rule-set edition key (identity.md §8). Accepted cost, stated in the ruling: editing a comment in
 * this file forces a version bump — and a version bump is a **new file beside this one**, never an
 * edit to this one, because an edition already pinning version 1 must go on resolving.
 *
 * Measured on the **gross concrete section**: reinforcement is never deducted from concrete
 * (measurement-rules.md §1's exemplar of a method with no engine path to toggle it,
 * bd-authority.md §4) — which is why no rebar term appears below and no parameter could add one.
 *
 * `count` is a binding the rail supplies; `L`, `B` and `H` come from the `PRISM_RECT` geometry
 * (`geometryVariables` in offer.ts). A vertical member is measured **full storey height**,
 * floor-to-floor, with beam and slab intersections not deducted (measurement-rules.md §1), and it
 * expands per level from the level stack (formulas.md §2) — one object, hence one offer, per level.
 */
export const rccColumnConcreteRectPrism = {
  ruleId: "RCC_COLUMN_CONCRETE_RECT_PRISM",
  version: 1,
  kind: "RCC_CONCRETE",
  formula: product(variable("count"), variable("L"), variable("B"), variable("H")),
  geometryVariants: ["PRISM_RECT"],
  /**
   * The channels this method governs, each naming the rule-set parameter that decides it
   * (measurement-rules.md §3): the end of a dissimilar member framing into the column, and an
   * embedded duct. Openings are **not** governed here — §2's opening lane is the face and slab
   * algebras' — so a candidate offered on that channel is a named gate refusal rather than a
   * deduction taken under a threshold that was never meant for it.
   */
  channels: {
    MEMBER_END: "memberEndNoDeductMaxCm2",
    EMBEDDED_DUCT: "embeddedDuctNoDeductMaxCm2",
  },
} as const satisfies MethodDeclaration;
