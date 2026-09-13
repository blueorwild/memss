import { NextRequest } from "next/server";
import {
  getPublicAgentConfig,
  saveAgentConfig,
  type SaveAgentConfigInput,
} from "@/lib/settings";

export const runtime = "nodejs";

/** GET /api/settings：返回 Agent provider 配置（密钥仅掩码） */
export async function GET() {
  return Response.json(getPublicAgentConfig());
}

/** PUT /api/settings：更新配置；apiKey 留空表示保留、null 表示清除 */
export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as SaveAgentConfigInput | null;
  if (!body) return Response.json({ error: "无效的请求体" }, { status: 400 });
  return Response.json(saveAgentConfig(body));
}
