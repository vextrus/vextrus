/**
 * PROTOTYPE — ticket 10. The drawing is the hero, so it is drawn, not stubbed:
 * a real (if small) structural plan in world coordinates — grid bubbles,
 * columns on intersections, a shear wall, dimension strings, mark labels.
 *
 * The point it exists to settle: a canvas that must never read as a thumbnail
 * beside a form. Two tones, because the two directions disagree about whether a
 * drawing belongs on paper or in a CAD viewport.
 */

const gridX = [0, 6000, 12000, 18000];
const gridY = [0, 5500, 11000];
const colLabels = ["A", "B", "C", "D"];
const rowLabels = ["1", "2", "3"];

const COL = 450; // column size, mm

interface Column {
  mark: string;
  x: number;
  y: number;
}

const columns: Column[] = gridY.flatMap((y, r) =>
  gridX.map((x, c) => ({ mark: `C-${r * gridX.length + c + 1}`, x, y })),
);

export interface CanvasTone {
  /** paper: black line on off-white, as the sheet prints. viewport: white line on near-black, as CAD shows it. */
  tone: "paper" | "viewport";
}

export function CanvasMock({
  tone,
  highlight = [],
  raster = false,
  showDimensions = true,
  caption,
}: CanvasTone & {
  /** Marks a disposition is citing — the viewport frames and highlights, never mutates. */
  highlight?: string[];
  /** A raster sheet renders as an image beneath the traced layer; the two are never the same channel. */
  raster?: boolean;
  showDimensions?: boolean;
  caption?: string;
}) {
  const paper = tone === "paper";
  const ink = paper ? "#26221c" : "#e8e4dc";
  const faint = paper ? "#b6ab98" : "#4d4a44";
  const ground = paper ? "#fbfaf6" : "#16161a";
  const hot = paper ? "#a8391a" : "#ff9a5c";

  return (
    <figure className="relative h-full w-full overflow-hidden" style={{ background: ground }}>
      <svg
        viewBox="-3400 -3000 25000 17500"
        className="h-full w-full"
        role="img"
        aria-label="Structural plan, grid A–D by 1–3, twelve columns and one shear wall"
      >
        {raster && (
          <>
            {/* The scan beneath: a grey, slightly skewed ghost of the same plan. */}
            <g opacity={paper ? 0.22 : 0.3} transform="rotate(0.4 9000 5500) translate(60 40)">
              <rect x={-2600} y={-2200} width={23000} height={16200} fill={paper ? "#e9e4d8" : "#26262b"} />
              {gridX.map((x) => (
                <line key={`rx${x}`} x1={x} y1={-1800} x2={x} y2={12800} stroke={ink} strokeWidth={90} />
              ))}
              {gridY.map((y) => (
                <line key={`ry${y}`} x1={-1800} y1={y} x2={19800} y2={y} stroke={ink} strokeWidth={90} />
              ))}
            </g>
            <text x={-3200} y={14200} fill={faint} fontSize={340} fontFamily="ui-monospace, monospace">
              RASTER SHEET · traced layer above, image below — never the same channel
            </text>
          </>
        )}

        {/* Grid lines, then bubbles. */}
        <g stroke={faint} strokeWidth={20} strokeDasharray="260 120 40 120">
          {gridX.map((x) => (
            <line key={`gx${x}`} x1={x} y1={-1800} x2={x} y2={12800} />
          ))}
          {gridY.map((y) => (
            <line key={`gy${y}`} x1={-1800} y1={y} x2={19800} y2={y} />
          ))}
        </g>
        <g fill="none" stroke={ink} strokeWidth={26}>
          {gridX.map((x, i) => (
            <g key={`bx${x}`}>
              <circle cx={x} cy={-2400} r={520} />
              <text
                x={x}
                y={-2260}
                textAnchor="middle"
                fill={ink}
                stroke="none"
                fontSize={520}
                fontFamily="ui-monospace, monospace"
              >
                {colLabels[i]}
              </text>
            </g>
          ))}
          {gridY.map((y, i) => (
            <g key={`by${y}`}>
              <circle cx={-2400} cy={y} r={520} />
              <text
                x={-2400}
                y={y + 180}
                textAnchor="middle"
                fill={ink}
                stroke="none"
                fontSize={520}
                fontFamily="ui-monospace, monospace"
              >
                {rowLabels[i]}
              </text>
            </g>
          ))}
        </g>

        {/* The shear wall between A1 and A2. */}
        <rect x={-160} y={0} width={320} height={5500} fill={ink} opacity={0.85} />
        <text x={520} y={2900} fill={ink} fontSize={420} fontFamily="ui-monospace, monospace">
          SW-1
        </text>

        {/* Columns. A cited mark is framed and flagged — highlight never mutates the drawing. */}
        {columns.map((c) => {
          const cited = highlight.includes(c.mark);
          return (
            <g key={c.mark}>
              <rect
                x={c.x - COL / 2}
                y={c.y - COL / 2}
                width={COL}
                height={COL}
                fill={cited ? hot : ink}
                stroke={cited ? hot : "none"}
                strokeWidth={40}
              />
              {cited && (
                <rect
                  x={c.x - 1100}
                  y={c.y - 1100}
                  width={2200}
                  height={2200}
                  fill="none"
                  stroke={hot}
                  strokeWidth={60}
                  strokeDasharray="220 160"
                />
              )}
              <text
                x={c.x + 700}
                y={c.y - 620}
                fill={cited ? hot : ink}
                fontSize={400}
                fontFamily="ui-monospace, monospace"
              >
                {c.mark}
              </text>
            </g>
          );
        })}

        {showDimensions && (
          <g stroke={faint} strokeWidth={22} fill={faint} fontFamily="ui-monospace, monospace" fontSize={380}>
            <line x1={0} y1={13600} x2={18000} y2={13600} />
            {gridX.map((x) => (
              <line key={`tick${x}`} x1={x} y1={13300} x2={x} y2={13900} />
            ))}
            {gridX.slice(1).map((x, i) => (
              <text key={`dim${x}`} x={(x + (gridX[i] ?? 0)) / 2} y={14400} textAnchor="middle" stroke="none">
                6000
              </text>
            ))}
            <text x={9000} y={15300} textAnchor="middle" stroke="none">
              18000 O/A
            </text>
          </g>
        )}
      </svg>
      {caption && (
        <figcaption
          className="pointer-events-none absolute bottom-2 left-3 font-mono text-[0.6875rem] tracking-wide"
          style={{ color: faint }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
