import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, memories } from "@/lib/db/schema";

export const runtime = "nodejs";

/** 媒体文件根目录（与 /api/media 路由一致） */
const MEDIA_ROOT = path.join(process.cwd(), "media");

/** 把 media 相对路径解析为绝对路径，并校验不越出 media 根目录（防路径穿越） */
function resolveMediaPath(rel: string): string | null {
  const abs = path.resolve(MEDIA_ROOT, rel);
  const root = path.resolve(MEDIA_ROOT) + path.sep;
  if (!abs.startsWith(root)) return null;
  return abs;
}

/** DELETE /api/memories/[id]：删除一条回忆及其媒体记录与物理文件 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const memory = db.select().from(memories).where(eq(memories.id, id)).get();
  if (!memory) {
    return Response.json({ error: "回忆不存在" }, { status: 404 });
  }

  const assets = db.select().from(media).where(eq(media.memoryId, id)).all();

  // 先删物理文件：单个失败不影响整体（文件可能已不存在）
  for (const a of assets) {
    const abs = resolveMediaPath(a.path);
    if (abs) await fs.rm(abs, { force: true }).catch(() => {});
  }

  // 再删数据库记录
  db.delete(media).where(eq(media.memoryId, id)).run();
  db.delete(memories).where(eq(memories.id, id)).run();

  return Response.json({ ok: true });
}
