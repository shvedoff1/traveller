import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Dev proxy: the browser talks same-origin to /api/*, Next forwards to
    // the NestJS API. In production a reverse proxy plays this role.
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/:path*",
      },
    ];
  },
};

export default nextConfig;
