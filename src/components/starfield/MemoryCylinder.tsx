/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  TRACK_GAP,
  flowTilt,
  tileJitter,
  trackCapacity,
  trackCrossPositions,
} from "@/lib/layout-seed";
import { useElementSize } from "@/lib/use-element-size";
import { useIsMobile, useMediaQuery } from "@/lib/use-media-query";
import type { MemoryCard } from "@/lib/db/queries";
import TimelineRail, { VerticalTimelineRail } from "./TimelineRail";

/** 宽屏卡片尺寸 */
const CARD_NORMAL = { w: 200, h: 140 };
/** 窄屏 / 横屏紧凑卡片尺寸 */
const CARD_COMPACT = { w: 150, h: 105 };
/** 自动流动速度（px/s） */
const FLOW_SPEED = 12;
/** 卡片标题占用的纵向长度（含间距，px）：算轨道步长用，避免相邻卡片贴合 */
const CARD_CAPTION = 26;
/** 「大半径滚筒」半径系数：相对视口长边，越大越接近平面流动 */
const RADIUS_FACTOR = 2.5;

type CardSize = { w: number; h: number };
type Size = { w: number; h: number };

/** 回忆卡片外观：白色常驻微光 + hover 增强 */
function MemoryCardFace({ memory, compact = false }: { memory: MemoryCard; compact?: boolean }) {
  return (
    <div
      className={`block overflow-hidden rounded-xl border border-white/15 bg-black/40 ring-1 ring-white/20 shadow-[0_0_18px_2px_rgba(255,255,255,0.18)] transition-shadow duration-300 hover:ring-white/45 hover:shadow-[0_0_28px_6px_rgba(255,255,255,0.32)] ${
        compact ? "h-[105px] w-[150px]" : "h-[140px] w-[200px]"
      }`}
    >
      {memory.cover ? (
        <img
          src={`/api/media/${memory.cover}`}
          alt={memory.title}
          draggable={false}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm text-white/50">
          {memory.title}
        </span>
      )}
    </div>
  );
}

/**
 * 记忆展示总入口：宽屏=上下两行横向轨道，窄屏=左右两列纵向轨道。
 * 两轨总容量内直接平铺；超出则转为「大半径滚筒」的流动形态。
 */
export default function MemoryCylinder({ memories }: { memories: MemoryCard[] }) {
  const isMobile = useIsMobile();
  const [ref, size] = useElementSize<HTMLDivElement>();

  if (memories.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/35">
        这个分类下还没有回忆
      </div>
    );
  }

  // 窄屏竖屏 → 纵向轨道（左右两列）；宽屏/横屏 → 横向轨道（上下两行）
  const vertical = isMobile;
  // 矮容器（手机横屏）用紧凑卡片
  const compact = isMobile || (size.h > 0 && size.h < 480);
  const card = compact ? CARD_COMPACT : CARD_NORMAL;

  const mainAvail = vertical ? size.h : size.w;
  const cardMain = vertical ? card.h : card.w;
  const capacity =
    mainAvail > 0 ? trackCapacity(mainAvail - TRACK_GAP * 3, cardMain + CARD_CAPTION) : 3;
  const threshold = capacity * 2;

  return (
    <div ref={ref} className="absolute inset-0">
      {size.w > 0 &&
        (memories.length <= threshold ? (
          <TileBoard memories={memories} card={card} vertical={vertical} size={size} />
        ) : (
          <FlowTracks memories={memories} card={card} vertical={vertical} size={size} />
        ))}
    </div>
  );
}

