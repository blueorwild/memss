/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Media } from "@/lib/db/queries";
import { useMediaQuery } from "@/lib/use-media-query";

/** 缩放范围与双击放大倍数 */
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_SCALE = 2.5;
/** 未放大时横向拖动超过该距离视为「切图」 */
const SWIPE_THRESHOLD = 40;
/** 视为拖动的位移阈值（避免轻微抖动被判成拖动） */
const MOVE_EPS = 6;

type Pt = { x: number; y: number };

function clampNum(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 全屏看图（Lightbox）：双指捏合 / 滚轮 / 双击缩放，放大后拖动平移，
 * 未放大时左右滑动或 ←/→ 切图，Esc 或点图片外的空白关闭。
 *
 * 说明：容器带 `role="dialog"`，因此 `shouldIgnorePageShortcut` 会让详情页的
 * 页面快捷键（←/→ 切图、空格播放、Esc 返回）在查看器打开期间失效，避免冲突。
 * 组件由父级用 `key={index}` 挂载，切图即重置缩放与位移。
 */
export default function ImageViewer({
  images,
  index,
  title,
  onIndexChange,
  onClose,
}: {
  images: Media[];
  index: number;
  title: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const current = images[index];
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // 指针集合（双指捏合需要同时跟踪两个指针）
  const pointers = useRef(new Map<number, Pt>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);
  // 打开时刻：吞掉「开启本次查看的那一下点击」随后合成的 click
  // （触摸点击会在 pointerup 后再补发一次 click，落点若在图片外的留白处会立刻把查看器关掉）
  const openedAtRef = useRef(0);

  /** 限制平移范围，避免把图片拖出视野 */
  const clampOffset = useCallback((off: Pt, s: number): Pt => {
    const box = backdropRef.current;
    if (!box || s <= 1) return { x: 0, y: 0 };
    const maxX = (box.clientWidth * (s - 1)) / 2;
    const maxY = (box.clientHeight * (s - 1)) / 2;
    return { x: clampNum(off.x, -maxX, maxX), y: clampNum(off.y, -maxY, maxY) };
  }, []);

  // Esc 关闭、←/→ 切图（页面快捷键已被 role="dialog" 挡掉）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && images.length > 1) {
        e.preventDefault();
        onIndexChange((index - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight" && images.length > 1) {
        e.preventDefault();
        onIndexChange((index + 1) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, index, onIndexChange, onClose]);

  // 打开期间锁定页面滚动；同时记录打开时刻（供点击关闭的防抖使用）
  useEffect(() => {
    openedAtRef.current = performance.now();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /** 滚轮缩放：以光标位置为锚点。用原生监听以便 preventDefault（避免页面滚动） */
  useEffect(() => {
    const box = backdropRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = clampNum(scale * Math.exp(-e.deltaY * 0.002), MIN_SCALE, MAX_SCALE);
      if (next === scale) return;
      const rect = box.getBoundingClientRect();
      // 光标相对容器中心的坐标
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const k = next / scale;
      const anchor = clampOffset({ x: cx - (cx - offset.x) * k, y: cy - (cy - offset.y) * k }, next);
      setScale(next);
      setOffset(anchor);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [scale, offset, clampOffset]);

  const distOfPointers = () => {
    const pts = [...pointers.current.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // 点在按钮上时不参与拖动 / 捏合
    if ((e.target as HTMLElement).closest("button")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movedRef.current = false;
    if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      setDragging(true);
    } else if (pointers.current.size === 2) {
      panStart.current = null;
      pinchStart.current = { dist: distOfPointers(), scale };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const next = clampNum(
        pinchStart.current.scale * (distOfPointers() / (pinchStart.current.dist || 1)),
        MIN_SCALE,
        MAX_SCALE,
      );
      movedRef.current = true;
      setScale(next);
      setOffset((o) => clampOffset(o, next));
      return;
    }

    const st = panStart.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.abs(dx) > MOVE_EPS || Math.abs(dy) > MOVE_EPS) movedRef.current = true;
    if (scale > 1) {
      setOffset(clampOffset({ x: st.ox + dx, y: st.oy + dy }, scale));
    } else {
      // 未放大：横向跟手拖拽，松手时判定是否切图
      setOffset({ x: dx, y: 0 });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size > 0) return;

    setDragging(false);
    panStart.current = null;
    if (scale > 1) {
      setOffset((o) => clampOffset(o, scale));
      return;
    }
    const dx = offset.x;
    setOffset({ x: 0, y: 0 });
    if (Math.abs(dx) > SWIPE_THRESHOLD && images.length > 1) {
      onIndexChange(dx < 0 ? (index + 1) % images.length : (index - 1 + images.length) % images.length);
    }
  };

  /** 双击：放大到 2.5 倍（以光标为锚点）或复原 */
  const onDoubleClick = (e: React.MouseEvent) => {
    const box = backdropRef.current;
    if (!box) return;
    if (scale > 1) {
      setScale(MIN_SCALE);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const rect = box.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const k = DOUBLE_SCALE;
    setScale(k);
    setOffset(clampOffset({ x: cx - cx * k, y: cy - cy * k }, k));
  };

  /** 点图片以外的空白关闭（拖动过或刚刚打开则忽略） */
  const onClick = (e: React.MouseEvent) => {
    if (e.target !== backdropRef.current || movedRef.current) return;
    if (performance.now() - openedAtRef.current < 400) return;
    onClose();
  };

  const btnCls =
    "flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-lg text-white backdrop-blur transition-colors hover:bg-black/60";

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label="查看图片"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      className={`fixed inset-0 z-[85] flex touch-none select-none items-center justify-center bg-black/95 ${
        scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
      }`}
    >
      {current && (
        <img
          key={current.id}
          src={`/api/media/${current.path}`}
          alt={current.caption ?? title}
          draggable={false}
          style={{
            // 查看器展示「完整原图」（object-contain，不做焦点裁剪），
            // 缩放原点固定在中心，下面的平移换算都以此为准
            transformOrigin: "center",
            transform: `${offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px) ` : ""}scale(${scale})`,
            transition: dragging || reduceMotion ? "none" : "transform 0.18s ease-out",
            willChange: "transform",
          }}
          className="max-h-full max-w-full object-contain"
        />
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[calc(var(--safe-top)+12px)]">
        <span className="max-w-[60%] truncate rounded-full bg-black/40 px-2.5 py-1 text-xs text-white/80 backdrop-blur">
          {images.length > 1 ? `${index + 1} / ${images.length}` : ""}
        </span>
        <button type="button" onClick={onClose} aria-label="关闭" className={btnCls}>
          ✕
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
            aria-label="上一张"
            className={`${btnCls} absolute left-3 top-1/2 -translate-y-1/2`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % images.length)}
            aria-label="下一张"
            className={`${btnCls} absolute right-3 top-1/2 -translate-y-1/2`}
          >
            ›
          </button>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[calc(var(--safe-bottom)+14px)]">
        <p className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/70 backdrop-blur">
          {scale > 1
            ? "拖动平移 · 双击或滚轮缩放 · Esc 关闭"
            : "滚轮 / 双指缩放 · 双击放大 · Esc 关闭"}
        </p>
      </div>
    </div>
  );
}
