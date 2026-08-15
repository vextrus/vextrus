/**
 * PROTOTYPE — ticket 10. The named directions, as coordinates.
 *
 * A preset is a *starting point on the grid*, not a bundle you must take whole:
 * every one of them can be moved on either axis from the switcher, and the
 * label goes to "—" the moment you leave a named point. That is the whole
 * repair — the first build could only be answered with "A, B or C", and the
 * honest answer was "A's chrome with C's structure", which nothing could show.
 */

import type { Density, Shell, Surface } from "./theme";

export interface Preset {
  key: string;
  name: string;
  surface: Surface;
  shell: Shell;
  /** One line: what this coordinate claims, so the switcher is self-explaining. */
  claim: string;
}

export const presets: Preset[] = [
  {
    key: "A",
    name: "Drafting Table",
    surface: "paper",
    shell: "split",
    claim: "paper instrument · drawing and worklist are persistent partners",
  },
  {
    key: "B",
    name: "Instrument Console",
    surface: "slate",
    shell: "stage",
    claim: "CAD register · the drawing is the page, docks push it aside rather than cover it",
  },
  {
    key: "C",
    name: "The Docket",
    surface: "paper",
    shell: "docket",
    claim: "case file · one judgement at a time, absence is the headline",
  },
  {
    key: "D",
    name: "Lit Table",
    surface: "duo",
    shell: "split",
    claim: "A's chrome with a dark viewport — the drawing is a different kind of object",
  },
  {
    key: "E",
    name: "Case Stage",
    surface: "duo",
    shell: "docket",
    claim: "C's judgement flow with the drawing on a CAD ground above it",
  },
];

export const shells: { key: Shell; name: string; note: string }[] = [
  { key: "split", name: "Split", note: "canvas ∥ worklist, 58/42, document beneath" },
  { key: "stage", name: "Stage", note: "canvas fills the page, worklist docks beside it" },
  { key: "docket", name: "Docket", note: "one judgement at a time, evidence above it" },
];

export const surfaceOptions: { key: Surface; name: string; note: string }[] = [
  { key: "paper", name: "Paper", note: "warm off-white throughout, drawing on paper" },
  { key: "slate", name: "Slate", note: "dark throughout, drawing in a viewport" },
  { key: "duo", name: "Duo", note: "light chrome, dark drawing" },
];

export const densityOptions: { key: Density; name: string; note: string }[] = [
  { key: "compact", name: "Compact", note: "28px row · 13px data · 11px label" },
  { key: "comfortable", name: "Comfortable", note: "34px row · 14px data · 12px label" },
];

/** The preset a coordinate sits on, or null once you have moved off the grid points. */
export function presetAt(surface: Surface, shell: Shell): Preset | null {
  return presets.find((p) => p.surface === surface && p.shell === shell) ?? null;
}
