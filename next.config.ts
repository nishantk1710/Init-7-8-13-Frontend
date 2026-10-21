import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone/server.js with only the node_modules it needs, which
  // is what the App Service startup command (`node server.js`) runs. See
  // .github/workflows/deploy.yml.
  output: "standalone",
  experimental: {
    serverActions: {
      // The monthly ZMM065 upload (I13 Validation) goes through a Server
      // Action; the default 1 MB is smaller than one site's report (~3.4 MB).
      // Matches the backend's own 50 MB cap.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
