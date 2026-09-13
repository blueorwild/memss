"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PROVIDER_PRESETS } from "@/lib/providers";
import { useSpriteStore } from "@/store/sprite";
import type { ClientAction } from "@/lib/agent-tools";
import HistoryPanel, { type ConversationRow } from "./HistoryPanel";

/** 检索结果中的记忆条目 */
type MemoryCardItem = { id: string; title: string; date: string | null };

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

  /** 发送：只把会话 id 与输入交给后端，回复流式渲染 */
  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError(null);
    setToolStatus(null);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text, categoryId: currentCategoryId() }),
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
            if (payload) handleEvent(JSON.parse(payload) as AgentEvent);
          }
          idx = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setStreaming(false);
      setToolStatus(null);
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
        onNew={newConversation}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-1.5 text-[11px] text-white/40">
        <span>使用中：{agentLabel ?? "…"}</span>
        <button
          type="button"
          onClick={() => void openHistory()}
          className="transition-colors hover:text-white"
        >
          历史
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            {m.content && (
              <span
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                  m.role === "user"
                    ? "bg-indigo-500/70 text-white"
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
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleAction({ type: "navigate", path: `/memory/${c.id}` })}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <span className="truncate">{c.title}</span>
                    {c.date && <span className="shrink-0 text-white/35">{c.date}</span>}
                  </button>
                ))}
                {(m.cardsTotal ?? 0) > m.cards.length && (
                  <p className="text-[11px] text-white/35">
                    共 {m.cardsTotal} 条，想看其余的可以说「继续」
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        {toolStatus && <div className="text-left text-xs text-white/40">{toolStatus}</div>}
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="说点什么…"
          className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={streaming}
          className="rounded-full bg-white/15 px-4 py-2 text-sm text-white transition-colors hover:bg-white/25 disabled:opacity-40"
        >
          {streaming ? "…" : "发送"}
        </button>
      </div>
    </div>
  );
}
