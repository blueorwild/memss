"use client";

import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import type { Category } from "@/lib/db/queries";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

type Country = { code: string; name: string };
type Province = { name: string; cities: string[] };

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white outline-none placeholder:text-white/35 focus:border-white/30 sm:text-sm";
const btnCls =
  "rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10";
const primaryCls =
  "rounded-full bg-accent-deep/80 px-5 py-2.5 text-sm text-white transition-colors hover:bg-accent-deep";

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
 * 新建子类别弹层：名称可自由输入，并按父层级提供 geo 标准名候选
 * （地球下=世界国家；中国下=省；中国省下=市；其他层级仅自由输入）。
 * 这里只生成「草稿类别」交给父组件，真正落库推迟到提交上传时。
 * 候选用内联搜索列表（cmdk），避免与 Dialog 的焦点陷阱冲突。
 */
export default function NewCategoryDialog({
  parent,
  categories,
  open,
  onOpenChange,
  onCreated,
}: {
  parent: Category | null;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (draft: Category) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {parent && (
          <NewCategoryForm
            parent={parent}
            categories={categories}
            onCreated={onCreated}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewCategoryForm({
  parent,
  categories,
  onCreated,
  onCancel,
}: {
  parent: Category;
  categories: Category[];
  onCreated: (draft: Category) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // 依据父层级懒加载候选名称（异步 setState）
  useEffect(() => {
    let alive = true;
    const depth = depthOf(parent.id, byId);
    const grand = parent.parentId ? byId.get(parent.parentId) : undefined;

    (async () => {
      try {
        if (depth === 1) {
          const cs = (await (await fetch("/geo/countries.json")).json()) as Country[];
          if (alive) setCandidates(cs.map((c) => c.name));
        } else if (depth === 2 && parent.name.includes("中国")) {
          const cn = (await (await fetch("/geo/china.json")).json()) as Province[];
          if (alive) setCandidates(cn.map((p) => p.name));
        } else if (depth === 3 && grand?.name.includes("中国")) {
          const cn = (await (await fetch("/geo/china.json")).json()) as Province[];
          const p = cn.find((x) => x.name === parent.name || x.name.startsWith(parent.name));
          if (alive && p) setCandidates(p.cities);
        }
      } catch {
        /* 候选加载失败则只能自由输入 */
      }
    })();

    return () => {
      alive = false;
    };
  }, [parent, byId]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写类别名称");
      return;
    }
    // 生成本地草稿（不落库），由父组件在提交上传时统一创建
    onCreated({
      id: `draft-${crypto.randomUUID()}`,
      parentId: parent.id,
      name: trimmed,
      kind: "custom",
      sortOrder: 1_000_000,
    });
    onCancel();
  }

  return (
    <>
      <DialogTitle>在「{parent.name}」下新建类别</DialogTitle>
      <DialogDescription>可直接输入名称，或从下面的标准名称中选择。</DialogDescription>

      {candidates.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] text-white/45">从标准名称选择（可选）</p>
          <Command
            filter={(value, search) => (value.includes(search) ? 1 : 0)}
            className="rounded-lg border border-white/15 bg-white/5"
          >
            <Command.Input
              placeholder="搜索…"
              className="w-full rounded-t-lg border-b border-white/10 bg-transparent px-3 py-2 text-base text-white outline-none placeholder:text-white/35 sm:text-sm"
            />
            <Command.List className="max-h-44 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-3 text-center text-xs text-white/40">
                无匹配名称
              </Command.Empty>
              {candidates.map((c) => (
                <Command.Item
                  key={c}
                  value={c}
                  onSelect={() => setName(c)}
                  className="cursor-pointer rounded-md px-2.5 py-2.5 text-sm text-white/80 data-[selected=true]:bg-white/15 data-[selected=true]:text-white"
                >
                  {c}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </div>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="类别名称"
        className={`${inputCls} mt-3`}
      />

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onCancel}>
          取消
        </button>
        <button type="button" className={primaryCls} onClick={submit}>
          创建
        </button>
      </div>
    </>
  );
}
