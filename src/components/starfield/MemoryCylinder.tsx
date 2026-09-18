/* eslint-disable @next/next/no-img-element */
"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  PER_TRACK_MAX,
  RAIL_CROSS,
  RAIL_MAIN,
  RAIL_MAIN_COMPACT,
  RAIL_COMPACT_BELOW,
  TRACK_GAP,
  flowTilt,
  tileJitter,
  trackCapacity,
  trackCrossPositions,
} from "@/lib/layout-seed";
import { useElementSize } from "@/lib/use-element-size";
import { coverStyle } from "@/lib/crop";
import { useIsMobile, useMediaQuery } from "@/lib/use-media-query";
import { useTrackFlow } from "@/lib/use-track-flow";
import type { MemoryCard } from "@/lib/db/queries";
import TimelineRail, { VerticalTimelineRail } from "./TimelineRail";

/** 卡片尺寸三档：宽屏 / 窄屏 / 手机横屏（空间极紧张）；统一 3:2 与详情页一致 */
const CARD_NORMAL = { w: 200, h: 133 };
const CARD_COMPACT = { w: 150, h: 100 };
const CARD_TINY = { w: 120, h: 80 };
/** 卡片标题占用的纵向长度（含间距，px）：算轨道步长用 */
const CARD_CAPTION = 26;
/** 「大半径滚筒」半径系数：相对视口长边，越大越接近平面流动 */
const RADIUS_FACTOR = 2.5;

type CardTier = "normal" | "compact" | "tiny";
type CardSize = { w: number; h: number };
type Size = { w: number; h: number };

const FACE_CLS: Record<CardTier, string> = {
  normal: "h-[133px] w-[200px]",
  compact: "h-[100px] w-[150px]",
  tiny: "h-[80px] w-[120px]",
};
const CAPTION_CLS: Record<CardTier, string> = {
  normal: "w-[200px]",
  compact: "w-[150px]",
  tiny: "w-[120px]",
};

/** 回忆卡片外观：白色常驻微光 + hover 增强；图片加载完成后淡入 */
const MemoryCardFace = memo(function MemoryCardFace({
  memory,
  tier,
}: {
  memory: MemoryCard;
  tier: CardTier;
}) {
  const [loaded, setLoaded] = useState(false);
  // 命中缓存时 onLoad 可能不触发，用 ref 回调主动检查一次
  const onImgRef = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete) setLoaded(true);
  }, []);
  // 裁剪样式只随焦点/缩放变化，避免父组件重渲染时反复建对象
  const cover = memory.cover;
  const style = useMemo(
    () =>
      cover
        ? coverStyle({ x: cover.focalX, y: cover.focalY, scale: cover.cropScale })
        : undefined,
    [cover],
  );

  return (
    <div
      className={`block overflow-hidden rounded-xl border border-white/15 bg-black/40 ring-1 ring-white/20 shadow-[0_0_18px_2px_rgba(255,255,255,0.18)] transition-shadow duration-300 hover:ring-white/45 hover:shadow-[0_0_28px_6px_rgba(255,255,255,0.32)] ${FACE_CLS[tier]}`}
    >
      {memory.cover ? (
        <img
          ref={onImgRef}
          src={`/api/media/${memory.cover.path}`}
          alt={memory.title}
          draggable={false}
          loading="eager"
          decoding="async"
          onLoad={() => setLoaded(true)}
          style={style}
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm text-white/50">
          {memory.title}
        </span>
      )}
    </div>
  );
});


/**
 * 记忆展示总入口：宽屏=横向轨道（默认上下两行），窄屏=左右两列纵向轨道。
 * 轨道总容量内直接平铺；超出则转为「大半径滚筒」的流动形态。
 */
