import {
  FALLBACK_DEFAULT_MODEL,
  getGuestModels,
  pickDefaultModel,
} from "@/lib/guest-models";

export const runtime = "nodejs";

/**
 * GET /api/guest/models：访客可选的免费模型（公开只读，不含任何密钥信息）。
 *
 * 列表来自 OpenRouter 的实时 `/models`（服务端缓存 6 小时），所以官方轮换免费档时这里会自动跟上。
 * 拉不到列表时 `ok=false`，前端只显示默认模型、但仍然可以聊天。
 */
export async function GET() {
  const models = await getGuestModels();
  return Response.json(
    {
      ok: models.length > 0,
      defaultModel: models.length > 0 ? pickDefaultModel(models) : FALLBACK_DEFAULT_MODEL,
      models,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
