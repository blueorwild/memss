"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import MemoryListItem from "@/components/memory/MemoryListItem";
import { Combobox } from "@/components/ui/combobox";
import { categoryPathMap } from "@/lib/category-path";
import type { Category } from "@/lib/db/queries";
import type { MemorySearchItem, MemorySearchResult } from "@/lib/memory-search";
import { useIsMobile } from "@/lib/use-media-query";
import { useSpriteStore } from "@/store/sprite";

/** 关键词输入到发起检索的延迟（毫秒），避免逐字请求 */
const DEBOUNCE_MS = 250;

const fieldCls =
  "rounded-lg border border-white/15 bg-white/5 text-white outline-none placeholder:text-white/35 focus:border-white/30";

/**
 * 搜索面板：关键词 + 类别 + 日期范围，结果一次列出（不分页）。
 * 与对话里的检索共用 src/lib/memory-search.ts 内核 → 语义完全一致；
 * 区别是对话受「每批 3 张卡」限制且需 LLM 往返，这里直接查库、零延迟。
 */
export default function SearchPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const close = useSpriteStore((s) => s.close);

  // 小精灵工具可预填关键词/类别（仅在挂载时读一次）
  const [query, setQuery] = useState(() => useSpriteStore.getState().searchDraft?.query ?? "");
  const [categoryId, setCategoryId] = useState(
    () => useSpriteStore.getState().searchDraft?.categoryId ?? "",
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<MemorySearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 预填草稿消费一次后即清空，避免下次打开还带着旧条件
  useEffect(() => {
    useSpriteStore.getState().clearSearchDraft();
  }, []);

  // 拉取全部类别用于筛选（异步 setState）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = (await (await fetch("/api/categories")).json()) as Category[];
        if (alive) setCategories(list);
      } catch {
        /* 类别拉取失败不影响关键词检索 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 条件变化即检索（关键词带防抖）
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (categoryId) params.set("categoryId", categoryId);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const res = await fetch(`/api/memories/search?${params.toString()}`);
        if (!res.ok) throw new Error("检索失败");
        const data = (await res.json()) as MemorySearchResult;
        if (alive) {
          setResult(data);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "检索失败");
      } finally {
        if (alive) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, categoryId, from, to]);

  const paths = useMemo(() => categoryPathMap(categories), [categories]);
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "全部类别" },
      ...categories.map((c) => ({ value: c.id, label: paths.get(c.id) ?? c.name })),
    ],
    [categories, paths],
  );

  const hasFilter = Boolean(query.trim() || categoryId || from || to);
  const items: MemorySearchItem[] = result?.items ?? [];

  /** 打开某条回忆：星空页用迷雾过渡导航，详情页直接 push；窄屏顺手收起抽屉（否则会挡住内容） */
  function open(id: string) {
    const path = `/memory/${id}`;
    if (pathname.startsWith("/star")) {
      useSpriteStore.getState().requestNavigate(path);
    } else {
      router.push(path);
    }
    if (isMobile) close();
  }

  function reset() {
    setQuery("");
    setCategoryId("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索标题 / 描述 / 地点…"
        className={`h-9 w-full shrink-0 px-3 text-base sm:text-sm ${fieldCls}`}
      />

      <div className="mt-2 flex shrink-0 items-center gap-2">
        <Combobox
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
          placeholder="全部类别"
          className={`min-h-9 flex-1 px-2.5 text-sm ${categoryId ? "" : "text-white/35"}`}
        />
      </div>

      <div className="mt-2 flex shrink-0 items-center gap-2">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="起始日期"
          className={`h-8 min-w-0 flex-1 px-2 text-xs text-white/80 [color-scheme:dark] ${fieldCls}`}
        />
        <span aria-hidden className="text-xs text-white/30">
          —
        </span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          aria-label="结束日期"
          className={`h-8 min-w-0 flex-1 px-2 text-xs text-white/80 [color-scheme:dark] ${fieldCls}`}
        />
        {hasFilter && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 text-xs text-white/45 transition-colors hover:text-white"
          >
            清除
          </button>
        )}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between text-[11px] text-white/40">
        <span>{loading ? "检索中…" : error ? error : result ? `共 ${result.total} 条` : ""}</span>
        {!loading && result && result.total > result.count && (
          <span>仅显示前 {result.count} 条</span>
        )}
      </div>

      <div className="mt-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pb-1">
        {items.map((m) => (
          <MemoryListItem key={m.id} item={m} variant="full" onClick={() => open(m.id)} />
        ))}
        {!loading && !error && items.length === 0 && (
          <p className="py-8 text-center text-xs text-white/35">
            {hasFilter ? "没有找到匹配的回忆" : "还没有回忆，先去上传一条吧"}
          </p>
        )}
      </div>
    </div>
  );
}
