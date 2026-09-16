"use client";

import { useEffect, useRef } from "react";
import { useSpriteStore } from "@/store/sprite";

type Star = { x: number; y: number; z: number; r: number; tw: number };

/** 窄屏断点与统计口径（与 use-media-query 的 MOBILE_QUERY 对齐） */
const MOBILE_QUERY = "(max-width: 639px)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

export default function StarBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 降载：窄屏降低像素密度；reduced-motion 只画静态一帧
    const narrow = window.matchMedia(MOBILE_QUERY).matches;
    const reduceMotion = window.matchMedia(REDUCE_QUERY).matches;
    const dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2);
    // 星数上限：窄屏下调（手机面积本就小，主要为防大屏手机/平板过量）
    const starCap = narrow ? 220 : 420;

    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;

    function resize() {
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = Math.max(1, Math.floor(w * dpr));
      canvas!.height = Math.max(1, Math.floor(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(starCap, Math.floor((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.8 + 0.2,
        r: Math.random() * 1.2 + 0.3,
        tw: Math.random() * Math.PI * 2,
      }));
    }

    /** 绘制一帧（t 为时间，用于闪烁相位） */
    function render(t: number) {
      ctx!.clearRect(0, 0, w, h);
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;
      for (const s of stars) {
        const px = s.x + mx * s.z * 18;
        const py = s.y + my * s.z * 18;
        // reduced-motion 下用固定亮度，去掉闪烁
        const alpha = reduceMotion ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(t / 1400 + s.tw));
        ctx!.beginPath();
        ctx!.arc(px, py, s.r * s.z, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(220,235,255,${alpha * s.z})`;
        ctx!.fill();
      }
    }

    let frame = 0;
    function draw(t: number) {
      raf = requestAnimationFrame(draw);
      // 后台标签页不绘制
      if (document.hidden) return;
      // 场景过渡期间暂停，减轻合成压力
      if (useSpriteStore.getState().sceneTransitioning) return;
      // 常态下每 2 帧绘制一次，降低开销
      frame += 1;
      if (frame % 2 !== 0) return;
      render(t);
    }

    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    // 静态模式：只画一帧，resize 时重画；不启动 rAF、不监听鼠标视差
    if (reduceMotion) {
      const onResizeStatic = () => {
        resize();
        render(0);
      };
      resize();
      render(0);
      window.addEventListener("resize", onResizeStatic);
      return () => window.removeEventListener("resize", onResizeStatic);
    }

    const onResize = () => resize();
    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-20"
        style={{
          background:
            "radial-gradient(60% 50% at 30% 20%, rgba(70,90,160,0.18), transparent 70%), radial-gradient(50% 40% at 75% 70%, rgba(120,80,170,0.14), transparent 70%), #05060a",
        }}
      />
      <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
    </>
  );
}
