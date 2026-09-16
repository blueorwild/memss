"use client";

import { useEffect, useRef, useState } from "react";

/** 菜单项：tone=danger 用于「遗忘」这类破坏性操作 */
export type MoreMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
};

/**
 * 右上角「⋯」更多菜单：把「编辑 / 遗忘」这类次要操作收进一个按钮里。
 * 刻意用**内联**菜单而非 Portal 浮层：Radix Dialog 会给 body 设 pointer-events:none
 * 且低 z-index 的浮层会被弹层盖住（详见 WORKBUDDY_MEMORY.md）。
 * 打开时 Esc 只关闭菜单（捕获阶段拦下，避免触发页面级的返回）。
 */
export default function MoreMenu({ items, label = "更多操作" }: { items: MoreMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 点击组件外 / 按 Esc 关闭（Esc 在捕获阶段拦下，避免页面级返回）
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      e.stopPropagation();
      e.preventDefault();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`-my-1 flex h-8 w-8 items-center justify-center rounded-full outline-none transition-colors hover:bg-white/10 ${
          open ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-28 overflow-hidden rounded-xl border border-white/15 bg-panel/95 py-1 text-sm shadow-2xl backdrop-blur-md"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={`block w-full px-3 py-2 text-left transition-colors hover:bg-white/10 ${
                it.tone === "danger" ? "text-red-300/90" : "text-white/85"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
