import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "ais-dev-ksv6hknjvecsiddgvt5qmp-849891169209.europe-west2.run.app",
    "*.europe-west2.run.app",
    "*.run.app",
    "*.aistudio.google.com",
    "*.e2b.app",
    "localhost:3000",
  ],
};

export default nextConfig;
