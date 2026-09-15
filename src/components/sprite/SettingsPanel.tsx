"use client";

import { useEffect, useState } from "react";
import { PROVIDER_PRESETS, type ProviderId } from "@/lib/providers";
import { Combobox } from "@/components/ui/combobox";
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

/** 输入框通用样式（移动端 16px 字号，避免 iOS 聚焦时自动放大） */
const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white outline-none placeholder:text-white/35 focus:border-white/30 sm:text-sm";

const labelCls = "block text-[11px] text-white/45";

/**
 * 设置面板：以可折叠区块组织，首块为「模型服务」（默认收起）。
 * baseURL / 请求头等适配细节由内置预置提供，用户只需选服务、填密钥、选模型。
 */
export default function SettingsPanel() {
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
    <div className="h-full overflow-y-auto px-3 py-3">
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
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
              )}
              {p.name}
              {p.id === config?.activeProvider && (
                <span className="ml-1 text-[10px] text-emerald-300/80">使用中</span>
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

        {status && <p className="text-xs text-emerald-300">{status}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="w-full rounded-full bg-indigo-500/80 py-3 text-sm text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
        >
          {busy ? "保存中…" : "保存并启用"}
        </button>
      </SettingsSection>
    </div>
  );
}
