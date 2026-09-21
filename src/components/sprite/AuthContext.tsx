"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * 登录态上下文：由根布局按 cookie 在服务端判定，再传给页面与 Sprite，
 * 因此首屏渲染就是正确的一版（不会先闪一下访客界面）。
 * 登录 / 登出后调用 `router.refresh()` 让服务端重新判定。
 */
const AuthedContext = createContext(false);

/**
 * 「访客允许浏览」开关的上下文：同样由根布局在服务端读取。
 * 页面与面板据此决定给访客看什么（关掉后只剩空星空 + 闲聊，连只读工具都没有）。
 */
const BrowseContext = createContext(true);

export function AuthedProvider({
  value,
  browseOpen = true,
  children,
}: {
  value: boolean;
  browseOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <AuthedContext.Provider value={value}>
      <BrowseContext.Provider value={browseOpen}>{children}</BrowseContext.Provider>
    </AuthedContext.Provider>
  );
}

/** 当前访问者是否是已登录的站长 */
export function useAuthed(): boolean {
  return useContext(AuthedContext);
}

/** 站长是否开放了「允许访客浏览」（对站长本人无影响） */
export function useBrowseOpen(): boolean {
  return useContext(BrowseContext);
}
