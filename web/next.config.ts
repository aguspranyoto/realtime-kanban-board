import type { NextConfig } from "next";

const getR2Host = () => {
  if (process.env.R2_PUBLIC_URL) {
    try {
      return new URL(process.env.R2_PUBLIC_URL).hostname;
    } catch {
      return "pub-970b2df171f941229fafcd5547165c37.r2.dev";
    }
  }
  return "pub-970b2df171f941229fafcd5547165c37.r2.dev";
};

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: getR2Host(),
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

