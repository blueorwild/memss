"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PROVIDER_PRESETS } from "@/lib/providers";
import MemoryListItem from "@/components/memory/MemoryListItem";
import { usePetActor } from "@/store/pet-actor";
import { useSpriteStore } from "@/store/sprite";
import type { ClientAction } from "@/lib/agent-tools";
import HistoryPanel, { type ConversationRow } from "./HistoryPanel";

/** 检索结果中的记忆条目（含封面与地点，卡片与搜索面板共用渲染） */
type MemoryCardItem = {
  id: string;
  title: string;
  date: string | null;
  location?: string | null;
  cover?: { path: string; focalX: number; focalY: number; cropScale: number } | null;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  /** 本条助手消息对应的检索卡片（由后端决定，最多 3 条） */
  cards?: MemoryCardItem[];
  /** 卡片对应的结果总数 */
  cardsTotal?: number;
};

/** 服务端 SSE 事件 */
type AgentEvent =
  | { type: "meta"; conversationId: string; title: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; status: "start" | "done" | "error" }
  | { type: "action"; action: ClientAction }
  | { type: "memories"; items: MemoryCardItem[]; total: number }
  | { type: "error"; message: string }
  | { type: "done" };

/** 工具执行时的状态文案 */
const TOOL_LABEL: Record<string, string> = {
  searchMemories: "正在检索回忆…",
  showMemories: "正在整理回忆…",
  navigateToCategory: "正在前往…",
  uploadMemory: "正在打开上传面板…",
  openSearch: "正在打开搜索面板…",
  openEditMemory: "正在打开编辑面板…",
  moveMemory: "正在迁移…",
  forgetMemory: "正在遗忘…",
  forgetCategory: "正在遗忘…",
  openMemory: "正在打开…",
};

const WELCOME = "你好，我是这片星空里的小精灵。想聊点什么？";
const STORAGE_KEY = "sprite:conversationId";

