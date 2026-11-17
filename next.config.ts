import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Short install addresses: /area-chart serves /r/area-chart.json.
  async rewrites() {
    return [{ source: "/:name([a-z-]+)", destination: "/r/:name.json" }]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
