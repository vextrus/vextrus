"use client";

/**
 * PROTOTYPE — throwaway. A stand-in drawing view: a column layout plan with a
 * grid, marks and per-element status.
 *
 * The one piece deliberately shared across variants, because the question each
 * variant is arguing about is *how much room the drawing gets and what sits
 * next to it* — not what a column looks like. Status is carried by fill
 * pattern, outline and glyph, never by colour alone (quantity-contract §6),
 * which is what the greyscale toggle in the switcher bar checks.
 */

import type { Lang } from "./format";

export type ElementStatus = "measured" | "interpreted" | "deferred" | "severed";

export type PlanElement = {
  id: string;
  ref: string;
  mark: string;
  status: ElementStatus;
  /** grid coordinates, 0-indexed */
  gx: number;
  gy: number;
  w: number;
  h: number;
};

const COLS = ["A", "B", "C", "D", "E"];
const ROWS = ["1", "2", "3", "4"];
const STEP = 150;
const PAD = 70;

export const planElements: PlanElement[] = COLS.flatMap((_, gx) =>
  ROWS.map((__, gy) => {
    const i = gx * ROWS.length + gy;
    const status: ElementStatus =
      i === 7 ? "deferred" : i === 13 ? "interpreted" : i === 18 ? "severed" : "measured";
    const wide = gx === 2 || gx === 3;
    return {
      id: `${COLS[gx]}${ROWS[gy]}`,
      ref: status === "deferred" ? "QR-0455" : status === "interpreted" ? "QR-0471" : "QR-0412",
      mark: wide ? "C2" : "C1",
      status,
      gx,
      gy,
      w: wide ? 34 : 26,
      h: wide ? 22 : 20,
    };
  }),
);

const STATUS_GLYPH: Record<ElementStatus, string> = {
  measured: "",
  interpreted: "≈",
  deferred: "?",
  severed: "✕",
};

export const STATUS_LABEL: Record<ElementStatus, { en: string; bn: string }> = {
  measured: { en: "Measured", bn: "পরিমাপকৃত" },
  interpreted: { en: "Interpreted", bn: "ব্যাখ্যাত" },
  deferred: { en: "No quantity", bn: "পরিমাণ নেই" },
  severed: { en: "Severed", bn: "বিচ্ছিন্ন" },
};

