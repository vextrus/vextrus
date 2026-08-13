"use client";

/**
 * PROTOTYPE — the switcher shell. State is React-local and mirrored into the
 * URL with the History API, so a variant is shareable and reload-stable
 * without a server round-trip on every keypress.
 */

import { useCallback, useEffect, useState } from "react";
import { PrototypeSwitcher } from "./switcher";
import type { Density } from "./density";
import type { Lang } from "./format";
import { VariantA, NAME as NAME_A } from "./variant-a-drafting-table";
import { VariantB, NAME as NAME_B } from "./variant-b-instrument";
import { VariantC, NAME as NAME_C } from "./variant-c-ledger";

const VARIANTS = {
  A: { name: NAME_A, Component: VariantA },
  B: { name: NAME_B, Component: VariantB },
  C: { name: NAME_C, Component: VariantC },
};
const KEYS = Object.keys(VARIANTS);

/**
 * Bangla needs its own face and a taller line box; discovering that after a
 * type scale is set is the expensive order (ticket 10 §6). The stack is
 * system-resolved on purpose — no webfont is fetched, so what you see is what
 * a Dhaka office machine actually has.
 */
const BN_STACK =
  "'Noto Sans Bengali', 'Kalpurush', 'SolaimanLipi', 'Nirmala UI', system-ui, sans-serif";

export function PrototypeShell({
  initialVariant,
  initialLang,
  initialDensity,
}: {
  initialVariant: string;
  initialLang: Lang;
  initialDensity: Density;
}) {
  const [variant, setVariant] = useState(initialVariant);
  const [lang, setLang] = useState<Lang>(initialLang);
  const [dens, setDens] = useState<Density>(initialDensity);
  const [grey, setGrey] = useState(false);

  const sync = useCallback((v: string, l: Lang, d: Density) => {
    const q = new URLSearchParams({ variant: v, lang: l, density: d });
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, []);

  useEffect(() => {
    sync(variant, lang, dens);
  }, [variant, lang, dens, sync]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const i = KEYS.indexOf(variant);
      const next = KEYS[(i + (e.key === "ArrowRight" ? 1 : -1) + KEYS.length) % KEYS.length];
      if (next) setVariant(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const active = VARIANTS[variant as keyof typeof VARIANTS] ?? VARIANTS.A;
  const Component = active.Component;

  return (
    <>
      <div
        lang={lang === "bn" ? "bn-BD" : "en"}
        style={{
          filter: grey ? "grayscale(1)" : undefined,
          fontFamily: lang === "bn" ? BN_STACK : undefined,
          // Bangla's ascender/descender load wants a taller line box than the
          // Latin scale; this is the whole finding, made visible in one line.
          lineHeight: lang === "bn" ? 1.75 : undefined,
        }}
      >
        <Component lang={lang} dens={dens} />
      </div>
      <PrototypeSwitcher
        variants={KEYS}
        current={variant}
        name={active.name}
        onVariant={setVariant}
        lang={lang}
        onLang={setLang}
        dens={dens}
        onDens={setDens}
        grey={grey}
        onGrey={setGrey}
      />
    </>
  );
}
