import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone/server.js with only the node_modules it needs, which
  // is what the App Service startup command (`node server.js`) runs. See
  // .github/workflows/deploy.yml.
  output: "standalone",
};

export default nextConfig;
