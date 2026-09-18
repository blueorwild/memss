"use client";

import { create } from "zustand";

/**
 * 聊天会话的内存暂存：**站长与访客共用**。
 *
 * 为什么需要它：小精灵面板在切换视图（对话 / 搜索 / 上传 / 设置）时会把 `ChatPanel` 卸载，
 * 而聊天状态原本都是组件内部的 state/ref，一卸载就全没了 —— 表现为
 * 「发送后还没回复就切走，切回来回复不见了」，访客更是「切到设置就全清空」。
 *
 * 把状态放在这里之后：
 * - 流式回复继续写进 store，切回来能看到（含正在生成中的）；
 * - 服务端 `meta` 事件回填的 `conversationId` 不会因为卸载而丢（新会话首条消息尤其关键）；
 * - `input` 草稿、`lastUser`（重试）、`controller`（停止）都能跨视图存活。
 *
 * 纯内存：刷新页面即清空（按产品要求，访客对话不落库、不进 localStorage）。
 */

/** 检索结果中的记忆条目（含封面与地点，卡片与搜索面板共用渲染） */
export type MemoryCardItem = {
  id: string;
  title: string;
  date: string | null;
  location?: string | null;
  cover?: { path: string; focalX: number; focalY: number; cropScale: number } | null;
};

export type Msg = {
  role: "user" | "assistant";
  content: string;
  /** 本条助手消息对应的检索卡片（由后端决定，最多 3 条；访客对话没有卡片） */
  cards?: MemoryCardItem[];
  /** 卡片对应的结果总数 */
  cardsTotal?: number;
};

/** 当前聊天属于哪种身份：切换身份时必须复位，避免站长的会话泄漏给访客 */
export type ChatMode = "owner" | "guest";

type ChatSessionState = {
  mode: ChatMode | null;
  messages: Msg[];
  streaming: boolean;
  toolStatus: string | null;
  error: string | null;
  /** 输入框草稿：切走再回来不丢 */
  input: string;
  /** 上一次发送的文本：用于失败后「重试」 */
  lastUser: string;
  /** 正在进行的请求；跨视图保留，所以切走再回来仍能「停止」 */
  controller: AbortController | null;
  /** 站长当前的会话 id（访客恒为 null） */
  conversationId: string | null;

  /** 切到某个身份：mode 变化时复位全部状态（原地不动则保持，让切视图无损） */
  begin: (mode: ChatMode, welcome: string) => void;
  setMessages: (updater: Msg[] | ((prev: Msg[]) => Msg[])) => void;
  patch: (
    partial: Partial<
      Pick<ChatSessionState, "streaming" | "toolStatus" | "error" | "input" | "lastUser" | "controller" | "conversationId">
    >,
  ) => void;
};

export const useChatSession = create<ChatSessionState>((set) => ({
  mode: null,
  messages: [],
  streaming: false,
  toolStatus: null,
  error: null,
  input: "",
  lastUser: "",
  controller: null,
  conversationId: null,

  begin: (mode, welcome) =>
    set((s) => {
      if (s.mode === mode) return s;
      // 换身份：旧请求作废（不 abort，交给服务端收尾），状态整体复位
      return {
        mode,
        messages: [{ role: "assistant", content: welcome }],
        streaming: false,
        toolStatus: null,
        error: null,
        input: "",
        lastUser: "",
        controller: null,
        conversationId: null,
      };
    }),

  setMessages: (updater) =>
    set((s) => ({
      messages: typeof updater === "function" ? updater(s.messages) : updater,
    })),

  patch: (partial) => set(partial),
}));
