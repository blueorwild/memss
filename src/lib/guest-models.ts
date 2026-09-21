/**
 * 访客对话用的免费模型（OpenRouter）。
 *
 * 为什么不用 OpenCode Zen 的免费档：那批模型有服务端硬门禁，
 * 站外调用一律 `403 FreeTierError: free tier can only be used from within OpenCode`（已实测）。
 * OpenRouter 的 `:free` 档是真正的第三方可用、$0 的模型，而且支持 `models: [...]` 兜底路由。
 *
 * 免费模型会被 OpenRouter 不断轮换，所以这里**不写死清单**：
 * 服务端定时拉 `/api/v1/models`，只保留真的 $0 档位（pricing 全为 "0"），排序后交给访客挑。
 * 唯一写死的是 `FALLBACK_DEFAULT_MODEL`——连列表都拉不到时的最后兜底。
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** 最后兜底（列表拉不到时用）：唯一写死的模型 id，轮换下线了就改这一行 */
export const FALLBACK_DEFAULT_MODEL = "cohere/north-mini-code:free";

/**
 * 默认档候选（按顺序取第一个仍在实时列表里的）。
 * 免费档轮换很快，所以这里只是「优先」，并不写死：都不在就退回列表首个。
 * 入选标准：免费档 + 支持工具调用 + 实测（2026-09）真的会调工具。
 * 实测记录：cohere 修好「类别名称当 id」的坑之后 2/2 都走「检索 → 作答」且没跑偏；
 * nex-agi/nex-n2.5-mini 出过卡片但也有跑偏（答非所问）的样本；dots/qwen 常只凭概览作答。
 * 免费档本身波动很大，所以访客随时可以在「免费模型」里换一个、或点重试。
 */
const DEFAULT_CANDIDATES = [
  "cohere/north-mini-code:free",
  "nex-agi/nex-n2.5-mini:free",
  "dots-studio/dots-3-note-preview:free",
  "qwen/qwen3.8-27b:free",
];

/** 上游明确拒绝过的档位（403「仅聚合端点可用」等）：6 小时内不再推荐 */
const BLOCKED_TTL_MS = 6 * 60 * 60 * 1000;
const blockedUntil = new Map<string, number>();

/** 记下某个档位当前不可用（请求失败时调用），列表与兜底链都会跳过它 */
export function markGuestModelUnusable(id: string): void {
  if (!id) return;
  blockedUntil.set(id, Date.now() + BLOCKED_TTL_MS);
}

function isUsable(id: string): boolean {
  const until = blockedUntil.get(id);
  if (until === undefined) return true;
  if (Date.now() > until) {
    blockedUntil.delete(id);
    return true;
  }
  return false;
}

/** 过滤掉临时不可用的档位 */
function usableOnly(models: GuestModel[]): GuestModel[] {
  return models.filter((m) => isUsable(m.id));
}

/** 免费档列表缓存时长：6 小时（过期后先返回旧列表、后台刷新） */
const TTL_MS = 6 * 60 * 60 * 1000;
/** 请求 OpenRouter 列表的超时（毫秒） */
const FETCH_TIMEOUT_MS = 8000;
/** 明显不是聊天用途的免费档（内容审核类），不给访客用 */
const EXCLUDE_ID_PARTS = ["content-safety"];
/**
 * OpenRouter 的 `models` 兜底数组**最多 3 项**（超出直接 400），所以链长封顶 3。
 */
const MAX_MODEL_CHAIN = 3;

export type GuestModel = {
  id: string;
  /** 展示名（去掉结尾的 "(free)"） */
  name: string;
  /** 上下文长度（token） */
  ctx: number;
};

type RawModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown } | null;
  architecture?: { output_modalities?: unknown } | null;
  supported_parameters?: unknown;
  reasoning?: { mandatory?: unknown } | null;
};

/** 访客精灵要能检索/带路，只给支持工具调用的档位（官方轮换时会自动跟上） */
function supportsTools(raw: RawModel): boolean {
  return Array.isArray(raw.supported_parameters) && raw.supported_parameters.includes("tools");
}

/** 少数档位强制开推理（`reasoning:{enabled:false}` 会被上游 400 拒掉），不给访客 */
function reasoningMandatory(raw: RawModel): boolean {
  return raw.reasoning?.mandatory === true;
}

/**
 * 只保留真正的免费档：id 以 `:free` 结尾（OpenRouter 对免费档的官方标记）
 * 且 pricing 全为 "0"，并且能输出文本（排除 Lyria 这类 0 价但只出音频的模型）。
 */
function isFreeModel(raw: RawModel): boolean {
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id.endsWith(":free")) return false;
  const p = raw.pricing;
  if (p?.prompt !== "0" || p?.completion !== "0") return false;
  const out = raw.architecture?.output_modalities;
  if (Array.isArray(out) && !out.includes("text")) return false;
  return true;
}

function displayName(raw: RawModel): string {
  const name = typeof raw.name === "string" ? raw.name : "";
  const cleaned = name.replace(/\s*\(free\)\s*$/i, "").trim();
  return cleaned || String(raw.id ?? "");
}

/**
 * 归一化 + 排序：先筛出真正的免费档，再优先留下「能调工具且不强制推理」的档位。
 * 万一某个时刻一个可用的都没有（官方大轮换），退回全部免费档——至少还能闲聊。
 * 排序：上下文长度降序 → id。
 */
