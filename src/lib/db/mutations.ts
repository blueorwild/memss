import { promises as fs } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { categories, media, memories } from "./schema";
import type { Memory } from "./schema";
import { getCategory } from "./queries";
import { isRootCategory } from "../category-path";

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

/** 更新类别（改名 / 改父级 / 重排）；调用方需先完成防环、深度与重名校验 */
export function updateCategory(
  id: string,
  patch: { name?: string; parentId?: string; sortOrder?: number },
): void {
  const set: { name?: string; parentId?: string; sortOrder?: number } = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.parentId !== undefined) set.parentId = patch.parentId;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
  // 空 patch 会被 drizzle 拒绝，直接跳过
  if (Object.keys(set).length === 0) return;
  db.update(categories).set(set).where(eq(categories.id, id)).run();
}

/**
 * 重算某类别子树内所有回忆的 location。
 * location 由类别路径派生（去掉根节点），改名 / 移动后必须重算，否则与面包屑不一致。
 * 返回受影响的回忆条数。
 */
export function resyncSubtreeLocation(rootId: string): number {
  const subtreeIds = collectSubtree(rootId);
  if (subtreeIds.length === 0) return 0;
  const mems = db
    .select()
    .from(memories)
    .where(inArray(memories.categoryId, subtreeIds))
    .all();
  if (mems.length === 0) return 0;

  // 一次性载入类别表，避免逐条查路径
  const all = db.select().from(categories).all();
  const byId = new Map(all.map((c) => [c.id, c]));
  const locationOf = (categoryId: string): string | null => {
    const names: string[] = [];
    let cur = byId.get(categoryId);
    while (cur) {
      if (!isRootCategory(cur)) names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return names.length > 0 ? names.join(" / ") : null;
  };

  for (const m of mems) {
    db.update(memories)
      .set({ location: locationOf(m.categoryId) })
      .where(eq(memories.id, m.id))
      .run();
  }
  return mems.length;
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

/** 更新回忆的标量字段（不含媒体增删，媒体由 PATCH 路由单独处理） */
export function updateMemory(
  id: string,
  patch: Partial<
    Pick<Memory, "title" | "categoryId" | "date" | "description" | "location" | "coverMediaId">
  >,
): void {
  db.update(memories).set(patch).where(eq(memories.id, id)).run();
}

/** 删除若干媒体记录及其物理文件（文件缺失不影响） */
export async function deleteMediaByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = db.select().from(media).where(inArray(media.id, ids)).all();
  for (const a of rows) {
    const abs = resolveMediaPath(a.path);
    if (abs) await fs.rm(abs, { force: true }).catch(() => {});
  }
  db.delete(media).where(inArray(media.id, ids)).run();
}

/** 按给定顺序重排媒体（数组下标即 sortOrder），用于图片顺序与封面归一化 */
export function setMediaOrder(ids: string[]): void {
  for (let i = 0; i < ids.length; i++) {
    db.update(media).set({ sortOrder: i }).where(eq(media.id, ids[i])).run();
  }
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
