"use client";

import { create } from "zustand";

/** 小精灵面板的视图类型：对话 / 搜索 / 上传回忆 / 编辑回忆 / 设置 */
export type SpriteView = "chat" | "search" | "upload" | "edit" | "settings";

/** 上传预填草稿（由小精灵工具下发） */
export type UploadDraft = {
  categoryId?: string;
  title?: string;
  description?: string;
  date?: string;
};

/** 搜索预填草稿（由小精灵工具下发） */
export type SearchDraft = {
  query?: string;
  categoryId?: string;
};

type SpriteState = {
  /** 面板是否展开 */
  open: boolean;
  /** 当前视图 */
  view: SpriteView;
  /** 上传表单预填草稿 */
  uploadDraft: UploadDraft | null;
  /** 搜索面板预填草稿 */
  searchDraft: SearchDraft | null;
  /** 正在编辑的回忆 id（view 为 "edit" 时有效） */
  editMemoryId: string | null;
  /** 导航请求（目标 /star/... 路径），由星空页消费并播放迷雾过渡 */
  navRequest: string | null;
  /** 是否正在播放场景过渡（用于暂停背景星空动画） */
  sceneTransitioning: boolean;
  /** 切换展开/收起 */
  toggle: () => void;
  /** 打开面板并切到指定视图 */
  openView: (view: SpriteView) => void;
  /** 收起面板 */
  close: () => void;
  /** 打开上传视图（可带预填草稿） */
  openUpload: (draft?: UploadDraft) => void;
  /** 打开搜索视图（可带预填关键词/类别） */
  openSearch: (draft?: SearchDraft) => void;
  /** 打开编辑视图（编辑指定回忆） */
  openEdit: (memoryId: string) => void;
  /** 清空上传预填草稿 */
  clearUploadDraft: () => void;
  /** 清空搜索预填草稿 */
  clearSearchDraft: () => void;
  /** 请求导航到某个星空路径 */
  requestNavigate: (path: string) => void;
  /** 清除导航请求 */
  clearNavRequest: () => void;
  /** 设置场景过渡状态 */
  setSceneTransitioning: (value: boolean) => void;
};

/** 小精灵全局状态（跨页面常驻，故用 zustand） */
export const useSpriteStore = create<SpriteState>((set) => ({
  open: false,
  view: "chat",
  uploadDraft: null,
  searchDraft: null,
  editMemoryId: null,
  navRequest: null,
  sceneTransitioning: false,
  toggle: () => set((s) => ({ open: !s.open })),
  openView: (view) => set({ open: true, view }),
  close: () => set({ open: false }),
  openUpload: (draft) => set({ open: true, view: "upload", uploadDraft: draft ?? null }),
  openSearch: (draft) => set({ open: true, view: "search", searchDraft: draft ?? null }),
  openEdit: (memoryId) => set({ open: true, view: "edit", editMemoryId: memoryId }),
  clearUploadDraft: () => set({ uploadDraft: null }),
  clearSearchDraft: () => set({ searchDraft: null }),
  requestNavigate: (path) => set({ navRequest: path }),
  clearNavRequest: () => set({ navRequest: null }),
  setSceneTransitioning: (value) => set({ sceneTransitioning: value }),
}));
