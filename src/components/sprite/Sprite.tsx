"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { hashSeed, mulberry32 } from "@/lib/layout-seed";
import { useSpriteStore } from "@/store/sprite";
import ActionBar from "./ActionBar";
import ChatPanel from "./ChatPanel";
import UploadMemoryForm from "./UploadMemoryForm";

/** 悬浮球直径与视口边距 */
const BALL = 56;
const MARGIN = 12;
/** 位置存储键（localStorage） */
const POS_KEY = "sprite-pos";
/** 科幻青蓝主色（电光蓝） */
const SPARK = "#7cc4ff";
/** 拖尾生命时长（秒）：淡出动画时长；DOM 移除在此基础上 +REMOVE_OFFSET */
const TRAIL_LIFE = 1.2;
/** 星尘生命时长（秒）：稍长于拖尾；DOM 移除同样 +REMOVE_OFFSET */
const DUST_LIFE = 1.6;
/** DOM 移除相对淡出动画的偏移（毫秒），留一点缓冲 */
const REMOVE_OFFSET = 50;

type Pt = { x: number; y: number };
type DragState = { startX: number; startY: number; origin: Pt; moved: boolean };
type Dust = { id: number; x: number; y: number; dx: number; dy: number; size: number };

/**
 * 常驻粒子参数：用固定种子（mulberry32）生成，保证 SSR 与客户端一致，
 * 避免随机值导致的 hydration 不一致。
 */
const rand = mulberry32(hashSeed("sprite-particles"));
const PARTICLES = Array.from({ length: 20 }, () => ({
  dx: (rand() - 0.5) * 64,
  dy: (rand() - 0.5) * 64,
  dur: 2.6 + rand() * 2.2,
  delay: rand() * 3,
  size: 1.5 + rand() * 1.5,
}));

