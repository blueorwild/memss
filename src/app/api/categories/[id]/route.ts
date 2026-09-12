import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, media, memories } from "@/lib/db/schema";
import { getCategory } from "@/lib/db/queries";

export const runtime = "nodejs";

/** 媒体文件根目录（与 /api/media 路由一致） */
const MEDIA_ROOT = path.join(process.cwd(), "media");

/** 解析媒体相对路径并校验不越出 media 根目录（防路径穿越） */
function resolveMediaPath(rel: string): string | null {
  const abs = path.resolve(MEDIA_ROOT, rel);
  const root = path.resolve(MEDIA_ROOT) + path.sep;
  if (!abs.startsWith(root)) return null;
  return abs;
}

/** 收集某类别及其所有后代的 id */
function collectSubtree(rootId: string): string[] {
  const all = db.select().from(categories).all();
  const childrenMap = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    const arr = childrenMap.get(c.parentId) ?? [];
    arr.push(c.id);
    childrenMap.set(c.parentId, arr);
  }
  const ids: string[] = [];
  const walk = (id: string) => {
    ids.push(id);
    for (const child of childrenMap.get(id) ?? []) walk(child);
  };
  walk(rootId);
  return ids;
}

/**
 * DELETE /api/categories/[id]?mode=purge|move
 * - purge：级联删除子树类别，并一并遗忘其下所有回忆（含媒体文件）
 * - move：把子树下所有回忆迁移到父类别后，再删除子树类别
 * 根类别（无 parent）不可删除。
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mode = new URL(req.url).searchParams.get("mode") === "move" ? "move" : "purge";

  const cat = getCategory(id);
  if (!cat) {
    return Response.json({ error: "类别不存在" }, { status: 404 });
  }
  if (!cat.parentId) {
    return Response.json({ error: "根类别不可删除" }, { status: 400 });
  }

  const subtreeIds = collectSubtree(id);
  const mems = db
    .select()
    .from(memories)
    .where(inArray(memories.categoryId, subtreeIds))
    .all();
  const affectedMemories = mems.length;

  if (mode === "move") {
    // 迁移记忆到父类别（保留回忆与媒体）
    db.update(memories)
      .set({ categoryId: cat.parentId })
      .where(inArray(memories.categoryId, subtreeIds))
      .run();
  } else if (mems.length > 0) {
    // 一并遗忘：先删物理文件，再删媒体与回忆记录
    const assets = db
      .select()
      .from(media)
      .where(inArray(media.memoryId, mems.map((m) => m.id)))
      .all();
    for (const a of assets) {
      const abs = resolveMediaPath(a.path);
      if (abs) await fs.rm(abs, { force: true }).catch(() => {});
    }
    db.delete(media).where(inArray(media.memoryId, mems.map((m) => m.id))).run();
    db.delete(memories).where(inArray(memories.categoryId, subtreeIds)).run();
  }

  // 删除子树类别（含当前类别）
  db.delete(categories).where(inArray(categories.id, subtreeIds)).run();

  return Response.json({
    ok: true,
    mode,
    affectedMemories,
    deletedCategories: subtreeIds.length,
  });
}
