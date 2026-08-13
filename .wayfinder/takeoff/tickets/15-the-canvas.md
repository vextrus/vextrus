# The canvas — the drawing, at a standard that stands next to anyone's

wayfinder:prototype
Status: open
Blocked by: 10-the-design-system.md, 11-the-entity-index.md
Claimed by:

## Objective

Charting ruled canvas-first a **first-class secondary** — explicitly not a thumbnail beside a
form. The CEO's instruction was to build the viewport and drawing tools to a quality competitors
look at. This prototype settles the interaction model and proves the performance approach before
any of it is production code.

## The decision

1. **Rendering approach at the bar** — 60 fps pan/zoom on the largest single sheet, 500K
   entities in the set. WebGL, WebGPU, or tiled 2D canvas. Prototype and **measure**; do not
   choose from reputation.
2. **What the EntityGraph already gives us, and it is a lot.** `cad-ingestion.md` §4 resolved
   colour server-side because ~98% of a real drawing is BYLAYER and *"an unresolving client
   paints everything one grey"*; text carries **world height** because *"clients that paint
   labels at screen size collide on zoom"*; closed polylines carry shoelace area; curves are
   flattened at fixed tolerance with a point cap. The rendering contract is half-written.
3. **Addressing.** A disposition says "look *here*" by citing source keys (ticket 02). The
   viewport must resolve a key set to a framing, and highlight without mutating.
4. **The tools**, ruled by what the domain already requires rather than by tool envy: two-point
   scale calibration (`measurement-rules.md` §5's top-ranked evidence), outline tracing over a
   scan (ticket 07's first-ship path), count-by-click, and **human snap-to-intersection at 0.5 of
   grid spacing — beyond it the honest off-grid form, never a snapped lie**
   (`cad-ingestion.md` §9).
5. **Derived paint renders; the extractor still never sees it** (§3). The canvas is the one place
   derived geometry is legitimately consumed. Make that boundary visible in the prototype.

## Guardrails

- LOD or decimation must **never** touch a measured value — `takeoff-core` 03 already caught
  decimation leaking into area.
- Raster sheets render as images beneath a traced vector layer; the two must never be confused
  in the same channel.
- Throwaway artifact. `/prototype` is the skill.
