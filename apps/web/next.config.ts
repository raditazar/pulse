import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pulse/ui", "@pulse/types", "@pulse/solana", "@pulse/evm"],
};

export default nextConfig;

