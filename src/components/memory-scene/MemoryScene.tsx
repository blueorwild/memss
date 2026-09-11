/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/starfield/Breadcrumb";
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

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const leavingRef = useRef(false);

  const parentPath = breadcrumb.length > 0 ? breadcrumb.map((c) => c.id).join("/") : "globe";

  const handleBack = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
  }, []);

  const changeImage = useCallback(
    (dir: number) => {
      if (images.length === 0) return;
      setIndex((i) => (i + dir + images.length) % images.length);
    },
    [images.length],
  );

  const togglePlayback = useCallback(async () => {
    const el = audioElRef.current;
    if (!el || !audio) return;

    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
    }

    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;
    if (ctx.state === "suspended") await ctx.resume();

    if (!playing) {
      el.currentTime = 0;
      await el.play();
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 1.5);
      setPlaying(true);
    } else {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      const target = el;
      setTimeout(() => target.pause(), 850);
      setPlaying(false);
    }
  }, [audio, playing]);

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

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
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
        <span className="shrink-0 text-sm text-white/50">{memory.date}</span>
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
