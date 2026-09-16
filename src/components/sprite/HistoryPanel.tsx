"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConversationRow = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

type Props = {
  conversations: ConversationRow[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onChanged: (deletedIds: string[]) => void;
  onBack: () => void;
};

/** 会话历史面板：列表 / 多选删除 / 一键清空 */
export default function HistoryPanel({
  conversations,
  currentId,
  onOpen,
  onChanged,
  onBack,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBatch, setConfirmBatch] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) =>
      s.size === conversations.length ? new Set() : new Set(conversations.map((c) => c.id)),
    );
  }

  async function remove(ids: string[], all = false) {
    if (busy) return;
    setBusy(true);
    try {
      const url = all
        ? "/api/conversations?all=1"
        : `/api/conversations?ids=${encodeURIComponent(ids.join(","))}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        onChanged(all ? conversations.map((c) => c.id) : ids);
        setSelected(new Set());
      }
    } finally {
      setBusy(false);
      setConfirmClear(false);
      setConfirmBatch(false);
    }
  }

  const allSelected = conversations.length > 0 && selected.size === conversations.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/70">
        <button type="button" onClick={onBack} className="transition-colors hover:text-white">
          ‹ 返回对话
        </button>
        <span className="text-white/40">对话历史</span>
        {/* 新建对话已挪到对话页顶部细条，这里不再重复 */}
        <span aria-hidden className="w-12" />
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {conversations.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-white/35">还没有历史对话</p>
        )}
        {conversations.map((c) => (
          <label
            key={c.id}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              c.id === currentId
                ? "border-white/25 bg-white/10"
                : "border-white/10 bg-white/[0.03] hover:bg-white/10",
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={() => toggle(c.id)}
              className="size-5 shrink-0 accent-accent-deep sm:size-3.5"
            />
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-white/85">{c.title || "未命名对话"}</span>
              <span className="block text-[11px] text-white/35">
                {new Date(c.updatedAt).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </button>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 p-3 text-xs">
        <button
          type="button"
          onClick={toggleAll}
          disabled={conversations.length === 0}
          className="rounded-full border border-white/15 min-h-11 px-3 py-2.5 sm:min-h-0 text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          {allSelected ? "取消全选" : "全选"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmBatch(true)}
          disabled={selected.size === 0 || busy}
          className="rounded-full border border-white/15 min-h-11 px-3 py-2.5 sm:min-h-0 text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          删除选中{selected.size > 0 ? `（${selected.size}）` : ""}
        </button>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={conversations.length === 0 || busy}
          className="ml-auto rounded-full border border-red-400/30 min-h-11 px-3 py-2.5 sm:min-h-0 text-red-300/80 transition-colors hover:bg-red-500/15 disabled:opacity-40"
        >
          清空全部
        </button>
      </div>

      <Dialog open={confirmBatch} onOpenChange={setConfirmBatch}>
        <DialogContent>
          <DialogTitle>删除选中的 {selected.size} 条对话？</DialogTitle>
          <DialogDescription>这些对话及其消息都会被永久删除，无法找回。</DialogDescription>
          <div className="mt-4 flex justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => setConfirmBatch(false)}
              className="rounded-full border border-white/15 px-4 py-1.5 text-white/70 transition-colors hover:bg-white/10"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void remove([...selected])}
              disabled={busy}
              className="rounded-full bg-red-500/80 px-4 py-1.5 text-white transition-colors hover:bg-red-500 disabled:opacity-40"
            >
              确认删除
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogTitle>清空全部对话？</DialogTitle>
          <DialogDescription>所有历史对话与消息都会被永久删除，无法找回。</DialogDescription>
          <div className="mt-4 flex justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded-full border border-white/15 px-4 py-1.5 text-white/70 transition-colors hover:bg-white/10"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void remove([], true)}
              disabled={busy}
              className="rounded-full bg-red-500/80 px-4 py-1.5 text-white transition-colors hover:bg-red-500 disabled:opacity-40"
            >
              确认清空
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
