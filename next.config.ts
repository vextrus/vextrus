import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pnpm verify` builds cold into its own directory (ADR-0007) so a running `next dev` and the
  // verify build never share state; the default `.next` is what `pnpm dev`/`pnpm build` use.
  distDir: process.env.VEXTRUS_NEXT_DIST_DIR ?? ".next",
  // Inside the verify lane only (issue #91): the lane's `typegen → typecheck` stages already
  // checked Next's generated route validator, so the build's second type check is skipped
  // (measured 2–4 s). `pnpm build` keeps Next's own check — the flag is off without the env.
  typescript: { ignoreBuildErrors: Boolean(process.env.VEXTRUS_NEXT_DIST_DIR) },
};

export default nextConfig;
