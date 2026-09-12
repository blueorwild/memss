"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Category } from "@/lib/db/queries";
import CategoryPicker from "@/components/ui/category-picker";
import NewCategoryDialog from "@/components/ui/new-category-dialog";

/** 从当前 URL 解析所处类别 id：/star/a/b → "b" */
function currentCategoryFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "star") return null;
  return parts[parts.length - 1] ?? null;
}

/** 输入框通用样式 */
const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30";

/** 文件选择框通用样式 */
const fileCls =
  "block w-full text-xs text-white/60 file:mr-2 file:rounded-full file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-white";

/**
 * 上传回忆表单：图片(多) / 音乐(单) / 标题 / 类别(级联=地点) / 时间 / 描述。
 * 新建类别先作为本地草稿，提交时才真正落库；未上传则不留痕迹。
 */
export default function UploadMemoryForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  const [serverCategories, setServerCategories] = useState<Category[]>([]);
  const [drafts, setDrafts] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新建类别弹层状态
  const [newParent, setNewParent] = useState<Category | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const imagesRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLInputElement | null>(null);

  // 服务端类别 + 本地草稿，合并后供级联选择
  const categories = useMemo(() => [...serverCategories, ...drafts], [serverCategories, drafts]);

  // location 由所选类别路径自动生成（去掉根「地球」）
  const locationText = useMemo(() => {
    if (!categoryId) return "";
    const byId = new Map(categories.map((c) => [c.id, c]));
    const names: string[] = [];
    let cur = byId.get(categoryId);
    while (cur) {
      names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return names.length > 1 ? names.slice(1).join(" / ") : names.join(" / ");
  }, [categories, categoryId]);

  // 载入类别列表，并默认选中「当前所处类别」
  useEffect(() => {
    let alive = true;
    fetch("/api/categories")
      .then((r) => r.json())
      .then((list: Category[]) => {
        if (!alive) return;
        setServerCategories(list);
        const cur = currentCategoryFromPath(pathname);
        setCategoryId(cur && list.some((c) => c.id === cur) ? cur : (list[0]?.id ?? ""));
      })
      .catch(() => {
        if (alive) setError("类别加载失败");
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  /** 新建类别（草稿）：加入本地列表并选中；提交时才落库 */
  function handleDraftCreated(draft: Category) {
    setDrafts((prev) => [...prev, draft]);
    setCategoryId(draft.id);
  }

  /** 创建类别：同级已存在同名则复用其 id */
  async function ensureCategory(parentId: string, name: string): Promise<string> {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, name }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (res.ok && data.id) return data.id;
    if (res.status === 409) {
      const list = (await (await fetch("/api/categories")).json()) as Category[];
      const found = list.find((c) => c.parentId === parentId && c.name === name);
      if (found) return found.id;
    }
    throw new Error(data.error ?? "新建类别失败");
  }

  /** 解析所选类别到根的链，把其中草稿依次落库，返回最终真实类别 id */
  async function resolveCategoryId(): Promise<string> {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const chain: Category[] = [];
    let cur = byId.get(categoryId);
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }

    let resolved = categoryId;
    let parentRealId: string | null = null;
    for (const cat of chain) {
      if (cat.id.startsWith("draft-")) {
        const realId = await ensureCategory(parentRealId ?? cat.parentId ?? "globe", cat.name);
        resolved = realId;
        parentRealId = realId;
      } else {
        resolved = cat.id;
        parentRealId = cat.id;
      }
    }
    return resolved;
  }

  /** 提交表单：先落库草稿类别，再以 multipart 发送到 /api/memories */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !categoryId) {
      setError("请填写标题并选择类别");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const finalCategoryId = await resolveCategoryId();

      const fd = new FormData();
      fd.set("title", title);
      fd.set("categoryId", finalCategoryId);
      fd.set("date", date);
      fd.set("location", locationText);
      fd.set("description", description);
      for (const f of Array.from(imagesRef.current?.files ?? [])) fd.append("images", f);
      const audio = audioRef.current?.files?.[0];
      if (audio) fd.append("audio", audio);

      const res = await fetch("/api/memories", { method: "POST", body: fd });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "上传失败");
      }
      // 刷新当前页，让新回忆出现在星空里
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <label className="block text-[11px] text-white/45">图片（可多选）</label>
        <input ref={imagesRef} type="file" accept="image/*" multiple className={fileCls} />

        <label className="block text-[11px] text-white/45">背景音乐（可选）</label>
        <input ref={audioRef} type="file" accept="audio/*" className={fileCls} />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（必填）"
          className={inputCls}
        />

        <label className="block text-[11px] text-white/45">类别（即地点）</label>
        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          onRequestNew={(parent) => {
            setNewParent(parent);
            setNewOpen(true);
          }}
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述"
          rows={3}
          className={`${inputCls} resize-none`}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="border-t border-white/10 p-3">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-indigo-500/80 py-2 text-sm text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
        >
          {submitting ? "上传中…" : "保存回忆"}
        </button>
      </div>

      <NewCategoryDialog
        parent={newParent}
        categories={categories}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={handleDraftCreated}
      />
    </form>
  );
}
