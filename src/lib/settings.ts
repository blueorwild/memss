import { decryptSecret, encryptSecret, maskSecret } from "./crypto";
import { getSetting, setSetting } from "./db/queries";
import {
  normalizeProviderId,
  PROVIDER_PRESETS,
  type ProviderId,
} from "./providers";

/** 存储键：Agent provider 配置 */
const SETTING_KEY = "agent";
/** 存储键：访客对话（Zen 免费模型）配置 */
const GUEST_KEY = "guest";
/** 默认启用哪个 provider */
const DEFAULT_PROVIDER: ProviderId = "opencode-go";

/** 单个 provider 的用户配置（baseURL/headers 属于内部适配，不在此存储） */
export type ProviderConfig = {
  model: string;
  /** 密钥密文；null 表示未设置 */
  apiKeyEnc: string | null;
};

export type AgentConfig = {
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
};

/** 返回给前端的 provider 配置：密钥只给 hasKey 与掩码 */
export type PublicProviderConfig = {
  model: string;
  hasKey: boolean;
  keyMask: string;
};

export type PublicAgentConfig = {
  activeProvider: ProviderId;
  providers: Record<ProviderId, PublicProviderConfig>;
};

/** 保存入参：apiKey 省略/空串=保留原值，null=清除，有值=更新 */
export type SaveAgentConfigInput = {
  activeProvider?: string;
  providers?: Record<
    string,
    {
      model?: string;
      apiKey?: string | null;
    }
  >;
};

/** 基于预置目录生成默认配置 */
function defaultProviders(): Record<ProviderId, ProviderConfig> {
  const out = {} as Record<ProviderId, ProviderConfig>;
  for (const p of PROVIDER_PRESETS) {
    out[p.id] = { model: p.defaultModel, apiKeyEnc: null };
  }
  return out;
}

/** 兼容旧的 opencode id 与多余字段，解析存储的 JSON */
function parseConfig(raw: string | null): AgentConfig {
  const base = defaultProviders();
  if (!raw) return { activeProvider: DEFAULT_PROVIDER, providers: base };
  try {
    const parsed = JSON.parse(raw) as {
      activeProvider?: string;
      providers?: Record<string, { model?: unknown; apiKeyEnc?: unknown }>;
    };
    const legacy = parsed.providers ?? {};
    const providers = { ...base };
    for (const p of PROVIDER_PRESETS) {
      // 旧版本中 opencode-go 的配置存在 "opencode" 键下
      const saved = legacy[p.id] ?? (p.id === "opencode-go" ? legacy.opencode : undefined);
      if (!saved) continue;
      providers[p.id] = {
        model: typeof saved.model === "string" && saved.model ? saved.model : base[p.id].model,
        apiKeyEnc: typeof saved.apiKeyEnc === "string" ? saved.apiKeyEnc : null,
      };
    }
    return {
      activeProvider: normalizeProviderId(parsed.activeProvider) ?? DEFAULT_PROVIDER,
      providers,
    };
  } catch {
    return { activeProvider: DEFAULT_PROVIDER, providers: base };
  }
}

export function getAgentConfig(): AgentConfig {
  return parseConfig(getSetting(SETTING_KEY));
}

/** 转为前端可见配置（解密后仅回传掩码） */
export function getPublicAgentConfig(config: AgentConfig = getAgentConfig()): PublicAgentConfig {
  const providers = {} as Record<ProviderId, PublicProviderConfig>;
  for (const p of PROVIDER_PRESETS) {
    const c = config.providers[p.id];
    const plain = c.apiKeyEnc ? decryptSecret(c.apiKeyEnc) : null;
    providers[p.id] = {
      model: c.model,
      hasKey: Boolean(plain),
      keyMask: plain ? maskSecret(plain) : "",
    };
  }
  return { activeProvider: config.activeProvider, providers };
}

/** 保存配置（密钥按语义更新），返回前端可见配置 */
export function saveAgentConfig(input: SaveAgentConfigInput): PublicAgentConfig {
  const config = getAgentConfig();

  const nextActive = normalizeProviderId(input.activeProvider);
  if (nextActive) config.activeProvider = nextActive;

  if (input.providers) {
    for (const p of PROVIDER_PRESETS) {
      const patch = input.providers[p.id];
      if (!patch) continue;
      const target = config.providers[p.id];
      if (typeof patch.model === "string") target.model = patch.model.trim();
      if (patch.apiKey === null) {
        target.apiKeyEnc = null;
      } else if (typeof patch.apiKey === "string" && patch.apiKey.trim()) {
        target.apiKeyEnc = encryptSecret(patch.apiKey.trim());
      }
    }
  }

  setSetting(SETTING_KEY, JSON.stringify(config));
  return getPublicAgentConfig(config);
}

