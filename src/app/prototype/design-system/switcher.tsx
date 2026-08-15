"use client";

/**
 * PROTOTYPE — ticket 10. The floating switcher, rebuilt as an axis panel.
 *
 * It used to cycle three bundles. That framing is what made the ticket
 * unanswerable: every bundle decided four things at once, so a reviewer who
 * wanted one bundle's tone with another's structure had nothing to point at.
 * Now the presets are shortcuts to coordinates and each axis moves on its own —
 * and the label reads "off-grid" the moment you leave a named point, which is a
 * perfectly good answer for this ticket to end on.
 *
 * Deliberately ugly and high-contrast so it never reads as part of the design
 * under evaluation, and gated on NODE_ENV so a stray merge cannot ship it.
 *
 *   ← / →  preset          b  language (English / বাংলা)
 *   s      surface         m  mono — colour stripped (quantity-contract §6)
 *   h      shell           x  density
 *   j / k  move the subject · a affirm · d defer (docket shell)
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  densityOptions,
  presetAt,
  presets,
  shells,
  surfaceOptions,
} from "./presets";
import type { Density, Lang, Shell, Surface } from "./theme";

export function VariantSwitcher({
  surface,
  shell,
  density,
  lang,
  mono,
}: {
  surface: Surface;
  shell: Shell;
  density: Density;
  lang: Lang;
  mono: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = presetAt(surface, shell);

  useEffect(() => {
    function set(entries: Record<string, string>) {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(entries)) params.set(k, v);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    function cyclePreset(delta: number) {
      const at = presets.findIndex((p) => p.surface === surface && p.shell === shell);
      const from = at === -1 ? 0 : at + delta;
      const next = presets[((from % presets.length) + presets.length) % presets.length];
      if (next) set({ surface: next.surface, shell: next.shell });
    }
    function cycle<T extends string>(list: readonly { key: T }[], current: T, param: string) {
      const at = list.findIndex((o) => o.key === current);
      const next = list[(at + 1) % list.length];
      if (next) set({ [param]: next.key });
    }
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") cyclePreset(-1);
      if (e.key === "ArrowRight") cyclePreset(1);
      if (e.key === "s") cycle(surfaceOptions, surface, "surface");
      if (e.key === "h") cycle(shells, shell, "shell");
      if (e.key === "x") cycle(densityOptions, density, "density");
      if (e.key === "b") set({ lang: lang === "en" ? "bn" : "en" });
      if (e.key === "m") set({ mono: mono ? "0" : "1" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchParams, router, surface, shell, density, lang, mono]);

  if (process.env.NODE_ENV === "production") return null;

  function href(entries: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(entries)) params.set(k, v);
    return `?${params.toString()}`;
  }

  function step(delta: number) {
    const at = presets.findIndex((p) => p.surface === surface && p.shell === shell);
    const from = at === -1 ? 0 : at + delta;
    const next = presets[((from % presets.length) + presets.length) % presets.length];
    return href({ surface: next?.surface ?? surface, shell: next?.shell ?? shell });
  }

  const pill = (on: boolean) =>
    `rounded-full px-2 py-0.5 ${on ? "bg-lime-400 text-black" : "text-white/70 hover:text-lime-400"}`;

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 flex max-w-[min(60rem,95vw)] -translate-x-1/2 flex-col gap-1 rounded-xl border-2 border-lime-400 bg-black px-3 py-2 font-mono text-[11px] text-white shadow-2xl">
      {/* Row 1 — where you are. */}
      <div className="flex items-center gap-2">
        <a href={step(-1)} aria-label="Previous preset" className="px-1 hover:text-lime-400">
          ←
        </a>
        <span className="min-w-[16rem] text-center tracking-wide">
          {active ? (
            <>
              <b>{active.key}</b> — {active.name}
            </>
          ) : (
            <span className="text-lime-400">off-grid — {surface} · {shell}</span>
          )}
        </span>
        <a href={step(1)} aria-label="Next preset" className="px-1 hover:text-lime-400">
          →
        </a>
        <span className="mx-1 h-3 w-px bg-white/30" />
        <span className="flex-1 truncate text-white/60">
          {active ? active.claim : "a combination no preset names — which is a legitimate answer"}
        </span>
        <a href={href({ lang: lang === "en" ? "bn" : "en" })} className={pill(lang === "bn")}>
          {lang === "bn" ? "বাংলা" : "EN"} <span className="opacity-60">b</span>
        </a>
        <a href={href({ mono: mono ? "0" : "1" })} className={pill(mono)}>
          mono <span className="opacity-60">m</span>
        </a>
      </div>

      {/* Row 2 — the axes, moving independently. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/20 pt-1.5">
        <Axis
          title="surface (s)"
          options={surfaceOptions}
          current={surface}
          hrefFor={(k) => href({ surface: k })}
        />
        <Axis title="shell (h)" options={shells} current={shell} hrefFor={(k) => href({ shell: k })} />
        <Axis
          title="density (x)"
          options={densityOptions}
          current={density}
          hrefFor={(k) => href({ density: k })}
        />
      </div>
    </nav>
  );
}

function Axis<T extends string>({
  title,
  options,
  current,
  hrefFor,
}: {
  title: string;
  options: readonly { key: T; name: string; note: string }[];
  current: T;
  hrefFor: (key: T) => string;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-white/40">{title}</span>
      {options.map((o) => (
        <a
          key={o.key}
          href={hrefFor(o.key)}
          title={o.note}
          className={`rounded-full px-2 py-0.5 ${
            o.key === current ? "bg-lime-400 text-black" : "text-white/70 hover:text-lime-400"
          }`}
        >
          {o.name}
        </a>
      ))}
    </span>
  );
}