/** 对话面板：后端为会话真相源，前端只渲染；历史面板可管理多会话 */
export default function ChatPanel() {
  const router = useRouter();
  const pathname = usePathname();

  const [view, setView] = useState<"chat" | "history">("chat");
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: WELCOME }]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentLabel, setAgentLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 中止控制器：用于「停止」按钮
  const abortRef = useRef<AbortController | null>(null);
  // 本次请求的角色动作 id（小精灵思考/顿悟状态机用；卸载或关闭后旧 id 自动失效）
  const petReqRef = useRef(0);
  // 上一次发送的文本：用于失败后「重试」
  const lastUserRef = useRef("");

  // 读取当前生效的服务与模型，显示在面板顶部
  useEffect(() => {
    let alive = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { activeProvider: string; providers: Record<string, { model: string }> }) => {
        if (!alive) return;
        const preset = PROVIDER_PRESETS.find((p) => p.id === d.activeProvider);
        const model = d.providers?.[d.activeProvider]?.model;
        setAgentLabel(preset ? `${preset.name} · ${model || "未选择模型"}` : "未配置");
      })
      .catch(() => {
        if (alive) setAgentLabel("未配置");
      });
    return () => {
      alive = false;
    };
  }, []);

  /** 记住当前会话 id（同时写入 localStorage，刷新后恢复） */
  const rememberConversation = useCallback((id: string | null) => {
    setConversationId(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  /** 从后端加载某个会话的历史消息 */
  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) {
          rememberConversation(null);
          return;
        }
        const d = (await res.json()) as {
          conversation: ConversationRow;
          messages: { id: string; role: string; content: string; cards: unknown }[];
        };
        const msgs: Msg[] = d.messages.map((m) => {
          const cards = (m.cards as { items?: MemoryCardItem[]; total?: number } | null) ?? null;
          return {
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
            cards: cards?.items,
            cardsTotal: cards?.total,
          };
        });
        rememberConversation(id);
        setMessages(msgs.length > 0 ? msgs : [{ role: "assistant", content: WELCOME }]);
      } catch {
        // 网络异常时保持当前界面
      }
    },
    [rememberConversation],
  );

  // 首次挂载：恢复上次的会话（异步触发，避免 effect 内同步 setState）
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const timer = setTimeout(() => void loadConversation(saved), 0);
    return () => clearTimeout(timer);
  }, [loadConversation]);

  // 消息或工具状态更新后自动滚到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, toolStatus]);

  // 面板卸载（切视图 / 关闭）：作废在途请求，避免角色卡在思考姿态
  useEffect(
    () => () => {
      usePetActor.getState().notifyRequestEnd(petReqRef.current);
    },
    [],
  );

  /** 从当前 URL 解析所在类别 id：/star/a/b → "b" */
  function currentCategoryId(): string | undefined {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "star") return undefined;
    return parts[parts.length - 1];
  }

  /** 向最后一条助手消息追加文本增量 */
  function appendToLast(delta: string) {
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") {
        copy[copy.length - 1] = { ...last, content: last.content + delta };
      }
      return copy;
    });
  }

  /** 把后端返回的卡片绑定到最后一条助手消息上 */
  function setLastCards(items: MemoryCardItem[], total: number) {
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") {
        copy[copy.length - 1] = { ...last, cards: items, cardsTotal: total };
      }
      return copy;
    });
  }

  /** 执行工具下发的客户端动作 */
  function handleAction(action: ClientAction) {
    if (action.type === "navigate") {
      if (pathname.startsWith("/star")) {
        useSpriteStore.getState().requestNavigate(action.path);
      } else {
        router.push(action.path);
      }
    } else if (action.type === "openUpload") {
      useSpriteStore.getState().openUpload(action.draft);
    } else if (action.type === "openEdit") {
      useSpriteStore.getState().openEdit(action.memoryId);
    } else if (action.type === "openSearch") {
      useSpriteStore.getState().openSearch({ query: action.query, categoryId: action.categoryId });
    } else if (action.type === "moved") {
      // 归属变更：刷新当前页（详情页的面包屑与地点随之更新）
      router.refresh();
    } else if (action.type === "forgotten") {
      if (action.kind === "memory") {
        if (pathname === `/memory/${action.targetId}`) {
          router.push(action.fallbackPath);
          router.refresh();
        } else {
          router.refresh();
        }
      } else {
        const ids = pathname.startsWith("/star/")
          ? pathname.split("/").filter(Boolean).slice(1)
          : [];
        if (ids.includes(action.targetId)) {
          router.push(action.fallbackPath);
          router.refresh();
        } else {
          router.refresh();
        }
      }
    }
  }

  /** 处理单条 SSE 事件 */
  function handleEvent(evt: AgentEvent) {
    if (evt.type === "meta") {
      rememberConversation(evt.conversationId);
    } else if (evt.type === "text") {
      appendToLast(evt.delta);
    } else if (evt.type === "tool") {
      setToolStatus(evt.status === "start" ? (TOOL_LABEL[evt.name] ?? "小精灵正在操作…") : null);
    } else if (evt.type === "memories") {
      setLastCards(evt.items, evt.total);
    } else if (evt.type === "action") {
      handleAction(evt.action);
    } else if (evt.type === "error") {
      setError(evt.message);
    }
  }

  /** 发送当前输入 */
  function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    void sendText(text, true);
  }

  /** 停止生成 */
  function stop() {
    abortRef.current?.abort();
  }

  /** 重试上一次失败/中止的输入（用户气泡已存在，故不重复追加） */
  function retry() {
    const text = lastUserRef.current;
    if (!text || streaming) return;
    setError(null);
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant" && !last.content.trim() && !last.cards?.length) copy.pop();
      return copy;
    });
    void sendText(text, false);
  }

  /** 发送文本并流式渲染；appendUser=false 用于重试 */
  async function sendText(text: string, appendUser: boolean) {
    if (streaming) return;
    lastUserRef.current = text;
    setError(null);
    setToolStatus(null);
    setMessages((m) =>
      appendUser
        ? [...m, { role: "user", content: text }, { role: "assistant", content: "" }]
        : [...m, { role: "assistant", content: "" }],
    );
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let aborted = false;
    // 小精灵：进入思考；首个有效正文增量才顿悟，失败/停止不顿悟
    const petReq = usePetActor.getState().notifyRequestStart();
    petReqRef.current = petReq;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text, categoryId: currentCategoryId() }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "请求失败");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf("\n\n");
        while (idx >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload) {
              const evt = JSON.parse(payload) as AgentEvent;
              if (evt.type === "text" && evt.delta.trim()) {
                usePetActor.getState().notifyFirstText(petReq);
              }
              handleEvent(evt);
            }
          }
          idx = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      if (controller.signal.aborted) aborted = true;
      else setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      abortRef.current = null;
      usePetActor.getState().notifyRequestEnd(petReq);
      setStreaming(false);
      setToolStatus(null);
      // 空文本兜底：避免留下空气泡
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && !last.content.trim() && !last.cards?.length) {
          copy[copy.length - 1] = {
            ...last,
            content: aborted ? "（已停止）" : "（这次没组织好语言，可以再问一次）",
          };
        }
        return copy;
      });
    }
  }

  /** 打开历史面板并拉取列表 */
  async function openHistory() {
    setView("history");
    try {
      const res = await fetch("/api/conversations");
      const d = (await res.json()) as { conversations?: ConversationRow[] };
      setConversations(d.conversations ?? []);
    } catch {
      setConversations([]);
    }
  }

  /** 新建会话（回到空白对话） */
  function newConversation() {
    rememberConversation(null);
    setMessages([{ role: "assistant", content: WELCOME }]);
    setView("chat");
  }

  if (view === "history") {
    return (
      <HistoryPanel
        conversations={conversations}
        currentId={conversationId}
        onOpen={(id) => {
          setView("chat");
          void loadConversation(id);
        }}
        onChanged={(deletedIds) => {
          setConversations((list) => list.filter((c) => !deletedIds.includes(c.id)));
          if (conversationId && deletedIds.includes(conversationId)) newConversation();
        }}
        onBack={() => setView("chat")}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-1.5 text-[11px] text-white/40">
        <span className="truncate">使用中：{agentLabel ?? "…"}</span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={newConversation}
            disabled={streaming}
            title="新对话（当前会话仍保留在历史里）"
            className="-my-1 px-1 py-1 transition-colors hover:text-white disabled:opacity-40 disabled:hover:text-white/40"
          >
            ＋ 新对话
          </button>
          <button
            type="button"
            onClick={() => void openHistory()}
            className="-my-1 -mr-2 px-2 py-1 transition-colors hover:text-white"
          >
            历史
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            {m.content && (
              <span
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left ${
                  m.role === "user"
                    ? "bg-accent-deep/70 text-white"
                    : "bg-white/10 text-white/90"
                }`}
              >
                {m.content}
              </span>
            )}
            {m.role === "assistant" && !m.content && streaming && i === messages.length - 1 && (
              <span className="inline-block rounded-2xl bg-white/10 px-3 py-2 text-white/60">…</span>
            )}
            {m.role === "assistant" && m.cards && m.cards.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {m.cards.map((c) => (
                  <MemoryListItem
                    key={c.id}
                    item={c}
                    variant="compact"
                    onClick={() => handleAction({ type: "navigate", path: `/memory/${c.id}` })}
                  />
                ))}
                {(m.cardsTotal ?? 0) > m.cards.length && (
                  <p className="text-[11px] text-white/35">
                    共 {m.cardsTotal} 条，想看其余的可以说「继续」或点上方「搜索」
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        {toolStatus && <div className="text-left text-xs text-white/40">{toolStatus}</div>}
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 pb-1 text-xs text-red-400">
          <span className="min-w-0 flex-1 truncate">{error}</span>
          <button
            type="button"
            onClick={retry}
            className="shrink-0 px-1 py-1 underline hover:text-red-300"
          >
            重试
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="说点什么…"
          enterKeyHint="send"
          className="min-h-11 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-base text-white outline-none placeholder:text-white/35 focus:border-white/30 sm:text-sm"
        />
        <button
          type="button"
          onClick={streaming ? stop : () => void send()}
          disabled={!streaming && !input.trim()}
          className="min-h-11 shrink-0 rounded-full bg-white/15 px-5 text-sm text-white transition-colors hover:bg-white/25 disabled:opacity-40"
        >
          {streaming ? "停止" : "发送"}
        </button>
      </div>
    </div>
  );
}
