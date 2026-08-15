/**
 * PROTOTYPE — ticket 10: the design system.
 *
 * "Five named directions as coordinates on two separable axes — surface ×
 * shell — plus a density toggle, on a throwaway route under
 * /prototype/design-system."
 * (SKILL.md sub-shape B: a design system has no existing page to live inside;
 * `src/app/` holds a layout, a home page and a login page.)
 *
 * The first build offered three bundles and asked "which one". Each bundle
 * decided four things at once — tone, where the drawing sits, how work arrives,
 * where the document lives — so the honest answer ("that one's chrome with the
 * other's structure") could not be pointed at, let alone seen. The axes are now
 * independent and the directions are presets on the grid:
 *
 *   A — Drafting Table ...... paper  × split   drawing and worklist as partners
 *   B — Instrument Console .. slate  × stage   the drawing is the page
 *   C — The Docket .......... paper  × docket  one judgement at a time
 *   D — Lit Table ........... duo    × split   light chrome, dark viewport
 *   E — Case Stage .......... duo    × docket  judgement flow on a CAD ground
 *
 * Every shell now shows *every* surface — canvas, worklist, bill, certificate
 * and act log — because a shell that hid the bill was being compared against
 * one that showed it, and that is not a comparison.
 *
 * Axes: `?surface=paper|slate|duo`, `?shell=split|stage|docket`,
 * `?density=compact|comfortable`, `?lang=en|bn`, `?mono=0|1`.
 * Run it with `pnpm dev` and open http://localhost:3210/prototype/design-system
 *
 * Throwaway code: no tests, no error handling, fixtures instead of a register.
 * Nothing here has been ruled — the ticket is open and the verdict is the
 * dispatcher's to give, in front of the running route.
 */

import { Suspense } from "react";
import "./prototype.css";
import { DesignSystemPrototypeClient } from "./prototype-client";

export default function DesignSystemPrototype() {
  return (
    <Suspense fallback={null}>
      <DesignSystemPrototypeClient />
    </Suspense>
  );
}
