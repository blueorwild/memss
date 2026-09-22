import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 健康检查（给容器 healthcheck 与 Cloudflare 用，不做登录门禁）。
 * 进程活着且数据库可读才算健康。
 */
export async function GET() {
  try {
    db.run(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
