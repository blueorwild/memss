/**
 * LLM provider 预置目录：均为 OpenAI 兼容端点。
 * baseURL / headers 属于内部适配细节，不暴露给用户；用户只需选择服务并填写 API Key。
 */

export type ProviderId = "deepseek" | "opencode-go";

export type ProviderPreset = {
  id: ProviderId;
  name: string;
  /** 服务端点（内部） */
  baseURL: string;
  /** 默认模型（空则由前端取模型列表第一项） */
  defaultModel: string;
  /** 是否可公开拉取 /models（无需密钥） */
  publicModels: boolean;
  /** 内部附带的请求头 */
  headers: Record<string, string>;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    publicModels: false,
    headers: {},
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    baseURL: "https://opencode.ai/zen/go/v1",
    defaultModel: "deepseek-v4.1-flash",
    publicModels: true,
    // OpenCode Go 要求客户端标识自身；会话头 x-opencode-session 由服务端按对话注入
    headers: { "User-Agent": "memory-starfield/1.0" },
  },
];

export function getPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}

/** 兼容旧配置 id：opencode → opencode-go */
export function normalizeProviderId(id: string | undefined): ProviderId | undefined {
  if (id === "opencode") return "opencode-go";
  return PROVIDER_PRESETS.some((p) => p.id === id) ? (id as ProviderId) : undefined;
}
