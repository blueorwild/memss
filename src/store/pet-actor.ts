"use client";

import { ACTIONS, type PetAction, type PetLoopAction } from "@/components/xiaoriyue-drag/PetArt";
import { create } from "zustand";

/**
 * 小精灵动作调度（宿主侧状态机）。
 * 美术包只负责渲染 action / actionKey，这里承担 README（v6）要求的全部计时、
 * 优先级判定与「恢复目标」维护；包内不做任何计时或副作用。
 */

/** 空闲多久打盹（doze → sleep）；仅面板收起时计时 */
const IDLE_MS = 30_000;
/** 睡满多久自然醒（wake → 业务状态） */
const SLEEP_MS = 20_000;
/** 请求多久没有有效正文即从「好奇」升级为「转圈思考」 */
const THINK_SPIN_MS = 4_000;
/** 悬停确认延迟与问好冷却 */
const HOVER_DELAY_MS = 250;
const HOVER_COOLDOWN_MS = 8_000;

/**
 * 减少动态效果：美术包会把所有造型静态化（动作在视觉上无差别），
 * 按约定宿主此时完全不驱动动作——不播动作、不跑生活/悬停计时。
 * 这里直接查 media query（而非 props）以保证每次事件都取到最新值。
 */
let reducedMq: MediaQueryList | null = null;
function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  reducedMq ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedMq.matches;
}

type PetActorState = {
  /** 当前动作：宿主透传给 PetArt */
  action: PetAction;
  /** 递增即重播；只在动作切换或重播时变化，绝不逐帧递增 */
  actionKey: number;
  /** 播放动作；after 优先于 ACTIONS 的 next（用于 wake → greet 这类链式） */
  play: (next: PetAction, after?: () => void) => void;
  /** 宿主初始化完成：开始 idle 生活计时 */
  notifyReady: () => void;
  /** 点角色打开面板 */
  notifyPanelOpen: () => void;
  /** 面板消失（任何关闭来源） */
  notifyPanelClose: () => void;
  /** 请求开始，返回 requestId */
  notifyRequestStart: () => number;
  /** 首个有效正文增量 */
  notifyFirstText: (id: number) => void;
  /** 请求结束（成功 / 失败 / 停止 / 卸载） */
  notifyRequestEnd: (id: number) => void;
  notifyDragStart: () => void;
  notifyDragEnd: () => void;
  /** 拖面板把角色挤开 */
  notifyCollision: () => void;
  notifyHoverEnter: () => void;
  notifyHoverLeave: () => void;
  /** 卸载：清计时并作废在途请求 */
  dispose: () => void;
};

