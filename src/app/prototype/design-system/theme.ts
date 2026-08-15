/**
 * PROTOTYPE — ticket 10. The axes, made separable.
 *
 * The first build offered three *bundles* (A/B/C), each of which decided four
 * things at once: surface tone, where the drawing sits, how work arrives, and
 * where the document lives. A reviewer who wants one bundle's tone with
 * another's structure has nothing to point at, and "which one" stops being an
 * answerable question. So the bundles are now coordinates on two axes that can
 * be moved independently, and the named directions are presets on that grid.
 *
 * Axis 1 — `surface`: what the instrument is made of.
 * Axis 2 — `shell`:   where the drawing sits and how a judgement arrives.
 * Axis 3 — `density`: ruled separately because it is ticket point 2, and
 *                     because it cannot be judged from a number in prose.
 *
 * Nothing here is ruled. `globals.css` is untouched on purpose.
 */

export type Surface = "paper" | "slate" | "duo";
export type Shell = "split" | "stage" | "docket";
export type Density = "compact" | "comfortable";
export type Lang = "en" | "bn";

export interface Palette {
  /** The page ground. Never pure white, never pure black. */
  ground: string;
  /** A raised document plane above the ground — the bill's own paper. */
  raised: string;
  /** A recessed plane — chrome that is not the document. */
  sunken: string;
  ink: string;
  inkMuted: string;
  rule: string;
  ruleFaint: string;
  /** Hover/selection wash on a dense row. */
  wash: string;
  /** Which way the drawing itself is drawn. */
  canvasTone: "paper" | "viewport";
  strong: string;
  caution: string;
  weak: string;
  refuse: string;
}

const paperInk = {
  ink: "#1c1a17",
  inkMuted: "#6b6459",
  rule: "#ddd6ca",
  ruleFaint: "#e8e2d6",
  wash: "#f4f1e8",
  strong: "#1f6f4f",
  caution: "#7a5b12",
  weak: "#a34a1f",
  refuse: "#8a3b3b",
} as const;

const slateInk = {
  ink: "#e8e4dc",
  inkMuted: "#948d81",
  rule: "#3a3833",
  ruleFaint: "#2a2926",
  wash: "#22222a",
  /* Lightened deliberately: the same hues at paper luminance fail contrast on a
     dark ground, and a status that cannot be read is the §6 failure by another
     route. Every one is still paired with a glyph and a word. */
  strong: "#5fbf94",
  caution: "#d6a83a",
  weak: "#ff9a5c",
  refuse: "#e8736f",
} as const;

export const surfaces: Record<Surface, Palette> = {
  /* Paper: the tool looks like the document it produces, and sits under office
     light next to a printed sheet without glare. */
  paper: { ground: "#faf9f6", raised: "#fffefb", sunken: "#f2efe6", canvasTone: "paper", ...paperInk },
  /* Slate: the CAD register. Every drafting tool on earth is dark, and a QS
     coming from AutoCAD reads this as an instrument rather than a web app. */
  slate: { ground: "#16161a", raised: "#1d1d22", sunken: "#121215", canvasTone: "viewport", ...slateInk },
  /* Duo: light chrome, dark drawing. The hybrid the first build made you
     imagine — the document planes stay paper, and only the viewport is a
     viewport. It is a real position, not a compromise: the drawing is a
     different kind of object from the bill, and the surface can say so. */
  duo: { ground: "#f4f2ec", raised: "#fffefb", sunken: "#eae7dd", canvasTone: "viewport", ...paperInk },
};

export interface Scale {
  /** A dense queue/bill row, px. */
  row: number;
  /** A row carrying two lines of citation, px. */
  rowLoose: number;
  /** Quantities, marks, citations. */
  data: string;
  /** Column heads, status marks — uppercase, tracked. */
  label: string;
  /** Prose inside a row: a headline. */
  body: string;
  /** Vertical padding inside a dense row, px. */
  padY: number;
}

/**
 * Two candidate scales. `compact` is the first build's proposal (28px row,
 * 13px data, 11px label); `comfortable` is that scale paid out at Bangla's
 * measured cost — worklist columns run ~15% taller in Bangla and bill rows
 * 45→54px, so a scale ruled in English is wrong by that much on every Bangla
 * screen. Which one is ruled, and in which language, is ticket point 2.
 */
export const densities: Record<Density, Scale> = {
  compact: { row: 28, rowLoose: 36, data: "0.8125rem", label: "0.6875rem", body: "0.9375rem", padY: 4 },
  comfortable: { row: 34, rowLoose: 44, data: "0.875rem", label: "0.75rem", body: "1rem", padY: 7 },
};

/** Bangla steps prose up one size and runs a looser leading; figures never step. */
export function script(lang: Lang) {
  return lang === "bn"
    ? {
        fontFamily: '"Noto Sans Bengali", "Hind Siliguri", ui-sans-serif, sans-serif',
        lineHeight: 1.7,
      }
    : { fontFamily: 'ui-sans-serif, "Segoe UI", system-ui, sans-serif', lineHeight: 1.3 };
}

/** Bangla prose takes one step up; a figure keeps the Latin data size in both. */
export function proseSize(scale: Scale, lang: Lang, base: keyof Pick<Scale, "data" | "body" | "label">) {
  const value = scale[base];
  if (lang === "en") return value;
  const rem = Number.parseFloat(value);
  return `${(rem + 0.0625).toFixed(4)}rem`;
}

export interface Theme {
  surface: Surface;
  shell: Shell;
  density: Density;
  lang: Lang;
  p: Palette;
  s: Scale;
}

export function theme(surface: Surface, shell: Shell, density: Density, lang: Lang): Theme {
  return { surface, shell, density, lang, p: surfaces[surface], s: densities[density] };
}

/** The status tokens the marks read, as inline custom properties. */
export function statusVars(p: Palette): Record<string, string> {
  return {
    "--proto-strong": p.strong,
    "--proto-caution": p.caution,
    "--proto-weak": p.weak,
    "--proto-refuse": p.refuse,
  };
}
