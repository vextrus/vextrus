/**
 * PROTOTYPE — ticket 10: the design system.
 *
 * "Two directions for the whole instrument, switchable via ?variant=, on a
 * throwaway route under /prototype/design-system." (SKILL.md sub-shape B —
 * there is no existing page for a design system to live inside.)
 *
 * A — "Drafting Table": canvas and worklist as persistent equal partners,
 *     split left/right; paper-toned; serif document heading.
 * B — "Instrument Console": canvas as a full-width hero band over a stacked
 *     dense table; dark, technical, cockpit-styled.
 *
 * See the ticket's Build note for which one won and why.
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