/** 当前生效 provider（已解密的密钥；未设置时为空串） */
export type ResolvedProvider = {
  id: ProviderId;
  baseURL: string;
  apiKey: string;
  model: string;
  supportsTools: boolean;
  headers: Record<string, string>;
};

export function resolveActiveProvider(config: AgentConfig = getAgentConfig()): ResolvedProvider {
  const preset = PROVIDER_PRESETS.find((p) => p.id === config.activeProvider) ?? PROVIDER_PRESETS[0];
  const c = config.providers[preset.id];
  const apiKey = c.apiKeyEnc ? (decryptSecret(c.apiKeyEnc) ?? "") : "";
  return {
    id: preset.id,
    baseURL: preset.baseURL,
    apiKey,
    model: c.model,
    supportsTools: true,
    headers: preset.headers,
  };
}

// ---------- 访客对话（OpenRouter 免费模型） ----------

/**
 * 访客配置：只用一把 OpenRouter 密钥。
 * 早期版本这里存的是 OpenCode Zen 的 key（Zen 免费档不允许站外调用，已弃用），
 * 所以读的时候**按前缀筛**：不是 `sk-or-` 开头的当作没配置，免得拿旧 key 去敲 OpenRouter。
 */
type GuestConfig = {
  apiKeyEnc: string | null;
};

/** OpenRouter 的密钥前缀 */
const OPENROUTER_KEY_PREFIX = "sk-or-";

/** 返回给前端的访客配置：密钥只给 hasKey 与掩码 */
export type PublicGuestConfig = {
  hasKey: boolean;
  keyMask: string;
  /** 密钥来自环境变量 OPENROUTER_API_KEY（此时界面不允许改） */
  fromEnv: boolean;
  /** 密钥看起来像不像 OpenRouter 的（sk-or- 开头），用于界面提示 */
  keyLooksValid: boolean;
};

export type SaveGuestConfigInput = {
  /** 省略/空串=保留原值，null=清除，有值=更新 */
  apiKey?: string | null;
};

function parseGuestConfig(raw: string | null): GuestConfig {
  if (!raw) return { apiKeyEnc: null };
  try {
    const parsed = JSON.parse(raw) as { apiKeyEnc?: unknown };
    const enc = typeof parsed.apiKeyEnc === "string" ? parsed.apiKeyEnc : null;
    if (!enc) return { apiKeyEnc: null };
    // 旧版本存的 Zen key 直接视为未配置
    const plain = decryptSecret(enc);
    return plain && plain.startsWith(OPENROUTER_KEY_PREFIX) ? { apiKeyEnc: enc } : { apiKeyEnc: null };
  } catch {
    return { apiKeyEnc: null };
  }
}

/** 访客对话实际使用的密钥：环境变量优先，其次是设置里保存的（密文解密） */
export function resolveGuestApiKey(): string {
  const env = process.env.OPENROUTER_API_KEY?.trim();
  if (env) return env;
  const c = parseGuestConfig(getSetting(GUEST_KEY));
  return c.apiKeyEnc ? (decryptSecret(c.apiKeyEnc) ?? "") : "";
}

export function getPublicGuestConfig(): PublicGuestConfig {
  const fromEnv = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const plain = resolveGuestApiKey();
  return {
    hasKey: Boolean(plain),
    keyMask: plain ? maskSecret(plain) : "",
    fromEnv,
    keyLooksValid: plain.startsWith(OPENROUTER_KEY_PREFIX),
  };
}

export function saveGuestConfig(input: SaveGuestConfigInput): PublicGuestConfig {
  const config = parseGuestConfig(getSetting(GUEST_KEY));
  if (input.apiKey === null) {
    config.apiKeyEnc = null;
  } else if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    config.apiKeyEnc = encryptSecret(input.apiKey.trim());
  }
  setSetting(GUEST_KEY, JSON.stringify(config));
  return getPublicGuestConfig();
}
