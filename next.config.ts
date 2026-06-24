import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required to silence Turbopack error when no turbopack config is present
  turbopack: {},
};

export default nextConfig;
