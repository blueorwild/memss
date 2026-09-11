"use client";

import { create } from "zustand";

/** 小精灵面板的视图类型：对话 / 上传回忆 */
export type SpriteView = "chat" | "upload";

type SpriteState = {
  /** 面板是否展开 */
  open: boolean;
  /** 当前视图 */
  view: SpriteView;
  /** 切换展开/收起 */
  toggle: () => void;
  /** 打开面板并切到指定视图 */
  openView: (view: SpriteView) => void;
  /** 收起面板 */
  close: () => void;
};

/** 小精灵全局状态（跨页面常驻，故用 zustand） */
export const useSpriteStore = create<SpriteState>((set) => ({
  open: false,
  view: "chat",
  toggle: () => set((s) => ({ open: !s.open })),
  openView: (view) => set({ open: true, view }),
  close: () => set({ open: false }),
}));
