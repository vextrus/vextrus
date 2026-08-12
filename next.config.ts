import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pnpm verify`'s build stage points this at its own directory so it never
  // fights a running `next dev` for `.next`, and can be deleted for a cold build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
