import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kit packages are consumed as TypeScript source via file: deps
  transpilePackages: ["@kit/logger", "@kit/claude"],
  // scoring.config.yaml is read with fs at runtime; without this it would be
  // missing from the serverless function bundle on Vercel (ENOENT).
  outputFileTracingIncludes: {
    "/api/leads": ["./scoring.config.yaml"],
  },
};

export default nextConfig;
