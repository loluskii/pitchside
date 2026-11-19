import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    // Crests and badges are generated SVGs served by /badge.
    unoptimized: true,
  },
};

export default nextConfig;
