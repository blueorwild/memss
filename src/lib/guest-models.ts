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
export const FALLBACK_DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731:free";

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
};

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
 * 排序：DeepSeek 优先（默认聊天模型）→ 上下文长度降序 → id。
 * 顺带过滤掉审核类等非聊天档位。
 */
function normalize(rawList: RawModel[]): GuestModel[] {
  const models: GuestModel[] = [];
  for (const raw of rawList) {
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id || typeof raw.pricing !== "object" || !isFreeModel(raw)) continue;
    if (EXCLUDE_ID_PARTS.some((part) => id.includes(part))) continue;
    models.push({
      id,
      name: displayName(raw),
      ctx: typeof raw.context_length === "number" ? raw.context_length : 0,
    });
  }
  models.sort((a, b) => {
    const aDeep = a.id.includes("deepseek") ? 0 : 1;
    const bDeep = b.id.includes("deepseek") ? 0 : 1;
    if (aDeep !== bDeep) return aDeep - bDeep;
    if (a.ctx !== b.ctx) return b.ctx - a.ctx;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return models;
}

/** 默认模型：优先 id 含 deepseek 的（当前就是 deepseek-v4-flash） */
export function pickDefaultModel(models: GuestModel[]): string {
  return models.find((m) => m.id.includes("deepseek"))?.id ?? models[0]?.id ?? FALLBACK_DEFAULT_MODEL;
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
    return cache.models;
  }
  return refresh();
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
  const chain = [model, ...models.map((m) => m.id).filter((id) => id !== model)].slice(
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
