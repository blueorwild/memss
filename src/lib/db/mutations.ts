import { promises as fs } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { categories, media, memories } from "./schema";
import { getCategory } from "./queries";

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
export function collectSubtree(rootId: string): string[] {
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

/** 删除一条回忆及其媒体记录与物理文件；文件缺失不影响 */
export async function deleteMemoryById(id: string): Promise<boolean> {
  const memory = db.select().from(memories).where(eq(memories.id, id)).get();
  if (!memory) return false;

  const assets = db.select().from(media).where(eq(media.memoryId, id)).all();
  for (const a of assets) {
    const abs = resolveMediaPath(a.path);
    if (abs) await fs.rm(abs, { force: true }).catch(() => {});
  }

  db.delete(media).where(eq(media.memoryId, id)).run();
  db.delete(memories).where(eq(memories.id, id)).run();
  return true;
}

export type CategoryDeleteResult =
  | { ok: true; mode: "purge" | "move"; affectedMemories: number; deletedCategories: number }
  | { ok: false; error: string };

/**
 * 删除类别：
 * - purge：级联删除子树类别，并一并遗忘其下所有回忆（含媒体文件）
 * - move：把子树下所有回忆迁移到父类别后，再删除子树类别
 * 根类别（无 parent）不可删除。
 */
export async function deleteCategoryById(
  id: string,
  mode: "purge" | "move",
): Promise<CategoryDeleteResult> {
  const cat = getCategory(id);
  if (!cat) return { ok: false, error: "类别不存在" };
  if (!cat.parentId) return { ok: false, error: "根类别不可删除" };

  const subtreeIds = collectSubtree(id);
  const mems = db
    .select()
    .from(memories)
    .where(inArray(memories.categoryId, subtreeIds))
    .all();
  const affectedMemories = mems.length;

  if (mode === "move") {
    db.update(memories)
      .set({ categoryId: cat.parentId })
      .where(inArray(memories.categoryId, subtreeIds))
      .run();
  } else if (mems.length > 0) {
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

  db.delete(categories).where(inArray(categories.id, subtreeIds)).run();
  return { ok: true, mode, affectedMemories, deletedCategories: subtreeIds.length };
}
