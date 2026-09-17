export function hashSeed(input: string | number): number {
  const s = String(input);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(input: string | number): number {
  return mulberry32(hashSeed(input))();
}

/** 统一把浮点取整到 3 位小数，避免 SSR 与客户端浮点序列化差异导致 hydration 不一致 */
export const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type CylinderSlot = {
  angle: number;
  y: number;
  radius: number;
  rotate: number;
  scale: number;
};

const BASE_RADIUS = 520;

export function cylinderSlot(
  seed: number,
  index: number,
  total: number,
  radius = BASE_RADIUS,
): CylinderSlot {
  const step = 360 / Math.max(total, 1);
  const rnd = mulberry32(hashSeed(`${seed}:${index}`));
  return {
    angle: r3(index * step),
    y: r3((rnd() - 0.5) * 130),
    radius: r3(radius + (rnd() - 0.5) * 70),
    rotate: r3((rnd() - 0.5) * 12),
    scale: r3(0.88 + rnd() * 0.22),
  };
}

export function radiusForCount(total: number, base = BASE_RADIUS): number {
  if (total <= 6) return base;
  return base + (total - 6) * 42;
}

/** 纵向滚筒槽位（窄屏）：绕 X 轴环绕，靠上下滑动切换 */
export type VerticalCylinderSlot = {
  angle: number;
  x: number;
  radius: number;
  rotate: number;
  scale: number;
};

export function verticalCylinderSlot(
  seed: number,
  index: number,
  total: number,
  radius: number,
): VerticalCylinderSlot {
  const step = 360 / Math.max(total, 1);
  const rnd = mulberry32(hashSeed(`vcy:${seed}:${index}`));
  return {
    angle: r3(index * step),
    x: r3((rnd() - 0.5) * 56),
    radius: r3(radius + (rnd() - 0.5) * 40),
    rotate: r3((rnd() - 0.5) * 8),
    scale: r3(0.9 + rnd() * 0.2),
  };
}

/** 纵向滚筒半径基准：卡片越多越大，避免相邻卡片互相重叠 */
export function verticalRadiusForCount(total: number, base = 300): number {
  return Math.max(base, total * 20);
}

export type FlatSlot = { x: number; y: number; rotate: number; scale: number };

/* ---------------------------------------------------------------------------
 * 双轨记忆展示（宽屏=上下两行横向轨道；窄屏=左右两列纵向轨道）
 * 少于/等于两轨容量时平铺；超过时转为「大半径滚筒」的流动形态。
 * ------------------------------------------------------------------------- */

/** 卡片间距（px） */
export const TRACK_GAP = 24;
/** 横向轨道下方星轨占用高度（px）：常规 / 矮容器（手机横屏）压缩版 */
export const RAIL_MAIN = 140;
export const RAIL_MAIN_COMPACT = 64;
/** 星轨切成压缩版的高度阈值（px）：低于它就压扁给卡片让位 */
export const RAIL_COMPACT_BELOW = 420;
/**
 * 记忆区在有子类别时占整页可用高度的比例（对应 StarfieldPage 的 `flex-[7]` / 10）。
 *
 * 星轨高度的判据要用「有子类别时那块的高度」而不是本区块高度，两种页面才会一致；
 * 改动 flex-[3]/flex-[7] 时必须同步这里。
 */
export const MEMORY_FLEX_RATIO = 0.7;
/** 纵向轨道左侧星轨占用宽度（px） */
export const RAIL_CROSS = 56;
/** 每条轨道同屏最多完整卡片数（两轨合计不超过 6 张） */
export const PER_TRACK_MAX = 3;

/**
 * 各条轨道在交叉方向上的中心位置（px）。
 * tracks=2 为对称两轨（宽屏上下两行 / 窄屏左右两列）；
 * tracks=1 为单轨居中（宽屏 + 当前类别既有子类别又有记忆时用）。
 * @param zoneStart 可用区起点（已避开星轨）
 * @param zoneLen   可用区长度
 * @param cardCross 卡片在交叉方向的尺寸
 */
export function trackCrossPositions(
  zoneStart: number,
  zoneLen: number,
  cardCross: number,
  tracks = 2,
): number[] {
  // 两侧各留 6px 余量：卡片有轻微旋转/缩放，避免贴边被裁
  const start = zoneStart + 6;
  const len = Math.max(cardCross, zoneLen - 12);
  const center = start + len / 2;
  if (tracks <= 1) return [center];
  // 优先保证两轨不重叠；空间实在不足时退让为「不越界」（可能轻微重叠）
  const half = Math.min(
    Math.max(len * 0.25, (cardCross + TRACK_GAP) / 2),
    Math.max(0, len / 2 - cardCross / 2),
  );
  return [center - half, center + half];
}

/* ---------------------------------------------------------------------------
 * 星图上的类别星星：同屏容量随屏宽自适应，超出则换成「流动轨道」
 * ------------------------------------------------------------------------- */

/** 同屏星星数量的下限 */
export const STAR_CAP_MIN = 3;
/** 同屏星星数量上限：只有子分类时 20（在参考宽度下） */
export const STAR_CAP_MAX = 20;
/** 同屏星星数量上限：既有子分类又有记忆时 10（上面还有记忆区，别太密） */
export const STAR_CAP_MAX_WITH_MEMORIES = 10;
/** 上限的参考宽度（px）：20 / 10 都是按这个宽度定的，其它宽度等比收敛 */
export const STAR_CAP_REF_WIDTH = 1440;

/**
 * 给定星区宽度与上限，算出同屏最多放几颗星（超出走流动轨道）。
 *
 * 上限是在参考宽度（`STAR_CAP_REF_WIDTH`）下的口径，实际容量按屏宽**等比**收敛：
 * 1440 宽 → 20 / 10，2000 宽仍封顶 20 / 10，窄屏 1100 → 15 / 8，390 → 5 / 3。
 */
export function starCapacity(
  width: number,
  maxCap = STAR_CAP_MAX,
  refWidth = STAR_CAP_REF_WIDTH,
): number {
  if (width <= 0) return maxCap;
  const scaled = Math.round((maxCap * width) / refWidth);
  return Math.min(maxCap, Math.max(STAR_CAP_MIN, scaled));
}


/** 沿轨道方向可容纳的卡片数：用于平铺排布与「平铺/流动」判定 */
export function trackCapacity(availLength: number, cardSize: number): number {
  return Math.max(1, Math.floor((availLength + TRACK_GAP) / (cardSize + TRACK_GAP)));
}

/** 平铺模式：单张卡片的随机扰动（seed 驱动，保证 SSR 与客户端一致） */
export type TileJitter = {
  along: number;
  cross: number;
  rotate: number;
  scale: number;
  floatAmp: number;
  floatDur: number;
};

export function tileJitter(seed: number, index: number): TileJitter {
  const rnd = mulberry32(hashSeed(`tile:${seed}:${index}`));
  return {
    along: r3((rnd() - 0.5) * 0.5), // 沿轨道方向 ±25% 格宽（大幅随机偏移）
    cross: r3((rnd() - 0.5) * 0.05), // 交叉方向 ±2.5%（轻微扰动）
    rotate: r3((rnd() - 0.5) * 7), // ±3.5° 轻微随机旋转
    scale: r3(0.92 + rnd() * 0.16),
    floatAmp: r3(3 + rnd() * 5), // 缓缓浮动的幅度（px）
    floatDur: r3(5 + rnd() * 3), // 缓缓浮动的周期（秒）
  };
}

/** 流动模式：卡片自身轻微旋转、沿轨道小幅扰动、交叉方向微扰 */
export type FlowTilt = { rotate: number; jitter: number; lag: number };

export function flowTilt(seed: number, index: number, track: number): FlowTilt {
  const rnd = mulberry32(hashSeed(`flow:${seed}:${index}:${track}`));
  return {
    rotate: r3((rnd() - 0.5) * 5), // ±2.5°
    jitter: r3((rnd() - 0.5) * 0.5), // 沿轨道小幅扰动（× 间距，保持不重叠）
    lag: r3((rnd() - 0.5) * 0.03),
  };
}
