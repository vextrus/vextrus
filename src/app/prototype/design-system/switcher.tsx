"use client";

/**
 * PROTOTYPE — ticket 10. The floating switcher. Deliberately ugly and
 * high-contrast so it never reads as part of the design under evaluation, and
 * gated on NODE_ENV so a stray merge cannot ship it.
 *
 * Three axes, because this ticket has three questions and flipping between
 * them is the whole method:
 *   ← / →  variant
 *   b      language (English / বাংলা) — the type scale has to survive both
 *   m      mono — colour stripped, proving §6's "never carried by colour alone"
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export interface VariantInfo {
  key: string;
  name: string;
}

export function VariantSwitcher({
  variants,
  current,
  lang,
  mono,
}: {
  variants: VariantInfo[];
  current: string;
  lang: "en" | "bn";
  mono: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  useEffect(() => {
    function set(key: string, value: string) {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    function cycle(delta: number) {
      const next = variants[(index + delta + variants.length) % variants.length];
      if (next) set("variant", next.key);
    }
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
      if (e.key === "b") set("lang", lang === "en" ? "bn" : "en");
      if (e.key === "m") set("mono", mono ? "0" : "1");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, variants, searchParams, router, lang, mono]);

  if (process.env.NODE_ENV === "production") return null;

  const active = variants[index];

  function href(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    return `?${params.toString()}`;
  }

  const step = (delta: number) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    return href("variant", next?.key ?? current);
  };

  return (
    <nav className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-lime-400 bg-black px-2 py-1.5 font-mono text-xs text-white shadow-2xl">
      <a href={step(-1)} aria-label="Previous variant" className="px-2 py-1 hover:text-lime-400">
        ←
      </a>
      <span className="min-w-[15rem] text-center tracking-wide">
        {active?.key} — {active?.name}
      </span>
      <a href={step(1)} aria-label="Next variant" className="px-2 py-1 hover:text-lime-400">
        →
      </a>
      <span className="mx-1 h-4 w-px bg-white/30" />
      <a
        href={href("lang", lang === "en" ? "bn" : "en")}
        className={`rounded-full px-2 py-1 ${lang === "bn" ? "bg-lime-400 text-black" : "hover:text-lime-400"}`}
      >
        {lang === "bn" ? "বাংলা" : "EN"} <span className="opacity-60">(b)</span>
      </a>
      <a
        href={href("mono", mono ? "0" : "1")}
        className={`rounded-full px-2 py-1 ${mono ? "bg-lime-400 text-black" : "hover:text-lime-400"}`}
      >
        mono <span className="opacity-60">(m)</span>
      </a>
    </nav>
  );
}
