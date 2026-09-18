import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { getAgentConfig } from "@/lib/settings";
import { getPreset } from "@/lib/providers";

export const runtime = "nodejs";

/** 从各种 OpenAI 兼容 /models 响应中提取模型 id */
function extractModels(data: unknown): string[] {
  const pick = (arr: unknown[]): string[] =>
    arr
      .map((m) => (typeof m === "string" ? m : (m as { id?: unknown })?.id))
      .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (Array.isArray(data)) return pick(data);
  const obj = data as { data?: unknown; models?: unknown } | null;
  if (Array.isArray(obj?.data)) return pick(obj.data);
  if (Array.isArray(obj?.models)) return pick(obj.models);
  return [];
}

/**
 * GET /api/agent/models?providerId=xxx
 * 服务端代理请求该服务的 /models，复用已存密钥（baseURL 由预置内部提供）。
 */
export async function GET(req: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;
  const url = new URL(req.url);
  const providerId = url.searchParams.get("providerId") ?? "";

  const preset = getPreset(providerId);
  if (!preset) return Response.json({ error: "未知的服务" }, { status: 400 });

  const config = getAgentConfig();
  const provider = config.providers[preset.id];
  const apiKey = provider.apiKeyEnc ? (decryptSecret(provider.apiKeyEnc) ?? "") : "";

  const baseURL = preset.baseURL.replace(/\/+$/, "");
  const headers: Record<string, string> = { ...preset.headers };
  if (!headers["User-Agent"] && !headers["user-agent"]) {
    headers["User-Agent"] = "memory-starfield/1.0";
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const res = await fetch(`${baseURL}/models`, { headers, cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const detail = text.slice(0, 120).replace(/\s+/g, " ");
      return Response.json(
        { error: `获取模型失败（${res.status}）${detail}` },
        { status: 502 },
      );
    }
    const models = extractModels(await res.json());
    if (models.length === 0) {
      return Response.json({ error: "该服务未返回模型列表，请手动填写" }, { status: 404 });
    }
    return Response.json({ models });
  } catch (err) {
    return Response.json(
      { error: `无法连接：${err instanceof Error ? err.message : "网络错误"}` },
      { status: 502 },
    );
  }
}
