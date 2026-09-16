/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Breadcrumb from "@/components/starfield/Breadcrumb";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Category, MemoryWithMedia } from "@/lib/db/queries";
import { coverStyle } from "@/lib/crop";
import { shouldIgnorePageShortcut } from "@/lib/dom";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSpriteStore } from "@/store/sprite";

/** 播放/暂停背景音乐按钮：带呼吸光晕（未播放时更明显，提示可点） */
function PlayButton({
  playing,
  failed,
  onClick,
  size = "md",
}: {
  playing: boolean;
  failed: boolean;
  onClick: () => void;
  size?: "md" | "lg";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? "暂停背景音乐" : "播放背景音乐"}
      title={failed ? "音乐暂时无法播放" : undefined}
      className={`relative flex shrink-0 items-center justify-center rounded-full border text-white backdrop-blur transition-colors ${
        size === "lg" ? "h-14 w-14 text-xl" : "h-12 w-12 text-lg"
      } ${
        failed
          ? "border-red-400/50 bg-red-500/10 hover:bg-red-500/20"
          : "border-white/25 bg-white/10 hover:bg-white/20"
      }`}
    >
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(160,215,255,0.45) 0%, rgba(124,196,255,0) 70%)",
        }}
        animate={
          playing
            ? { scale: [1, 1.15, 1], opacity: [0.45, 0.75, 0.45] }
            : { scale: [1, 1.4, 1], opacity: [0.35, 0.9, 0.35] }
        }
        transition={{ duration: playing ? 3 : 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <span aria-hidden className="relative">
        {playing ? "❚❚" : "▶"}
      </span>
    </button>
  );
}

