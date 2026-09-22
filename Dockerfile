# syntax=docker/dockerfile:1

# ---------- 依赖（含 better-sqlite3 的 native 编译兜底） ----------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# better-sqlite3 优先用预编译包；国内网络拉不到时回退到 node-gyp，故装编译工具
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci \
  && rm -rf /var/lib/apt/lists/*

# ---------- 构建 ----------
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next 会把 .env 拷进 standalone（运行时读环境变量用）；我们由 compose 的 env_file 注入，
# 镜像里不需要它，显式删掉以免本机密钥被打进镜像
RUN npm run build \
  && rm -f .next/standalone/.env

# ---------- 运行 ----------
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data /media \
  && chown nextjs:nodejs /data /media

# standalone 输出（精简 node_modules + server.js）+ 静态资源
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# better-sqlite3 是 native 模块，standalone 的文件追踪可能漏掉 .node 与 migrator 子路径，显式覆盖
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

# 建表脚本 / SQL / seed（首次初始化用 `docker compose exec app node scripts/seed.mjs`）
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs
EXPOSE 3000

# 先建表（幂等）再启动；DATABASE_URL/MEDIA_ROOT 由 compose 注入
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