/** 双轨平铺：每轨均匀铺开 + 大幅随机偏移 + 轻微旋转 + 缓缓浮动 */
function TileBoard({
  memories,
  card,
  vertical,
  size,
}: {
  memories: MemoryCard[];
  card: CardSize;
  vertical: boolean;
  size: Size;
}) {
  const router = useRouter();

  // 交替分配到两轨，并记录每张卡片在本轨内的序号
  const placed: { m: MemoryCard; i: number; track: number; k: number; cnt: number }[] = [];
  const counts = [0, 0];
  for (let i = 0; i < memories.length; i++) counts[i % 2]++;
  const seen = [0, 0];
  memories.forEach((m, i) => {
    const track = i % 2;
    placed.push({ m, i, track, k: seen[track]++, cnt: Math.max(1, counts[track]) });
  });

  const mainLen = vertical ? size.h : size.w;
  const crossLen = vertical ? size.w : size.h;
  const cardMain = vertical ? card.h : card.w;
  const pad = TRACK_GAP * 1.5;
  const avail = Math.max(1, mainLen - pad * 2);
  const compact = card.w === CARD_COMPACT.w;
  const trackCross = trackCrossPositions(crossLen, vertical ? card.w : card.h);

  return (
    <>
      {placed.map(({ m, i, track, k, cnt }) => {
        const j = tileJitter(m.seed, i);
        // 「大幅随机偏移」以卡片自身尺寸为基准（不是整条轨道），避免单张卡片被推得很偏
        const alongRaw =
          pad + ((k + 0.5) / cnt) * avail + j.along * (cardMain + TRACK_GAP) * 2.4;
        const along = Math.min(mainLen - pad * 0.4, Math.max(pad * 0.4, alongRaw));
        const cross = trackCross[track] + j.cross * crossLen;
        return (
          <motion.div
            key={m.id}
            className="absolute"
            style={{
              left: vertical ? cross : along,
              top: vertical ? along : cross,
              translateX: "-50%",
              translateY: "-50%",
            }}
            animate={{
              x: [0, j.floatAmp * 0.7, 0, -j.floatAmp * 0.7, 0],
              y: [0, -j.floatAmp, 0, j.floatAmp, 0],
            }}
            transition={{ duration: j.floatDur, repeat: Infinity, ease: "easeInOut" }}
          >
            <div style={{ transform: `rotate(${j.rotate}deg) scale(${j.scale})` }}>
              <button
                type="button"
                onClick={() => router.push(`/memory/${m.id}`)}
                className="block cursor-pointer outline-none"
              >
                <MemoryCardFace memory={m} compact={compact} />
                <p
                  className={`mt-2 truncate text-center text-xs text-white/70 ${
                    compact ? "w-[150px]" : "w-[200px]"
                  }`}
                >
                  {m.title}
                </p>
              </button>
            </div>
          </motion.div>
        );
      })}

      {vertical ? (
        <VerticalTimelineRail memories={memories} />
      ) : (
        <TimelineRail memories={memories} />
      )}
    </>
  );
}

