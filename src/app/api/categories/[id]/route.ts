import { NextRequest } from "next/server";
import { deleteCategoryById } from "@/lib/db/mutations";

export const runtime = "nodejs";

/**
 * DELETE /api/categories/[id]?mode=purge|move
 * - purge：级联删除子树类别，并一并遗忘其下所有回忆（含媒体文件）
 * - move：把子树下所有回忆迁移到父类别后，再删除子树类别
 * 根类别（无 parent）不可删除。
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mode = new URL(req.url).searchParams.get("mode") === "move" ? "move" : "purge";

  const res = await deleteCategoryById(id, mode);
  if (!res.ok) {
    const status = res.error === "类别不存在" ? 404 : 400;
    return Response.json({ error: res.error }, { status });
  }

  return Response.json({
    ok: true,
    mode: res.mode,
    affectedMemories: res.affectedMemories,
    deletedCategories: res.deletedCategories,
  });
}
