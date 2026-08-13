/**
 * PROTOTYPE — throwaway route for `.wayfinder/takeoff/tickets/10-the-design-system.md`.
 *
 * Three variants of the takeoff working surface, switchable via `?variant=`
 * (plus `?lang=` and `?density=`), on `/prototype/design-system`. Sub-shape B:
 * there is no existing page to host them — `src/app/` holds a layout, a home
 * page and a login form, which is the fact that made this ticket exist.
 *
 * No auth, no tRPC, no database: the fixture is static so the prototype runs on
 * a machine with no Postgres. Nothing here is production code — see README.md.
 */

import { PrototypeShell } from "./shell";
import type { Density } from "./density";
import type { Lang } from "./format";

export const metadata = { title: "Vextrus — design system prototype" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const variant = one("variant") ?? "A";
  const lang: Lang = one("lang") === "bn" ? "bn" : "en";
  const raw = one("density");
  const density: Density =
    raw === "relaxed" || raw === "dense" || raw === "default" ? raw : "default";

  return <PrototypeShell initialVariant={variant} initialLang={lang} initialDensity={density} />;
}
