"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import PetArt, { ACTION_DURATION_MS, CHAR, FRAME, type PetAction } from "@/components/xiaoriyue-drag/PetArt";
import { hashSeed, mulberry32 } from "@/lib/layout-seed";
import { useIsMobile, useMediaQuery } from "@/lib/use-media-query";
import { useSpriteStore } from "@/store/sprite";
import ActionBar from "./ActionBar";
import ChatPanel from "./ChatPanel";
import MemoryForm from "./MemoryForm";
import SearchPanel from "./SearchPanel";
import SettingsPanel from "./SettingsPanel";

/**
 * 角色主体视觉高度（px）：桌面与移动一致，略大于原 56px 悬浮球。
 * 美术包只声明 viewBox 与角色包围盒，尺寸换算由宿主完成（见 SPEC.md §3）。
 */
const PET_H = 80;
/** 外框宽 / 高（px）：按 viewBox 与角色主体比例换算，保证倾斜与动作余量不被裁切 */
const PET_W = (PET_H * FRAME.w) / CHAR.h;
const PET_BOX_H = (PET_H * FRAME.h) / CHAR.h;
/** 角色主体矩形相对外框左上角的偏移与尺寸（px）——命中区与避让都用它 */
const BODY = {
  left: ((CHAR.x - FRAME.x) / FRAME.w) * PET_W,
  top: ((CHAR.y - FRAME.y) / FRAME.h) * PET_BOX_H,
  w: (CHAR.w / FRAME.w) * PET_W,
  h: (CHAR.h / FRAME.h) * PET_BOX_H,
};
/** 角色主体中心相对外框左上角的偏移（拖尾光带 / 粒子原点） */
const CORE = { dx: BODY.left + BODY.w / 2, dy: BODY.top + BODY.h / 2 };
/** 命中区（角色主体）在外框内的百分比：点影子与顶部空白不会拖走角色 */
const HIT = {
  left: ((CHAR.x - FRAME.x) / FRAME.w) * 100,
  top: ((CHAR.y - FRAME.y) / FRAME.h) * 100,
  w: (CHAR.w / FRAME.w) * 100,
  h: (CHAR.h / FRAME.h) * 100,
};
/** 视口边距 */
const MARGIN = 12;
/** 位置存储键（localStorage） */
const POS_KEY = "sprite-pos";
/** 桌面浮动面板尺寸与间隙（用于角色 / 面板互相避让） */
const PANEL_W = 360;
const PANEL_H = 460;
const PANEL_GAP = 12;
/** 拖拽倾斜上限（度） */
const TILT_MAX = 6;
/** 角色与面板之间的保底间隙（px）：避免像素级贴边看起来像重叠 */
const OUT_GAP = 1;
/** 科幻青蓝主色（电光蓝）：走主题 token，见 globals.css 的 --accent */
const SPARK = "rgb(var(--accent))";
/** 拖尾生命时长（秒）：淡出动画时长；DOM 移除在此基础上 +REMOVE_OFFSET */
const TRAIL_LIFE = 1.2;
/** 星尘生命时长（秒）：稍长于拖尾；DOM 移除同样 +REMOVE_OFFSET */
const DUST_LIFE = 1.6;
/** DOM 移除相对淡出动画的偏移（毫秒），留一点缓冲 */
const REMOVE_OFFSET = 50;

type Pt = { x: number; y: number };
/** 面板定位用（CSS left/top，避免与 framer-motion 的 x/y transform 混淆） */
type Box = { left: number; top: number };
type Rect = { left: number; top: number; right: number; bottom: number };
type DragState = { startX: number; startY: number; origin: Pt; moved: boolean };
type Dust = { id: number; x: number; y: number; dx: number; dy: number; size: number };

/** 外框左上角坐标 → 角色主体矩形（避让与命中判定用） */
function bodyRect(p: Pt): Rect {
  return {
    left: p.x + BODY.left,
    top: p.y + BODY.top,
    right: p.x + BODY.left + BODY.w,
    bottom: p.y + BODY.top + BODY.h,
  };
}

