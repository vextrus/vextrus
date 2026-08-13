/**
 * PROTOTYPE — throwaway. The density scale, as three switchable steps.
 *
 * Ticket 10 §2: a disposition queue is a dense worklist and a bill is a dense
 * table; consumer spacing wastes a QS's screen and spreadsheet density is
 * hostile. Three steps rather than two, because the argument is about where
 * the *middle* sits — `default` is the candidate the other two exist to judge.
 *
 * Class strings are written out in full: Tailwind reads source text, so a
 * computed class name would not survive the build.
 */

export type Density = "relaxed" | "default" | "dense";

export const densities: Density[] = ["relaxed", "default", "dense"];

export type DensityTokens = {
  /** table/queue row padding */
  row: string;
  /** the row's own text size + leading */
  rowText: string;
  /** section padding */
  pane: string;
  /** stack gap inside a pane */
  gap: string;
  /** a queue card */
  card: string;
  /** column header */
  head: string;
  /** the row's box height in px: leading + vertical padding, computed from the two above */
  rowHeightPx: number;
};

export const density: Record<Density, DensityTokens> = {
  relaxed: {
    row: "px-4 py-3",
    rowText: "text-[14px] leading-6",
    pane: "p-6",
    gap: "gap-4",
    card: "px-4 py-3.5",
    head: "px-4 py-2.5 text-[11px] tracking-wider",
    rowHeightPx: 24 + 24, // leading-6 + py-3
  },
  default: {
    row: "px-3 py-1.5",
    rowText: "text-[13px] leading-5",
    pane: "p-4",
    gap: "gap-2.5",
    card: "px-3 py-2",
    head: "px-3 py-1.5 text-[10px] tracking-wider",
    rowHeightPx: 20 + 12, // leading-5 + py-1.5
  },
  dense: {
    row: "px-2 py-0.5",
    rowText: "text-[12px] leading-4",
    pane: "p-2.5",
    gap: "gap-1.5",
    card: "px-2 py-1",
    head: "px-2 py-1 text-[10px] tracking-wide",
    rowHeightPx: 16 + 4, // leading-4 + py-0.5
  },
};
