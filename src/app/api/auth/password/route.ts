import { NextRequest } from "next/server";
import { changePassword, hasOwner, isOwner, setInitialPassword } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/password：设置 / 修改访问口令。
 * - 尚未设置过：body = { next }，直接设置（无需登录）
 * - 已设置过：body = { current, next }，需要已登录且旧口令正确
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { current?: unknown; next?: unknown }
    | null;
  const next = typeof body?.next === "string" ? body.next : "";
  const current = typeof body?.current === "string" ? body.current : "";
  if (!next) return Response.json({ error: "请输入新口令" }, { status: 400 });

  if (!hasOwner()) {
    const result = setInitialPassword(next);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ ok: true, created: true });
  }

  if (!(await isOwner())) return Response.json({ error: "需要登录" }, { status: 401 });
  const result = await changePassword(current, next);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
