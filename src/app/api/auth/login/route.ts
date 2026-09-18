import { NextRequest } from "next/server";
import { login } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/auth/login：口令登录；body = { password, remember } */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { password?: unknown; remember?: unknown }
    | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return Response.json({ error: "请输入访问口令" }, { status: 400 });

  const result = await login(password, body?.remember === true);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
