"use client";

/**
 * PROTOTYPE — the floating switcher. Deliberately ugly and high-contrast so it
 * never reads as part of the design being judged. Hidden in production builds.
 *
 * Beyond the variant cycle it carries the three axes ticket 10 asks to rule,
 * because each one is a question you answer by *looking*, not by arguing:
 * density (§2), language (§6/genesis §5), and greyscale — which is the
 * quantity-contract §6 check that no certificate signal rides on colour alone.
 */

import { densities, type Density } from "./density";
import type { Lang } from "./format";

export function PrototypeSwitcher({
  variants,
  current,
  name,
  onVariant,
  lang,
  onLang,
  dens,
  onDens,
  grey,
  onGrey,
}: {
  variants: string[];
  current: string;
  name: string;
  onVariant: (v: string) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  dens: Density;
  onDens: (d: Density) => void;
  grey: boolean;
  onGrey: (g: boolean) => void;
}) {
  if (process.env.NODE_ENV === "production") return null;
  const i = variants.indexOf(current);
  const step = (n: number) => {
    const next = variants[(i + n + variants.length) % variants.length];
    if (next) onVariant(next);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-stretch divide-x divide-white/25 rounded-full bg-[#0b0b0c] font-sans text-[12px] text-white shadow-[0_8px_30px_-8px_rgba(0,0,0,0.8)] ring-1 ring-white/20">
        <button onClick={() => step(-1)} className="rounded-l-full px-3 hover:bg-white/15" aria-label="previous variant">
          ←
        </button>
        <span className="flex items-center gap-2 px-3 py-2 whitespace-nowrap">
          <b>{current}</b>
          <span className="text-white/70">{name}</span>
        </span>
        <button onClick={() => step(1)} className="px-3 hover:bg-white/15" aria-label="next variant">
          →
        </button>

        <span className="flex items-center gap-1 px-2">
          {densities.map((k) => (
            <button
              key={k}
              onClick={() => onDens(k)}
              className={`rounded-full px-2 py-0.5 ${k === dens ? "bg-white text-black" : "text-white/70 hover:bg-white/15"}`}
            >
              {k}
            </button>
          ))}
        </span>

        <span className="flex items-center gap-1 px-2">
          {(["en", "bn"] as Lang[]).map((k) => (
            <button
              key={k}
              onClick={() => onLang(k)}
              className={`rounded-full px-2 py-0.5 ${k === lang ? "bg-white text-black" : "text-white/70 hover:bg-white/15"}`}
            >
              {k === "en" ? "EN" : "বাংলা"}
            </button>
          ))}
        </span>

        <button
          onClick={() => onGrey(!grey)}
          className={`rounded-r-full px-3 ${grey ? "bg-white text-black" : "text-white/70 hover:bg-white/15"}`}
          title="greyscale — the §6 check that nothing rides on colour alone"
        >
          {grey ? "◑ grey" : "◐ colour"}
        </button>
      </div>
    </div>
  );
}
