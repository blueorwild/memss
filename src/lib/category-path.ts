import type { Category } from "./db/queries";

/**
 * 类别 id → 完整路径名（含根「地球」，如「地球 / 日本 / 东京」）。
 * 用迭代 + 记忆化，避免深层递归重复计算。供下拉/筛选的显示文案使用。
 */
export function categoryPathMap(categories: Category[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const memo = new Map<string, string>();
  const pathOf = (id: string): string => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const c = byId.get(id);
    if (!c) return "";
    const parent = c.parentId ? pathOf(c.parentId) : "";
    const full = [parent, c.name].filter(Boolean).join(" / ");
    memo.set(id, full);
    return full;
  };
  for (const c of categories) pathOf(c.id);
  return memo;
}
