import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ← build 時に ESLint エラーを無視
  },
};

export default nextConfig;
