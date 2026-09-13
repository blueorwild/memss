import { NextRequest } from "next/server";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { isStepCount, streamText } from "ai";
import { resolveActiveProvider } from "@/lib/settings";
import { createAgentTools, type ClientAction } from "@/lib/agent-tools";
import { getCategoryPath, listCategories, listMemories, getSubtreeMemoryCounts } from "@/lib/db/queries";

export const runtime = "nodejs";

/** 对话消息（前端仅传 user/assistant 文本） */
type ChatMessage = { role: "user" | "assistant"; content: string };

/** 小精灵人格与基本约束 */
const SYSTEM_PROMPT = [
  "你是「回忆星空」里的小精灵，常驻在用户的个人回忆网站中。",
  "你温和、简洁、带一点俏皮，自称小精灵。",
  "始终用中文回复，一般控制在两三句话内；用户要求详细时可以展开。",
  "检索到回忆后，正文只用一两句话概括（如数量与大致范围），严禁逐条罗列回忆的标题或日期——详细条目一律由卡片呈现给用户。",
  "一轮对话最多调用一次 searchMemories；若结果不理想，就直接基于已有结果作答，不要反复换词重复检索；检索后必须给出一句话的回应，不要留空。",
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

/** POST /api/agent：流式对话 + 工具调用，以 SSE 下发（text / tool / action / error / done） */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { messages?: ChatMessage[]; sessionId?: string; categoryId?: string }
    | null;
  const messages = (body?.messages ?? []).filter(
    (m): m is ChatMessage =>
      !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  if (messages.length === 0) {
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

  // 判断最后一条用户消息是否表达明确同意（用于删除类操作的二次确认校验）
  const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const userConfirmed = /(确认|确定|同意|删吧|删除|可以删|没问题|就这么|好的|行)/.test(
    lastUserText,
  );

  // 组装请求头：用户自定义头 + 默认 UA + 稳定的会话 ID（同一对话复用）
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId ? body.sessionId : crypto.randomUUID();
  const headers: Record<string, string> = { ...provider.headers };
  if (!headers["User-Agent"] && !headers["user-agent"]) {
    headers["User-Agent"] = "memory-starfield/1.0";
  }
  if (!headers["x-opencode-session"]) {
    headers["x-opencode-session"] = sessionId;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      // 本轮所有 searchMemories 结果，按 id 去重合并，结束后统一下发一次
      const collected = new Map<string, { id: string; title: string; date: string | null }>();
      let collectedTotal = 0;
      try {
        const model = createOpenAICompatible({
          name: provider.id,
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          headers,
        }).chatModel(provider.model);

        const result = streamText({
          model,
          system: `${SYSTEM_PROMPT}\n\n${buildContext(categoryId)}`,
          messages,
          tools: createAgentTools({ currentCategoryId: categoryId, userConfirmed }),
          stopWhen: isStepCount(8),
        });

        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            send({ type: "text", delta: part.text });
          } else if (part.type === "tool-call") {
            send({ type: "tool", name: part.toolName, status: "start" });
          } else if (part.type === "tool-result") {
            send({ type: "tool", name: part.toolName, status: "done" });
            const output = (part as {
              output?: { clientAction?: ClientAction; items?: unknown; total?: number };
            }).output;
            if (output?.clientAction) send({ type: "action", action: output.clientAction });
            // 收集检索结果（并集去重），稍后统一以卡片下发
            if (part.toolName === "searchMemories" && Array.isArray(output?.items)) {
              for (const it of output.items as { id?: unknown; title?: unknown; date?: unknown }[]) {
                if (it && typeof it.id === "string") {
                  collected.set(it.id, {
                    id: it.id,
                    title: typeof it.title === "string" ? it.title : "",
                    date: typeof it.date === "string" ? it.date : null,
                  });
                }
              }
              if (typeof output.total === "number") {
                collectedTotal = Math.max(collectedTotal, output.total);
              }
            }
          } else if (part.type === "tool-error") {
            send({ type: "tool", name: part.toolName, status: "error" });
          } else if (part.type === "error") {
            send({ type: "error", message: errorMessage(part.error) });
          }
        }
        // 统一下发本轮检索到的回忆（并集去重）
        if (collected.size > 0) {
          send({
            type: "memories",
            items: [...collected.values()],
            total: Math.max(collectedTotal, collected.size),
          });
        }
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