/** 面板左上角坐标 → 面板矩形 */
function panelRect(b: Box): Rect {
  return { left: b.left, top: b.top, right: b.left + PANEL_W, bottom: b.top + PANEL_H };
}

function overlaps(a: Rect, b: Rect) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** 外框位置夹取到视口内（并让开底部安全区） */
function clampViewport(p: Pt, safeBottom: number): Pt {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, w - MARGIN - PET_W)),
    y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, h - MARGIN - PET_BOX_H - safeBottom)),
  };
}

/**
 * 把角色沿最小位移推出面板矩形（用于「面板挤开角色」）。
 * 逐个尝试四个方向（按位移从小到大），取第一个「夹取到视口内后仍不重叠」的方向；
 * 都不可行时退回位移最小的方向（保底：宁可重叠也不把角色丢出视口）。
 */
function pushOut(p: Pt, rect: Rect, safeBottom: number): Pt {
  const r = bodyRect(p);
  const gap = OUT_GAP;
  const moves: Pt[] = [
    { x: 0, y: rect.top - r.bottom - gap }, // 向上
    { x: 0, y: rect.bottom - r.top + gap }, // 向下
    { x: rect.left - r.right - gap, y: 0 }, // 向左
    { x: rect.right - r.left + gap, y: 0 }, // 向右
  ].sort((a, b) => Math.abs(a.x) + Math.abs(a.y) - (Math.abs(b.x) + Math.abs(b.y)));
  for (const m of moves) {
    const cand = clampViewport({ x: p.x + m.x, y: p.y + m.y }, safeBottom);
    if (!overlaps(bodyRect(cand), rect)) return cand;
  }
  const fallback = moves[0];
  return clampViewport({ x: p.x + fallback.x, y: p.y + fallback.y }, safeBottom);
}

/**
 * 由角色位置推导面板候选位置（优先放在角色左上方，全部夹在视口内）。
 * 角色不能与面板重叠，所以候选按「左上 → 左下 → 左 → 右 → 右上」依次尝试。
 */
function panelCandidates(p: Pt): Box[] {
  const maxL = Math.max(8, window.innerWidth - PANEL_W - 8);
  const maxT = Math.max(8, window.innerHeight - PANEL_H - 8);
  const raw: Box[] = [
    { left: p.x + PET_W - PANEL_W, top: p.y - PANEL_H - PANEL_GAP },
    { left: p.x + PET_W - PANEL_W, top: p.y + PET_BOX_H + PANEL_GAP },
    { left: p.x - PANEL_W - PANEL_GAP, top: p.y + PET_BOX_H - PANEL_H },
    { left: p.x + PET_W + PANEL_GAP, top: p.y + PET_BOX_H - PANEL_H },
    { left: p.x + PET_W + PANEL_GAP, top: p.y - PANEL_H - PANEL_GAP },
  ];
  return raw.map((b) => ({
    left: Math.min(Math.max(8, b.left), maxL),
    top: Math.min(Math.max(8, b.top), maxT),
  }));
}

/** 面板默认位置：第一个与角色主体不重叠的候选（都重叠时退回第一个） */
function derivedPanelPos(p: Pt): Box {
  const body = bodyRect(p);
  const list = panelCandidates(p);
  return list.find((c) => !overlaps(body, panelRect(c))) ?? list[0];
}

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