function normalize(rawList: RawModel[]): GuestModel[] {
  const free: GuestModel[] = [];
  const toolCapable = new Set<string>();
  for (const raw of rawList) {
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id || typeof raw.pricing !== "object" || !isFreeModel(raw)) continue;
    if (EXCLUDE_ID_PARTS.some((part) => id.includes(part))) continue;
    free.push({
      id,
      name: displayName(raw),
      ctx: typeof raw.context_length === "number" ? raw.context_length : 0,
    });
    if (supportsTools(raw) && !reasoningMandatory(raw)) toolCapable.add(id);
  }
  const prefer = free.filter((m) => toolCapable.has(m.id));
  const models = prefer.length > 0 ? prefer : free;
  models.sort((a, b) => {
    if (a.ctx !== b.ctx) return b.ctx - a.ctx;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return models;
}

/** 默认模型：候选表里第一个仍在列表中的；都没有就用列表首个 */
export function pickDefaultModel(models: GuestModel[]): string {
  const hit = DEFAULT_CANDIDATES.find((id) => models.some((m) => m.id === id));
  return hit ?? models[0]?.id ?? FALLBACK_DEFAULT_MODEL;
}

let cache: { models: GuestModel[]; fetchedAt: number } | null = null;
let inflight: Promise<GuestModel[]> | null = null;

async function loadFromOpenRouter(): Promise<GuestModel[]> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`模型列表获取失败（${res.status}）`);
  const data = (await res.json()) as { data?: RawModel[] };
  return normalize(Array.isArray(data.data) ? data.data : []);
}

/** 冷启动时偶发网络抖动很常见（缓存里没有旧列表可退），失败就再试一次 */
async function loadWithRetry(): Promise<GuestModel[]> {
  try {
    return await loadFromOpenRouter();
  } catch {
    await new Promise((r) => setTimeout(r, 400));
    return await loadFromOpenRouter();
  }
}

/** 刷新列表（单飞：并发调用只发一次请求） */
function refresh(): Promise<GuestModel[]> {
  if (inflight) return inflight;
  const task = loadWithRetry()
    .then((models) => {
      if (models.length > 0) cache = { models, fetchedAt: Date.now() };
      return cache?.models ?? models;
    })
    .catch(() => cache?.models ?? [])
    .finally(() => {
      if (inflight === task) inflight = null;
    });
  inflight = task;
  return task;
}

/** 当前可用的免费档列表（带缓存；过期时先返回旧列表并后台刷新） */
export async function getGuestModels(): Promise<GuestModel[]> {
  if (cache) {
    if (Date.now() - cache.fetchedAt >= TTL_MS) void refresh();
    return usableOnly(cache.models);
  }
  return usableOnly(await refresh());
}

/**
 * 校验访客选的模型并给出兜底链：
 * 不在当前列表里（被轮换下线 / 手改）就回落到默认；同时带上几个其它免费档，
 * 由 OpenRouter 在首选被限流或下线时自动切换（实测有效）。链长最多 3（官方限制）。
 */
export async function resolveGuestModel(requested: string | undefined): Promise<{
  model: string;
  chain: string[];
}> {
  const models = await getGuestModels();
  const ids = new Set(models.map((m) => m.id));
  const model = requested && ids.has(requested) ? requested : pickDefaultModel(models);
  // 兜底链优先放「默认候选」里的档位（更可能真的能用），再补其它免费档
  const others = models.map((m) => m.id).filter((id) => id !== model);
  const preferred = DEFAULT_CANDIDATES.filter((id) => others.includes(id));
  const chain = [model, ...preferred, ...others.filter((id) => !preferred.includes(id))].slice(
    0,
    MAX_MODEL_CHAIN,
  );
  return { model, chain };
}

/** 访客看向量：服务端实时列表 + 默认项 */
export type GuestModelsPayload = {
  /** 是否成功拿到实时列表（false 时前端只显示默认模型） */
  ok: boolean;
  defaultModel: string;
  models: GuestModel[];
};

// ---------- 前端（浏览器）侧 ----------

/** 访客所选模型（localStorage） */
const CHOICE_KEY = "memss:guest-model";

export function readGuestModelChoice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CHOICE_KEY);
  } catch {
    return null;
  }
}

export function writeGuestModelChoice(id: string): void {
  if (!id) return;
  try {
    localStorage.setItem(CHOICE_KEY, id);
  } catch {
    /* 存储失败忽略 */
  }
}

let clientCache: GuestModelsPayload | null = null;

/** 拉取访客可选模型（模块级缓存，切视图不重复请求） */
export async function fetchGuestModels(): Promise<GuestModelsPayload> {
  if (clientCache) return clientCache;
  try {
    const res = await fetch("/api/guest/models");
    const data = (await res.json()) as Partial<GuestModelsPayload>;
    clientCache = {
      ok: Boolean(data.ok),
      defaultModel: data.defaultModel || FALLBACK_DEFAULT_MODEL,
      models: Array.isArray(data.models) ? data.models : [],
    };
  } catch {
    clientCache = { ok: false, defaultModel: FALLBACK_DEFAULT_MODEL, models: [] };
  }
  return clientCache;
}

/** 丢弃前端缓存（列表拉取失败后重试用） */
export function resetGuestModelsCache(): void {
  clientCache = null;
}

/** 上下文长度展示：1M / 262K */
export function formatContext(ctx: number): string {
  if (ctx >= 1_000_000) return `${Math.round((ctx / 1_000_000) * 10) / 10}M`;
  if (ctx >= 1000) return `${Math.round(ctx / 1000)}K`;
  return String(ctx);
}
