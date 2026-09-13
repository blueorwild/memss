import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { categories, conversations, media, memories, messages, settings } from "./schema";
import type { Category, Conversation, Media, Memory, Message } from "./schema";

export type { Category, Media, Memory };

export type MemoryWithMedia = Memory & { media: Media[] };
export type CategoryWithCount = Category & { memoryCount: number };
export type MemoryCard = Memory & { cover: string | null };

export function getMemoryWithMedia(id: string): MemoryWithMedia | null {
  const memory = db.select().from(memories).where(eq(memories.id, id)).get();
  if (!memory) return null;
  const assets = db
    .select()
    .from(media)
    .where(eq(media.memoryId, id))
    .orderBy(asc(media.sortOrder))
    .all();
  return { ...memory, media: assets };
}

export function listMemories(): Memory[] {
  return db.select().from(memories).orderBy(desc(memories.date)).all();
}

export function listCategories(): Category[] {
  return db.select().from(categories).orderBy(asc(categories.sortOrder)).all();
}

export function getCategory(id: string): Category | null {
  return db.select().from(categories).where(eq(categories.id, id)).get() ?? null;
}

export function getChildren(categoryId: string): Category[] {
  return db
    .select()
    .from(categories)
    .where(eq(categories.parentId, categoryId))
    .orderBy(asc(categories.sortOrder))
    .all();
}

export function getMemoriesByCategory(categoryId: string): Memory[] {
  return db
    .select()
    .from(memories)
    .where(eq(memories.categoryId, categoryId))
    .orderBy(asc(memories.date))
    .all();
}

export function listMemoryCards(categoryId: string): MemoryCard[] {
  const mems = getMemoriesByCategory(categoryId);
  if (mems.length === 0) return [];
  const assets = db
    .select()
    .from(media)
    .where(inArray(media.memoryId, mems.map((m) => m.id)))
    .orderBy(asc(media.sortOrder))
    .all();
  const coverMap = new Map<string, string>();
  for (const a of assets) {
    if (a.type === "image" && !coverMap.has(a.memoryId)) coverMap.set(a.memoryId, a.path);
  }
  return mems.map((m) => ({ ...m, cover: coverMap.get(m.id) ?? null }));
}

export function getSubtreeMemoryCounts(): Map<string, number> {
  const cats = db.select().from(categories).all();
  const mems = db.select().from(memories).all();

  const childrenMap = new Map<string, string[]>();
  for (const c of cats) {
    if (!c.parentId) continue;
    const arr = childrenMap.get(c.parentId) ?? [];
    arr.push(c.id);
    childrenMap.set(c.parentId, arr);
  }

  const directCount = new Map<string, number>();
  for (const m of mems) {
    directCount.set(m.categoryId, (directCount.get(m.categoryId) ?? 0) + 1);
  }

  const result = new Map<string, number>();
  const count = (id: string): number => {
    const cached = result.get(id);
    if (cached !== undefined) return cached;
    let total = directCount.get(id) ?? 0;
    for (const child of childrenMap.get(id) ?? []) total += count(child);
    result.set(id, total);
    return total;
  };
  for (const c of cats) count(c.id);
  return result;
}

export function getChildrenWithCounts(categoryId: string): CategoryWithCount[] {
  const counts = getSubtreeMemoryCounts();
  return getChildren(categoryId).map((c) => ({
    ...c,
    memoryCount: counts.get(c.id) ?? 0,
  }));
}

export function getBreadcrumb(pathIds: string[]): Category[] {
  if (pathIds.length === 0) return [];
  const rows = db
    .select()
    .from(categories)
    .where(inArray(categories.id, pathIds))
    .all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  return pathIds.map((id) => byId.get(id)).filter((c): c is Category => Boolean(c));
}

export function getCategoryPath(categoryId: string): Category[] {
  const all = db.select().from(categories).all();
  const byId = new Map(all.map((c) => [c.id, c]));
  const path: Category[] = [];
  let cur = byId.get(categoryId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

// ---------- 对话会话 ----------

export function listConversations(): Conversation[] {
  return db.select().from(conversations).orderBy(desc(conversations.updatedAt)).all();
}

export function getConversation(id: string): Conversation | null {
  return db.select().from(conversations).where(eq(conversations.id, id)).get() ?? null;
}

export function createConversation(title: string): Conversation {
  const now = Date.now();
  const row = { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now };
  db.insert(conversations).values(row).run();
  return row;
}

export function touchConversation(id: string, title?: string): void {
  const patch: { updatedAt: number; title?: string } = { updatedAt: Date.now() };
  if (title !== undefined) patch.title = title;
  db.update(conversations).set(patch).where(eq(conversations.id, id)).run();
}

export function listMessages(conversationId: string): Message[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .all();
}

export function addMessage(conversationId: string, role: string, content: string): Message {
  const row = { id: crypto.randomUUID(), conversationId, role, content, createdAt: Date.now() };
  db.insert(messages).values(row).run();
  return row;
}

/** 多选删除会话（连带其消息） */
export function deleteConversations(ids: string[]): void {
  if (ids.length === 0) return;
  db.delete(messages).where(inArray(messages.conversationId, ids)).run();
  db.delete(conversations).where(inArray(conversations.id, ids)).run();
}

/** 一键清空全部会话与消息 */
export function clearConversations(): void {
  db.delete(messages).run();
  db.delete(conversations).run();
}

// ---------- 键值设置 ----------

export function getSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}
