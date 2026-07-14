import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server output for the production Docker image (self-contained
  // .next/standalone with a minimal node_modules).
  output: "standalone",
  // Pin the file-tracing root to the monorepo root so the standalone bundle
  // includes the hoisted (pnpm) node_modules and workspace packages. Keeps the
  // Docker copy paths deterministic (apps/web/.next/standalone/apps/web/...).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async rewrites() {
    // Dev proxy: the browser talks same-origin to /api/*, Next forwards to
    // the NestJS API. The prefix is preserved (the API serves under /api),
    // matching how Caddy forwards /api/* in production.
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
