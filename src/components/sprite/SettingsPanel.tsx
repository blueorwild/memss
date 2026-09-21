"use client";

import { useEffect, useState } from "react";
import {
  fetchGuestModels,
  formatContext,
  readGuestModelChoice,
  resetGuestModelsCache,
  writeGuestModelChoice,
  type GuestModelsPayload,
} from "@/lib/guest-models";
import { PROVIDER_PRESETS, type ProviderId } from "@/lib/providers";
import { Combobox } from "@/components/ui/combobox";
import AccountPanel from "./AccountPanel";
import { useAuthed } from "./AuthContext";
import SettingsSection from "./SettingsSection";

/** 前端可见的 provider 配置（密钥仅掩码） */
type PublicProviderConfig = {
  model: string;
  hasKey: boolean;
  keyMask: string;
};

type PublicAgentConfig = {
  activeProvider: ProviderId;
  providers: Record<ProviderId, PublicProviderConfig>;
};

type PublicGuestConfig = {
  hasKey: boolean;
  keyMask: string;
  fromEnv: boolean;
  keyLooksValid: boolean;
  allowBrowse: boolean;
};

/** 输入框通用样式（移动端 16px 字号，避免 iOS 聚焦时自动放大） */
const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white outline-none placeholder:text-white/35 focus:border-white/30 sm:text-sm";

const labelCls = "block text-[11px] text-white/45";

/**
 * 设置面板：账号（登录 / 改口令）+ 模型配置，以可折叠区块组织。
 * 访客只能看到「登录」与「免费模型」；站长才能进入模型服务与访客对话配置。
 */
export default function SettingsPanel() {
  const authed = useAuthed();
  return (
    <div className="h-full space-y-3 overflow-y-auto px-3 py-3">
      <AccountPanel />
      {authed ? (
        <>
          <AgentSettingsSection />
          <GuestSettingsSection />
        </>
      ) : (
        <FreeModelSection />
      )}
      <AboutSection />
    </div>
  );
}

/**
 * 站长专属：模型服务（默认收起）。
 * baseURL / 请求头等适配细节由内置预置提供，用户只需选服务、填密钥、选模型。
 */
