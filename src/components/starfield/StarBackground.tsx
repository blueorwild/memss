"use client";

import { useEffect, useRef } from "react";
import { useSpriteStore } from "@/store/sprite";

type Star = { x: number; y: number; z: number; r: number; tw: number };

export default function StarBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      const count = Math.min(420, Math.floor((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.8 + 0.2,
        r: Math.random() * 1.2 + 0.3,
        tw: Math.random() * Math.PI * 2,
      }));
    }

    let frame = 0;
    function draw(t: number) {
      raf = requestAnimationFrame(draw);
      // 场景过渡期间暂停，减轻合成压力
      if (useSpriteStore.getState().sceneTransitioning) return;
      // 常态下每 2 帧绘制一次，降低开销
      frame += 1;
      if (frame % 2 !== 0) return;

      ctx!.clearRect(0, 0, w, h);
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;
      for (const s of stars) {
        const px = s.x + mx * s.z * 18;
        const py = s.y + my * s.z * 18;
        const alpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 1400 + s.tw));
        ctx!.beginPath();
        ctx!.arc(px, py, s.r * s.z, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(220,235,255,${alpha * s.z})`;
        ctx!.fill();
      }
    }

    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
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
