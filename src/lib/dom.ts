import { useSpriteStore } from "@/store/sprite";

/**
 * 页面级快捷键是否应当被忽略。
 * 用 window 监听键盘时（切图 / 播放 / 返回上级等），若用户正在输入、或存在弹层、
 * 或小精灵面板正打开，则不应抢占按键（否则 ←/→ 无法移动光标、空格打不出、Esc 误退出）。
 */
export function shouldIgnorePageShortcut(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  // 正在表单控件 / 可编辑区域内输入
  if (target?.closest("input, textarea, select, [contenteditable='true']")) return true;
  // 有弹层打开（Esc 交由弹层处理）
  if (document.querySelector('[role="dialog"]')) return true;
  // 小精灵面板打开期间，暂停页面快捷键
  if (useSpriteStore.getState().open) return true;
  return false;
}
