import { NextRequest } from "next/server";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { isStepCount, streamText } from "ai";
import type { ModelMessage } from "ai";
import { resolveActiveProvider } from "@/lib/settings";
import { createAgentTools, type ClientAction } from "@/lib/agent-tools";
import {
  getCategoryPath,
  listCategories,
  listMemories,
  getSubtreeMemoryCounts,
  createConversation,
  getConversation,
  listMessages,
  addMessages,
  touchConversation,
  type MessageInput,
} from "@/lib/db/queries";
import type { Message } from "@/lib/db/schema";

export const runtime = "nodejs";

/** 检索卡片中的记忆条目 */
type CardItem = { id: string; title: string; date: string | null };

/** 小精灵人格与基本约束 */
const SYSTEM_PROMPT = [
  "你是「回忆星空」里的小精灵，常驻在用户的个人回忆网站中。",
  "你温和、简洁、带一点俏皮，自称小精灵。",
  "始终用中文回复，一般控制在两三句话内；用户要求详细时可以展开。",
  "给用户看回忆的工作流：先调用一次 searchMemories 取回候选（当条件可能命中较多回忆时把 limit 调大，例如 20~50，争取一次取全；结果里带 location 与 category，可用于判断地点与归属），再在推理中按用户条件筛选、排除不符合的条目，最后用 showMemories 显式指定本批展示（每批最多 3 条），正文两三句话概括。",
  "一轮最多调用一次 searchMemories：一次取全后直接过滤即可，不要为凑结果反复换词检索；检索后必须给出回应，不要留空。",
  "不要在调用工具之前输出正文：工具调用前的说明一律省略，只在最终回答里用两三句话概括一次，避免重复表述。",
  "若符合条件的回忆超过 3 条：先展示前 3 条，并在正文说明共 N 条、还有 X 条，提示用户想看就说「继续」；用户说「继续 / 还有吗」时，展示尚未展示过的下 3 条（依据此前 showMemories 用过的 id 避开重复）。",
  "showMemories 的 total 传符合条件的结果总数，用于「共 N 条」提示；正文不要复述卡片里的逐条内容。",
  "示例：✅「日本有 11 条回忆，从 2022 年秋天的涩谷霓虹到 2024 年的银座圣诞灯，四季都有，集中在东京，也有京都的。」❌「1. 银座的圣诞灯（2024-12-24）2. 夏日祭的烟火（2024-08-15）…」",
  "删除回忆或类别（遗忘）前，必须先向用户复述要删除的对象并取得明确同意；若类别下有回忆，先让用户在「迁移到上一级」与「一并遗忘」中选择。得到同意后才调用对应工具并传 confirm=true。",
].join("");

/** 从任意错误对象中提取可读文案 */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "生成失败";
  }
}

/** 拼装当前回忆空间上下文，供模型参考 */
function buildContext(categoryId?: string): string {
  const lines: string[] = [];

  if (categoryId) {
    const path = getCategoryPath(categoryId);
    if (path.length > 0) {
      lines.push(
        `用户当前位于类别路径：${path.map((c) => c.name).join(" / ")}（当前类别 id：${categoryId}）。`,
      );
    }
  }

  const cats = listCategories();
  const counts = getSubtreeMemoryCounts();
  if (cats.length > 0) {
    lines.push(
      `类别与回忆数概览：${cats.map((c) => `${c.name}(${counts.get(c.id) ?? 0}条)`).join("、")}。`,
    );
  }
  lines.push(`回忆总数：${listMemories().length} 条。`);
  lines.push("涉及具体回忆内容或跳转时，请调用相应工具获取，不要凭空编造。");

  return lines.join("\n");
}

/** 从一条消息中提取纯文本（用于历史展示与内容摘要） */
function messageText(msg: ModelMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  return "";
}

/** 判断一条消息是否包含工具调用（用于识别"工具前的预告文本"） */
function hasToolCall(msg: ModelMessage): boolean {
  return Array.isArray(msg.content) && msg.content.some((p) => p.type === "tool-call");
}

/** 把库中历史消息还原为 AI SDK 消息，并追加本轮用户输入 */
function toModelMessages(rows: Message[], currentText: string): ModelMessage[] {
  const msgs: ModelMessage[] = [];
  for (const row of rows) {
    if (row.data) {
      try {
        msgs.push(JSON.parse(row.data) as ModelMessage);
        continue;
      } catch {
        // 数据损坏时退回纯文本
      }
    }
    if (row.role === "user" || row.role === "assistant") {
      msgs.push({ role: row.role, content: row.content });
    }
  }
  if (currentText) msgs.push({ role: "user", content: currentText });
  return msgs;
}

