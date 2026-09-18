"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * 登录态上下文：由根布局按 cookie 在服务端判定，再传给 Sprite，
 * 因此首屏渲染就是正确的一版（不会先闪一下访客界面）。
 * 登录 / 登出后调用 `router.refresh()` 让服务端重新判定。
 */
const AuthedContext = createContext(false);

export function AuthedProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <AuthedContext.Provider value={value}>{children}</AuthedContext.Provider>;
}

/** 当前访问者是否是已登录的站长 */
export function useAuthed(): boolean {
  return useContext(AuthedContext);
}
