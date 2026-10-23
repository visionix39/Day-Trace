import type { NextConfig } from "next";

/**
 * DayTrace has no server of its own. `next build` prerenders the page and
 * Vercel serves it from the CDN. Everything that touches your notes - the
 * SQLite database, the rule-based extractor and the AI calls - runs in the
 * browser, so your unfinished business never sits on a machine we run.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack(config, { isServer }) {
    // Lets the app `import schema from "../../data/schema.sql"` as a plain
    // string, so that file stays the one source of truth for the tables.
    config.module.rules.push({ test: /\.sql$/, type: "asset/source" });
    // sql.js ships one build for Node and browsers; in the browser it never
    // touches these Node modules, so tell webpack not to look for them.
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    return config;
  },
};

export default nextConfig;
