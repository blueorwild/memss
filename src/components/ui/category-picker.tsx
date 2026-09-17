"use client";

import { useMemo } from "react";
import type { Category } from "@/lib/db/queries";
import { Combobox } from "./combobox";

/** 最大层级（含根节点）：根-国家-省-市-自建 */
const MAX_DEPTH = 5;

/** 计算某类别深度（含自身） */
function depthOf(id: string, byId: Map<string, Category>): number {
  let d = 0;
  let cur = byId.get(id);
  while (cur) {
    d++;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return d;
}

/**
 * 类别级联选择器（类别即地点）：从根节点（MemSS）起逐级下钻，
 * 任意层级都可选中（可挂回忆），也可在任一层新建子类别（最多 5 级）。
 */
export default function CategoryPicker({
  categories,
  value,
  onChange,
  onRequestNew,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  onRequestNew: (parent: Category) => void;
}) {
  const { byId, childrenMap, root } = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const childrenMap = new Map<string, Category[]>();
    for (const c of categories) {
      if (!c.parentId) continue;
      const arr = childrenMap.get(c.parentId) ?? [];
      arr.push(c);
      childrenMap.set(c.parentId, arr);
    }
    return { byId, childrenMap, root: categories.find((c) => !c.parentId) ?? null };
  }, [categories]);

  // 当前选中项的祖先链（含根），用于决定各级默认选中
  const path = useMemo(() => {
    const ids: string[] = [];
    let cur = value ? byId.get(value) : undefined;
    while (cur) {
      ids.unshift(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return ids;
  }, [value, byId]);

  // 组装展示层级：以根为起点沿 path 逐级渲染（即使某层暂无子级，也保留该层以便「新建」）
  const levels = useMemo(() => {
    const arr: { parent: Category; options: Category[]; selected: string | null }[] = [];
    if (!root) return arr;
    let parent = root;
    let guard = 0;
    while (guard++ < MAX_DEPTH) {
      // 已达最大层级时，不再渲染下级类别选择框
      if (depthOf(parent.id, byId) >= MAX_DEPTH) break;
      const options = childrenMap.get(parent.id) ?? [];
      const idx = path.indexOf(parent.id);
      const selected = idx >= 0 ? (path[idx + 1] ?? null) : null;
      arr.push({ parent, options, selected });
      if (!selected) break;
      const next = byId.get(selected);
      if (!next) break;
      parent = next;
    }
    return arr;
  }, [root, childrenMap, path, byId]);

  if (!root) return null;

  return (
    <div className="space-y-2">
      {/* 根节点本身也可作为归属 */}
      <button
        type="button"
        onClick={() => onChange(root.id)}
        className={`min-h-9 rounded-full px-3.5 py-2 text-xs transition-colors sm:min-h-0 sm:py-1 ${
          value === root.id ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/10"
        }`}
      >
        {root.name}
      </button>

      {levels.map((lv) => {
        const canCreate = depthOf(lv.parent.id, byId) < MAX_DEPTH;
        return (
          <Combobox
            key={lv.parent.id}
            options={lv.options.map((c) => ({ value: c.id, label: c.name }))}
            value={lv.selected}
            onChange={(id) => onChange(id)}
            placeholder={`选择「${lv.parent.name}」下的类别`}
            emptyText="该层级暂无类别"
            footer={
              canCreate ? (
                <button
                  type="button"
                  onClick={() => onRequestNew(lv.parent)}
                  className="flex w-full items-center gap-1 rounded-md px-2.5 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  ＋ 在「{lv.parent.name}」下新建
                </button>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
