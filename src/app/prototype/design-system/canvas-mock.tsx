/** PROTOTYPE — ticket 10. Stand-in drawing viewport: enough geometry that the canvas reads as a drawing, not a thumbnail. */

export function CanvasMock({ tone }: { tone: "light" | "dark" }) {
  const stroke = tone === "light" ? "#2c2822" : "#e8e2d4";
  const grid = tone === "light" ? "#ddd6ca" : "#453f34";
  const highlight = "#a34a1f";

  return (
    <svg viewBox="0 0 640 480" className="h-full w-full" role="img" aria-label="Drawing viewport — S-101 rev C, level 2">
      <rect width="640" height="480" fill="none" />
      {Array.from({ length: 13 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 48} y1={0} x2={i * 48} y2={480} stroke={grid} strokeWidth={1} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 48} x2={640} y2={i * 48} stroke={grid} strokeWidth={1} />
      ))}
      {/* grid bubbles */}
      {["A", "B", "C", "D"].map((label, i) => (
        <g key={label}>
          <circle cx={96 + i * 144} cy={20} r={14} fill="none" stroke={stroke} strokeWidth={1.5} />
          <text x={96 + i * 144} y={25} textAnchor="middle" fontSize={13} fill={stroke}>
            {label}
          </text>
        </g>
      ))}
      {/* columns at intersections */}
      {[96, 240, 384, 528].flatMap((x) =>
        [96, 240, 384].map((y) => (
          <rect key={`${x}-${y}`} x={x - 10} y={y - 10} width={20} height={20} fill={stroke} />
        )),
      )}
      {/* the selected element (C-14) picked out — colour never alone: it also gets a dashed ring and a label */}
      <circle cx={240} cy={240} r={26} fill="none" stroke={highlight} strokeWidth={2} strokeDasharray="4 3" />
      <text x={240} y={278} textAnchor="middle" fontSize={12} fill={highlight}>
        C-14
      </text>
      {/* tie beam run, dashed = derived */}
      <line x1={106} y1={96} x2={230} y2={96} stroke={stroke} strokeWidth={3} strokeDasharray="6 4" />
      <text x={168} y={88} textAnchor="middle" fontSize={11} fill={stroke}>
        TB-2
      </text>
    </svg>
  );
}
