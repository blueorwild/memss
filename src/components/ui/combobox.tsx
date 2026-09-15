"use client";

import { useState, type ReactNode } from "react";
import { Command } from "cmdk";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** 下拉选项：value 为存储值，label 为显示与搜索值 */
export type ComboOption = { value: string; label: string };

/**
 * 可搜索下拉：触发器显示当前选中项，展开后用 cmdk 过滤列表。
 * 用于地点级联等需要从大量选项中选择的场景。
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "请选择",
  emptyText = "无匹配项",
  disabled = false,
  className,
  footer,
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /** 列表底部附加内容（如「新建类别」入口） */
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-base text-white outline-none transition-colors hover:border-white/25 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:text-sm",
            className,
          )}
        >
          <span className={cn("truncate", !current && "text-white/35")}>
            {current?.label ?? placeholder}
          </span>
          <span aria-hidden className="shrink-0 text-white/40">
            ⌄
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Command
          // 对中文 label 做简单子串匹配即可
          filter={(value, search) => (value.includes(search) ? 1 : 0)}
          className="flex flex-col"
        >
          <Command.Input
            placeholder="搜索…"
            className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-base text-white outline-none placeholder:text-white/35 sm:text-sm"
          />
          <Command.List className="mt-1 max-h-56 overflow-y-auto">
            <Command.Empty className="px-2 py-3 text-center text-xs text-white/40">
              {emptyText}
            </Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.value}
                value={o.label}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-md px-2.5 py-2.5 text-sm text-white/80 data-[selected=true]:bg-white/15 data-[selected=true]:text-white"
              >
                {o.label}
              </Command.Item>
            ))}
          </Command.List>
          {footer && <div className="mt-1 border-t border-white/10 pt-1">{footer}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
