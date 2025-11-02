import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lumo-creator.aasciihub.com",
        pathname: "/**"
      },
    ],
  },
};

export default nextConfig;
