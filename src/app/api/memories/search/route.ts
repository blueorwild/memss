import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT, searchMemories } from "@/lib/memory-search";

export const runtime = "nodejs";

/**
 * GET /api/memories/search?q=&categoryId=&from=&to=&limit=
 * 与 Agent 的 searchMemories 工具共用内核（src/lib/memory-search.ts），语义一致。
 * 返回 { total, count, items }，items 含封面裁剪参数，供列表直接渲染缩略图。
 */
export async function GET(req: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : SEARCH_DEFAULT_LIMIT;

  const result = searchMemories({
    query: sp.get("q") ?? undefined,
    categoryId: sp.get("categoryId") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    limit,
  });

  return Response.json({ ...result, maxLimit: SEARCH_MAX_LIMIT });
}
