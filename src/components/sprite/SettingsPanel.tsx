"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FREE_MODEL,
  FREE_MODELS,
  readFreeModelChoice,
  writeFreeModelChoice,
} from "@/lib/free-models";
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
          <GuestChatSection />
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
 * 站长专属：访客对话（OpenCode Zen 免费模型）。
 * 访客的闲聊由这把密钥代付；没有密钥时访客对话会提示「暂不可用」，其余功能不受影响。
 */
function GuestChatSection() {
  const [guest, setGuest] = useState<PublicGuestConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [busy, setBusy] = useState(false);
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
    : "粘贴 OpenCode Zen 的 API Key";

  return (
    <SettingsSection title="访客对话（免费模型）">
      <p className="text-xs text-white/45">
        未登录的访客只能用 Zen 的免费模型闲聊，用它代付。没有配置时访客对话会提示暂不可用。
      </p>
      {guest?.fromEnv ? (
        <p className="text-xs text-white/45">已由环境变量 ZEN_API_KEY 提供，界面不可修改。</p>
      ) : (
        <>
          <div>
            <label className={labelCls}>Zen API Key</label>
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

/** 访客专属：在免费模型白名单里挑一个（只存本地，不涉及任何密钥） */
function FreeModelSection() {
  const [choice, setChoice] = useState(DEFAULT_FREE_MODEL);

  useEffect(() => {
    const timer = window.setTimeout(() => setChoice(readFreeModelChoice()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const current = FREE_MODELS.find((m) => m.id === choice) ?? FREE_MODELS[0];

  return (
    <SettingsSection title="免费模型" defaultOpen>
      <p className="text-xs text-white/45">挑一个陪你聊天的模型（由站长统一提供，无需填写密钥）。</p>
      <div className="flex flex-wrap gap-2">
        {FREE_MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setChoice(m.id);
              writeFreeModelChoice(m.id);
            }}
            className={`min-h-9 rounded-full px-3 py-1.5 text-xs transition-colors sm:min-h-0 sm:py-1 ${
              choice === m.id
                ? "bg-white/15 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>
      {current.note && <p className="text-[11px] text-warm/70">{current.note}</p>}
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
        免费模型多为试用 / 隐身档，可能会记录使用数据，请勿输入隐私内容。
      </p>
    </SettingsSection>
  );
}
