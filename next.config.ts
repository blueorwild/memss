import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 容器部署：只输出运行时必需文件（.next/standalone），镜像更小、启动更快
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // standalone 会把「被追踪到的文件」按项目根结构拷进 .next/standalone。
  // 数据库、媒体与密钥绝不能进镜像（Docker 侧还有 .dockerignore 兜底，这里是双保险）。
  outputFileTracingExcludes: {
    "*": ["./data/**", "./media/**", "./.env", "./.env.*", "./*.md", "./tsconfig.tsbuildinfo"],
  },
};

export default nextConfig;
