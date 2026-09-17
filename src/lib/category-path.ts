import type { Category } from "./db/queries";

/**
 * 根节点判定：类别树只有唯一一个无父节点的根（现名「MemSS」，曾用名「地球」/「memss」）。
 *
 * 一律用**结构**判断（`parentId === null`），**不要**再按名字比较——
 * 根节点改过名（地球 → memss → MemSS），按名字硬编码会让「去掉根节点」的逻辑静默失效
 * （例如记忆的 location 会变成「MemSS / 日本 / 东京」）。
 */
export function isRootCategory(c: { parentId: string | null }): boolean {
  return c.parentId === null;
}

/**
 * 类别 id → 完整路径名（含根节点，如「MemSS / 日本 / 东京」）。
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
