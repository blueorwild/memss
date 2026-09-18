import Database from "better-sqlite3";

/**
 * 重置访问口令：删除 settings 表里的 owner 记录。
 * 之后重新打开站点会回到「设置访问口令」视图（数据不受影响）。
 * 用法：npm run reset-password
 */
const DB_PATH = process.env.DATABASE_URL ?? "./data/app.db";

const db = new Database(DB_PATH);
const info = db.prepare("DELETE FROM settings WHERE key = 'owner'").run();

if (info.changes > 0) {
  console.log("已清除访问口令。重新打开站点即可设置新口令（回忆数据不受影响）。");
} else {
  console.log("没有找到已设置的访问口令，无需重置。");
}
db.close();
