import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pnpm verify` builds cold into its own directory (ADR-0007) so a running `next dev` and the
  // verify build never share state; the default `.next` is what `pnpm dev`/`pnpm build` use.
  distDir: process.env.VEXTRUS_NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
