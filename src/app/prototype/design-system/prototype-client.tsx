"use client";

/**
 * PROTOTYPE — ticket 10. Client half of the route: `useSearchParams` needs a
 * Suspense boundary above it to prerender, so the server page owns that and
 * this owns the switching.
 *
 * `mono` renders the whole variant through a greyscale filter. That is not a
 * gimmick: `quantity-contract.md` §6 forbids the certificate being carried by
 * colour alone, and this is the cheapest possible proof — flip it and read.
 */

import { useSearchParams } from "next/navigation";
import { VariantSwitcher, type VariantInfo } from "./switcher";
import { VariantA } from "./variant-a";
import { VariantB } from "./variant-b";
import { VariantC } from "./variant-c";

const variants: VariantInfo[] = [
  { key: "A", name: "Drafting Table" },
  { key: "B", name: "Instrument Console" },
  { key: "C", name: "The Docket" },
];

export function DesignSystemPrototypeClient() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";
  const lang = searchParams.get("lang") === "bn" ? "bn" : "en";
  const mono = searchParams.get("mono") === "1";

  return (
    <>
      <div style={mono ? { filter: "grayscale(1) contrast(1.05)" } : undefined}>
        {variant === "B" ? (
          <VariantB lang={lang} />
        ) : variant === "C" ? (
          <VariantC lang={lang} />
        ) : (
          <VariantA lang={lang} />
        )}
      </div>
      <VariantSwitcher variants={variants} current={variant} lang={lang} mono={mono} />
    </>
  );
}
