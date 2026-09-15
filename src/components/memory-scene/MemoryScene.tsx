/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // 音量淡入淡出的 rAF 句柄
  const fadeRafRef = useRef<number | null>(null);
  // 播放序号：避免「淡出后暂停」与「快速再次播放」之间的竞态
  const playSeqRef = useRef(0);
  const leavingRef = useRef(false);

  const parentPath = breadcrumb.length > 0 ? breadcrumb.map((c) => c.id).join("/") : "globe";

  const handleBack = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
  }, []);

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
    await el.play();
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

  // 进入详情页时若有背景音乐则尝试自动播放；被浏览器拦截则静默回退（保留手动按钮）
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (!audio || autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    startPlayback().catch(() => setPlaying(false));
  }, [audio, startPlayback]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
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
      className={`relative flex min-h-screen flex-col bg-neutral-950 text-white ${
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
            decoding="async"
            className="h-full w-full scale-105 object-cover opacity-40 blur-sm"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
        </div>
      )}

      <header className="relative z-10 flex items-start justify-between gap-4 px-6 py-5">
        <div className="flex flex-col gap-2">
          <Breadcrumb items={crumbItems} />
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex w-fit items-center gap-1 text-sm text-white/60 transition-colors hover:text-white"
          >
            ← 返回
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-sm text-white/50">{memory.date}</span>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-sm text-red-300/80 transition-colors hover:text-red-300"
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
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-6 pb-16">
        <div className="flex items-center gap-3">
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => changeImage(-1)}
              aria-label="上一张"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-2xl leading-none text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
            >
              ‹
            </button>
          )}
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            {current && (
              <img
                key={current.id}
                src={`/api/media/${current.path}`}
                alt={current.caption ?? memory.title}
                decoding="async"
                className="aspect-[3/2] w-full object-cover"
              />
            )}
          </div>
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => changeImage(1)}
              aria-label="下一张"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-2xl leading-none text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
            >
              ›
            </button>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex justify-center gap-2">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIndex(i)}
                aria-label={`第 ${i + 1} 张`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm tracking-wide text-white/60">{memory.location}</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">{memory.title}</h1>
          {memory.description && (
            <p className="max-w-2xl leading-8 text-white/75">{memory.description}</p>
          )}
        </div>

        {audio && (
          <div>
            <button
              onClick={togglePlayback}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm backdrop-blur transition-colors hover:bg-white/10"
            >
              <span aria-hidden>{playing ? "❚❚" : "▶"}</span>
              <span>{playing ? "暂停" : "播放背景音乐"}</span>
            </button>
            <audio ref={audioElRef} src={`/api/media/${audio.path}`} loop preload="auto" />
          </div>
        )}
      </main>
    </div>
  );
}
