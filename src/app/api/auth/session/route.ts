import { hasOwner, isOwner } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/auth/session：登录态与口令状态。
 * - authed：当前是否已登录
 * - hasPassword：是否已设置过访问口令（false 时前端显示「设置口令」而不是「登录」）
 */
export async function GET() {
  return Response.json({ authed: await isOwner(), hasPassword: hasOwner() });
}
