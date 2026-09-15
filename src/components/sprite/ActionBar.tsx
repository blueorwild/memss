"use client";

import { useSpriteStore } from "@/store/sprite";
import type { SpriteView } from "@/store/sprite";

/** 功能按钮定义：后续可在此扩展更多能力 */
const ACTIONS: { key: SpriteView; label: string; icon: string }[] = [
  { key: "chat", label: "对话", icon: "✦" },
  { key: "upload", label: "上传回忆", icon: "＋" },
  { key: "settings", label: "设置", icon: "⚙" },
];

/** 小精灵功能按钮栏：切换对话 / 上传回忆 / 设置 */
export default function ActionBar() {
  const view = useSpriteStore((s) => s.view);
  const openView = useSpriteStore((s) => s.openView);
  const openUpload = useSpriteStore((s) => s.openUpload);

  return (
    <div className="flex gap-2 border-b border-white/10 px-4 py-2">
      {ACTIONS.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => (it.key === "upload" ? openUpload() : openView(it.key))}
          className={`flex min-h-9 flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs transition-colors sm:min-h-0 sm:flex-none sm:py-1 ${
            view === it.key
              ? "bg-white/15 text-white"
              : "text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span aria-hidden>{it.icon}</span>
          {it.label}
        </button>
      ))}
    </div>
  );
}