/** 悬浮小精灵：可拖拽的发光蓝球 + 可展开面板（全局常驻） */
export default function Sprite() {
  const open = useSpriteStore((s) => s.open);
  const view = useSpriteStore((s) => s.view);
  const toggle = useSpriteStore((s) => s.toggle);
  const close = useSpriteStore((s) => s.close);

  const [pos, setPos] = useState<Pt | null>(null); // 球的左上角坐标（null = 尚未初始化）
  const [dragging, setDragging] = useState(false);
  const [trail, setTrail] = useState<{ id: number; x: number; y: number }[]>([]);
  const [dust, setDust] = useState<Dust[]>([]);

  const posRef = useRef<Pt | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // 记录「本次交互是否发生了拖动」，用于区分点击与拖动（拖动后不弹面板）
  const justDraggedRef = useRef(false);
  const trailId = useRef(0);
  const dustId = useRef(0);

  // 初始化位置：优先读 localStorage，否则默认右下角
  // 用 setTimeout 异步设置，避免在 effect 内同步 setState 触发级联渲染
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      let next: Pt = { x: w - MARGIN - BALL, y: h - MARGIN - BALL };
      try {
        const saved = localStorage.getItem(POS_KEY);
        if (saved) {
          const p = JSON.parse(saved) as Pt;
          next = {
            x: Math.min(Math.max(MARGIN, p.x), w - MARGIN - BALL),
            y: Math.min(Math.max(MARGIN, p.y), h - MARGIN - BALL),
          };
        }
      } catch {
        /* 读取失败则用默认位置 */
      }
      posRef.current = next;
      setPos(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // 拖拽移动：更新位置、记录拖尾光带点、并在路径上随机飞溅星尘粒子
  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const next = {
      x: Math.min(Math.max(MARGIN, d.origin.x + dx), w - MARGIN - BALL),
      y: Math.min(Math.max(MARGIN, d.origin.y + dy), h - MARGIN - BALL),
    };
    posRef.current = next;
    setPos(next);

    const cx = next.x + BALL / 2;
    const cy = next.y + BALL / 2;

    // 拖尾光带点：按 TRAIL_LIFE 淡出，并在淡出后（+偏移）从 DOM 移除
    const tid = trailId.current++;
    setTrail((t) => [...t.slice(-50), { id: tid, x: cx, y: cy }]);
    window.setTimeout(() => setTrail((t) => t.filter((p) => p.id !== tid)), TRAIL_LIFE * 1000 + REMOVE_OFFSET);

    // 星尘粒子：沿拖拽路径随机方向飞溅、飘散消失
    const count = 2 + Math.floor(Math.random() * 2); // 每次 2–3 颗
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random() * 100;
      const id = dustId.current++;
      const particle: Dust = {
        id,
        x: cx,
        y: cy,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        size: 2 + Math.random() * 2.5,
      };
      setDust((arr) => [...arr.slice(-50), particle]);
      window.setTimeout(() => setDust((arr) => arr.filter((p) => p.id !== id)), DUST_LIFE * 1000 + REMOVE_OFFSET);
    }
  }, []);

  // 结束拖拽：记录本次是否拖动（供 click 判断），并保存位置
  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    justDraggedRef.current = d?.moved ?? false;
    dragRef.current = null;
    setDragging(false);
    window.removeEventListener("pointermove", onPointerMove);
    if (d?.moved && posRef.current) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
      } catch {
        /* 存储失败忽略 */
      }
    }
  }, [onPointerMove]);

  /** 按下球体：开始拖拽（并监听全局指针事件） */
  function onPointerDown(e: React.PointerEvent) {
    if (!posRef.current) return;
    justDraggedRef.current = false; // 新一次交互，先重置
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: posRef.current, moved: false };
    setDragging(true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  /** 点击：仅在「非拖动」时开合面板 */
  function onBallClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    toggle();
  }

  // 拖拽时粒子数量翻倍，更密集
  const particles = dragging
    ? [...PARTICLES, ...PARTICLES.map((p) => ({ ...p, dx: p.dx * 1.4, dy: p.dy * 1.4, delay: p.delay + 0.12 }))]
    : PARTICLES;

  // 面板位置：置于球左上方并限制在视口内（pos 初始化后才会渲染面板）
  const panelStyle = pos
    ? {
        left: Math.min(Math.max(8, pos.x + BALL - 360), window.innerWidth - 368),
        top: Math.max(8, pos.y - 472),
      }
    : undefined;

  const ballStyle = pos ? { left: pos.x, top: pos.y } : undefined;

  return (
    <>
      {/* 拖尾光带（加粗、发光、逐点淡出） */}
      {trail.map((p) => (
        <motion.span
          key={p.id}
          className="pointer-events-none fixed z-[58] h-7 w-7 rounded-full"
          style={{
            left: p.x,
            top: p.y,
            translateX: "-50%",
            translateY: "-50%",
            background: `radial-gradient(circle, rgba(160,215,255,0.85) 0%, rgba(124,196,255,0.35) 45%, rgba(124,196,255,0) 70%)`,
            filter: "blur(1px)",
          }}
          initial={{ opacity: 0.85, scale: 1 }}
          animate={{ opacity: 0, scale: 0.4 }}
          transition={{ duration: TRAIL_LIFE, ease: "easeOut" }}
        />
      ))}

      {/* 星尘粒子（拖动路径上飞溅、飘散消失） */}
      {dust.map((p) => (
        <motion.span
          key={p.id}
          className="pointer-events-none fixed z-[59] rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            translateX: "-50%",
            translateY: "-50%",
            background: SPARK,
            boxShadow: `0 0 6px 2px rgba(124,196,255,0.9)`,
          }}
          initial={{ x: 0, y: 0, opacity: 0.95, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.2 }}
          transition={{ duration: DUST_LIFE, ease: "easeOut" }}
        />
      ))}

      {/* 常驻粒子（更细碎、青蓝、发光） */}
      {pos &&
        particles.map((p, i) => (
          <motion.span
            key={i}
            className="pointer-events-none fixed z-[59] rounded-full"
            style={{
              left: pos.x + BALL / 2,
              top: pos.y + BALL / 2,
              width: p.size,
              height: p.size,
              translateX: "-50%",
              translateY: "-50%",
              background: SPARK,
              boxShadow: `0 0 5px 1.5px rgba(124,196,255,0.9)`,
            }}
            animate={{ x: [0, p.dx], y: [0, p.dy], opacity: [0, 0.95, 0], scale: [0.5, 1, 0.3] }}
            transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
          />
        ))}

      {/* 展开面板 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={panelStyle}
            className={`fixed z-[60] flex h-[460px] w-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f18]/95 text-white shadow-2xl backdrop-blur-xl ${
              panelStyle ? "" : "bottom-24 right-6"
            }`}
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-medium">小精灵</span>
              <button
                type="button"
                onClick={close}
                aria-label="收起"
                className="text-white/50 outline-none transition-colors hover:text-white"
              >
                ✕
              </button>
            </header>
            <ActionBar />
            <div className="min-h-0 flex-1">
              {view === "chat" ? <ChatPanel /> : <UploadMemoryForm onDone={close} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 可拖拽的发光蓝球 */}
      <motion.button
        type="button"
        onPointerDown={onPointerDown}
        onClick={onBallClick}
        style={ballStyle}
        aria-label="小精灵"
        className={`fixed z-[60] h-14 w-14 touch-none select-none rounded-full outline-none ${
          ballStyle ? "" : "bottom-6 right-6"
        }`}
      >
        {/* 外层呼吸光晕 */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,196,255,0.55) 0%, rgba(80,160,255,0) 70%)" }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.95, 0.6] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* 半透明球体（青蓝 / 电光蓝） */}
        <motion.span
          className="absolute inset-[10px] rounded-full border border-white/30"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, rgba(225,245,255,0.95), rgba(110,200,255,0.55) 45%, rgba(40,120,220,0.5) 100%)",
            boxShadow:
              "0 0 18px 6px rgba(90,190,255,0.7), inset 0 0 12px rgba(255,255,255,0.55)",
          }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.button>
    </>
  );
}
