"use client";

/** PROTOTYPE — ticket 10. Client half of the switcher page (useSearchParams needs a Suspense boundary to prerender). */

import { useSearchParams } from "next/navigation";
import { VariantSwitcher, type VariantInfo } from "./switcher";
import { VariantA } from "./variant-a";
import { VariantB } from "./variant-b";

const variants: VariantInfo[] = [
  { key: "A", name: "Drafting Table" },
  { key: "B", name: "Instrument Console" },
];

export function DesignSystemPrototypeClient() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";

  return (
    <>
      {variant === "B" ? <VariantB /> : <VariantA />}
      <VariantSwitcher variants={variants} current={variant} />
    </>
  );
}