/** POST /api/agent：流式对话 + 工具调用，以 SSE 下发（meta / text / tool / action / memories / error / done） */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { conversationId?: string; text?: string; categoryId?: string }
    | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ error: "缺少消息内容" }, { status: 400 });
  }

  const provider = resolveActiveProvider();
  if (!provider.baseURL) {
    return Response.json({ error: "请先在设置里填写 Base URL" }, { status: 400 });
  }
  if (!provider.apiKey) {
    return Response.json({ error: "请先在设置里填写 API Key" }, { status: 400 });
  }

  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : undefined;

  // 定位或新建会话
  const requestedId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
  let conversation = requestedId ? getConversation(requestedId) : null;
  if (!conversation) {
    const title = text.length > 20 ? `${text.slice(0, 20)}…` : text;
    conversation = createConversation(title);
  }
  const conversationId = conversation.id;

  // 历史消息（不含本轮输入）
  const history = listMessages(conversationId);

  // 判断最后一条用户消息是否表达明确同意（用于删除类操作的二次确认校验）
  const userConfirmed = /(确认|确定|同意|删吧|删除|可以删|没问题|就这么|好的|行)/.test(text);

  // 落库本轮用户消息；若上一条正是同内容且其后没有助手回复（失败/中止后的重试），则跳过重复插入
  const lastRow = history[history.length - 1];
  const isRetry = lastRow?.role === "user" && lastRow.content === text;
  if (!isRetry) {
    addMessages(conversationId, [
      { role: "user", content: text, data: { role: "user", content: text } },
    ]);
  }

  // 组装请求头：用户自定义头 + 默认 UA + 会话 ID（同一会话复用）
  const headers: Record<string, string> = { ...provider.headers };
  if (!headers["User-Agent"] && !headers["user-agent"]) {
    headers["User-Agent"] = "memory-starfield/1.0";
  }
  if (!headers["x-opencode-session"]) {
    headers["x-opencode-session"] = conversationId;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      // 本轮 showMemories 决定要展示的卡片（由模型显式指定，最多 3 条）
      let roundCards: { items: CardItem[]; total: number } | null = null;
      // 步骤级文本缓冲：仅下发「不含工具调用」的步骤文本（最终回答），丢弃工具前的预告文本
      let stepText = "";
      let stepHasTool = false;
      try {
        send({ type: "meta", conversationId, title: conversation.title });

        const model = createOpenAICompatible({
          name: provider.id,
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          headers,
        }).chatModel(provider.model);

        const result = streamText({
          model,
          system: `${SYSTEM_PROMPT}\n\n${buildContext(categoryId)}`,
          messages: toModelMessages(history, text),
          tools: createAgentTools({ currentCategoryId: categoryId, userConfirmed }),
          stopWhen: isStepCount(8),
        });

        for await (const part of result.fullStream) {
          if (part.type === "start-step") {
            stepText = "";
            stepHasTool = false;
          } else if (part.type === "text-delta") {
            stepText += part.text;
          } else if (part.type === "finish-step") {
            // 只把"最终步骤"（未调用工具）的文本下发，避免与工具前的预告文本重复
            if (!stepHasTool && stepText.trim()) send({ type: "text", delta: stepText });
            stepText = "";
            stepHasTool = false;
          } else if (part.type === "tool-call") {
            stepHasTool = true;
            send({ type: "tool", name: part.toolName, status: "start" });
          } else if (part.type === "tool-result") {
            send({ type: "tool", name: part.toolName, status: "done" });
            const output = (part as {
              output?: {
                clientAction?: ClientAction;
                items?: CardItem[];
                total?: number;
              };
            }).output;
            if (output?.clientAction) send({ type: "action", action: output.clientAction });
            // 仅 showMemories 的结果作为卡片下发（含前端需要的条数与总数）
            if (part.toolName === "showMemories" && Array.isArray(output?.items)) {
              const items = output.items;
              const total =
                typeof output.total === "number" ? output.total : items.length;
              roundCards = { items, total };
              send({ type: "memories", items, total });
            }
          } else if (part.type === "tool-error") {
            send({ type: "tool", name: part.toolName, status: "error" });
          } else if (part.type === "error") {
            send({ type: "error", message: errorMessage(part.error) });
          }
        }

        // 落库本轮的助手与工具消息（含完整工具调用结构），并把卡片绑定到最后一条助手消息
        const responseMessages = await result.responseMessages;
        const stored: MessageInput[] = responseMessages.map((m) => ({
          role: m.role,
          // 含工具调用的步骤（工具前的预告文本）不保留正文，避免历史重复；data 仍保留完整结构供回灌
          content: hasToolCall(m) ? "" : messageText(m),
          data: m,
        }));
        if (roundCards) {
          for (let i = stored.length - 1; i >= 0; i--) {
            if (stored[i].role === "assistant") {
              stored[i].cards = roundCards;
              break;
            }
          }
        }
        addMessages(conversationId, stored);
        touchConversation(conversationId);

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: errorMessage(err) });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
