import { attachCovers, listCategories, listMemories } from "./db/queries";
import { isRootCategory } from "./category-path";
import type { Memory, MemoryCover } from "./db/queries";

/**
 * 回忆检索内核：Agent 工具与 /api/memories/search 共用，
 * 保证「对话里能搜到的，面板里也能搜到」（语义完全一致）。
 *
 * 关键词匹配范围：标题 / 描述 / location；类别含子树；日期为闭区间。
 */

/** 默认返回条数上限 */
export const SEARCH_DEFAULT_LIMIT = 30;
/** 返回条数硬上限（超出需缩小检索范围） */
export const SEARCH_MAX_LIMIT = 100;

export type MemorySearchFilters = {
  /** 关键词（匹配标题/描述/location） */
  query?: string;
  /** 限定类别 id（含其子类别） */
  categoryId?: string;
  /** 起始日期 YYYY-MM-DD（闭区间） */
  from?: string;
  /** 结束日期 YYYY-MM-DD（闭区间） */
  to?: string;
  /** 返回条数上限 */
  limit?: number;
};

/** 检索结果条目（含卡片封面，便于列表直接渲染缩略图） */
export type MemorySearchItem = {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  categoryId: string;
  /** 类别路径（去根节点），如「日本 / 东京」 */
  category: string;
  cover: MemoryCover | null;
};

export type MemorySearchResult = {
  /** 符合条件的总数（未截断） */
  total: number;
  /** 本次返回条数 */
  count: number;
  items: MemorySearchItem[];
};

/** 收集某类别子树内的全部回忆；不传类别则返回全部 */
export function collectMemories(categoryId?: string): Memory[] {
  const all = listMemories();
  if (!categoryId) return all;

  const cats = listCategories();
  const childrenMap = new Map<string, string[]>();
  for (const c of cats) {
    if (!c.parentId) continue;
    const arr = childrenMap.get(c.parentId) ?? [];
    arr.push(c.id);
    childrenMap.set(c.parentId, arr);
  }

  const ids = new Set<string>();
  const stack = [categoryId];
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const ch of childrenMap.get(id) ?? []) stack.push(ch);
  }
  return all.filter((m) => ids.has(m.categoryId));
}

/** 构建「类别 id → 路径名（去根节点）」映射，供检索结果附带地点/归属信息 */
export function buildCategoryPaths(): Map<string, string> {
  const cats = listCategories();
  const byId = new Map(cats.map((c) => [c.id, c]));
  const memo = new Map<string, string>();
  const pathOf = (id: string): string => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const c = byId.get(id);
    if (!c) return "";
    const parent = c.parentId ? pathOf(c.parentId) : "";
    const name = isRootCategory(c) ? "" : c.name;
    const full = [parent, name].filter(Boolean).join(" / ");
    memo.set(id, full);
    return full;
  };
  for (const c of cats) pathOf(c.id);
  return memo;
}

/** 按条件检索回忆：结果按日期由新到旧（无日期者置后），再按创建时间倒序 */
export function searchMemories(filters: MemorySearchFilters = {}): MemorySearchResult {
  const { query, categoryId, from, to } = filters;
  const pool = collectMemories(categoryId);
  const q = query?.trim().toLowerCase();

  const filtered = pool.filter((m) => {
    if (from && (!m.date || m.date < from)) return false;
    if (to && (!m.date || m.date > to)) return false;
    if (!q) return true;
    return [m.title, m.description, m.location].some((v) => v?.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    const ka = a.date ?? "";
    const kb = b.date ?? "";
    if (ka !== kb) {
      if (!ka) return 1;
      if (!kb) return -1;
      return ka < kb ? 1 : -1;
    }
    return b.createdAt - a.createdAt;
  });

  const rawLimit = filters.limit ?? SEARCH_DEFAULT_LIMIT;
  const limit = Math.min(Math.max(Math.floor(rawLimit) || SEARCH_DEFAULT_LIMIT, 1), SEARCH_MAX_LIMIT);
  const capped = sorted.slice(0, limit);

  const paths = buildCategoryPaths();
  const items: MemorySearchItem[] = attachCovers(capped).map((m) => ({
    id: m.id,
    title: m.title,
    date: m.date,
    location: m.location,
    categoryId: m.categoryId,
    category: paths.get(m.categoryId) ?? "",
    cover: m.cover,
  }));

  return { total: filtered.length, count: items.length, items };
}
