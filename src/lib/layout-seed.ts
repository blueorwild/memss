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
  const angle = index * step;
  const rnd = mulberry32(hashSeed(`${seed}:${index}`));
  return {
    angle,
    y: (rnd() - 0.5) * 130,
    radius: radius + (rnd() - 0.5) * 70,
    rotate: (rnd() - 0.5) * 12,
    scale: 0.88 + rnd() * 0.22,
  };
}

export function radiusForCount(total: number, base = BASE_RADIUS): number {
  if (total <= 6) return base;
  return base + (total - 6) * 42;
}

export type FlatSlot = { x: number; y: number; rotate: number; scale: number };

export function gridScatter(seed: number, index: number, total: number): FlatSlot {
  const cols = total <= 2 ? Math.max(total, 1) : total <= 6 ? Math.ceil(total / 2) : Math.ceil(Math.sqrt(total * 1.4));
  const rows = Math.ceil(total / Math.max(cols, 1));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = 100 / cols;
  const cellH = 100 / Math.max(rows, 1);
  const rnd = mulberry32(hashSeed(`flat:${seed}:${index}`));
  const jx = (rnd() - 0.5) * cellW * 0.35;
  const jy = (rnd() - 0.5) * cellH * 0.4;
  const x = cellW * (col + 0.5) + jx;
  const y = cellH * (row + 0.5) + jy;
  return {
    x: Math.min(92, Math.max(8, x)),
    y: Math.min(88, Math.max(12, y)),
    rotate: (rnd() - 0.5) * 10,
    scale: 0.92 + rnd() * 0.16,
  };
}

export type TimelineSlot = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  floatPhase: number;
  floatAmp: number;
};

export function timelineScatter(seed: number, index: number, total: number): TimelineSlot {
  const rnd = mulberry32(hashSeed(`tl:${seed}:${index}`));
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const x = 12 + t * 76;
  const y = 40 + (rnd() - 0.5) * 34;
  return {
    x,
    y,
    rotate: (rnd() - 0.5) * 10,
    scale: 0.9 + rnd() * 0.16,
    floatPhase: rnd() * Math.PI * 2,
    floatAmp: 4 + rnd() * 4,
  };
}
