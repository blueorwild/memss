"use client";

import { useState, type ReactNode } from "react";

/**
 * 设置面板中的可折叠区块。每个块独立管理展开状态，
 * 因此多个块可以同时展开（非手风琴互斥）。
 */
export default function SettingsSection({
  title,
  defaultOpen = false,
  onOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  /** 首次展开时回调（常用于懒加载该块的数据） */
  onOpen?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
  }

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span className="text-[13px] font-medium text-white/85">{title}</span>
        <span
          aria-hidden
          className={`text-white/40 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          ▸
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-white/10 px-3 py-3">{children}</div>
      )}
    </section>
  );
}
