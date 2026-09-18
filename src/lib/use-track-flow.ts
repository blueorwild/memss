"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

/** 自动流动速度（px/s）：记忆卡片与星图星星共用同一手感 */
export const FLOW_SPEED = 12;

/** 拖动结束后多久内到来的那次 click 仍算「拖动的尾巴」、不当点击（防误触） */
export const DRAG_CLICK_GUARD_MS = 400;

/**
 * 每帧回调：参数为当前 offset（px）。
 * **回调里只写 DOM，不要 setState** —— 每帧 setState 会让整棵子树重渲染
 * （实测：12 张卡片 + 星轨每帧重渲染 ≈ 4ms/帧，是滚筒页卡顿的主因）。
 */
type FrameCallback = (offset: number) => void;

/**
 * 单轨流动（「滚筒」）的公共逻辑：缓慢自走 + 跟手拖动 + 松手惯性。
 *
 * 记忆卡片（MemoryCylinder 的 FlowTracks）与超量类别星星（CategoryStars）都用它。
 * 只负责 offset 与拖动状态；各项的渲染位置（含循环回绕）由调用方算，
 * 通过 `onFrame` 订阅后**直接写 DOM**（见上面的说明）。
 */
export function useTrackFlow({
  /** 轨道主轴长度（宽屏=宽，窄屏=高），用于换算拖动方向 */
  mainLen,
  vertical = false,
}: {
  mainLen: number;
  vertical?: boolean;
}) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastPosRef = useRef(0);
  const movedRef = useRef(false);
  const lastDragEndRef = useRef(0);
  /** 每帧回调集合（订阅方在 effect 里注册，卸载时退订） */
  const framesRef = useRef(new Set<FrameCallback>());
  const [ready, setReady] = useState(false);

  /** 通知所有帧回调：rAF 每帧调用；拖动时每个事件也调，保证跟手不滞后一帧 */
  const emit = useCallback(() => {
    for (const cb of framesRef.current) cb(offsetRef.current);
  }, []);

  /** 订阅每一帧（返回退订函数）。回调里直接写 DOM，不要 setState。 */
  const onFrame = useCallback((cb: FrameCallback) => {
    framesRef.current.add(cb);
    return () => {
      framesRef.current.delete(cb);
    };
  }, []);

  // 首帧随机初始位置（客户端生成），随后淡入，避免看到跳变
  useEffect(() => {
    const timer = window.setTimeout(() => {
      offsetRef.current = -Math.random() * mainLen * 0.8;
      emit();
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
    // mainLen 变化不需要重播入场动画，只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动流动：offset 递减（横向向左 / 纵向向上），时间由旧至新
  useEffect(() => {
    if (reduceMotion || !ready) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 1) {
          // 松手后的惯性：与拖动同向
          offsetRef.current += velocityRef.current * dt;
          velocityRef.current *= 0.94;
        } else {
          velocityRef.current = 0;
          offsetRef.current -= FLOW_SPEED * dt;
        }
        emit();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, ready, emit]);

  /** 拖动：沿轨道方向跟手移动 */
  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    movedRef.current = false;
    lastPosRef.current = vertical ? e.clientY : e.clientX;
    velocityRef.current = 0;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const p = vertical ? e.clientY : e.clientX;
    const d = p - lastPosRef.current;
    lastPosRef.current = p;
    if (Math.abs(d) > 2) {
      movedRef.current = true;
      containerRef.current?.setPointerCapture(e.pointerId);
    }
    offsetRef.current += d;
    velocityRef.current = d * 60;
    emit();
  }

  function endDrag(e: React.PointerEvent) {
    draggingRef.current = false;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    // 拖过就开一个时间窗：紧随其后的那次 click 不算点击；窗口过期后不再拦。
    // 不能用「粘性标记 + 只在 pointerdown 清零」——流动形态切回散布时拖动层会被卸载，
    // 那种写法会永远清不掉标记，把之后所有点击都吞掉。
    if (movedRef.current) lastDragEndRef.current = performance.now();
  }

  /** 刚拖过就别把这次抬手当成点击（只拦拖动结束后立刻到来的那一次 click） */
  const justDragged = useCallback(
    () => performance.now() - lastDragEndRef.current < DRAG_CLICK_GUARD_MS,
    [],
  );

  return {
    reduceMotion,
    containerRef,
    /** 当前 offset。只在 effect / 事件回调里读（渲染期不读，避免 lint 与不一致） */
    offsetRef,
    /** 订阅每帧（回调里写 DOM，别 setState） */
    onFrame,
    ready,
    onPointerDown,
    onPointerMove,
    endDrag,
    justDragged,
  };
}