/** 双轨流动：大半径滚筒（近似平面），只渲染可见卡片，两端渐隐 */
function FlowTracks({
  memories,
  card,
  vertical,
  size,
}: {
  memories: MemoryCard[];
  card: CardSize;
  vertical: boolean;
  size: Size;
}) {
  const router = useRouter();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const mainLen = vertical ? size.h : size.w;
  const crossLen = vertical ? size.w : size.h;
  const cardMain = vertical ? card.h : card.w;
  const step = cardMain + CARD_CAPTION + TRACK_GAP;
  // 半径设得远大于屏幕：滚筒退化为接近平面的流动，只在两端留下很轻的弧度
  const radius = Math.max(mainLen * RADIUS_FACTOR, 1200);
  const compact = card.w === CARD_COMPACT.w;
  const trackCross = trackCrossPositions(crossLen, vertical ? card.w : card.h);

  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastPosRef = useRef(0);
  const movedRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [ready, setReady] = useState(false);

  // 每次进入随机初始位置（客户端生成），随后淡入，避免看到跳变
  useEffect(() => {
    const timer = window.setTimeout(() => {
      offsetRef.current = Math.random() * step * 8;
      setOffset(offsetRef.current);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [step]);

  // 自动流动：offset 递减（横向向左 / 纵向向上），时间由旧至新
  useEffect(() => {
    if (reduceMotion || !ready) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 1) {
          // 松手后的惯性：与拖动同向
          offsetRef.current += velocityRef.current * dt;
          velocityRef.current *= 0.94;
        } else {
          velocityRef.current = 0;
          offsetRef.current -= FLOW_SPEED * dt;
        }
        setOffset(offsetRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, ready]);

  /** 拖动：沿轨道方向跟手移动 */
  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    movedRef.current = false;
    lastPosRef.current = vertical ? e.clientY : e.clientX;
    velocityRef.current = 0;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const p = vertical ? e.clientY : e.clientX;
    const d = p - lastPosRef.current;
    lastPosRef.current = p;
    if (Math.abs(d) > 2) {
      movedRef.current = true;
      containerRef.current?.setPointerCapture(e.pointerId);
    }
    offsetRef.current += d;
    velocityRef.current = d * 60;
    setOffset(offsetRef.current);
  }

  function endDrag(e: React.PointerEvent) {
    draggingRef.current = false;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }

  function openMemory(id: string) {
    if (movedRef.current) return;
    router.push(`/memory/${id}`);
  }

  // 计算可见卡片（含一张卡缓冲，滑动时不闪）
  const counts = [0, 0];
  for (let i = 0; i < memories.length; i++) counts[i % 2]++;
  const seen = [0, 0];
  const nodes: { m: MemoryCard; main: number; cross: number; rot: number }[] = [];
  memories.forEach((m, i) => {
    const track = i % 2;
    const k = seen[track]++;
    const cnt = Math.max(1, counts[track]);
    const span = cnt * step;
    const tilt = flowTilt(m.seed, i, track);
    // 均匀分布 + 整体随机偏移（offset）+ 沿轨道小幅扰动：既随机又不重叠
    const raw = k * step + offset + tilt.jitter * TRACK_GAP * 0.6;
    const wrapped = ((raw % span) + span) % span;
    const main = wrapped - span / 2 + mainLen / 2;
    if (main < -cardMain - CARD_CAPTION || main > mainLen + CARD_CAPTION) return;
    const cross = trackCross[track] + tilt.lag * crossLen;
    // 大半径带来的轻微弧度
    const arc = ((main - mainLen / 2) / radius) * 57.2958;
    nodes.push({ m, main, cross, rot: tilt.rotate + (vertical ? -arc : arc) });
  });

  // 当前最接近屏幕中心的卡片：供星轨光标使用
  let activeId: string | null = null;
  let bestD = Infinity;
  for (const n of nodes) {
    const d = Math.abs(n.main - mainLen / 2);
    if (d < bestD) {
      bestD = d;
      activeId = n.m.id;
    }
  }

  // 两端渐隐（用 mask，GPU 合成，比逐卡片 opacity 更平滑）
  const mask = vertical
    ? "linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)"
    : "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none select-none transition-opacity duration-500"
      style={{ opacity: ready ? 1 : 0, cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="absolute inset-0"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {nodes.map(({ m, main, cross, rot }) => (
          <div
            key={m.id}
            className="absolute"
            style={{
              left: vertical ? cross : main,
              top: vertical ? main : cross,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
            }}
          >
            <button
              type="button"
              onClick={() => openMemory(m.id)}
              className="block cursor-pointer outline-none"
            >
              <MemoryCardFace memory={m} compact={compact} />
              <p
                className={`mt-2 truncate text-center text-xs text-white/70 ${
                  compact ? "w-[150px]" : "w-[200px]"
                }`}
              >
                {m.title}
              </p>
            </button>
          </div>
        ))}
      </div>

      {vertical ? (
        <VerticalTimelineRail memories={memories} activeId={activeId} showCursor />
      ) : (
        <TimelineRail memories={memories} activeId={activeId} showCursor />
      )}
    </div>
  );
}
