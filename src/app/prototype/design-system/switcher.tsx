"use client";

/** PROTOTYPE — ticket 10. Floating variant switcher; never ships (see the NODE_ENV gate below). */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export interface VariantInfo {
  key: string;
  name: string;
}

export function VariantSwitcher({
  variants,
  current,
}: {
  variants: VariantInfo[];
  current: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    if (!next) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next.key);
    router.replace(`?${params.toString()}`);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, variants, searchParams, router]);

  if (process.env.NODE_ENV === "production") return null;

  const active = variants[index];

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-400 bg-black px-4 py-2 text-white shadow-lg">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => go(-1)}
        className="px-2 text-lg leading-none hover:text-amber-400"
      >
        ←
      </button>
      <span className="font-mono text-xs tracking-wide">
        {active?.key} — {active?.name}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => go(1)}
        className="px-2 text-lg leading-none hover:text-amber-400"
      >
        →
      </button>
    </div>
  );
}
