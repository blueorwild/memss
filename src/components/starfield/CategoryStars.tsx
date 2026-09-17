"use client";

import { motion } from "framer-motion";
import {
  hashSeed,
  mulberry32,
  starCapacity,
  STAR_CAP_MAX_WITH_MEMORIES,
} from "@/lib/layout-seed";
import { useElementSize } from "@/lib/use-element-size";
import { useTrackFlow } from "@/lib/use-track-flow";
import type { CategoryWithCount } from "@/lib/db/queries";

/** 单颗星（圆点 + 名字 + 段数）的估算半高/半宽（px）：随机与流动都要留出名字的位置 */
const ITEM_HALF_H = 34;
/** 名字最宽 96px（再长就省略号），半宽取 50 留 2px 余量 */
const ITEM_HALF_W = 50;
/** 星星名字最大宽度（px）：超过就截断，避免长名字互相压住 / 撑出星区 */
const LABEL_MAX_W = 96;
/** 不同排的相邻星之间至少要留的空隙（px）：圆点不挤即可（名字靠排间距错开） */
const MIN_PAIR_GAP = 44;
/** 同一排的相邻星：名字两侧额外留白（px） */
const LABEL_PAD = 8;
/** 随机分摊多余量的权重下限：避免出现间隔恰好等于下限（观感太整齐） */
const SLACK_WEIGHT_MIN = 0.15;
/** 流动形态下屏外提前渲染的缓冲（px） */
const FLOW_BUFFER = 140;

/** 估算文字宽度：CJK / 全角按 14px，其余按 7px（text-sm 下的粗估值，只用于算间距） */
function estWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += /[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 14 : 7;
  return w;
}

/** 相邻星星在纵向至少要错开的距离（px）：靠得近就会被名字宽度逼着拉开横向间距，看起来像"一条线" */
const MIN_CROSS_SEP = ITEM_HALF_H * 2;
/** 纵向随机时每颗星试几个候选，取"离前两颗最远"的（既随机又不会连成一行） */
const CROSS_CANDIDATES = 5;

/**
 * 流动轨道的布局：**整片区域 2D 随机 + 环形随机间隔**。
 *
 * - 纵向：每颗星在星区内**随机**取 y（按 id 定种子，稳定、刷新不变），但会在若干随机候选里
 *   挑一个「离前两颗最远」的（蓝色噪声）——不做分排，也不会让相邻星星落在同一水平线上。
 *   这一步是关键：上下同高时，横向会被"名字不能叠"逼着拉到 90px 以上，一排排平齐就成了"一条线"。
 * - 横向：间隔 = 逐对下限 + 随机分摊的多余量。下限按纵向是否靠得近决定：靠得近的相邻两颗
 *   （含隔一颗，因为中间那段横向距离可能仍不够放名字）必须放得下双方名字，错开的只需圆点不挤（44px）。
 * - 总长仍为 `n × slot`，所以平均间距 = 目标密度。
 */
