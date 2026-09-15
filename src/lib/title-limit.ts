/**
 * 标题长度限制：按「显示宽度」计算。
 * - 汉字 / 全角字符 / emoji = 2 个半角单位
 * - 英文字母 / 数字 / 半角符号 = 1 个半角单位
 * 上限 40 半角单位（= 20 个汉字，或 40 个英文字母）。
 * 前后端共用，避免两端规则不一致。
 */
export const TITLE_MAX = 40;

/** 上限对应的「字」数（半角单位 / 2），仅用于界面展示 */
export const TITLE_MAX_HAN = TITLE_MAX / 2;

/** 判断一个码点是否为全角/宽字符 */
function isWide(cp: number): boolean {
  return (
    cp >= 0x1100 && cp <= 0x115f // 谚文字母
    || (cp >= 0x2e80 && cp <= 0x303e) // 汉字部首 ~ CJK 符号
    || (cp >= 0x3041 && cp <= 0x33ff) // 平假名 / 片假名 / CJK 兼容
    || (cp >= 0x3400 && cp <= 0x4dbf) // CJK 扩展 A
    || (cp >= 0x4e00 && cp <= 0x9fff) // CJK 统一表意文字
    || (cp >= 0xa000 && cp <= 0xa4cf) // 彝文
    || (cp >= 0xac00 && cp <= 0xd7a3) // 谚文音节
    || (cp >= 0xf900 && cp <= 0xfaff) // CJK 兼容表意
    || (cp >= 0xfe30 && cp <= 0xfe4f) // CJK 兼容形式
    || (cp >= 0xff00 && cp <= 0xff60) // 全角 ASCII
    || (cp >= 0xffe0 && cp <= 0xffe6) // 全角符号
    || cp > 0xffff // 补充平面（emoji 等）按宽字符计
  );
}

/** 字符串占用的半角单位数（按码点遍历，正确处理 emoji） */
export function titleWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    w += isWide(cp) ? 2 : 1;
  }
  return w;
}

/** 是否在允许长度内 */
export function isValidTitle(s: string): boolean {
  return titleWidth(s) <= TITLE_MAX;
}
