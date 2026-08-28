import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hides Next's dev-only route indicator (the floating "N" badge). It never
  // renders in a production build anyway, but staff use the dev server on the
  // LAN during setup and it sits on top of the UI.
  devIndicators: false,
  // Pins the workspace root to this project — without it, Turbopack can
  // pick up a stray package-lock.json in a parent directory (e.g. the
  // user's home folder from an unrelated project) and misdetect the root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
