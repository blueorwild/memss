import { NextRequest } from "next/server";
import { clearConversations, deleteConversations, listConversations } from "@/lib/db/queries";

export const runtime = "nodejs";

/** GET /api/conversations：会话列表（按更新时间倒序） */
export async function GET() {
  return Response.json({ conversations: listConversations() });
}

/** DELETE /api/conversations?all=1 清空全部；?ids=a,b 删除选中 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("all") === "1") {
    clearConversations();
    return Response.json({ ok: true });
  }
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return Response.json({ error: "缺少要删除的会话 id" }, { status: 400 });
  }
  deleteConversations(ids);
  return Response.json({ ok: true });
}
