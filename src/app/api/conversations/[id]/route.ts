import { NextRequest } from "next/server";
import { deleteConversation, getConversationWithMessages } from "@/lib/db/queries";

export const runtime = "nodejs";

/** GET /api/conversations/[id]：会话详情 + 消息（供前端渲染历史，含卡片） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getConversationWithMessages(id);
  if (!data) return Response.json({ error: "会话不存在" }, { status: 404 });

  const messages = data.messages
    .filter((m) => {
      if (m.role === "user") return true;
      if (m.role !== "assistant") return false;
      // 跳过只含工具调用的中间步骤（既无正文也无卡片），避免历史里出现空气泡
      return Boolean(m.content.trim()) || Boolean(m.cards);
    })
    .map((m) => {
      let cards: unknown = null;
      if (m.cards) {
        try {
          cards = JSON.parse(m.cards);
        } catch {
          cards = null;
        }
      }
      return { id: m.id, role: m.role, content: m.content, cards, createdAt: m.createdAt };
    });

  return Response.json({ conversation: data.conversation, messages });
}

/** DELETE /api/conversations/[id]：删除单个会话 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteConversation(id);
  return Response.json({ ok: true });
}
