"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SettingsSection from "./SettingsSection";

/** 输入框通用样式（移动端 16px 字号，避免 iOS 聚焦时自动放大） */
const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white outline-none placeholder:text-white/35 focus:border-white/30 sm:text-sm";
const labelCls = "block text-[11px] text-white/45";

/**
 * 设置里的「账号」块：站长唯一的身份入口。
 * - 尚未设置过口令 → 「设置访问口令」（设置后自动登录）
 * - 已设置但未登录 → 口令登录（可勾「记住我」）
 * - 已登录 → 修改口令 / 退出登录
 */
export default function AccountPanel() {
  const router = useRouter();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [current, setCurrent] = useState("");
  const [remember, setRemember] = useState(true);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { authed?: boolean; hasPassword?: boolean }) => {
        if (!alive) return;
        setAuthed(Boolean(d.authed));
        setHasPassword(d.hasPassword !== false);
      })
      .catch(() => {
        if (alive) setError("登录状态读取失败");
      });
    return () => {
      alive = false;
    };
  }, []);

  function resetFields() {
    setPw("");
    setPw2("");
    setCurrent("");
  }

  async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: d.error ?? "操作失败" };
  }

  /** 登录 */
  async function doLogin() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    const r = await post("/api/auth/login", { password: pw, remember });
    if (!r.ok) {
      setError(r.error ?? "登录失败");
    } else {
      setAuthed(true);
      setStatus("已登录");
      resetFields();
      router.refresh();
    }
    setBusy(false);
  }

  /** 首次设置口令（成功后顺手登录，省得再输一遍） */
  async function doSetup() {
    if (busy) return;
    if (pw !== pw2) {
      setError("两次输入的口令不一致");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    const r = await post("/api/auth/password", { next: pw });
    if (!r.ok) {
      setError(r.error ?? "设置失败");
      setBusy(false);
      return;
    }
    setHasPassword(true);
    const login = await post("/api/auth/login", { password: pw, remember: true });
    if (!login.ok) {
      setStatus("口令已设置，请登录");
    } else {
      setAuthed(true);
      setStatus("口令已设置并登录");
      router.refresh();
    }
    resetFields();
    setBusy(false);
  }

  /** 修改口令（旧口令 + 新口令），成功后其它设备上的登录会失效 */
  async function doChange() {
    if (busy) return;
    if (pw !== pw2) {
      setError("两次输入的新口令不一致");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    const r = await post("/api/auth/password", { current, next: pw });
    if (!r.ok) {
      setError(r.error ?? "修改失败");
    } else {
      setStatus("已修改口令，其它设备上的登录已失效");
      setChanging(false);
      resetFields();
    }
    setBusy(false);
  }

  /** 退出登录 */
  async function doLogout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthed(false);
    setStatus("已退出登录");
    resetFields();
    router.refresh();
    setBusy(false);
  }

  const title = authed ? "账号 · 已登录" : hasPassword ? "登录" : "设置访问口令";

  return (
    // 未登录时常开：登录 / 设置口令是访客打开设置后最需要看到的东西
    <SettingsSection title={title} locked={authed === false} defaultOpen={authed === false}>
      {authed === null ? (
        <p className="text-xs text-white/40">读取中…</p>
      ) : authed ? (
        changing ? (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>当前口令</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={inputCls}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className={labelCls}>新口令</label>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelCls}>再输一次新口令</label>
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void doChange()}
                disabled={busy || !current || !pw}
                className="flex-1 rounded-full bg-accent-deep/80 py-2.5 text-sm text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
              >
                {busy ? "提交中…" : "确认修改"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChanging(false);
                  resetFields();
                  setError(null);
                }}
                className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/60 transition-colors hover:text-white"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-white/45">
              已以站长身份登录，可以看到并管理这片星空里的全部回忆。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChanging(true)}
                className="flex-1 rounded-full border border-white/15 py-2.5 text-sm text-white/85 transition-colors hover:bg-white/10"
              >
                修改口令
              </button>
              <button
                type="button"
                onClick={() => void doLogout()}
                disabled={busy}
                className="flex-1 rounded-full border border-white/15 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                退出登录
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {!hasPassword && (
            <p className="text-xs text-white/45">
              这是第一次使用：先设置一个访问口令，之后用它登录。忘记口令时可在电脑上运行
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5 text-[11px]">npm run reset-password</code>
              重置。
            </p>
          )}
          {hasPassword && (
            <div>
              <label className={labelCls}>访问口令</label>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void doLogin();
                }}
                placeholder="输入口令"
                className={inputCls}
                autoComplete="current-password"
              />
            </div>
          )}
          {!hasPassword && (
            <>
              <div>
                <label className={labelCls}>设置口令</label>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="至少 4 个字符"
                  className={inputCls}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className={labelCls}>再输一次</label>
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void doSetup();
                  }}
                  className={inputCls}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}
          {hasPassword && (
            <label className="flex items-center gap-2 text-xs text-white/55">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
              />
              记住我（30 天内免登录）
            </label>
          )}
          <button
            type="button"
            onClick={() => void (hasPassword ? doLogin() : doSetup())}
            disabled={busy || !pw || (!hasPassword && !pw2)}
            className="w-full rounded-full bg-accent-deep/80 py-3 text-sm text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
          >
            {busy ? "提交中…" : hasPassword ? "登录" : "设置口令并进入"}
          </button>
        </div>
      )}

      {status && <p className="text-xs text-ok">{status}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </SettingsSection>
  );
}
