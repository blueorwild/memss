import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * 主密钥来源（仅用于加密数据库中的 provider 密钥）：
 * 1) 环境变量 AGENT_SECRET（优先，适合部署到远端）；
 * 2) 环境变量 AGENT_SECRET_FILE（显式指定密钥文件路径）；
 * 3) 回退：与数据库**同目录**的 secret.key —— 本机是 ./data/secret.key，
 *    容器里是 /data/secret.key（与 DB 同卷，随 data/ 一起备份）。
 *    ⚠️ 不能用 process.cwd()/data：容器里 cwd 是 /app（root 所有），nextjs 用户会 EACCES。
 */
function keyFilePath(): string {
  if (process.env.AGENT_SECRET_FILE) return path.resolve(process.env.AGENT_SECRET_FILE);
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl !== ":memory:") {
    return path.join(path.dirname(path.resolve(dbUrl)), "secret.key");
  }
  return path.join(process.cwd(), "data", "secret.key");
}

let cachedKey: Buffer | null = null;

/** 把任意字符串派生为 32 字节密钥：64 位 hex 直接解析，否则按 sha256 派生 */
function deriveKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  return crypto.createHash("sha256").update(trimmed).digest();
}

/** 读取本地密钥文件；不存在则生成一个 32 字节随机密钥并以 600 权限落盘 */
function loadOrCreateKeyFile(): Buffer {
  const file = keyFilePath();
  try {
    const saved = fs.readFileSync(file, "utf8").trim();
    if (/^[0-9a-fA-F]{64}$/.test(saved)) return Buffer.from(saved, "hex");
  } catch {
    /* 文件不存在则下面生成 */
  }
  const key = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, key.toString("hex"), { mode: 0o600 });
  return key;
}

/** 获取主密钥（进程内缓存） */
export function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = process.env.AGENT_SECRET ? deriveKey(process.env.AGENT_SECRET) : loadOrCreateKeyFile();
  return cachedKey;
}

/** 加密：返回 v1:iv:tag:ciphertext（各段 base64） */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/** 解密；格式不符或密钥不匹配时返回 null（不抛错，避免影响整体流程） */
export function decryptSecret(payload: string): string | null {
  try {
    const [ver, ivB64, tagB64, dataB64] = payload.split(":");
    if (ver !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** 掩码展示：仅保留末 4 位 */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
}
