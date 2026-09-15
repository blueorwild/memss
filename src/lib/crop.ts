import type { CSSProperties } from "react";

/**
 * 图片裁剪参数（展示用）。
 * - focalX/focalY：焦点位置百分比 0-100（object-position 的 X%/Y%）
 * - scale：缩放百分比 100-600，以焦点为中心放大
 * 三者用同一套 CSS（object-position + transform scale + transform-origin）渲染，
 * 因此瓷砖 / 卡片 / 详情页 / 裁剪弹窗的构图完全一致。
 */
export type Crop = { x: number; y: number; scale: number };

export const CROP_MIN_SCALE = 100;
export const CROP_MAX_SCALE = 600;
export const DEFAULT_CROP: Crop = { x: 50, y: 50, scale: 100 };

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.round(Math.min(max, Math.max(min, v)));
}

/** 归一化裁剪参数：x/y 0-100，scale 100-600 */
export function clampCrop(input: Partial<Crop> | null | undefined): Crop {
  return {
    x: clampNum(input?.x, 0, 100, DEFAULT_CROP.x),
    y: clampNum(input?.y, 0, 100, DEFAULT_CROP.y),
    scale: clampNum(input?.scale, CROP_MIN_SCALE, CROP_MAX_SCALE, DEFAULT_CROP.scale),
  };
}

/** 生成图片的裁剪样式（配合 object-cover + 容器 overflow-hidden） */
export function coverStyle(crop: Crop, baselineScale = 1): CSSProperties {
  const s = (crop.scale / 100) * baselineScale;
  return {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: s === 1 ? undefined : `scale(${s})`,
    transformOrigin: `${crop.x}% ${crop.y}%`,
  };
}