function buildFlowLayout(items: CategoryWithCount[], slot: number, bandH: number) {
  const n = items.length;
  const widths = items.map((c) => Math.min(LABEL_MAX_W, estWidth(c.name)));

  // 横向目标间距本来就放得下名字时（有记忆页同屏 10 颗、间距大），纵向就**纯随机**；
  // 只有横向挤（同屏 20 颗、间距接近名字宽度）时才靠纵向错开避免叠字——否则矮星区里
  // "相邻必须相差 68px" 这条硬约束会把星星逼成上下两排，反而更像"一条线"。
  let maxPairNeed = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    maxPairNeed = Math.max(maxPairNeed, (widths[i] + widths[j]) / 2 + LABEL_PAD);
  }
  const needCrossSep = n > 1 && maxPairNeed > slot;

  // 纵向：整段区域随机 + 相邻错开（含 4px 边距）
  const lo = ITEM_HALF_H + 4;
  const hi = Math.max(lo, bandH - ITEM_HALF_H - 4);
  const range = Math.max(1, hi - lo);
  const crosses: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!needCrossSep) {
      crosses.push(lo + mulberry32(hashSeed(`starflow:${items[i].id}`))() * range);
      continue;
    }
    let best = lo;
    let bestSep = -1;
    for (let k = 0; k < CROSS_CANDIDATES; k++) {
      const y = lo + mulberry32(hashSeed(`starflow:${items[i].id}:${k}`))() * range;
      let sep = Infinity;
      for (const back of [1, 2]) {
        const prev = crosses[i - back];
        if (prev === undefined) continue;
        sep = Math.min(sep, Math.abs(y - prev));
      }
      if (sep >= MIN_CROSS_SEP) { best = y; break; }
      if (sep > bestSep) { bestSep = sep; best = y; }
    }
    crosses.push(best);
  }

  // 横向：逐对下限（纵向靠得近 → 要放得下名字；错开 → 点不挤即可）
  const needs = items.map((c, i) => {
    const nameNeed = (j: number) =>
      Math.max(MIN_PAIR_GAP, (widths[i] + widths[j]) / 2 + LABEL_PAD);
    if (!needCrossSep) {
      const j = (i + 1) % n;
      return Math.abs(crosses[i] - crosses[j]) >= MIN_CROSS_SEP
        ? MIN_PAIR_GAP
        : nameNeed(j);
    }
    let need = MIN_PAIR_GAP;
    for (const ahead of [1, 2]) {
      const j = (i + ahead) % n;
      if (j === i) continue;
      if (Math.abs(crosses[i] - crosses[j]) >= MIN_CROSS_SEP) continue;
      need = Math.max(need, nameNeed(j));
    }
    return need;
  });
  const needSum = needs.reduce((a, b) => a + b, 0);
  const totalSlack = Math.max(0, n * slot - needSum);
  const weights = items.map(
    (c) =>
      SLACK_WEIGHT_MIN +
      mulberry32(hashSeed(`stargap:${c.id}`))() * (1 - SLACK_WEIGHT_MIN),
  );
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const bases: number[] = new Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    bases[i] = acc;
    acc += needs[i] + (totalSlack * weights[i]) / weightSum;
  }

  // 环长取累加实际值：最后一个回到第一个的间隔就等于 needs[n-1] + 它的多余量
  return { bases, crosses, span: Math.max(1, acc) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 随机散布：黄金角螺旋 + 按类别 id 定种子（刷新/SSR 都稳定，不会每次都变） */
function scatterPos(index: number, total: number, id: string) {
  const rnd = mulberry32(hashSeed(`scatter:${id}`));
  const GA = 137.508 * (Math.PI / 180);
  const t = (index + 0.5) / Math.max(total, 1);
  const r = Math.sqrt(t) * 40;
  const theta = index * GA + (rnd() - 0.5) * 0.6;
  return {
    x: 50 + Math.cos(theta) * r + (rnd() - 0.5) * 8,
    y: 50 + Math.sin(theta) * r + (rnd() - 0.5) * 8,
  };
}

/** 流动形态下每颗星的轻微随机旋转（按 id 定种子） */
function flowRotate(id: string) {
  return (mulberry32(hashSeed(`starrot:${id}`))() - 0.5) * 6;
}

/** 星星白色呼吸粒子参数：固定种子保证 SSR 与客户端一致，中等密度（5 颗/星） */
const starRand = mulberry32(hashSeed("star-particles"));
const STAR_PARTICLES = Array.from({ length: 12 }, () => ({
  dx: (starRand() - 0.5) * 52,
  dy: (starRand() - 0.5) * 52,
  dur: 2.4 + starRand() * 2,
  delay: starRand() * 2.5,
  size: 1.5 + starRand() * 1.5,
}));

/**
 * 类别星星：一律随机散布；数量超出同屏容量（随屏宽自适应）时，
 * 换成与记忆卡片同一套「滚筒」流动形态——缓慢自走 + 可拖 + 惯性 + 两端渐隐。
 */
export default function CategoryStars({
  items,
  onSelect,
  zoomedId,
  withMemories,
}: {
  items: CategoryWithCount[];
  onSelect: (id: string, e: React.MouseEvent) => void;
  zoomedId: string | null;
  /** 当前类别是否还有记忆：有记忆时星区只占 3/10，同屏上限收到 10 */
  withMemories: boolean;
}) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const n = items.length;
  // 同屏容量：宽度未测到前用上限，避免 SSR 与首帧就误判成流动形态
  const cap = starCapacity(
    size.w,
    withMemories ? STAR_CAP_MAX_WITH_MEMORIES : undefined,
  );
  const flowing = n > cap;
  // 目标平均间距：宽度 ÷ 同屏上限，所以同屏可见星数就是上限本身
  const slot = size.w / Math.max(1, cap);

  const {
    containerRef: flowRef,
    offset: flowOffset,
    ready: flowReady,
    onPointerDown: flowPointerDown,
    onPointerMove: flowPointerMove,
    endDrag: flowEndDrag,
    justDragged,
  } = useTrackFlow({ mainLen: size.w });

  type Node = { c: CategoryWithCount; left: string; top: string; rot: number };
  const nodes: Node[] = [];

  if (flowing) {
    // 整片区域 2D 随机 + 环形随机间隔：算可见的一批（含屏外缓冲），回绕的跳变发生在屏幕外
    const { bases, crosses, span } = buildFlowLayout(items, slot, size.h);
    for (let i = 0; i < n; i++) {
      const c = items[i];
      const raw = bases[i] + flowOffset;
      const wrapped = ((raw % span) + span) % span;
      const main = wrapped - span / 2 + size.w / 2;
      if (main < -ITEM_HALF_W - FLOW_BUFFER || main > size.w + ITEM_HALF_W + FLOW_BUFFER) continue;
      nodes.push({ c, left: `${main}px`, top: `${crosses[i]}px`, rot: flowRotate(c.id) });
    }
  } else {
    // 随机散布：把位置夹在可视区内（星星带可能很矮，名字不能被裁）
    const xPadPct = size.w > 0 ? (ITEM_HALF_W / size.w) * 100 : 0;
    const yPadPct = size.h > 0 ? ((ITEM_HALF_H + 4) / size.h) * 100 : 0;
    items.forEach((c, i) => {
      const p = scatterPos(i, n, c.id);
      nodes.push({
        c,
        left: `${clamp(p.x, xPadPct, 100 - xPadPct)}%`,
        top: `${clamp(p.y, yPadPct, 100 - yPadPct)}%`,
        rot: 0,
      });
    });
  }

  const body = (
    <>
      {nodes.map(({ c, left, top, rot }) => {
        const hasMemories = c.memoryCount > 0;
        const isZoomed = zoomedId === c.id;

        return (
          <div
            key={c.id}
            className="absolute"
            style={{ left, top, transform: `translate(-50%, -50%) rotate(${rot}deg)` }}
          >
            {/* 可点星星的白色呼吸粒子（不拦截点击） */}
            {hasMemories && (
              <div className="pointer-events-none absolute left-1/2 top-2 h-0 w-0">
                {STAR_PARTICLES.map((p, i) => (
                  <motion.span
                    key={i}
                    className="absolute rounded-full bg-white"
                    style={{
                      width: p.size,
                      height: p.size,
                      boxShadow: "0 0 5px 1.5px rgb(var(--sky-star) / 0.85)",
                    }}
                    animate={{
                      x: [0, p.dx],
                      y: [0, p.dy],
                      opacity: [0, 0.9, 0],
                      scale: [0.5, 1, 0.3],
                    }}
                    transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
                  />
                ))}
              </div>
            )}
            <motion.button
              type="button"
              onClick={(e) => {
                // 刚拖动过就不当成点击；但只有流动形态才有拖动层，
                // 散布形态别让历史标记（流动→散布切换后清不掉）挡住点击
                if (flowing && justDragged()) return;
                onSelect(c.id, e);
              }}
              className="group flex flex-col items-center outline-none"
              animate={{ opacity: isZoomed ? 0 : 1, scale: isZoomed ? 1.8 : 1 }}
              transition={{ duration: isZoomed ? 0.1 : 0.3 }}
            >
              <motion.span
                className={
                  hasMemories
                    ? "block h-4 w-4 rounded-full bg-white shadow-[0_0_22px_7px_rgb(var(--accent) / 0.55)]"
                    : "block h-2.5 w-2.5 rounded-full bg-white/25 transition-colors group-hover:bg-white/60"
                }
                animate={hasMemories ? { scale: [1, 1.35, 1], opacity: [0.85, 1, 0.85] } : {}}
                transition={
                  hasMemories ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : {}
                }
              />
              <span
                className={
                  hasMemories
                    ? "mt-3 max-w-[96px] truncate text-sm text-white/80 transition-colors group-hover:text-white"
                    : "mt-3 max-w-[96px] truncate text-xs text-white/35 transition-colors group-hover:text-white/70"
                }
              >
                {c.name}
              </span>
              {hasMemories && (
                <span className="mt-0.5 text-[10px] text-white/35">{c.memoryCount} 段回忆</span>
              )}
            </motion.button>
          </div>
        );
      })}

      {items.length === 0 && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-white/35">
          这里没有更细的分类
        </p>
      )}
    </>
  );

  // 流动形态：两端渐隐用 mask（GPU 合成，比逐项改透明度更平滑）
  const mask =
    "linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)";

  // 测尺寸的容器与拖动的容器分开挂 ref：两者同尺寸，避免同一节点上塞两个 ref
  return (
    <div ref={containerRef} className="relative h-full w-full">
      {flowing ? (
        <div
          ref={flowRef}
          className="absolute inset-0 touch-none select-none transition-opacity duration-500"
          style={{ opacity: flowReady ? 1 : 0, cursor: "grab" }}
          onPointerDown={flowPointerDown}
          onPointerMove={flowPointerMove}
          onPointerUp={flowEndDrag}
          onPointerCancel={flowEndDrag}
        >
          <div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
            {body}
          </div>
        </div>
      ) : (
        body
      )}
    </div>
  );
}
