import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Transformers.js / ONNX WASM multi-threading in Chrome.
  // SharedArrayBuffer requires these Cross-Origin isolation headers.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },

  // Required to silence Turbopack error when no turbopack config is present
  turbopack: {},
};

export default nextConfig;
