"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 观测元素尺寸（contentRect）。
 * 初始测量放到 setTimeout 里异步执行，避免 effect 内同步 setState 触发级联渲染。
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    const timer = window.setTimeout(
      () => setSize({ w: el.clientWidth, h: el.clientHeight }),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  return [ref, size] as const;
}
