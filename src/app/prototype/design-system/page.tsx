/**
 * PROTOTYPE — ticket 10: the design system.
 *
 * "Three directions for the whole instrument on one screen — a QS's working
 * day: drawing, disposition queue, bill and certificate — switchable via
 * `?variant=`, on a throwaway route under /prototype/design-system."
 * (SKILL.md sub-shape B: a design system has no existing page to live inside;
 * `src/app/` holds a layout, a home page and a login page.)
 *
 *   A — Drafting Table ...... paper register; canvas ∥ worklist, persistent split
 *   B — Instrument Console .. CAD register; canvas is the page, panels float over it
 *   C — The Docket .......... case-file register; one judgement at a time, absence on top
 *
 * Axes on the switcher: `?variant=A|B|C`, `?lang=en|bn`, `?mono=0|1`.
 * Run it with `pnpm dev` and open http://localhost:3210/prototype/design-system
 *
 * Throwaway code: no tests, no error handling, fixtures instead of a register.
 * The verdict this settled lives in docs/adr/0015-the-design-system.md.
 */

import { Suspense } from "react";
import { DesignSystemPrototypeClient } from "./prototype-client";

export default function DesignSystemPrototype() {
  return (
    <Suspense fallback={null}>
      <DesignSystemPrototypeClient />
    </Suspense>
  );
}