export default function MemoryCylinder({
  memories,
  rows = 2,
  basisH = 0,
  railCompact,
}: {
  memories: MemoryCard[];
  /** 宽屏轨道数：当前类别「既有子类别又有记忆」时用 1（单排），否则 2 */
  rows?: 1 | 2;
  /** 整页可用高度（header 以下的区域）：只用来选卡片档位，见下 */
  basisH?: number;
  /** 星轨是否用压缩档（由宿主按「有子类别时那块的高度」统一判定，两页一致） */
  railCompact?: boolean;
}) {
  const isMobile = useIsMobile();
  const [ref, size] = useElementSize<HTMLDivElement>();

  if (memories.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/35">
        这个分类下还没有回忆
      </div>
    );
  }

  // 窄屏竖屏 → 纵向轨道（左右两列，空间紧张不单排）；宽屏/横屏 → 横向轨道
  const vertical = isMobile;
  const tracks = vertical ? 2 : rows;
  // 卡片档位：手机横屏（很矮）→ 迷你；窄屏/较矮 → 紧凑；其余 → 常规。
  // 基准用「整页可用高度」而不是本区块高度——有子类别时本区块只占 7/10，
  // 按自身高度算会掉档，卡片比「只有记忆」时小一圈（单排本来也放得下常规档）。
  const basis = basisH > 0 ? basisH : size.h;
  const tier: CardTier =
    basis > 0 && basis < 420
      ? "tiny"
      : isMobile || (basis > 0 && basis < 520)
        ? "compact"
        : "normal";
  const card = tier === "tiny" ? CARD_TINY : tier === "compact" ? CARD_COMPACT : CARD_NORMAL;
  // 星轨高度：宿主给的口径优先；没给时退回「按本区块高度」（旧行为）
  const railCompactNow = railCompact ?? (size.h > 0 && size.h < RAIL_COMPACT_BELOW);

  const mainAvail = vertical ? size.h : size.w;
  const cardMain = vertical ? card.h : card.w;
  // 每条轨道同屏最多 PER_TRACK_MAX 张：双排合计 ≤ 6，单排（有子类别时）≤ 3
  const capacity =
    mainAvail > 0
      ? Math.min(
          trackCapacity(mainAvail - TRACK_GAP * 3, cardMain + CARD_CAPTION),
          PER_TRACK_MAX,
        )
      : PER_TRACK_MAX;
  const threshold = capacity * tracks;

  return (
    <div ref={ref} className="absolute inset-0">
      {size.w > 0 &&
        (memories.length <= threshold ? (
          <TileBoard
            memories={memories}
            card={card}
            tier={tier}
            vertical={vertical}
            tracks={tracks}
            railCompact={railCompactNow}
            size={size}
          />
        ) : (
          <FlowTracks
            memories={memories}
            card={card}
            tier={tier}
            vertical={vertical}
            tracks={tracks}
            railCompact={railCompactNow}
            size={size}
          />
        ))}
    </div>
  );
}

