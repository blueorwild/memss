"use client";

import { useEffect, useRef } from "react";
import { rgba, readTheme } from "@/lib/theme";
import type { RGB } from "@/lib/theme";
import { useSpriteStore } from "@/store/sprite";

type Star = { x: number; y: number; z: number; r: number; tw: number };

/**
 * 流星：偶发（首次 2~4s，之后每次间隔 6~16s 随机，同屏最多 1 条），
 * 方向固定「右上 → 左下」，偏快（约 1.5s 划过屏幕）。
 * 配色**冷/暖交替**出现（cool = 与星星同族的冷白/淡蓝；warm = 时间/回忆的暖金），
 * 纯属 A/B 观察用，定下来后可以只留一种。
 */
type Meteor = {
  x: number;
  y: number;
  /** 速度分量（px/s） */
  vx: number;
  vy: number;
  /** 尾迹长度（px） */
  len: number;
  /** 存活时长（s）与已存活时长（s） */
  ttl: number;
  age: number;
  /** 当前透明度（含淡入淡出包络） */
  alpha: number;
  head: RGB;
  tail: RGB;
};

/** 降载口径：宽窄屏统一（canvas 像素数是最大开销，宽屏也按 1.5 倍封顶） */
const MAX_DPR = 1.5;
/** 星数上限 */
const STAR_CAP = 220;
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** 单帧最大步进（s）：切后台/场景过渡后回来时不至于瞬移 */
const MAX_STEP = 0.05;
/** 流星首次出现与两次之间的间隔（ms） */
const METEOR_FIRST_MIN_MS = 2000;
const METEOR_FIRST_MAX_MS = 4000;
const METEOR_GAP_MIN_MS = 6000;
const METEOR_GAP_MAX_MS = 16000;
/** 流星速度（px/s）与倾角（水平线以下，度） */
const METEOR_SPEED_MIN = 950;
const METEOR_SPEED_MAX = 1500;
/** 再放慢 1.5 倍（用户反馈"有点快"）：划过时间 ×1.5 */
const METEOR_SPEED_SCALE = 1 / 1.5;
const METEOR_ANGLE_MIN = 20;
const METEOR_ANGLE_MAX = 34;
/** 尾迹长度（px）与回收余量（px） */
const METEOR_LEN_MIN = 110;
const METEOR_LEN_MAX = 200;
const METEOR_MARGIN = 60;