export function DrawingCanvas({
  lang,
  selected,
  onSelect,
  chrome = true,
  className = "",
}: {
  lang: Lang;
  selected: string | null;
  onSelect: (id: string) => void;
  /** grid bubbles, scale bar, sheet stamp — a variant may want the plan bare */
  chrome?: boolean;
  className?: string;
}) {
  const width = PAD * 2 + STEP * (COLS.length - 1);
  const height = PAD * 2 + STEP * (ROWS.length - 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={lang === "bn" ? "কলাম লেআউট প্ল্যান" : "Column layout plan"}
    >
      <defs>
        {/* hatch carries INTERPRETED without depending on hue */}
        <pattern id="vx-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="var(--vx-surface)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--vx-ink)" strokeWidth="2" />
        </pattern>
        <pattern id="vx-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="var(--vx-surface)" />
          <circle cx="1" cy="1" r="0.9" fill="var(--vx-ink-3)" />
        </pattern>
      </defs>

      <rect width={width} height={height} fill="var(--vx-canvas)" />

      {/* grid */}
      {COLS.map((c, i) => (
        <line
          key={`gv${c}`}
          x1={PAD + i * STEP}
          y1={PAD - 40}
          x2={PAD + i * STEP}
          y2={height - PAD + 40}
          stroke="var(--vx-grid)"
          strokeWidth="1"
          strokeDasharray="14 4 2 4"
        />
      ))}
      {ROWS.map((r, i) => (
        <line
          key={`gh${r}`}
          x1={PAD - 40}
          y1={PAD + i * STEP}
          x2={width - PAD + 40}
          y2={PAD + i * STEP}
          stroke="var(--vx-grid)"
          strokeWidth="1"
          strokeDasharray="14 4 2 4"
        />
      ))}

      {chrome &&
        COLS.map((c, i) => (
          <g key={`bc${c}`}>
            <circle cx={PAD + i * STEP} cy={PAD - 46} r="12" fill="none" stroke="var(--vx-grid)" />
            <text
              x={PAD + i * STEP}
              y={PAD - 42}
              textAnchor="middle"
              fontSize="12"
              fill="var(--vx-ink-2)"
              fontFamily="var(--vx-mono)"
            >
              {c}
            </text>
          </g>
        ))}
      {chrome &&
        ROWS.map((r, i) => (
          <g key={`br${r}`}>
            <circle cx={PAD - 46} cy={PAD + i * STEP} r="12" fill="none" stroke="var(--vx-grid)" />
            <text
              x={PAD - 46}
              y={PAD + i * STEP + 4}
              textAnchor="middle"
              fontSize="12"
              fill="var(--vx-ink-2)"
              fontFamily="var(--vx-mono)"
            >
              {r}
            </text>
          </g>
        ))}

      {planElements.map((el) => {
        const cx = PAD + el.gx * STEP;
        const cy = PAD + el.gy * STEP;
        const isSel = selected === el.id;
        const fill =
          el.status === "interpreted"
            ? "url(#vx-hatch)"
            : el.status === "deferred"
              ? "url(#vx-dots)"
              : el.status === "severed"
                ? "var(--vx-surface)"
                : "var(--vx-ink)";
        return (
          <g
            key={el.id}
            onClick={() => onSelect(el.id)}
            style={{ cursor: "pointer" }}
            aria-label={`${el.mark} ${el.id} — ${STATUS_LABEL[el.status][lang]}`}
          >
            <rect
              x={cx - el.w / 2}
              y={cy - el.h / 2}
              width={el.w}
              height={el.h}
              fill={fill}
              stroke="var(--vx-ink)"
              strokeWidth={el.status === "measured" ? 1 : 2}
              strokeDasharray={el.status === "deferred" ? "5 3" : undefined}
            />
            {el.status === "severed" && (
              <>
                <line
                  x1={cx - el.w / 2}
                  y1={cy - el.h / 2}
                  x2={cx + el.w / 2}
                  y2={cy + el.h / 2}
                  stroke="var(--vx-ink)"
                  strokeWidth="2"
                />
                <line
                  x1={cx + el.w / 2}
                  y1={cy - el.h / 2}
                  x2={cx - el.w / 2}
                  y2={cy + el.h / 2}
                  stroke="var(--vx-ink)"
                  strokeWidth="2"
                />
              </>
            )}
            {isSel && (
              <rect
                x={cx - el.w / 2 - 8}
                y={cy - el.h / 2 - 8}
                width={el.w + 16}
                height={el.h + 16}
                fill="none"
                stroke="var(--vx-accent)"
                strokeWidth="2.5"
              />
            )}
            <text
              x={cx + el.w / 2 + 8}
              y={cy - el.h / 2 - 4}
              fontSize="13"
              fill="var(--vx-ink-2)"
              fontFamily="var(--vx-mono)"
            >
              {el.mark}
              {STATUS_GLYPH[el.status] && ` ${STATUS_GLYPH[el.status]}`}
            </text>
          </g>
        );
      })}

      {chrome && (
        <g>
          <line
            x1={PAD}
            y1={height - 22}
            x2={PAD + STEP}
            y2={height - 22}
            stroke="var(--vx-ink-2)"
            strokeWidth="2"
          />
          <line x1={PAD} y1={height - 27} x2={PAD} y2={height - 17} stroke="var(--vx-ink-2)" strokeWidth="2" />
          <line
            x1={PAD + STEP}
            y1={height - 27}
            x2={PAD + STEP}
            y2={height - 17}
            stroke="var(--vx-ink-2)"
            strokeWidth="2"
          />
          <text
            x={PAD + STEP + 10}
            y={height - 18}
            fontSize="12"
            fill="var(--vx-ink-2)"
            fontFamily="var(--vx-mono)"
          >
            {lang === "bn" ? "৫০০০ মিমি · স্কেল নিশ্চিতকৃত" : "5000 mm · scale affirmed"}
          </text>
        </g>
      )}
    </svg>
  );
}

/** The legend, shared: proves every status reads without colour. */
export function StatusLegend({ lang, className = "" }: { lang: Lang; className?: string }) {
  const items: { status: ElementStatus; swatch: React.ReactNode }[] = [
    { status: "measured", swatch: <span className="block h-3 w-4 bg-[var(--vx-ink)]" /> },
    {
      status: "interpreted",
      swatch: (
        <span
          className="block h-3 w-4 border-2 border-[var(--vx-ink)]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--vx-ink) 0 2px, transparent 2px 5px)",
          }}
        />
      ),
    },
    {
      status: "deferred",
      swatch: <span className="block h-3 w-4 border-2 border-dashed border-[var(--vx-ink)]" />,
    },
    {
      status: "severed",
      swatch: (
        <span className="flex h-3 w-4 items-center justify-center border-2 border-[var(--vx-ink)] text-[9px] leading-none">
          ✕
        </span>
      ),
    },
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
      {items.map((it) => (
        <span key={it.status} className="flex items-center gap-2 text-[11px] text-[var(--vx-ink-2)]">
          {it.swatch}
          {STATUS_LABEL[it.status][lang]}
          {it.status === "interpreted" && <code className="text-[10px]">≈</code>}
          {it.status === "deferred" && <code className="text-[10px]">?</code>}
        </span>
      ))}
    </div>
  );
}
