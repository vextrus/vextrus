"use client";

/**
 * PROTOTYPE — ticket 10. Client half of the route: `useSearchParams` needs a
 * Suspense boundary above it to prerender, so the server page owns that and
 * this owns the axes and the one piece of live state (which subject is under
 * judgement — shared across shells so switching shells does not lose your
 * place, which is exactly the comparison the ticket needs).
 *
 * `mono` renders the whole shell through a greyscale filter. That is not a
 * gimmick: `quantity-contract.md` §6 forbids the certificate being carried by
 * colour alone, and this is the cheapest possible proof — flip it and read.
 * All three shells and all three surfaces must survive it.
 */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { queue } from "./fixtures";
import { ShellDocket } from "./shell-docket";
import { ShellSplit } from "./shell-split";
import { ShellStage } from "./shell-stage";
import { VariantSwitcher } from "./switcher";
import { theme, type Density, type Lang, type Shell, type Surface } from "./theme";

const surfaceKeys: Surface[] = ["paper", "slate", "duo"];
const shellKeys: Shell[] = ["split", "stage", "docket"];

function pick<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function DesignSystemPrototypeClient() {
  const searchParams = useSearchParams();
  const surface = pick(searchParams.get("surface"), surfaceKeys, "paper");
  const shell = pick(searchParams.get("shell"), shellKeys, "split");
  const density: Density = searchParams.get("density") === "comfortable" ? "comfortable" : "compact";
  const lang: Lang = searchParams.get("lang") === "bn" ? "bn" : "en";
  const mono = searchParams.get("mono") === "1";

  const t = theme(surface, shell, density, lang);

  const [selectedId, setSelectedId] = useState(queue[0]?.id ?? "");
  const [docOpen, setDocOpen] = useState(false);

  /* j / k walk the queue in every shell, not just the docket: comparing shells
     means doing the same act in each. `a` / `d` are stubs — a prototype may not
     mutate a register (SKILL.md), so they only advance. */
  const move = useCallback((delta: number) => {
    setSelectedId((current) => {
      const at = queue.findIndex((q) => q.id === current);
      const next = queue[Math.min(queue.length - 1, Math.max(0, at + delta))];
      return next?.id ?? current;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "j") move(1);
      if (e.key === "k") move(-1);
      if (e.key === "a" || e.key === "d") move(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  return (
    <>
      <div style={mono ? { filter: "grayscale(1) contrast(1.05)" } : undefined}>
        {shell === "stage" ? (
          <ShellStage
            t={t}
            selectedId={selectedId}
            onSelect={setSelectedId}
            docOpen={docOpen}
            onToggleDoc={() => setDocOpen((v) => !v)}
          />
        ) : shell === "docket" ? (
          <ShellDocket t={t} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <ShellSplit t={t} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>
      <VariantSwitcher
        surface={surface}
        shell={shell}
        density={density}
        lang={lang}
        mono={mono}
      />
    </>
  );
}
