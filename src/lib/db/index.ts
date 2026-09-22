import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "./data/app.db";

// 确保数据库所在目录存在（新环境 clone 后 data/ 可能不存在，否则会打不开数据库）
if (url !== ":memory:") {
  try {
    fs.mkdirSync(path.dirname(path.resolve(url)), { recursive: true });
  } catch {
    /* 创建失败时交由数据库驱动报错 */
  }
}

const sqlite = new Database(url);
// WAL 依赖共享内存（mmap）：Windows 目录经 bind mount（9p）挂进容器时，宿主机留下的 -shm 打不开
// （SQLITE_IOERR_SHMOPEN）。容器由 compose 显式设 SQLITE_JOURNAL_MODE=DELETE；pragma 失败再兜底退回 DELETE。
const journalMode = process.env.SQLITE_JOURNAL_MODE ?? "WAL";
try {
  sqlite.pragma(`journal_mode = ${journalMode}`);
} catch {
  sqlite.pragma("journal_mode = DELETE");
}

export const db = drizzle(sqlite, { schema });
export { schema };
