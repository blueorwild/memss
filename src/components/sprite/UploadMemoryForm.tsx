"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Category } from "@/lib/db/queries";

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

/** 上传回忆表单：图片(多) / 音乐(单) / 标题 / 类别 / 时间 / 地点 / 描述 */
export default function UploadMemoryForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imagesRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLInputElement | null>(null);

  // 载入类别列表，并默认选中「当前所处类别」
  useEffect(() => {
    let alive = true;
    fetch("/api/categories")
      .then((r) => r.json())
      .then((list: Category[]) => {
        if (!alive) return;
        setCategories(list);
        const cur = currentCategoryFromPath(pathname);
        setCategoryId(cur && list.some((c) => c.id === cur) ? cur : list[0]?.id ?? "");
      })
      .catch(() => {
        if (alive) setError("类别加载失败");
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  /** 提交表单：以 multipart 发送到 /api/memories */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !categoryId) {
      setError("请填写标题并选择类别");
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.set("title", title);
    fd.set("categoryId", categoryId);
    fd.set("date", date);
    fd.set("location", location);
    fd.set("description", description);
    for (const f of Array.from(imagesRef.current?.files ?? [])) fd.append("images", f);
    const audio = audioRef.current?.files?.[0];
    if (audio) fd.append("audio", audio);

    try {
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

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputCls}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="bg-neutral-900">
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="地点"
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
    </form>
  );
}
