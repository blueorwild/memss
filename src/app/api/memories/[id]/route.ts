import { NextRequest } from "next/server";
import { deleteMemoryById } from "@/lib/db/mutations";

export const runtime = "nodejs";

/** DELETE /api/memories/[id]：删除一条回忆及其媒体记录与物理文件 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteMemoryById(id);
  if (!ok) {
    return Response.json({ error: "回忆不存在" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
