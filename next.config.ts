import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "s3proxygw.cineplexx.at",
        protocol: "https",
      },
    ],
  },
  output: "standalone",
};

export default nextConfig;
