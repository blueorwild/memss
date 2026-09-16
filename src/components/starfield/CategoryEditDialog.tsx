"use client";

import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import type { Category } from "@/lib/db/queries";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white outline-none placeholder:text-white/35 focus:border-white/30 sm:text-sm";
const btnCls =
  "rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10";
const primaryCls =
  "rounded-full bg-indigo-500/80 px-5 py-2.5 text-sm text-white transition-colors hover:bg-indigo-500 disabled:opacity-40";

/** 类别完整路径（含根「地球」），用于父级下拉的显示文案 */
function pathLabel(id: string, byId: Map<string, Category>): string {
  const names: string[] = [];
  let cur = byId.get(id);
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return names.join(" / ");
}

/** 收集某类别及其全部后代 id（父级候选需排除，防止把类别移入自身子树） */
function subtreeIds(rootId: string, byId: Map<string, Category>): Set<string> {
  const children = new Map<string, string[]>();
  for (const c of byId.values()) {
    if (!c.parentId) continue;
    const arr = children.get(c.parentId) ?? [];
    arr.push(c.id);
    children.set(c.parentId, arr);
  }
  const ids = new Set<string>();
  const walk = (id: string) => {
    ids.add(id);
    for (const child of children.get(id) ?? []) walk(child);
  };
  walk(rootId);
  return ids;
}

/**
 * 编辑当前类别：改名 / 移动到其它父级。
 * 打开时拉取全部类别用于父级选择（排除自身子树）；保存后由父组件刷新路由。
 */
export default function CategoryEditDialog({
  current,
  open,
  onOpenChange,
  onSaved,
}: {
  current: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** newPath：移动到新父级后的完整 id 路径（改名或未移动时为 null） */
  onSaved: (newPath: string[] | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <CategoryEditForm
            current={current}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryEditForm({
  current,
  onSaved,
  onCancel,
}: {
  current: Category;
  onSaved: (newPath: string[] | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(current.name);
  const [parentId, setParentId] = useState(current.parentId ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 拉取全部分类，用于父级候选（异步 setState，避免同步 set-state-in-effect）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = (await (await fetch("/api/categories")).json()) as Category[];
        if (alive) setCategories(list);
      } catch {
        /* 拉取失败则父级不可改，仅能改名 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const parentOptions = useMemo(() => {
    if (byId.size === 0) return [];
    const excluded = subtreeIds(current.id, byId);
    return categories
      .filter((c) => !excluded.has(c.id))
      .map((c) => ({ value: c.id, label: pathLabel(c.id, byId) }));
  }, [categories, byId, current.id]);
  const currentParentLabel = parentId && byId.has(parentId) ? pathLabel(parentId, byId) : "选择上级分类";

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写类别名称");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, parentId }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "保存失败");
      }
      // 移动到新父级后 URL（按 id 组织）会失效，需给出新的完整路径
      let newPath: string[] | null = null;
      if (parentId !== (current.parentId ?? "")) {
        const ids: string[] = [current.id];
        let cur = byId.get(parentId);
        while (cur) {
          ids.unshift(cur.id);
          cur = cur.parentId ? byId.get(cur.parentId) : undefined;
        }
        // 祖先链解析成功才跳转（拉取失败时退回刷新）
        if (ids.length >= 2) newPath = ids;
      }
      onSaved(newPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      setSaving(false);
    }
  }

  return (
    <>
      <DialogTitle>编辑「{current.name}」</DialogTitle>
      <DialogDescription>修改名称，或移动到其它分类下。</DialogDescription>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] text-white/45">名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="类别名称"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/45">
            上级分类
            {parentOptions.length > 0 && (
              <span className="text-white/25">（共 {parentOptions.length} 项）</span>
            )}
          </label>
          {/*
            内联可折叠选择器：刻意不用 Portal 型 Popover/Combobox。
            Radix Dialog 的 modal 模式会给 body 设 pointer-events:none 并捕获焦点，
            且 Popover 的 z-[80] 低于弹层的 z-[91]，浮层会被弹层盖住导致点不到。
          */}
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={parentOptions.length === 0}
            aria-expanded={pickerOpen}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-base text-white outline-none transition-colors hover:border-white/25 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:text-sm"
          >
            <span className={parentId ? "truncate" : "truncate text-white/35"}>
              {currentParentLabel}
            </span>
            <span aria-hidden className="shrink-0 text-white/40">
              {pickerOpen ? "⌃" : "⌄"}
            </span>
          </button>

          {pickerOpen && parentOptions.length > 0 && (
            <Command
              filter={(value, search) => (value.includes(search) ? 1 : 0)}
              className="mt-2 rounded-lg border border-white/15 bg-white/5"
            >
              <Command.Input
                autoFocus
                placeholder="搜索…"
                className="w-full rounded-t-lg border-b border-white/10 bg-transparent px-3 py-2 text-base text-white outline-none placeholder:text-white/35 sm:text-sm"
              />
              <Command.List className="max-h-52 overflow-y-auto overscroll-contain p-1">
                <Command.Empty className="px-2 py-3 text-center text-xs text-white/40">
                  无匹配分类
                </Command.Empty>
                {parentOptions.map((o) => (
                  <Command.Item
                    key={o.value}
                    value={o.label}
                    onSelect={() => {
                      setParentId(o.value);
                      setPickerOpen(false);
                    }}
                    className="cursor-pointer rounded-md px-2.5 py-2.5 text-sm text-white/80 data-[selected=true]:bg-white/15 data-[selected=true]:text-white"
                  >
                    {o.label}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onCancel}>
          取消
        </button>
        <button type="button" className={primaryCls} onClick={submit} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </>
  );
}
