import type { NextConfig } from "next";

/**
 * DayTrace has no server of its own. `next build` prerenders the page and
 * Vercel serves it from the CDN. Everything that touches your notes - the
 * SQLite database, search, and (later) the AI calls - runs in the browser, so
 * your unfinished business never sits on a machine we run.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
