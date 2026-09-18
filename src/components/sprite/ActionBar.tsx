"use client";

import { useSpriteStore } from "@/store/sprite";
import type { SpriteView } from "@/store/sprite";
import { useAuthed } from "./AuthContext";

/** 功能按钮定义：后续可在此扩展更多能力（标签用短词，窄屏 4 个按钮不至于换行） */
const ACTIONS: { key: SpriteView; label: string; icon: string }[] = [
  { key: "chat", label: "对话", icon: "✦" },
  { key: "search", label: "搜索", icon: "⌕" },
  { key: "upload", label: "上传", icon: "＋" },
  { key: "settings", label: "设置", icon: "⚙" },
];

/** 未登录访客可用的功能：只能对话与查看设置（登录入口在设置里） */
const GUEST_KEYS: SpriteView[] = ["chat", "settings"];

/** 小精灵功能按钮栏：切换对话 / 搜索 / 上传回忆 / 设置（访客只有对话与设置） */
export default function ActionBar() {
  const view = useSpriteStore((s) => s.view);
  const openView = useSpriteStore((s) => s.openView);
  const openUpload = useSpriteStore((s) => s.openUpload);
  const authed = useAuthed();

  const actions = authed ? ACTIONS : ACTIONS.filter((it) => GUEST_KEYS.includes(it.key));

  return (
    <div className="flex gap-2 border-b border-white/10 px-4 py-2">
      {actions.map((it) => (
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
