"use client";

import { useCallback, useSyncExternalStore } from "react";

/** 窄屏断点：与 Tailwind 的 sm 对齐（< 640px 视为移动端） */
export const MOBILE_QUERY = "(max-width: 639px)";

/** 服务端快照：统一返回 false，避免 SSR / 客户端首帧不一致 */
const getServerSnapshot = () => false;

/**
 * 订阅某个媒体查询的结果。
 * 用 useSyncExternalStore 而非 effect + setState：既天然规避
 * react-hooks/set-state-in-effect，也不会产生 hydration 抖动。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 是否为窄屏（移动端）：< 640px */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