export default function MemoryScene({
  memory,
  breadcrumb,
}: {
  memory: MemoryWithMedia;
  breadcrumb: Category[];
}) {
  const router = useRouter();
  const images = memory.media.filter((m) => m.type === "image");
  const audio = memory.media.find((m) => m.type === "audio");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 播放失败（浏览器拦截 / 音频不可用）时给出可见提示
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // 音量淡入淡出的 rAF 句柄
  const fadeRafRef = useRef<number | null>(null);
  // 播放序号：避免「淡出后暂停」与「快速再次播放」之间的竞态
  const playSeqRef = useRef(0);
  const leavingRef = useRef(false);

  const parentPath = breadcrumb.length > 0 ? breadcrumb.map((c) => c.id).join("/") : "globe";
  // 降载：reduced-motion 下不要入场/退场动画，直接切换
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const handleBack = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (reduceMotion) {
      router.push(`/star/${parentPath}`);
      return;
    }
    setLeaving(true);
  }, [reduceMotion, router, parentPath]);

  /** 删除当前回忆：成功后走退出动画返回所属类别 */
  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      handleBack();
    } catch {
      setDeleting(false);
    }
  }, [deleting, memory.id, handleBack]);

  const changeImage = useCallback(
    (dir: number) => {
      if (images.length === 0) return;
      setIndex((i) => (i + dir + images.length) % images.length);
    },
    [images.length],
  );

  /** 用 requestAnimationFrame 线性改变音量，实现淡入淡出 */
  const fadeVolume = useCallback((el: HTMLAudioElement, to: number, ms: number) => {
    if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    const from = el.volume;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      fadeRafRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    fadeRafRef.current = requestAnimationFrame(step);
  }, []);

  /** 开始播放：从头播放并淡入 */
  const startPlayback = useCallback(async () => {
    const el = audioElRef.current;
    if (!el) return;
    const seq = ++playSeqRef.current;
    el.currentTime = 0;
    el.volume = 0;
    try {
      await el.play();
    } catch {
      setFailed(true);
      setPlaying(false);
      return;
    }
    setFailed(false);
    if (playSeqRef.current !== seq) return;
    fadeVolume(el, 1, 1500);
    setPlaying(true);
  }, [fadeVolume]);

  /** 暂停播放：先淡出再暂停，避免生硬截断 */
  const stopPlayback = useCallback(() => {
    const el = audioElRef.current;
    if (!el) return;
    const seq = ++playSeqRef.current;
    fadeVolume(el, 0, 800);
    setTimeout(() => {
      // 若期间又触发了播放，则不再暂停
      if (playSeqRef.current === seq) el.pause();
    }, 850);
    setPlaying(false);
  }, [fadeVolume]);

  /** 手动切换播放 / 暂停 */
  const togglePlayback = useCallback(() => {
    if (!audio) return;
    if (playing) stopPlayback();
    else void startPlayback();
  }, [audio, playing, startPlayback, stopPlayback]);

  /** 左右滑动切换图片：位移 >40px 且以水平为主方向（不干扰纵向滚动） */
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const onSwipeStart = useCallback((e: React.PointerEvent) => {
    swipeRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onSwipeEnd = useCallback(
    (e: React.PointerEvent) => {
      const s = swipeRef.current;
      swipeRef.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        changeImage(dx < 0 ? 1 : -1);
      }
    },
    [changeImage],
  );
  const onSwipeCancel = useCallback(() => {
    swipeRef.current = null;
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // 输入中 / 有弹层 / 小精灵面板打开时不抢按键
      if (shouldIgnorePageShortcut(e)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        changeImage(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        changeImage(1);
      } else if (e.code === "Space") {
        if (audio) {
          e.preventDefault();
          void togglePlayback();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [audio, changeImage, togglePlayback, handleBack]);

  // 卸载时取消未完成的淡入淡出动画
  useEffect(() => {
    return () => {
      if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    };
  }, []);

  const current = images[index];
  const crumbItems = [
    ...breadcrumb.map((c) => ({ id: c.id, name: c.name })),
    { id: memory.id, name: memory.title },
  ];

  return (
    <div
      className={`relative flex min-h-dvh flex-col bg-neutral-950 text-white motion-reduce:animate-none ${
        leaving
          ? "animate-[memoryOut_0.26s_ease-out_forwards]"
          : "animate-[memoryIn_0.2s_ease-out_both]"
      }`}
      onAnimationEnd={() => {
        if (leaving) router.push(`/star/${parentPath}`);
      }}
    >
      {current && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={`/api/media/${current.path}`}
            alt=""
            draggable={false}
            decoding="async"
            style={coverStyle(
              { x: current.focalX, y: current.focalY, scale: current.cropScale },
              1.05,
            )}
            className="h-full w-full object-cover opacity-40 blur-xs"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
        </div>
      )}

      <header className="relative z-10 flex items-start justify-between gap-4 px-4 py-3 pt-[calc(var(--safe-top)+12px)] sm:px-6 sm:py-5 sm:pt-5">
        <div className="flex flex-col gap-2">
          <Breadcrumb items={crumbItems} />
          <button
            type="button"
            onClick={handleBack}
            className="-my-1 inline-flex w-fit items-center gap-1 px-1 py-1.5 text-sm text-white/60 transition-colors hover:text-white"
          >
            ← 返回
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-sm text-white/50">{memory.date}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => useSpriteStore.getState().openEdit(memory.id)}
              className="-my-1 px-1 py-1.5 text-sm text-white/70 transition-colors hover:text-white"
            >
              编辑
            </button>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="-my-1 px-1 py-1.5 text-sm text-red-300/80 transition-colors hover:text-red-300"
                >
                  遗忘
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>遗忘这条回忆？</DialogTitle>
                <DialogDescription>
                  「{memory.title}」及其图片、音乐将被永久遗忘，无法找回。
                </DialogDescription>
                <div className="mt-5 flex justify-end gap-2">
                  <DialogClose asChild>
                    <button
                      type="button"
                      className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                    >
                      取消
                    </button>
                  </DialogClose>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-full bg-red-500/80 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                  >
                    {deleting ? "遗忘中…" : "确认遗忘"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-5 px-4 pb-28 sm:gap-8 sm:px-6 sm:pb-16">
        {/* 宽屏：播放按钮在图片上方正中（独立一行） */}
        {audio && (
          <div className="hidden justify-center sm:flex">
            <PlayButton playing={playing} failed={failed} onClick={togglePlayback} size="lg" />
          </div>
        )}

        <div className="flex items-center gap-3">
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => changeImage(-1)}
              aria-label="上一张"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-2xl leading-none text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-white sm:flex"
            >
              ‹
            </button>
          )}
          <div
            className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            onPointerDown={onSwipeStart}
            onPointerUp={onSwipeEnd}
            onPointerCancel={onSwipeCancel}
          >
            {current && (
              <img
                key={current.id}
                src={`/api/media/${current.path}`}
                alt={current.caption ?? memory.title}
                draggable={false}
                decoding="async"
                style={coverStyle({ x: current.focalX, y: current.focalY, scale: current.cropScale })}
                className="aspect-[3/2] w-full touch-pan-y object-cover"
              />
            )}
          </div>
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => changeImage(1)}
              aria-label="下一张"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-2xl leading-none text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-white sm:flex"
            >
              ›
            </button>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex justify-center gap-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIndex(i)}
                aria-label={`第 ${i + 1} 张`}
                className="p-2"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          <p className="text-sm tracking-wide text-white/60">{memory.location}</p>
          <h1 className="text-2xl font-semibold sm:text-3xl lg:text-4xl">{memory.title}</h1>
          {memory.description && (
            <p className="max-w-2xl whitespace-pre-wrap break-words leading-7 text-white/75 sm:leading-8">
              {memory.description}
            </p>
          )}
        </div>

        {audio && (
          <audio ref={audioElRef} src={`/api/media/${audio.path}`} loop preload="metadata" />
        )}
      </main>

      {/* 窄屏固定底栏：切图按钮在左右两侧，播放按钮居中（同一水平线） */}
      <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 items-center border-t border-white/10 bg-neutral-950/80 px-4 pt-3 pb-[calc(var(--safe-bottom)+10px)] backdrop-blur sm:hidden">
        {images.length > 1 ? (
          <button
            type="button"
            onClick={() => changeImage(-1)}
            aria-label="上一张"
            className="flex h-12 w-12 items-center justify-center justify-self-start rounded-full border border-white/20 bg-white/5 text-2xl leading-none text-white/80 transition-colors active:bg-white/20"
          >
            ‹
          </button>
        ) : (
          <span />
        )}
        <div className="justify-self-center">
          {audio && <PlayButton playing={playing} failed={failed} onClick={togglePlayback} />}
        </div>
        {images.length > 1 ? (
          <button
            type="button"
            onClick={() => changeImage(1)}
            aria-label="下一张"
            className="flex h-12 w-12 items-center justify-center justify-self-end rounded-full border border-white/20 bg-white/5 text-2xl leading-none text-white/80 transition-colors active:bg-white/20"
          >
            ›
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
