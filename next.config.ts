import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hides Next's dev-only route indicator (the floating "N" badge). It never
  // renders in a production build anyway, but staff use the dev server on the
  // LAN during setup and it sits on top of the UI.
  devIndicators: false,
  // Next blocks cross-origin requests to dev-only assets by default, and the
  // LAN address counts as cross-origin. Without this the server-rendered HTML
  // still arrives, so the page looks almost right — but every JS chunk and the
  // HMR socket are refused, nothing hydrates, and the symptom is a dead top bar
  // and client-only panels (the WhatsApp widget) that never appear at all.
  // The subnet wildcard is here because the Mac's address is handed out by
  // DHCP: pinning the exact host means the CRM silently breaks for everyone
  // else the next time the router reassigns it.
  allowedDevOrigins: ["192.168.31.75", "192.168.31.*", "192.168.*.*"],
  // Pins the workspace root to this project — without it, Turbopack can
  // pick up a stray package-lock.json in a parent directory (e.g. the
  // user's home folder from an unrelated project) and misdetect the root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
