import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import {
  getPublicAgentConfig,
  getPublicGuestConfig,
  saveAgentConfig,
  saveGuestConfig,
  type SaveAgentConfigInput,
  type SaveGuestConfigInput,
} from "@/lib/settings";

export const runtime = "nodejs";

/** GET /api/settings：返回 Agent provider 配置（密钥仅掩码）与访客对话配置——仅站长可见 */
export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  return Response.json({ ...getPublicAgentConfig(), guest: getPublicGuestConfig() });
}

/** PUT /api/settings：更新配置；apiKey 留空表示保留、null 表示清除 */
export async function PUT(req: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as
    | (SaveAgentConfigInput & { guest?: SaveGuestConfigInput })
    | null;
  if (!body) return Response.json({ error: "无效的请求体" }, { status: 400 });
  if (body.guest) saveGuestConfig(body.guest);
  return Response.json({ ...saveAgentConfig(body), guest: getPublicGuestConfig() });
}
