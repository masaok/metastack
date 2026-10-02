import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@metastack/content", "@metastack/srs"],
  reactStrictMode: true,
};

export default nextConfig;
