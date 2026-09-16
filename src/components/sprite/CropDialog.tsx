"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CROP_MAX_SCALE,
  CROP_MIN_SCALE,
  DEFAULT_CROP,
  clampCrop,
  coverStyle,
  type Crop,
} from "@/lib/crop";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** 展示比例：与卡片/详情页一致（3:2） */
const ASPECT = 3 / 2;

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/**
 * 裁剪弹窗：固定 3:2 方框，图片可拖动平移、缩放（滚轮 / 双指捏合 / 滑杆），
 * 框内所见即最终展示区域。确认后回传 Crop（焦点 % + 缩放 %）。
 * 由父组件在打开时挂载（内部用初始 value 初始化，关闭即卸载）。
 */
export default function CropDialog({
  onOpenChange,
  src,
  value,
  onConfirm,
}: {
  onOpenChange: (open: boolean) => void;
  src: string;
  value: Crop;
  onConfirm: (crop: Crop) => void;
}) {
  const [crop, setCrop] = useState<Crop>(() => clampCrop(value));
  const cropRef = useRef<Crop>(crop);
  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  const frameRef = useRef<HTMLDivElement | null>(null);
  // 图片自然宽高比（用于平移换算）；未加载前按 3:2 处理
  const aspectRef = useRef(ASPECT);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  const update = useCallback((patch: Partial<Crop>) => {
    setCrop((c) => clampCrop({ ...c, ...patch }));
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      panRef.current = { x: e.clientX, y: e.clientY };
      pinchRef.current = null;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: cropRef.current.scale,
      };
      panRef.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 双指：按两指距离比缩放
    if (pointers.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchRef.current.dist > 0) {
        update({ scale: Math.round((pinchRef.current.scale * dist) / pinchRef.current.dist) });
      }
      return;
    }

    // 单指/鼠标：平移，按溢出比 1:1 跟手
    if (pointers.current.size === 1 && panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      const frame = frameRef.current?.getBoundingClientRect();
      if (!frame) return;
      const a = aspectRef.current;
      const s = cropRef.current.scale / 100;
      const kx = Math.max(a / ASPECT, 1) * s;
      const ky = Math.max(ASPECT / a, 1) * s;
      let x = cropRef.current.x;
      let y = cropRef.current.y;
      if (kx > 1.01) x -= (dx / frame.width) * 100 / (kx - 1);
      if (ky > 1.01) y -= (dy / frame.height) * 100 / (ky - 1);
      update({ x: clamp(x), y: clamp(y) });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 1) {
      const [pt] = [...pointers.current.values()];
      panRef.current = { x: pt.x, y: pt.y };
    } else if (pointers.current.size === 0) {
      panRef.current = null;
    }
  }

  // 滚轮缩放（非 passive 才能 preventDefault，避免页面滚动）
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      update({ scale: cropRef.current.scale - e.deltaY * 0.2 });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [update]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,520px)]">
        <DialogTitle>调整展示区域</DialogTitle>
        <p className="mt-1 text-xs text-white/50">拖动图片移动位置，滚轮 / 双指 / 滑杆缩放</p>

        {/* 固定 3:2 裁剪框 */}
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ aspectRatio: "3 / 2", touchAction: "none" }}
          className="relative mt-3 w-full cursor-grab overflow-hidden rounded-xl border border-white/15 bg-black/40 active:cursor-grabbing"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth && el.naturalHeight) {
                aspectRef.current = el.naturalWidth / el.naturalHeight;
              }
            }}
            style={coverStyle(crop)}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-white/50">缩小</span>
          <input
            type="range"
            min={CROP_MIN_SCALE}
            max={CROP_MAX_SCALE}
            step={1}
            value={crop.scale}
            onChange={(e) => update({ scale: Number(e.target.value) })}
            className="h-1 flex-1 accent-accent-deep"
          />
          <span className="text-xs text-white/50">放大</span>
          <span className="w-12 shrink-0 text-right text-xs text-white/60">{crop.scale}%</span>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => update(DEFAULT_CROP)}
            className="text-xs text-white/50 transition-colors hover:text-white"
          >
            重置
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(clampCrop(crop));
                onOpenChange(false);
              }}
              className="rounded-full bg-accent-deep/80 px-4 py-1.5 text-sm text-white transition-colors hover:bg-accent-deep"
            >
              确定
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
