/**
 * 主题色的 JS 侧入口。
 *
 * **CSS 变量是唯一来源**（见 src/app/globals.css 的 :root），这里只是把它们读出来，
 * 供 canvas（`StarBackground` 的星点颜色）等拿不到 CSS 类的场景使用。
 * 需要透明度时用 `rgba(token, a)` 拼装。
 *
 * 注意：CSS 与内联样式（含 SVG）请直接用 `rgb(var(--sky-x) / <alpha>)`，不要走这里。
 */

/** RGB 分量（0-255） */
export type RGB = [number, number, number];

/** 需要在 JS 里使用的 token（值均为 RGB 分量） */
const TOKENS = {
  star: "--sky-star",
  beam: "--sky-beam",
  accent: "--accent",
  accentDeep: "--accent-deep",
  warm: "--warm",
  warmGlow: "--warm-glow",
  ok: "--ok",
} as const;

export type ThemeToken = keyof typeof TOKENS;
export type Theme = Record<ThemeToken, RGB>;

/**
 * 兜底值：仅在读取 CSS 变量失败时使用（例如样式表尚未生效）。
 * 与 globals.css 保持一致——改动色板时请同时更新这两处。
 */
const FALLBACK: Theme = {
  star: [220, 235, 255],
  beam: [150, 180, 255],
  accent: [124, 196, 255],
  accentDeep: [47, 127, 208],
  warm: [255, 243, 216],
  warmGlow: [255, 238, 180],
  ok: [52, 211, 153],
};

/** 元数据（布局 themeColor 等）需要字面量颜色，这里给出与 token 一致的值 */
export const SKY_VOID_HEX = "#05060a";

function parseRGB(raw: string, fallback: RGB): RGB {
  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return fallback;
  return [parts[0], parts[1], parts[2]];
}

/** 读取当前主题色（每次调用都会重新读取，颜色随 CSS 变量变化） */
export function readTheme(): Theme {
  if (typeof window === "undefined") return FALLBACK;
  const styles = getComputedStyle(document.documentElement);
  const out = {} as Theme;
  for (const [key, cssVar] of Object.entries(TOKENS) as [ThemeToken, string][]) {
    out[key] = parseRGB(styles.getPropertyValue(cssVar), FALLBACK[key]);
  }
  return out;
}

/** 把 RGB 分数组装成 rgba() 字符串 */
export function rgba(color: RGB, alpha = 1): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}
