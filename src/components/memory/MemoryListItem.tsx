/* eslint-disable @next/next/no-img-element */
"use client";

import { coverStyle } from "@/lib/crop";
import type { MemoryCover } from "@/lib/db/queries";

/** 列表条目数据（搜索面板与对话卡片共用） */
export type MemoryListItemData = {
  id: string;
  title: string;
  date?: string | null;
  location?: string | null;
  cover?: MemoryCover | null;
};

/**
 * 回忆列表条目：缩略图 + 标题 + 日期（+ 地点）。
 * 对话卡片与搜索面板共用，保证两处观感一致。
 * - compact：对话中的检索卡片（窄，仅标题 + 日期）
 * - full：搜索面板结果（含地点）
 */
export default function MemoryListItem({
  item,
  variant = "full",
  onClick,
}: {
  item: MemoryListItemData;
  variant?: "compact" | "full";
  onClick?: () => void;
}) {
  const thumb =
    variant === "compact" ? "h-8 w-12 rounded-md" : "h-[38px] w-[57px] rounded-lg";
  // 紧凑档（对话卡片）无封面时不占位，避免旧卡片出现空白灰块；完整档始终占位以保持对齐
  const showThumb = Boolean(item.cover) || variant === "full";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left transition-colors hover:bg-white/10 sm:min-h-0"
    >
      {showThumb && (
        <span className={`shrink-0 overflow-hidden bg-white/[0.06] ${thumb}`}>
          {item.cover && (
            <img
              src={`/api/media/${item.cover.path}`}
              alt=""
              draggable={false}
              decoding="async"
              loading="lazy"
              style={coverStyle({
                x: item.cover.focalX,
                y: item.cover.focalY,
                scale: item.cover.cropScale,
              })}
              className="h-full w-full object-cover"
            />
          )}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-white/85">{item.title}</span>
        <span className="flex items-center gap-2 text-[11px] text-white/35">
          {item.date && <span className="shrink-0">{item.date}</span>}
          {variant === "full" && item.location && (
            <span className="truncate">{item.location}</span>
          )}
        </span>
      </span>
    </button>
  );
}