export const usePetActor = create<PetActorState>((set, get) => {
  /** 面板是否展开：idle 生活计时只在面板收起时走 */
  let panelOpen = false;
  /** 恢复目标：只允许持续状态（一次性动作不能存进来） */
  let resume: PetLoopAction = "idle";
  let dragging = false;
  /** 在途请求 id：0 表示无请求；旧 id 的回调一律丢弃 */
  let requestSeq = 0;
  let requestId = 0;
  let ideaFired = false;
  let hovering = false;
  let hoverCooldownUntil = 0;
  /** 拖动期间收到关闭指令：抬手后再告别 */
  let closePending = false;
  /** 动作代次：计时器回调过期后不得改状态 */
  let generation = 0;

  let finishTimer: number | null = null;
  let idleTimer: number | null = null;
  let sleepTimer: number | null = null;
  let spinTimer: number | null = null;
  let hoverTimer: number | null = null;

  function stopTimer(id: number | null): null {
    if (id !== null) window.clearTimeout(id);
    return null;
  }

  function stopAll() {
    finishTimer = stopTimer(finishTimer);
    idleTimer = stopTimer(idleTimer);
    sleepTimer = stopTimer(sleepTimer);
    spinTimer = stopTimer(spinTimer);
    hoverTimer = stopTimer(hoverTimer);
  }

  /**
   * 重新评估生活计时：
   * sleep → 30s 后自然醒；idle 且面板收起、无请求、未拖动 → 45s 后打盹；其余情况停表。
   */
  function rescheduleLife() {
    idleTimer = stopTimer(idleTimer);
    sleepTimer = stopTimer(sleepTimer);
    const current = get().action;
    if (current === "sleep") {
      sleepTimer = window.setTimeout(() => {
        sleepTimer = null;
        resume = "idle";
        play("wake");
      }, SLEEP_MS);
      return;
    }
    if (current !== "idle" || panelOpen || dragging || requestId !== 0) return;
    idleTimer = window.setTimeout(() => {
      idleTimer = null;
      play("doze");
    }, IDLE_MS);
  }

  /** 切到持续状态：已在目标状态则不动，避免无意义重建内部动作层 */
  function playLoopIfChanged(target: PetLoopAction) {
    if (get().action === target) {
      rescheduleLife();
      return;
    }
    play(target);
  }

  /** 播放动作：一次性动作按 ACTIONS 元数据收尾（after 优先，否则走 next） */
  function play(next: PetAction, after?: () => void) {
    if (reducedMotion()) return;
    const token = ++generation;
    finishTimer = stopTimer(finishTimer);
    set((s) => ({ action: next, actionKey: s.actionKey + 1 }));
    const spec = ACTIONS[next];
    if (spec.kind !== "once") {
      rescheduleLife();
      return;
    }
    finishTimer = window.setTimeout(() => {
      finishTimer = null;
      if (token !== generation) return;
      if (after) {
        after();
        return;
      }
      play(spec.next === "resume" ? resume : spec.next);
    }, spec.durationMs);
    rescheduleLife();
  }

  return {
    action: "idle",
    actionKey: 0,
    play,

    notifyReady() {
      if (reducedMotion()) return;
      rescheduleLife();
    },

    notifyPanelOpen() {
      if (reducedMotion()) return;
      panelOpen = true;
      closePending = false;
      hovering = false;
      hoverTimer = stopTimer(hoverTimer);
      resume = "idle";
      const current = get().action;
      // 睡着（或正在入睡 / 告别）时先醒过来再开心，避免从闭眼末帧直接跳
      if (current === "sleep" || current === "doze" || current === "bye") {
        play("wake", () => play("happy"));
        return;
      }
      play("happy");
    },

    notifyPanelClose() {
      if (reducedMotion()) return;
      panelOpen = false;
      closePending = false;
      hovering = false;
      hoverTimer = stopTimer(hoverTimer);
      // 关闭即作废在途请求：旧 requestId 的响应不得再改角色
      requestId = 0;
      ideaFired = false;
      spinTimer = stopTimer(spinTimer);
      resume = "sleep";
      if (dragging) {
        closePending = true;
        return;
      }
      play("bye");
    },

    notifyRequestStart() {
      if (reducedMotion()) return 0;
      const id = ++requestSeq;
      requestId = id;
      ideaFired = false;
      resume = "think-curious";
      if (!dragging) playLoopIfChanged("think-curious");
      spinTimer = stopTimer(spinTimer);
      spinTimer = window.setTimeout(() => {
        spinTimer = null;
        if (id !== requestId) return;
        resume = "think-spin";
        if (!dragging) playLoopIfChanged("think-spin");
      }, THINK_SPIN_MS);
      rescheduleLife();
      return id;
    },

    notifyFirstText(id) {
      if (reducedMotion()) return;
      if (requestId === 0 || id !== requestId || ideaFired) return;
      ideaFired = true;
      spinTimer = stopTimer(spinTimer);
      resume = "idle";
      // 拖动中只更新恢复目标，丢弃这次顿悟（避免打断拖动）
      if (dragging) return;
      play("idea");
    },

    notifyRequestEnd(id) {
      if (reducedMotion()) return;
      if (requestId === 0 || id !== requestId) return;
      requestId = 0;
      ideaFired = false;
      spinTimer = stopTimer(spinTimer);
      resume = "idle";
      // 只把「思考中」收回业务状态；顿悟 / 开心等一次性动作交给各自的 next 收尾
      const current = get().action;
      if (!dragging && (current === "think-curious" || current === "think-spin")) {
        playLoopIfChanged("idle");
      }
      rescheduleLife();
    },

    notifyDragStart() {
      if (reducedMotion()) return;
      if (dragging) return;
      dragging = true;
      play("drag-shy");
    },

    notifyDragEnd() {
      if (reducedMotion()) return;
      if (!dragging) return;
      dragging = false;
      if (closePending) {
        closePending = false;
        resume = "sleep";
        play("bye");
        return;
      }
      // 重新计算恢复目标：请求仍在就恢复思考，否则 idle
      const target: PetLoopAction =
        requestId === 0 ? "idle" : resume === "think-spin" ? "think-spin" : "think-curious";
      resume = target;
      playLoopIfChanged(target);
    },

    notifyCollision() {
      if (reducedMotion()) return;
      // 优先级：主动拖动、有效回复 / 思考高于挤开
      if (dragging || requestId !== 0) return;
      play("grumpy");
    },

    notifyHoverEnter() {
      if (reducedMotion()) return;
      hovering = true;
      hoverTimer = stopTimer(hoverTimer);
      if (dragging || requestId !== 0) return;
      if (Date.now() < hoverCooldownUntil) return;
      hoverTimer = window.setTimeout(() => {
        hoverTimer = null;
        if (!hovering || dragging || requestId !== 0) return;
        const current = get().action;
        // 面板关闭动画 / 入睡过渡期间不问好
        if (current === "bye" || current === "doze") return;
        hoverCooldownUntil = Date.now() + HOVER_COOLDOWN_MS;
        if (current === "sleep") {
          resume = "idle";
          play("wake", () => {
            // 醒来时重新核对光标与业务状态，再决定问好还是直接恢复
            if (hovering && !dragging && requestId === 0 && get().action === "wake") play("greet");
            else playLoopIfChanged(resume);
          });
          return;
        }
        play("greet");
      }, HOVER_DELAY_MS);
    },

    notifyHoverLeave() {
      hovering = false;
      hoverTimer = stopTimer(hoverTimer);
    },

    dispose() {
      generation += 1;
      requestId = 0;
      ideaFired = false;
      dragging = false;
      panelOpen = false;
      hovering = false;
      closePending = false;
      resume = "idle";
      stopAll();
    },
  };
});
