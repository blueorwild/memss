import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getSessionRow, getSetting, setSetting } from "./db/queries";
import {
  createSession,
  deleteAllSessions,
  deleteExpiredSessions,
  deleteSession,
  touchSession,
} from "./db/mutations";

/**
 * 单用户站长的访问口令与会话。
 * - 口令哈希存 settings 键值表（key=owner），用 scrypt + 随机盐，不落明文；
 * - 会话 token 只以 sha256 存库、明文只存在 httpOnly cookie 里（偷到 DB 也无法直接登录）。
 */

/** 站长口令在 settings 表中的键 */
const OWNER_KEY = "owner";
/** 会话 cookie 名 */
export const SESSION_COOKIE = "memss_session";
/** 「记住我」有效期：30 天 */
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
/** 未勾「记住我」：会话 cookie（关浏览器即失效）+ 库内 12 小时兜底 */
const SHORT_MS = 12 * 60 * 60 * 1000;
/** 活跃续期阈值：距上次写库超过 1 天才续，避免每个请求都写库 */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;
/** 口令长度限制（按码点计数，中文也算 1 个） */
const PW_MIN = 4;
const PW_MAX = 128;
/** 连续失败 MAX_FAILS 次后锁定 LOCK_MS */
const MAX_FAILS = 5;
const LOCK_MS = 30 * 1000;

/** scrypt 参数（约 16MB 内存、单次 ~50ms） */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

export type OwnerRecord = { pw: string; createdAt: number };

/** 口令是否符合要求；不合规时返回可读文案 */
export function passwordIssue(pw: string): string | null {
  const len = [...pw].length;
  if (len < PW_MIN) return `口令至少 ${PW_MIN} 个字符`;
  if (len > PW_MAX) return `口令太长（最多 ${PW_MAX} 个字符）`;
  return null;
}

/** 生成 scrypt$salt$hash 形式的口令哈希 */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** 常量时间校验口令 */
export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = crypto.scryptSync(plain, salt, expected.length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** 读取站长口令记录（未设置或数据损坏时返回 null） */
export function getOwner(): OwnerRecord | null {
  const raw = getSetting(OWNER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OwnerRecord>;
    if (typeof parsed.pw !== "string" || !parsed.pw) return null;
    return { pw: parsed.pw, createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0 };
  } catch {
    return null;
  }
}

/** 是否已经设置过访问口令 */
export function hasOwner(): boolean {
  return getOwner() !== null;
}

/** cookie token → 库内会话 id */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** 会话 cookie 属性（本机自用，Secure 需显式用 COOKIE_SECURE=1 打开） */
function cookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.COOKIE_SECURE === "1",
    ...(remember ? { maxAge: Math.floor(REMEMBER_MS / 1000) } : {}),
  };
}

/** 当前生效的会话 */
export type ActiveSession = { id: string; remember: boolean; expiresAt: number };

/**
 * 读当前会话：无 cookie / 库内不存在 / 已过期都返回 null。
 * 距上次活跃超过 1 天时顺带续期（只写库，不改 cookie——RSC 渲染期间不允许写 cookie）。
 */
export async function getSession(): Promise<ActiveSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const row = getSessionRow(id);
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt <= now) {
    deleteSession(id);
    return null;
  }
  if (now - row.lastSeenAt > RENEW_AFTER_MS) {
    touchSession(id, now, now + (row.remember === 1 ? REMEMBER_MS : SHORT_MS));
  }
  return { id, remember: row.remember === 1, expiresAt: row.expiresAt };
}

/** 是否已登录（站长） */
export async function isOwner(): Promise<boolean> {
  return (await getSession()) !== null;
}

/** 数据 API 的服务端门禁：未登录返回 401 响应，已登录返回 null */
export async function requireOwner(): Promise<Response | null> {
  if (await isOwner()) return null;
  return Response.json({ error: "需要登录" }, { status: 401 });
}

/**
 * 签发会话并写 cookie。只能在 route handler / server action 中调用
 * （在 Server Component 渲染期间写 cookie 会抛错）。
 */
export async function startSession(remember: boolean): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  deleteExpiredSessions(now);
  createSession({
    id: hashToken(token),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + (remember ? REMEMBER_MS : SHORT_MS),
    remember,
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(remember));
}

export type AuthResult = { ok: true } | { ok: false; error: string; status: number };

/** 登录失败节流（内存态，单进程本地应用足够）：连续失败到阈值后锁 30 秒 */
const failures = { count: 0, lockedUntil: 0 };

export async function login(password: string, remember: boolean): Promise<AuthResult> {
  const now = Date.now();
  if (failures.lockedUntil > now) {
    const secs = Math.ceil((failures.lockedUntil - now) / 1000);
    return { ok: false, error: `尝试过于频繁，请 ${secs} 秒后再试`, status: 429 };
  }
  const owner = getOwner();
  if (!owner) return { ok: false, error: "尚未设置访问口令", status: 400 };
  if (!verifyPassword(password, owner.pw)) {
    failures.count += 1;
    if (failures.count >= MAX_FAILS) {
      failures.count = 0;
      failures.lockedUntil = now + LOCK_MS;
      return { ok: false, error: "口令错误次数过多，请 30 秒后再试", status: 429 };
    }
    return { ok: false, error: "口令不正确", status: 401 };
  }
  failures.count = 0;
  failures.lockedUntil = 0;
  await startSession(remember);
  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(hashToken(token));
  store.delete(SESSION_COOKIE);
}

/** 首次设置口令（已设置过则拒绝，改用 changePassword） */
export function setInitialPassword(password: string): AuthResult {
  if (hasOwner()) return { ok: false, error: "访问口令已设置", status: 409 };
  const issue = passwordIssue(password);
  if (issue) return { ok: false, error: issue, status: 400 };
  const record: OwnerRecord = { pw: hashPassword(password), createdAt: Date.now() };
  setSetting(OWNER_KEY, JSON.stringify(record));
  return { ok: true };
}

/** 修改口令：校验旧口令 → 写入新口令 → 让其它设备上的旧会话全部失效（当前这次重新签发，保持登录） */
export async function changePassword(current: string, next: string): Promise<AuthResult> {
  const owner = getOwner();
  if (!owner) return { ok: false, error: "尚未设置访问口令", status: 400 };
  if (!verifyPassword(current, owner.pw)) return { ok: false, error: "当前口令不正确", status: 401 };
  const issue = passwordIssue(next);
  if (issue) return { ok: false, error: issue, status: 400 };
  const active = await getSession();
  setSetting(OWNER_KEY, JSON.stringify({ pw: hashPassword(next), createdAt: owner.createdAt }));
  deleteAllSessions();
  await startSession(active?.remember ?? true);
  return { ok: true };
}
