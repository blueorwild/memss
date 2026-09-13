"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PROVIDER_PRESETS } from "@/lib/providers";
import { useSpriteStore } from "@/store/sprite";
import type { ClientAction } from "@/lib/agent-tools";

/** 检索结果中的记忆条目 */
type MemoryCardItem = { id: string; title: string; date: string | null };

type Msg = {
  role: "user" | "assistant";
  content: string;
  /** 本条助手消息对应的检索卡片 */
  cards?: MemoryCardItem[];
  /** 卡片对应的检索总数 */
  cardsTotal?: number;
};

/** 服务端 SSE 事件 */
type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; status: "start" | "done" | "error" }
  | { type: "action"; action: ClientAction }
  | { type: "memories"; items: MemoryCardItem[]; total: number }
  | { type: "error"; message: string }
  | { type: "done" };

/** 工具执行时的状态文案 */
const TOOL_LABEL: Record<string, string> = {
  searchMemories: "正在检索回忆…",
  navigateToCategory: "正在前往…",
  uploadMemory: "正在打开上传面板…",
  forgetMemory: "正在遗忘…",
  forgetCategory: "正在遗忘…",
  openMemory: "正在打开…",
};

/** 对话中最多展示的记忆卡片数量 */
const MAX_CARDS = 3;

/** 对话面板：流式对接 /api/agent，逐块渲染回复，并执行工具下发的动作 */
export default function ChatPanel() {
  const router = useRouter();
  const pathname = usePathname();

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "你好，我是这片星空里的小精灵。想聊点什么？" },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentLabel, setAgentLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 会话 ID：同一面板内保持稳定，供 OpenCode Go 等需要会话头的服务做路由优化
  const sessionRef = useRef("");

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

  // 消息或工具状态更新后自动滚到底部（卡片随消息更新，故也会触发）
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

  /** 把检索卡片绑定到最后一条助手消息上 */
  function setLastCards(items: MemoryCardItem[], total: number) {
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") {
        copy[copy.length - 1] = { ...last, cards: items.slice(0, MAX_CARDS), cardsTotal: total };
      }
      return copy;
    });
  }

  /** 执行工具下发的客户端动作 */
  function handleAction(action: ClientAction) {
    if (action.type === "navigate") {
      if (pathname.startsWith("/star")) {
        // 交给星空页播放迷雾过渡后再跳转
        useSpriteStore.getState().requestNavigate(action.path);
      } else {
        router.push(action.path);
      }
    } else if (action.type === "openUpload") {
      useSpriteStore.getState().openUpload(action.draft);
    } else if (action.type === "forgotten") {
      // 与按钮删除一致：若当前正在查看被删对象，回到上一层；否则刷新当前页
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
    if (evt.type === "text") {
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

  /** 发送：追加用户消息与空助手占位，然后读取流式回复 */
  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    // 历史只带 role/content（卡片等前端状态不发送）
    const history: Msg[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];
    setInput("");
    setError(null);
    setToolStatus(null);
    setMessages([...history, { role: "assistant", content: "", cards: [] }]);
    setStreaming(true);

    try {
      if (!sessionRef.current) sessionRef.current = crypto.randomUUID();
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          sessionId: sessionRef.current,
          categoryId: currentCategoryId(),
        }),
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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-1.5 text-[11px] text-white/40">
        使用中：{agentLabel ?? "…"}
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                m.role === "user"
                  ? "bg-indigo-500/70 text-white"
                  : "bg-white/10 text-white/90"
              }`}
            >
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </span>
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
                    共 {m.cardsTotal} 条，可让小精灵缩小范围
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
