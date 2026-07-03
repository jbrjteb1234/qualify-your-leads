import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kit packages are consumed as TypeScript source via file: deps
  transpilePackages: ["@kit/logger", "@kit/claude"],
};

export default nextConfig;
