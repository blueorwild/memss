import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

/**
 * 建表 / 升级数据库结构（容器启动时执行）。
 *
 * - 用 drizzle 官方 migrator 按 drizzle/ 下的 SQL 顺序执行，已应用过的会跳过（幂等）。
 * - 用 better-sqlite3 直连，不依赖 drizzle-kit（那是 devDependency，生产镜像里没有）。
 * - 只适用于**全新空库**：现有开发机 DB 是 drizzle-kit push 建的，
 *   没有 __drizzle_migrations 记录，在本机不要跑这个（继续用 `npx drizzle-kit push`）。
 */

const DB_PATH = process.env.DATABASE_URL ?? "./data/app.db";
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

if (DB_PATH !== ":memory:") {
  fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });
}

const sqlite = new Database(DB_PATH);
// WAL 在 Windows bind mount（9p）上不可靠 → 容器由 compose 设 SQLITE_JOURNAL_MODE=DELETE，失败再兜底
const journalMode = process.env.SQLITE_JOURNAL_MODE ?? "WAL";
try {
  sqlite.pragma(`journal_mode = ${journalMode}`);
} catch {
  sqlite.pragma("journal_mode = DELETE");
}

try {
  migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_DIR });
  console.log(`[migrate] ok → ${DB_PATH}`);
} finally {
  sqlite.close();
}
