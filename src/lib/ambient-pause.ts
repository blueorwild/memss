"use client";

/**
 * 环境动画的暂停总闸：把状态写到 `<html data-ambient="paused|run">`，
 * CSS 侧统一用 `animation-play-state: paused` 冻结（小精灵造型 / 星点粒子 /
 * 星点呼吸 / 卡片浮动 / 回忆页播放键）。canvas 不吃 CSS，自己读同一组条件
 * （见 StarBackground 的 draw）。
 *
 * 暂停条件：标签页切到后台 / 窗口失焦。
 * **不含**「小精灵面板打开」——面板是角落里的浮层，星空与小精灵仍在视野里，
 * 冻结会让整片天和小精灵看起来是张静止图片（实现时实测过，观感不可接受）。
 * 也不做「无操作多久自动降载」（用户明确不要）。
 *
 * 只挂一组监听（模块级、幂等，Sprite 全局常驻所以不做撤销）。
 */
let started = false;

function apply(paused: boolean) {
  const el = document.documentElement;
  const next = paused ? "paused" : "run";
  if (el.dataset.ambient !== next) el.dataset.ambient = next;
}

export function startAmbientPauseWatch() {
  if (started || typeof window === "undefined") return;
  started = true;

  const sync = () => {
    apply(document.hidden || !document.hasFocus());
  };

  document.addEventListener("visibilitychange", sync);
  window.addEventListener("focus", sync);
  window.addEventListener("blur", sync);
  sync();
}