export default function StarBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 降载：宽窄屏统一（宽屏不再用更高像素密度与更多星点）；
    // reduced-motion 时只画静态一帧
    const reduceMotion = window.matchMedia(REDUCE_QUERY).matches;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    // 星数上限（实际还受 w*h/DENSITY 约束，主要为防大屏过量）
    const starCap = STAR_CAP;
    // 星点颜色取自主题 token（canvas 拿不到 CSS 类）
    const theme = readTheme();
    const starColor = theme.star;

    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    /** 在飞的流星（最多 1 条）与下一条的出现时刻（ms） */
    let meteors: Meteor[] = [];
    let nextMeteorAt = 0;
    let meteorScheduled = false;
    /** 冷/暖交替计数 */
    let meteorSeq = 0;
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

    /** 排一条新流星：起点沿「右上角外侧」随机，头部出屏即回收 */
    function spawnMeteor(t: number) {
      const angle =
        ((METEOR_ANGLE_MIN + Math.random() * (METEOR_ANGLE_MAX - METEOR_ANGLE_MIN)) * Math.PI) /
        180;
      const speed =
        (METEOR_SPEED_MIN + Math.random() * (METEOR_SPEED_MAX - METEOR_SPEED_MIN)) *
        METEOR_SPEED_SCALE;
      const vx = -Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      // 一半从顶边偏右起、一半从右缘偏上起，避免每条都从同一个点出发
      const fromTop = Math.random() < 0.5;
      const x = fromTop ? w * (0.45 + Math.random() * 0.6) : w + 20 + Math.random() * w * 0.15;
      const y = fromTop ? -20 - Math.random() * h * 0.12 : h * Math.random() * 0.4;
      // 存活时长 = 头部走到左/下边界外的较小值
      const ttl = Math.max(
        0.3,
        Math.min(
          (-METEOR_MARGIN - x) / vx,
          (h + METEOR_MARGIN - y) / vy,
        ),
      );
      const cool = meteorSeq++ % 2 === 0;
      meteors.push({
        x,
        y,
        vx,
        vy,
        len: METEOR_LEN_MIN + Math.random() * (METEOR_LEN_MAX - METEOR_LEN_MIN),
        ttl,
        age: 0,
        alpha: 0,
        head: cool ? theme.star : theme.warm,
        tail: cool ? theme.beam : theme.warmGlow,
      });
      nextMeteorAt = t + METEOR_GAP_MIN_MS + Math.random() * (METEOR_GAP_MAX_MS - METEOR_GAP_MIN_MS);
    }

    /** 推进流星：按 dt 位移（帧率无关）、算淡入淡出包络、到点回收 */
    function updateMeteors(dt: number, t: number) {
      if (meteors.length === 0) {
        if (!meteorScheduled) {
          meteorScheduled = true;
          nextMeteorAt =
            t + METEOR_FIRST_MIN_MS + Math.random() * (METEOR_FIRST_MAX_MS - METEOR_FIRST_MIN_MS);
        } else if (t >= nextMeteorAt) {
          spawnMeteor(t);
        }
        return;
      }
      for (const m of meteors) {
        m.age += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const k = m.age / m.ttl;
        // 快速淡入（前 12%）、缓慢淡出（后 25%）
        m.alpha = Math.max(0, Math.min(1, Math.min(k / 0.12, (1 - k) / 0.25)));
      }
      meteors = meteors.filter((m) => m.age < m.ttl);
    }

    /** 画一条流星：叠加混合下画一条「头亮尾透明」的渐变尾迹 + 头部光斑 */
    function drawMeteor(m: Meteor) {
      if (m.alpha <= 0) return;
      const sp = Math.hypot(m.vx, m.vy) || 1;
      const tailX = m.x - (m.vx / sp) * m.len;
      const tailY = m.y - (m.vy / sp) * m.len;
      ctx!.globalCompositeOperation = "lighter";
      const streak = ctx!.createLinearGradient(m.x, m.y, tailX, tailY);
      streak.addColorStop(0, rgba(m.head, 0.9 * m.alpha));
      streak.addColorStop(0.3, rgba(m.tail, 0.4 * m.alpha));
      streak.addColorStop(1, rgba(m.tail, 0));
      ctx!.strokeStyle = streak;
      ctx!.lineWidth = 1.8;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(m.x, m.y);
      ctx!.lineTo(tailX, tailY);
      ctx!.stroke();
      // 头部光斑用径向渐变（不用 shadowBlur，避免掉帧）
      const glow = ctx!.createRadialGradient(m.x, m.y, 0, m.x, m.y, 8);
      glow.addColorStop(0, rgba(m.head, m.alpha));
      glow.addColorStop(0.45, rgba(m.head, 0.35 * m.alpha));
      glow.addColorStop(1, rgba(m.head, 0));
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(m.x, m.y, 8, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";
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
        ctx!.fillStyle = rgba(starColor, alpha * s.z);
        ctx!.fill();
      }
      for (const m of meteors) drawMeteor(m);
    }

    let frame = 0;
    let prevT = 0;
    function draw(t: number) {
      raf = requestAnimationFrame(draw);
      const dt = prevT ? Math.min((t - prevT) / 1000, MAX_STEP) : 0;
      prevT = t;
      // 后台标签页不绘制
      if (document.hidden) return;
      // 场景过渡期间暂停，减轻合成压力
      if (useSpriteStore.getState().sceneTransitioning) return;
      // 常态下每 2 帧绘制一次；有流星时逐帧（快速尾迹在 30fps 下会一顿一顿）
      frame += 1;
      if (meteors.length === 0 && frame % 2 !== 0) return;
      updateMeteors(dt, t);
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
          // 星云：冷蓝 + 暖紫两团柔和径向渐变（刻意很淡，只给底色一点层次）+ 底色。
          // 渐变终点用「同色 0 透明度」而非 transparent，避免过渡发灰。
          background:
            "radial-gradient(60% 50% at 30% 20%, rgb(var(--sky-nebula-1) / 0.22), rgb(var(--sky-nebula-1) / 0) 70%)," +
            "radial-gradient(50% 40% at 75% 70%, rgb(var(--sky-nebula-2) / 0.17), rgb(var(--sky-nebula-2) / 0) 70%)," +
            "var(--sky-void)",
        }}
      />
      <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
    </>
  );
}