/** 悬浮小精灵：可拖拽的线稿角色 + 可展开面板（全局常驻） */
export default function Sprite() {
  const open = useSpriteStore((s) => s.open);
  const view = useSpriteStore((s) => s.view);
  const editMemoryId = useSpriteStore((s) => s.editMemoryId);
  const toggle = useSpriteStore((s) => s.toggle);
  const close = useSpriteStore((s) => s.close);

  const [pos, setPos] = useState<Pt | null>(null); // 外框的左上角坐标（null = 尚未初始化）
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState(0); // 拖拽倾斜角（度）
  const [trail, setTrail] = useState<{ id: number; x: number; y: number }[]>([]);
  const [dust, setDust] = useState<Dust[]>([]);
  // 宽屏面板左上角坐标（null = 跟随角色推算；手动拖过后与角色解耦，刷新即复位）
  const [panelPos, setPanelPos] = useState<Box | null>(null);
  // 一次性动作：点开面板时播放 happy，播完由宿主切回 idle（见 xiaoriyue-drag/README.md）
  const [action, setAction] = useState<PetAction>("idle");
  const [actionKey, setActionKey] = useState(0);

  // 窄屏：面板改为底部抽屉
  const isMobile = useIsMobile();
  // 降载：减少动态效果（关闭粒子无限动画、拖拽特效与倾斜）
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // 底部安全区高度（px）：让角色避开 iPhone 底部横条
  const safeBottomRef = useRef(0);

  const posRef = useRef<Pt | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // 面板拖动状态
  const panelDragRef = useRef<{ startX: number; startY: number; origin: Box } | null>(null);
  // 记录「本次交互是否发生了拖动」，用于区分点击与拖动（拖动后不弹面板）
  const justDraggedRef = useRef(false);
  // 倾斜速度采样（水平位移 / 时间）
  const tiltXRef = useRef(0);
  const tiltTimeRef = useRef(0);
  const trailId = useRef(0);
  const dustId = useRef(0);
  // happy 动作计时器：重复触发需取消旧计时，卸载需清理
  const actionTimerRef = useRef<number | null>(null);

  // 卸载时清掉 happy 计时，避免卸载后再 setState
  useEffect(
    () => () => {
      if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current);
    },
    [],
  );

  // 初始化位置：优先读 localStorage，否则默认右下角
  // 用 setTimeout 异步设置，避免在 effect 内同步 setState 触发级联渲染
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // 读取底部安全区（刘海屏底部横条），让角色与其保持距离；
      // 窄屏再让开详情页固定底栏，避免角色压住底栏按钮
      const safeB =
        (parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom"),
        ) || 0) + (isMobile ? 64 : 0);
      safeBottomRef.current = safeB;
      const maxY = h - MARGIN - PET_BOX_H - safeB;
      let next: Pt = { x: w - MARGIN - PET_W, y: maxY };
      try {
        const saved = localStorage.getItem(POS_KEY);
        if (saved) {
          const p = JSON.parse(saved) as Pt;
          next = clampViewport(p, safeB);
        }
      } catch {
        /* 读取失败则用默认位置 */
      }
      posRef.current = next;
      setPos(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isMobile]);

  // 窄屏打开面板时锁定 body 滚动，避免背后内容跟随滑动
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  // 拖拽移动：更新位置与倾斜、记录拖尾光带点、并在路径上随机飞溅星尘粒子
  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;

    let next = clampViewport({ x: d.origin.x + dx, y: d.origin.y + dy }, safeBottomRef.current);

    // 面板打开时作为静态障碍：角色不得进入面板区域（沿最小位移推出后重新夹取）
    if (open && !isMobile) {
      // 面板位置用「即将生效的角色位置」推导，避免与下一帧渲染的面板错位一拍
      const rect = panelRect(panelPos ?? derivedPanelPos(next));
      if (overlaps(bodyRect(next), rect)) next = pushOut(next, rect, safeBottomRef.current);
    }
    posRef.current = next;
    setPos(next);

    // 倾斜：按水平速度跟随（停止后由 CSS transition 回正；reduced-motion 下不倾斜）
    const now = performance.now();
    const velocity = (e.clientX - tiltXRef.current) / Math.max(8, now - tiltTimeRef.current);
    tiltXRef.current = e.clientX;
    tiltTimeRef.current = now;
    setTilt(reduceMotion ? 0 : Math.max(-TILT_MAX, Math.min(TILT_MAX, velocity * 5)));

    const cx = next.x + CORE.dx;
    const cy = next.y + CORE.dy;

    // reduced-motion 下不产生拖尾/星尘特效
    if (reduceMotion) return;

    // 拖尾光带点：按 TRAIL_LIFE 淡出，并在淡出后（+偏移）从 DOM 移除
    const tid = trailId.current++;
    setTrail((t) => [...t.slice(-50), { id: tid, x: cx, y: cy }]);
    window.setTimeout(() => setTrail((t) => t.filter((p) => p.id !== tid)), TRAIL_LIFE * 1000 + REMOVE_OFFSET);

    // 星尘粒子：沿拖拽路径随机方向飞溅、飘散消失（宽窄屏统一 1 颗）
    const count = 1;
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
  }, [reduceMotion, open, isMobile, panelPos]);

  // 结束拖拽：记录本次是否拖动（供 click 判断），保存位置并让倾斜回正
  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    justDraggedRef.current = d?.moved ?? false;
    dragRef.current = null;
    setDragging(false);
    setTilt(0);
    window.removeEventListener("pointermove", onPointerMove);
    if (d?.moved && posRef.current) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
      } catch {
        /* 存储失败忽略 */
      }
    }
  }, [onPointerMove]);

  /** 按下角色：开始拖拽（并监听全局指针事件） */
  function onPointerDown(e: React.PointerEvent) {
    if (!posRef.current) return;
    justDraggedRef.current = false; // 新一次交互，先重置
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: posRef.current, moved: false };
    tiltXRef.current = e.clientX;
    tiltTimeRef.current = performance.now();
    setDragging(true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  /** 播放一次开心动作：清旧计时后从头播放，播完切回 idle（美术包不自行改 props） */
  function playHappy() {
    if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current);
    setAction("happy");
    setActionKey((k) => k + 1);
    actionTimerRef.current = window.setTimeout(() => {
      setAction("idle");
      actionTimerRef.current = null;
    }, ACTION_DURATION_MS.happy);
  }

  /** 点击：仅在「非拖动」时开合面板；打开面板的那一次附带一次开心动作 */
  function onBallClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (!open) playHappy();
    toggle();
  }

  // 拖动面板标题栏：更新面板位置，并把角色挤开（仅存内存，刷新即复位）
  const onPanelPointerMove = useCallback((e: PointerEvent) => {
    const d = panelDragRef.current;
    if (!d) return;
    const next = {
      left: Math.min(
        Math.max(8, d.origin.left + (e.clientX - d.startX)),
        window.innerWidth - PANEL_W - 8,
      ),
      top: Math.min(
        Math.max(8, d.origin.top + (e.clientY - d.startY)),
        window.innerHeight - PANEL_H - 8,
      ),
    };
    setPanelPos(next);
    // 面板可以挤开角色：被挤开的坐标只更新内存，不写 localStorage
    const p = posRef.current;
    if (p) {
      const rect = panelRect(next);
      if (overlaps(bodyRect(p), rect)) {
        const pushed = pushOut(p, rect, safeBottomRef.current);
        posRef.current = pushed;
        setPos(pushed);
      }
    }
  }, []);

  const onPanelPointerUp = useCallback(() => {
    panelDragRef.current = null;
    window.removeEventListener("pointermove", onPanelPointerMove);
  }, [onPanelPointerMove]);

  /** 在标题栏按下开始拖动面板（标题栏上的按钮不触发） */
  function onPanelPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    const origin = panelPos ?? (pos ? derivedPanelPos(pos) : null);
    if (!origin) return;
    panelDragRef.current = { startX: e.clientX, startY: e.clientY, origin };
    window.addEventListener("pointermove", onPanelPointerMove);
    window.addEventListener("pointerup", onPanelPointerUp, { once: true });
  }

  // 拖拽时粒子数量翻倍；宽窄屏统一限 10 颗；reduced-motion 关闭常驻粒子
  const baseParticles = PARTICLES.slice(0, 10);
  const particles = reduceMotion
    ? []
    : dragging
      ? [...baseParticles, ...baseParticles.map((p) => ({ ...p, dx: p.dx * 1.4, dy: p.dy * 1.4, delay: p.delay + 0.12 }))]
      : baseParticles;

  // 面板位置：优先用户拖动的坐标，否则置于角色左上方（pos 初始化后才会渲染面板）
  const panelStyle = panelPos ?? (pos ? derivedPanelPos(pos) : undefined);

  // 角色外框样式（位置 + 尺寸 + 倾斜角变量）
  const petStyle = {
    left: pos?.x ?? undefined,
    top: pos?.y ?? undefined,
    width: PET_W,
    height: PET_BOX_H,
    "--pet-angle": `${tilt}deg`,
  } as CSSProperties;

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
            background: `radial-gradient(circle, rgb(var(--sky-star) / 0.85) 0%, rgb(var(--accent) / 0.35) 45%, rgb(var(--accent) / 0) 70%)`,
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
            boxShadow: `0 0 6px 2px rgb(var(--accent) / 0.9)`,
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
              left: pos.x + CORE.dx,
              top: pos.y + CORE.dy,
              width: p.size,
              height: p.size,
              translateX: "-50%",
              translateY: "-50%",
              background: SPARK,
              boxShadow: `0 0 5px 1.5px rgb(var(--accent) / 0.9)`,
            }}
            animate={{ x: [0, p.dx], y: [0, p.dy], opacity: [0, 0.95, 0], scale: [0.5, 1, 0.3] }}
            transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
          />
        ))}

      {/* 展开面板：窄屏为底部抽屉（含遮罩），宽屏为角色旁的浮动面板 */}
      <AnimatePresence>
        {open && isMobile && (
          <motion.div
            key="sprite-mask"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-[65] bg-black/50 backdrop-blur-sm"
          />
        )}
        {open && (
          <motion.div
            key="sprite-panel"
            initial={isMobile ? { y: "100%" } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: isMobile ? 0.26 : 0.18, ease: "easeOut" }}
            style={isMobile ? undefined : panelStyle}
            className={
              isMobile
                ? "fixed inset-x-0 bottom-0 z-[70] flex h-[min(78dvh,560px)] w-full flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-panel/95 pb-[var(--safe-bottom)] text-white shadow-2xl backdrop-blur-xl"
                : `fixed z-[60] flex h-[460px] w-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel/95 text-white shadow-2xl backdrop-blur-xl ${
                    panelStyle ? "" : "bottom-24 right-6"
                  }`
            }
          >
            <header
              onPointerDown={isMobile ? undefined : onPanelPointerDown}
              className={`flex items-center justify-between border-b border-white/10 px-4 py-3 ${
                isMobile ? "" : "cursor-grab select-none active:cursor-grabbing"
              }`}
            >
              <span className="text-sm font-medium">
                {view === "edit"
                  ? "编辑回忆"
                  : view === "upload"
                    ? "上传回忆"
                    : view === "search"
                      ? "搜索回忆"
                      : "小精灵"}
              </span>
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
              {view === "chat" ? (
                <ChatPanel />
              ) : view === "search" ? (
                <SearchPanel />
              ) : view === "upload" ? (
                <MemoryForm mode="create" onDone={close} />
              ) : view === "edit" && editMemoryId ? (
                <MemoryForm mode="edit" memoryId={editMemoryId} onDone={close} />
              ) : (
                <SettingsPanel />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        可拖拽的小精灵角色：
        外框 = 造型 + 动作余量（透明、不拦事件），命中区只覆盖角色主体（见 SPEC.md §3）。
        层级 z-[62]：高于桌面面板（z-60），低于窄屏遮罩（z-65）与抽屉（z-70）。
      */}
      <div
        className={`pointer-events-none fixed z-[62] touch-none select-none ${
          pos ? "" : "bottom-6 right-6"
        }`}
        style={petStyle}
      >
        <PetArt
          className="pointer-events-none absolute inset-0 h-full w-full text-star"
          action={action}
          actionKey={actionKey}
        />
        <button
          type="button"
          onPointerDown={onPointerDown}
          onClick={onBallClick}
          aria-label="小精灵：点击打开面板，拖动可移动"
          title="点击打开 · 拖动移动"
          className="pointer-events-auto absolute cursor-grab touch-none outline-none active:cursor-grabbing"
          style={{
            left: `${HIT.left}%`,
            top: `${HIT.top}%`,
            width: `${HIT.w}%`,
            height: `${HIT.h}%`,
          }}
        />
      </div>
    </>
  );
}