/** 多轨平铺：每轨均匀铺开 + 大幅随机偏移 + 轻微旋转 + 缓缓浮动 */
function TileBoard({
  memories,
  card,
  tier,
  vertical,
  tracks,
  railCompact,
  size,
}: {
  memories: MemoryCard[];
  card: CardSize;
  tier: CardTier;
  vertical: boolean;
  tracks: number;
  railCompact: boolean;
  size: Size;
}) {
  const router = useRouter();
  // 降载：reduced-motion 下关闭卡片浮动动画
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // 交替分配到各轨，并记录每张卡片在本轨内的序号
  const placed: { m: MemoryCard; i: number; track: number; k: number; cnt: number }[] = [];
  const counts = Array.from({ length: tracks }, () => 0);
  for (let i = 0; i < memories.length; i++) counts[i % tracks]++;
  const seen = Array.from({ length: tracks }, () => 0);
  memories.forEach((m, i) => {
    const track = i % tracks;
    placed.push({ m, i, track, k: seen[track]++, cnt: Math.max(1, counts[track]) });
  });

  const mainLen = vertical ? size.h : size.w;
  const crossLen = vertical ? size.w : size.h;
  const cardMain = vertical ? card.h : card.w;
  const cardCross = vertical ? card.w : card.h;
  const pad = TRACK_GAP * 1.5;
  const avail = Math.max(1, mainLen - pad * 2);
  // 交叉方向可用区：纵向轨道避开左侧星轨，横向轨道避开底部星轨
  const railMain = railCompact ? RAIL_MAIN_COMPACT : RAIL_MAIN;
  const zoneStart = vertical ? RAIL_CROSS : 0;
  const zoneLen = Math.max(cardCross, crossLen - (vertical ? RAIL_CROSS : railMain));
  const trackCross = trackCrossPositions(zoneStart, zoneLen, cardCross, tracks);

  // 只有 1~2 段时尽量居中：1 段完全居中；2 段向中心收拢（间距约 1.5 倍卡宽）
  const zoneCenter = zoneStart + zoneLen / 2;
  const centered = memories.length <= 2;
  const crossOf = (track: number): number => {
    // 单排：所有卡片同一行，靠轨道内的横向错位分开
    if (tracks <= 1) return zoneCenter;
    if (memories.length === 1) return zoneCenter;
    if (memories.length === 2) {
      // 间距取 1.5 倍卡宽，但不超出可用区（窄屏空间有限时自动收拢）
      const half = Math.min(
        (cardCross + TRACK_GAP) * 0.75,
        Math.max(0, (zoneLen - cardCross) / 2),
      );
      return zoneCenter + (track === 0 ? -half : half);
    }
    return trackCross[track];
  };

  return (
    <>
      {placed.map(({ m, i, track, k, cnt }) => {
        const j = tileJitter(m.seed, i);
        // 大幅随机偏移限制在本格空隙内：观感明显，又绝不与相邻卡片重叠；
        // 只有 1~2 段时收窄偏移，保证整体仍居中
        const cell = avail / cnt;
        const slack = centered ? avail * 0.25 : Math.max(0, cell - cardMain);
        // 第 2 轨整体错开半张卡：保证两轨同一索引不会排成一条线
        const stagger = tracks > 1 && track === 1 ? (cardMain + TRACK_GAP) * 0.5 : 0;
        const alongRaw =
          pad + ((k + 0.5) / cnt) * avail + stagger + j.along * slack * 0.9;
        const along = Math.min(mainLen - pad * 0.4, Math.max(pad * 0.4, alongRaw));
        const cross = crossOf(track) + j.cross * zoneLen;
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
            animate={
              reduceMotion
                ? undefined
                : {
                    x: [0, j.floatAmp * 0.7, 0, -j.floatAmp * 0.7, 0],
                    y: [0, -j.floatAmp, 0, j.floatAmp, 0],
                  }
            }
            transition={
              reduceMotion
                ? undefined
                : { duration: j.floatDur, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <div style={{ transform: `rotate(${j.rotate}deg) scale(${j.scale})` }}>
              <button
                type="button"
                onClick={() => router.push(`/memory/${m.id}`)}
                className="block cursor-pointer outline-none"
              >
                <MemoryCardFace memory={m} tier={tier} />
                {tier !== "tiny" && (
                  <p
                    className={`mt-2 truncate text-center text-xs text-white/70 ${CAPTION_CLS[tier]}`}
                  >
                    {m.title}
                  </p>
                )}
              </button>
            </div>
          </motion.div>
        );
      })}

      {vertical ? (
        <VerticalTimelineRail memories={memories} />
      ) : (
        <TimelineRail memories={memories} compact={railCompact} />
      )}
    </>
  );
}

/** 流动形态里一张卡的静态布局（与 offset 无关的部分） */
type FlowItem = {
  m: MemoryCard;
  /** 主轴上的未回绕基准位置（offset = 0 时） */
  base: number;
  /** 回绕环长：同一轨道内所有卡片相同 */
  span: number;
  /** 交叉方向位置（静态，JSX 里定死） */
  cross: number;
  /** 卡片自身旋转（不含大半径弧度） */
  rot: number;
};

/** 把一张卡写到主轴位置：只写 transform（不写 left/top，避免每帧触发布局） */
function placeCard(
  el: HTMLElement,
  it: FlowItem,
  main: number,
  vertical: boolean,
  mainLen: number,
  radius: number,
) {
  // 大半径带来的轻微弧度
  const arc = ((main - mainLen / 2) / radius) * 57.2958;
  const rot = it.rot + (vertical ? -arc : arc);
  el.style.transform = vertical
    ? `translate3d(0, ${main.toFixed(2)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(3)}deg)`
    : `translate3d(${main.toFixed(2)}px, 0, 0) translate(-50%, -50%) rotate(${rot.toFixed(3)}deg)`;
}

/** 主轴位置：把「基准 + offset」回绕到环内，再换算成屏幕坐标 */
function mainPos(it: FlowItem, offset: number, mainLen: number) {
  const wrapped = (((it.base + offset) % it.span) + it.span) % it.span;
  return wrapped - it.span / 2 + mainLen / 2;
}

/**
 * 多轨流动：大半径滚筒（近似平面），只渲染可见卡片（含屏外缓冲），两端渐隐。
 *
 * 性能要点：**每帧只写 DOM transform，绝不 setState**。可见集合与星轨光标
 * 用「变了才 setState」的方式更新（按 12px/s 与 ≥480px 的步长，几秒~几十秒才变一次），
 * 否则 12 张卡 + 星轨每帧重渲染要烧掉约 4ms/帧（改前的卡顿主因）。
 */
function FlowTracks({
  memories,
  card,
  tier,
  vertical,
  tracks,
  railCompact,
  size,
}: {
  memories: MemoryCard[];
  card: CardSize;
  tier: CardTier;
  vertical: boolean;
  tracks: number;
  railCompact: boolean;
  size: Size;
}) {
  const router = useRouter();

  const mainLen = vertical ? size.h : size.w;
  const crossLen = vertical ? size.w : size.h;
  const cardMain = vertical ? card.h : card.w;
  const cardCross = vertical ? card.w : card.h;
  // 稀疏化：每条轨道同屏最多 PER_TRACK_MAX 张完整卡片
  const step = Math.max(cardMain + CARD_CAPTION + TRACK_GAP, mainLen / PER_TRACK_MAX);
  // 半径设得远大于屏幕：滚筒退化为接近平面的流动，只在两端留下很轻的弧度
  const radius = Math.max(mainLen * RADIUS_FACTOR, 1200);
  // 交叉方向可用区：纵向轨道避开左侧星轨，横向轨道避开底部星轨
  const railMain = railCompact ? RAIL_MAIN_COMPACT : RAIL_MAIN;
  const zoneStart = vertical ? RAIL_CROSS : 0;
  const zoneLen = Math.max(cardCross, crossLen - (vertical ? RAIL_CROSS : railMain));
  const trackCross = trackCrossPositions(zoneStart, zoneLen, cardCross, tracks);
  // 屏外提前渲染一段距离：让图片有时间加载完成，卡片滑入时不再「突然出现」
  const buffer = Math.max(step, mainLen * 0.25);

  // 自走 + 拖动 + 惯性由公共 hook 提供；这里只算每张卡片的落点
  const {
    containerRef,
    offsetRef,
    ready,
    onFrame,
    onPointerDown,
    onPointerMove,
    endDrag,
    justDragged,
  } = useTrackFlow({ mainLen, vertical });

  /** 静态布局：只在条数 / 轨道数 / 尺寸变化时重算 */
  const items = useMemo<FlowItem[]>(() => {
    const counts = Array.from({ length: tracks }, () => 0);
    for (let i = 0; i < memories.length; i++) counts[i % tracks]++;
    const seen = Array.from({ length: tracks }, () => 0);
    return memories.map((m, i) => {
      const track = i % tracks;
      const k = seen[track]++;
      const tilt = flowTilt(m.seed, i, track);
      return {
        m,
        // 均匀分布 + 沿轨道小幅扰动：既随机又不重叠
        base: k * step + tilt.jitter * TRACK_GAP * 0.6,
        span: Math.max(1, counts[track]) * step,
        cross: trackCross[track] + tilt.lag * zoneLen,
        rot: tilt.rotate,
      };
    });
  }, [memories, tracks, step, trackCross, zoneLen]);

  const itemById = useMemo(() => new Map(items.map((it) => [it.m.id, it])), [items]);
  const elsRef = useRef(new Map<string, HTMLDivElement>());
  const idsKeyRef = useRef("");
  const activeIdRef = useRef<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  /** 挂载瞬间按当前 offset 放好，否则新卡片会先在左上角露一帧 */
  const elRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const id = el.dataset.id;
      const it = id ? itemById.get(id) : undefined;
      if (!it) return;
      elsRef.current.set(it.m.id, el);
      placeCard(
        el,
        it,
        mainPos(it, offsetRef.current, mainLen),
        vertical,
        mainLen,
        radius,
      );
      return () => {
        elsRef.current.delete(it.m.id);
      };
    },
    [itemById, offsetRef, mainLen, vertical, radius],
  );

  /** 每帧：算可见集合 → 写 transform → 只有集合/光标变化时才 setState */
  const update = useCallback(
    (offset: number) => {
      const ids: string[] = [];
      let best: string | null = null;
      let bestD = Infinity;
      for (const it of items) {
        const main = mainPos(it, offset, mainLen);
        if (main < -cardMain - buffer || main > mainLen + buffer) continue;
        ids.push(it.m.id);
        const el = elsRef.current.get(it.m.id);
        if (el) placeCard(el, it, main, vertical, mainLen, radius);
        const d = Math.abs(main - mainLen / 2);
        if (d < bestD) {
          bestD = d;
          best = it.m.id;
        }
      }
      const key = ids.join("|");
      if (key !== idsKeyRef.current) {
        idsKeyRef.current = key;
        setVisibleIds(ids);
      }
      if (best !== activeIdRef.current) {
        activeIdRef.current = best;
        setActiveId(best);
      }
    },
    [items, mainLen, cardMain, buffer, vertical, radius],
  );

  useEffect(() => onFrame(update), [onFrame, update]);
  // 布局变化后先同步补一遍（setState 在 layout 阶段刷完，不会闪）
  useLayoutEffect(() => {
    update(offsetRef.current);
  }, [update, offsetRef]);

  /** 刚拖过就别把这次抬手当成点击 */
  function openMemory(id: string) {
    if (justDragged()) return;
    router.push(`/memory/${id}`);
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
      <div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {visibleIds.map((id) => {
          const it = itemById.get(id);
          if (!it) return null;
          const m = it.m;
          return (
            <div
              key={id}
              ref={elRef}
              data-id={id}
              className="absolute will-change-transform"
              style={{
                left: vertical ? it.cross : 0,
                top: vertical ? 0 : it.cross,
                // 挂载瞬间的兜底：先放到屏幕外，随后 elRef 用真实 offset 修正
                transform: "translate3d(-99999px, -99999px, 0)",
              }}
            >
              <button
                type="button"
                onClick={() => openMemory(m.id)}
                className="block cursor-pointer outline-none"
              >
                <MemoryCardFace memory={m} tier={tier} />
                {tier !== "tiny" && (
                  <p
                    className={`mt-2 truncate text-center text-xs text-white/70 ${CAPTION_CLS[tier]}`}
                  >
                    {m.title}
                  </p>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {vertical ? (
        <VerticalTimelineRail memories={memories} activeId={activeId} showCursor />
      ) : (
        <TimelineRail memories={memories} activeId={activeId} showCursor compact={railCompact} />
      )}
    </div>
  );
}
