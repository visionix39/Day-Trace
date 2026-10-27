import type { NextConfig } from "next";

/**
 * The page is prerendered and served from Vercel's CDN. Your notebook - the
 * SQLite database, search, the offline rules - lives in the browser. The only
 * server code is two small serverless functions in src/app/api, which hold
 * the free Groq key and pass a note to the AI and the answer back. They don't
 * store anything.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets a second dev server (e.g. one testing other settings) build into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  webpack(config, { isServer }) {
    // Lets the app `import schema from "../../data/schema.sql"` as a plain
    // string, so that file stays the one source of truth for the tables.
    config.module.rules.push({ test: /\.sql$/, type: "asset/source" });
    // sql.js ships one build for Node and browsers; in the browser it never
    // touches these Node modules, so tell webpack not to look for them.
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    // transformers.js (in-browser search) has optional Node-only parts we never use.
    config.resolve.alias = { ...config.resolve.alias, sharp$: false, "onnxruntime-node$": false };
    return config;
  },
};

export default nextConfig;
