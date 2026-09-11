"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

/** 占位回复文案：P4 接入真实 LLM 后会替换 */
function mockReply(): string {
  return "（占位回复）我听见你了。等接入真正的模型后，我就能帮你找回忆、配音乐，甚至带你逛这片星空。";
}

/** 对话面板：P3 先本地模拟流式逐字输出，P4 替换为真实流式接口 */
export default function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "你好，我是这片星空里的小精灵。想聊点什么？" },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 消息更新后自动滚到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  /** 发送：追加用户消息，再逐字追加助手回复（模拟流式） */
  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setStreaming(true);

    const full = mockReply();
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    for (let i = 0; i < full.length; i++) {
      await new Promise((r) => setTimeout(r, 22));
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: full.slice(0, i + 1) };
        return copy;
      });
    }
    setStreaming(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 ${
                m.role === "user"
                  ? "bg-indigo-500/70 text-white"
                  : "bg-white/10 text-white/90"
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
      </div>

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
          发送
        </button>
      </div>
    </div>
  );
}