function AgentSettingsSection() {
  const [config, setConfig] = useState<PublicAgentConfig | null>(null);
  const [active, setActive] = useState<ProviderId>("opencode-go");

  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [model, setModel] = useState("");

  const [models, setModels] = useState<string[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saved = config?.providers[active];

  /** 拉取某服务的模型列表；若当前已存模型不在列表中，默认选中第一项 */
  async function loadModels(id: ProviderId, currentModel: string) {
    setLoadingModels(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/models?providerId=${id}`);
      const d = (await res.json().catch(() => ({}))) as { models?: string[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? "获取模型失败");
      const list = d.models ?? [];
      setModels(list);
      setModelsLoaded(true);
      if (list.length > 0 && !list.includes(currentModel)) setModel(list[0]);
      setStatus(`已获取 ${list.length} 个模型`);
    } catch (err) {
      setModels([]);
      setError(err instanceof Error ? err.message : "获取模型失败");
    } finally {
      setLoadingModels(false);
    }
  }

  /** 切换服务：回填其模型与密钥状态，并加载该服务模型列表 */
  function selectProvider(id: ProviderId, cfg: PublicAgentConfig) {
    const c = cfg.providers[id];
    setActive(id);
    setModel(c.model);
    setApiKey("");
    setClearKey(false);
    setModels([]);
    setModelsLoaded(false);
    setStatus(null);
    setError(null);
    void loadModels(id, c.model);
  }

  // 载入配置并回填当前生效服务（不预先拉取模型，待块展开时再加载）
  useEffect(() => {
    let alive = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: PublicAgentConfig) => {
        if (!alive) return;
        setConfig(d);
        setActive(d.activeProvider);
        setModel(d.providers[d.activeProvider].model);
      })
      .catch(() => {
        if (alive) setError("配置加载失败");
      });
    return () => {
      alive = false;
    };
  }, []);

  /** 保存：设置生效服务、模型，并按语义更新密钥 */
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const providerPatch: Record<string, unknown> = { model };
      if (clearKey) providerPatch.apiKey = null;
      else if (apiKey.trim()) providerPatch.apiKey = apiKey.trim();

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider: active, providers: { [active]: providerPatch } }),
      });
      const d = (await res.json().catch(() => ({}))) as PublicAgentConfig & { error?: string };
      if (!res.ok) throw new Error(d.error ?? "保存失败");
      setConfig(d);
      setApiKey("");
      setClearKey(false);
      setStatus("已保存");
      // 首次保存密钥后，尝试补加载模型列表
      if (models.length === 0) void loadModels(active, model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  const keyPlaceholder = saved?.hasKey ? `${saved.keyMask}（留空不修改）` : "粘贴 API Key";
  const modelPlaceholder = loadingModels
    ? "加载中…"
    : models.length > 0
      ? "选择模型"
      : "保存 API Key 后可选模型";

  return (
    <SettingsSection
      title="模型服务"
      onOpen={() => {
        if (!modelsLoaded) void loadModels(active, model);
      }}
    >
      <div className="flex flex-wrap gap-2">
        {PROVIDER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!config}
            onClick={() => config && selectProvider(p.id, config)}
            className={`min-h-9 rounded-full px-3 py-1.5 text-xs transition-colors disabled:opacity-40 sm:min-h-0 sm:py-1 ${
              active === p.id
                ? "bg-white/15 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {p.id === config?.activeProvider && (
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-ok align-middle" />
            )}
            {p.name}
            {p.id === config?.activeProvider && (
              <span className="ml-1 text-[10px] text-ok/80">使用中</span>
            )}
          </button>
        ))}
      </div>

      <div>
        <label className={labelCls}>API Key</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (e.target.value) setClearKey(false);
            }}
            placeholder={keyPlaceholder}
            className={inputCls}
            autoComplete="off"
          />
          {saved?.hasKey && (
            <button
              type="button"
              onClick={() => {
                setClearKey((v) => !v);
                setApiKey("");
              }}
              className={`shrink-0 rounded-lg border px-3.5 py-2 text-xs transition-colors ${
                clearKey
                  ? "border-red-400/50 text-red-300"
                  : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              {clearKey ? "将清除" : "清除"}
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className={labelCls}>模型</label>
          <button
            type="button"
            onClick={() => void loadModels(active, model)}
            disabled={loadingModels}
            className="px-1 py-1 text-[11px] text-white/50 transition-colors hover:text-white disabled:opacity-40"
          >
            {loadingModels ? "加载中…" : "刷新"}
          </button>
        </div>
        <Combobox
          options={models.map((m) => ({ value: m, label: m }))}
          value={model || null}
          onChange={setModel}
          placeholder={modelPlaceholder}
          emptyText="无可用模型"
          disabled={loadingModels || models.length === 0}
        />
      </div>

      {status && <p className="text-xs text-ok">{status}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="w-full rounded-full bg-accent-deep/80 py-3 text-sm text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
      >
        {busy ? "保存中…" : "保存并启用"}
      </button>
    </SettingsSection>
  );
}

/**
 * 站长专属：访客设置——访客能看到什么（浏览开关）+ 访客对话由谁代付（OpenRouter 免费档）。
 * 开关即时生效（一次 PUT）；密钥改动需要点「保存」。
 */
function GuestSettingsSection() {
  const [guest, setGuest] = useState<PublicGuestConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { guest?: PublicGuestConfig }) => {
        if (alive && d.guest) setGuest(d.guest);
      })
      .catch(() => {
        if (alive) setError("配置加载失败");
      });
    return () => {
      alive = false;
    };
  }, []);

  /** 切换「允许访客浏览」：点一下即时生效 */
  async function toggleBrowse() {
    if (!guest || toggling) return;
    const next = !guest.allowBrowse;
    setToggling(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest: { allowBrowse: next } }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        guest?: PublicGuestConfig;
        error?: string;
      };
      if (!res.ok) throw new Error(d.error ?? "保存失败");
      if (d.guest) setGuest(d.guest);
      setStatus(next ? "已开放：访客可以只读浏览" : "已关闭：访客看不到任何回忆");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setToggling(false);
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const patch: { apiKey?: string | null } = {};
      if (clearKey) patch.apiKey = null;
      else if (apiKey.trim()) patch.apiKey = apiKey.trim();

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest: patch }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        guest?: PublicGuestConfig;
        error?: string;
      };
      if (!res.ok) throw new Error(d.error ?? "保存失败");
      if (d.guest) setGuest(d.guest);
      setApiKey("");
      setClearKey(false);
      setStatus("已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  const placeholder = guest?.hasKey
    ? `${guest.keyMask}（留空不修改）`
    : "粘贴 OpenRouter 的 API Key（sk-or-…）";

  return (
    <SettingsSection title="访客设置">
      <p className="text-xs text-white/45">
        访客（未登录）能看什么、聊什么都在这里。访客一律只读，改不了任何东西。
      </p>

      {guest === null ? (
        <p className="text-xs text-white/40">读取中…</p>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-white/85">允许访客浏览回忆</p>
            <p className="mt-0.5 text-[11px] text-white/40">
              打开后：访客可以只读浏览类别、回忆、图片与音乐，小精灵也能帮他检索、带路；
              关掉则只剩空星空与闲聊。
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={guest.allowBrowse}
            aria-label="允许访客浏览回忆"
            onClick={() => void toggleBrowse()}
            disabled={toggling}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
              guest.allowBrowse ? "bg-accent-deep" : "bg-white/20"
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                guest.allowBrowse ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      )}

      <p className="text-xs text-white/45">
        访客对话走 OpenRouter 的免费档（$0），由下面这把密钥代付；没有配置时访客对话会提示暂不可用。
      </p>
      {guest?.fromEnv ? (
        <p className="text-xs text-white/45">
          已由环境变量 OPENROUTER_API_KEY 提供，界面不可修改。
        </p>
      ) : (
        <>
          <div>
            <label className={labelCls}>OpenRouter API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (e.target.value) setClearKey(false);
                }}
                placeholder={placeholder}
                className={inputCls}
                autoComplete="off"
              />
              {guest?.hasKey && (
                <button
                  type="button"
                  onClick={() => {
                    setClearKey((v) => !v);
                    setApiKey("");
                  }}
                  className={`shrink-0 rounded-lg border px-3.5 py-2 text-xs transition-colors ${
                    clearKey
                      ? "border-red-400/50 text-red-300"
                      : "border-white/15 text-white/60 hover:text-white"
                  }`}
                >
                  {clearKey ? "将清除" : "清除"}
                </button>
              )}
            </div>
          </div>
          {guest?.hasKey && !guest.keyLooksValid && (
            <p className="text-[11px] text-warm/80">
              这把密钥不是 sk-or- 开头，可能不是 OpenRouter 的。
            </p>
          )}
          <p className="text-[11px] text-white/35">
            注意，免费档的对话内容可能被上游记录或用于训练。
          </p>
          {status && <p className="text-xs text-ok">{status}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="w-full rounded-full bg-accent-deep/80 py-3 text-sm text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </>
      )}
    </SettingsSection>
  );
}

/**
 * 访客专属：从 OpenRouter 的实时免费档里挑一个。
 * 列表由服务端缓存后下发（`/api/guest/models`），官方轮换免费模型时这里会自动跟上；
 * 本地存的坑位若已下线，会自动回落到默认模型。
 */
function FreeModelSection() {
  const [payload, setPayload] = useState<GuestModelsPayload | null>(null);
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchGuestModels().then((data) => {
      if (!alive) return;
      setPayload(data);
      const saved = readGuestModelChoice();
      const valid =
        saved && data.models.some((m) => m.id === saved) ? saved : data.defaultModel;
      setChoice(valid);
      if (valid !== saved) writeGuestModelChoice(valid);
    });
    return () => {
      alive = false;
    };
  }, []);

  function retry() {
    resetGuestModelsCache();
    setPayload(null);
    void fetchGuestModels().then((data) => {
      setPayload(data);
      setChoice((prev) =>
        prev && data.models.some((m) => m.id === prev) ? prev : data.defaultModel,
      );
    });
  }

  const models = payload?.models ?? [];
  const current = models.find((m) => m.id === choice);

  return (
    <SettingsSection title="免费模型">
      <p className="text-xs text-white/45">
        挑一个陪你聊天的模型（由站长统一提供，无需填写密钥）。它既要能闲聊，
        也要能帮你检索回忆、带路逛星空。
      </p>
      {payload === null ? (
        <p className="text-xs text-white/40">读取中…</p>
      ) : (
        <>
          <Combobox
            options={models.map((m) => ({
              value: m.id,
              label: `${m.name} · ${formatContext(m.ctx)}`,
            }))}
            value={choice}
            onChange={(id) => {
              setChoice(id);
              writeGuestModelChoice(id);
            }}
            placeholder={current ? `${current.name} · ${formatContext(current.ctx)}` : "选择模型"}
            emptyText="暂无可用模型"
            disabled={models.length === 0}
          />
          {models.length === 0 && (
            <button
              type="button"
              onClick={retry}
              className="px-1 py-1 text-[11px] text-white/50 underline transition-colors hover:text-white"
            >
              免费模型列表获取失败，点此重试
            </button>
          )}
          {payload.ok && models.length > 0 && (
            <p className="text-[11px] text-white/35">
              免费档列表跟随 OpenRouter 实时更新；
              免费档每分 20 次 / 每天 50 次，被限流时换个模型或稍后再试。
            </p>
          )}
          <p className="text-[11px] text-warm/70">
            免费模型可能记录使用数据，请勿输入隐私内容。
          </p>
        </>
      )}
    </SettingsSection>
  );
}

/** 关于：站名、定位与隐私提示 */
function AboutSection() {
  return (
    <SettingsSection title="关于">
      <p className="text-xs text-white/45">
        MemSS：以星空承载个人回忆。把照片与故事挂成星星，按地点与时间漫游。
      </p>
      <p className="text-[11px] text-white/35">
        访客聊天的免费模型来自 OpenRouter，内容可能被上游记录或用于训练，请勿输入隐私内容。
      </p>
    </SettingsSection>
  );
}
