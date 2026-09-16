import { NextRequest } from "next/server";
import {
  collectSubtree,
  deleteCategoryById,
  resyncSubtreeLocation,
  updateCategory,
} from "@/lib/db/mutations";
import { getCategory, getCategoryPath, getChildren } from "@/lib/db/queries";

export const runtime = "nodejs";

/** 最大层级（含地球）：地球-国家-省-市-自建，与 POST /api/categories 一致 */
const MAX_DEPTH = 5;

/**
 * PATCH /api/categories/[id]
 * body：{ name?, parentId? } —— 重命名 / 移动（改父级）。
 * 校验：根类别不可修改、新父存在且非自身、防环（新父不得在自身子树内）、
 * 移动后子树最大深度 ≤ MAX_DEPTH、目标同级重名。
 * 改名或移动后重算子树内所有回忆的 location（由类别路径派生）。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { name?: unknown; parentId?: unknown }
    | null;

  const cat = getCategory(id);
  if (!cat) return Response.json({ error: "类别不存在" }, { status: 404 });
  if (!cat.parentId) return Response.json({ error: "根类别不可修改" }, { status: 400 });

  const nameGiven = body && typeof body.name === "string";
  const parentGiven = body && typeof body.parentId === "string";

  const nextName = nameGiven ? (body!.name as string).trim() : undefined;
  const nextParentId = parentGiven ? (body!.parentId as string).trim() : undefined;

  if (nameGiven && !nextName) {
    return Response.json({ error: "类别名称不能为空" }, { status: 400 });
  }
  if (!nameGiven && !parentGiven) {
    return Response.json({ error: "没有需要修改的字段" }, { status: 400 });
  }

  const subtreeIds = collectSubtree(id);

  // 移动校验
  if (parentGiven) {
    if (!nextParentId) {
      return Response.json({ error: "目标父级不能为空" }, { status: 400 });
    }
    if (nextParentId === id || subtreeIds.includes(nextParentId)) {
      return Response.json({ error: "不能移动到自身或其子分类下" }, { status: 400 });
    }
    if (!getCategory(nextParentId)) {
      return Response.json({ error: "目标父级不存在" }, { status: 404 });
    }
    // 子树自身高度（自身为 1）：移动后最大深度 = 新父深度 + 子树高度
    const selfDepth = getCategoryPath(id).length;
    const height = subtreeIds.reduce(
      (max, sid) => Math.max(max, getCategoryPath(sid).length - selfDepth + 1),
      1,
    );
    if (getCategoryPath(nextParentId).length + height > MAX_DEPTH) {
      return Response.json(
        { error: `移动后超出 ${MAX_DEPTH} 级上限，无法移动` },
        { status: 400 },
      );
    }
  }

  // 重名校验：以「移动后的父级」为准，排除自身
  const targetParentId = nextParentId ?? cat.parentId;
  const finalName = nextName ?? cat.name;
  const conflict = getChildren(targetParentId).some(
    (c) => c.id !== id && c.name === finalName,
  );
  if (conflict) {
    return Response.json({ error: "同级已存在同名类别" }, { status: 409 });
  }

  const patch: { name?: string; parentId?: string; sortOrder?: number } = {};
  if (nextName !== undefined) patch.name = nextName;
  if (nextParentId !== undefined && nextParentId !== cat.parentId) {
    patch.parentId = nextParentId;
    // 移动到末尾，避免与目标同级原有排序冲突
    const siblings = getChildren(nextParentId);
    patch.sortOrder = siblings.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: true, changed: false, affectedMemories: 0 });
  }

  updateCategory(id, patch);
  // location 由类别路径派生：改名 / 移动后同步子树内全部回忆
  const affectedMemories = resyncSubtreeLocation(id);

  return Response.json({ ok: true, changed: true, affectedMemories });
}

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
