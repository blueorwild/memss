import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * 生成/清理「测试数据」，用于验证不同记忆数量下的展示形态。
 *   node scripts/seed-demo.mjs          # 生成（幂等：先清理旧的测试数据）
 *   node scripts/seed-demo.mjs --clean  # 只清理
 *
 * 只操作「地球 / 测试数据」这一分支及其 dm_* 媒体文件，不会动真实数据。
 */

const ROOT = process.cwd();
const MEDIA_ROOT = process.env.MEDIA_ROOT
  ? path.resolve(process.env.MEDIA_ROOT)
  : path.join(ROOT, "media");
const MEDIA_DIR = path.join(MEDIA_ROOT, "seed");
const DB_PATH = process.env.DATABASE_URL ?? "./data/app.db";

const PARENT_ID = "demo";
const PARENT_NAME = "测试数据";
const GROUPS = [1, 2, 5, 6, 7, 100];
const cleanOnly = process.argv.includes("--clean");

fs.mkdirSync(MEDIA_DIR, { recursive: true });

/** 渐变封面（与真实 seed 同一风格），带序号便于肉眼区分 */
function makeSvg(label, sub, hue) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},72%,58%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 60) % 360},68%,32%)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <circle cx="980" cy="190" r="150" fill="rgba(255,255,255,0.14)"/>
  <circle cx="180" cy="700" r="220" fill="rgba(0,0,0,0.10)"/>
  <text x="80" y="610" font-size="76" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-weight="bold">${label}</text>
  <text x="82" y="682" font-size="36" fill="rgba(255,255,255,0.88)" font-family="Helvetica, Arial, sans-serif">${sub}</text>
</svg>
`;
}

function writeMedia(fileName, buf) {
  fs.writeFileSync(path.join(MEDIA_DIR, fileName), buf);
  return `seed/${fileName}`;
}

/** 2020-01-01 ~ 2026-12-31 的随机日期（ISO 片段，供时间轴排序） */
function randomDate() {
  const start = Date.UTC(2020, 0, 1);
  const end = Date.UTC(2026, 11, 31);
  const d = new Date(start + Math.random() * (end - start));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

const db = new Database(DB_PATH);
// WAL 在 Windows bind mount（9p）上不可靠 → 容器由 compose 设 SQLITE_JOURNAL_MODE=DELETE，失败再兜底
const journalMode = process.env.SQLITE_JOURNAL_MODE ?? "WAL";
try {
  db.pragma(`journal_mode = ${journalMode}`);
} catch {
  db.pragma("journal_mode = DELETE");
}

/** 删除测试数据：仅 demo 分类、其下记忆、以及 dm_* 媒体文件 */
function cleanDemo() {
  const cats = db
    .prepare("SELECT id FROM categories WHERE id = ? OR parent_id = ?")
    .all(PARENT_ID, PARENT_ID);
  const catIds = cats.map((c) => c.id);
  if (catIds.length === 0) return 0;

  const cph = catIds.map(() => "?").join(",");
  const mems = db.prepare(`SELECT id FROM memories WHERE category_id IN (${cph})`).all(...catIds);
  const memIds = mems.map((m) => m.id);

  if (memIds.length > 0) {
    const mph = memIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT path FROM media WHERE memory_id IN (${mph})`).all(...memIds);
    for (const r of rows) {
      const f = path.join(MEDIA_ROOT, r.path);
      // 双保险：只删 seed 目录下的 dm_* 文件
      if (f.includes(`${path.sep}seed${path.sep}dm_`)) fs.rmSync(f, { force: true });
    }
    db.prepare(`DELETE FROM media WHERE memory_id IN (${mph})`).run(...memIds);
    db.prepare(`DELETE FROM memories WHERE id IN (${mph})`).run(...memIds);
  }
  db.prepare(`DELETE FROM categories WHERE id IN (${cph})`).run(...catIds);
  return memIds.length;
}

if (cleanOnly) {
  const removed = cleanDemo();
  db.close();
  console.log(`已清理测试数据：删除 ${removed} 条记忆及对应封面。`);
  process.exit(0);
}

const run = db.transaction(() => {
  cleanDemo();

  const insCat = db.prepare(
    "INSERT INTO categories (id, parent_id, name, kind, sort_order) VALUES (?, ?, ?, ?, ?)",
  );
  insCat.run(PARENT_ID, "globe", PARENT_NAME, "custom", 999);
  GROUPS.forEach((n, idx) => insCat.run(`demo-${n}`, PARENT_ID, `${n} 段`, "custom", idx));

  const insMem = db.prepare(
    "INSERT INTO memories (id, category_id, title, date, description, location, seed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insMedia = db.prepare(
    "INSERT INTO media (id, memory_id, type, path, sort_order, caption) VALUES (?, ?, ?, ?, ?, ?)",
  );

  const now = Date.now();
  let total = 0;
  for (const n of GROUPS) {
    for (let i = 1; i <= n; i++) {
      const id = `dm_${n}_${i}`;
      const hue = Math.floor(Math.random() * 360);
      const label = `${n} 段 · ${String(i).padStart(3, "0")}`;
      const rel = writeMedia(`${id}.svg`, Buffer.from(makeSvg(label, PARENT_NAME, hue), "utf8"));
      insMem.run(
        id,
        `demo-${n}`,
        `测试回忆 ${i}`,
        randomDate(),
        "用于验证不同记忆数量下的展示形态。",
        `${PARENT_NAME} / ${n} 段`,
        100000 + Math.floor(Math.random() * 899999),
        now + total,
      );
      insMedia.run(`${id}_img`, id, "image", rel, 0, label);
      total++;
    }
  }
  return total;
});

const total = run();
db.close();
console.log(`已生成测试数据：{${GROUPS.join(", ")}} 段，共 ${total} 条记忆。`);
console.log(`入口：地球 / ${PARENT_NAME} / {${GROUPS.join(",")}} 段`);
console.log(`封面：${MEDIA_DIR}/dm_*.svg`);
