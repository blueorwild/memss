import { logout } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/auth/logout：注销当前会话（仅删这一条 + 清 cookie） */
export async function POST() {
  await logout();
  return Response.json({ ok: true });
}
