import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const MEDIA_ROOT = process.env.MEDIA_ROOT
  ? path.resolve(process.env.MEDIA_ROOT)
  : path.join(ROOT, "media");
const MEDIA_DIR = path.join(MEDIA_ROOT, "seed");
const DB_PATH = process.env.DATABASE_URL ?? "./data/app.db";

fs.mkdirSync(MEDIA_DIR, { recursive: true });

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

function toneWav(freqs, seconds, sampleRate = 44100) {
  const n = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(44 + n * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + n * 2, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (const f of freqs) v += Math.sin(2 * Math.PI * f * t);
    v /= freqs.length;
    const attack = Math.min(1, t / 0.6);
    const release = Math.min(1, (seconds - t) / 0.6);
    const env = Math.max(0, Math.min(attack, release));
    data.writeInt16LE(Math.round(v * 0.3 * env * 32767), 44 + i * 2);
  }
  return data;
}

function writeMedia(fileName, buf) {
  fs.writeFileSync(path.join(MEDIA_DIR, fileName), buf);
  return `seed/${fileName}`;
}

const categories = [
  { id: "globe", parentId: null, name: "MemSS", kind: "globe", sortOrder: 0 },
  { id: "jp", parentId: "globe", name: "日本", kind: "country", sortOrder: 0 },
  { id: "cn", parentId: "globe", name: "中国", kind: "country", sortOrder: 1 },
  { id: "tokyo", parentId: "jp", name: "东京", kind: "region", sortOrder: 0 },
  { id: "yunnan", parentId: "cn", name: "云南", kind: "region", sortOrder: 0 },
];

const memories = [
  {
    id: "m_asakusa",
    categoryId: "tokyo",
    title: "浅草寺的清晨",
    date: "2023-04-05",
    location: "日本 · 东京 · 浅草",
    description:
      "起了个大早，赶在人潮之前到了雷门。晨光落在巨大的灯笼上，空气里还有一点凉意。抽了一支签，是「吉」。",
    seed: 10407,
    images: [
      { label: "雷门", sub: "浅草寺 · 东京", hue: 12 },
      { label: "五重塔", sub: "晨光", hue: 320 },
    ],
    tones: [392.0, 493.88, 587.33],
  },
  {
    id: "m_matsuri",
    categoryId: "tokyo",
    title: "夏日祭的烟火",
    date: "2024-08-15",
    location: "日本 · 东京 · 台场",
    description:
      "穿着浴衣挤在人群里，章鱼烧的香味混着海风。烟火升起来的那一瞬间，所有人都安静了一秒。",
    seed: 20815,
    images: [
      { label: "浴衣", sub: "台场 · 夏", hue: 268 },
      { label: "花火", sub: "夜空中绽放", hue: 210 },
      { label: "屋台", sub: "小吃摊", hue: 32 },
    ],
    tones: [440.0, 554.37, 659.25],
  },
  {
    id: "m_shibuya",
    categoryId: "tokyo",
    title: "涩谷的霓虹",
    date: "2022-11-18",
    location: "日本 · 东京 · 涩谷",
    description: "十字路口的人潮随着信号灯起落，霓虹次第亮起。站在天桥上看了很久。",
    seed: 221118,
    images: [
      { label: "十字路口", sub: "涩谷 · 东京", hue: 285 },
      { label: "霓虹", sub: "黄昏", hue: 330 },
    ],
    tones: [349.23, 440.0, 523.25],
  },
  {
    id: "m_shinjuku",
    categoryId: "tokyo",
    title: "新宿御苑的秋",
    date: "2022-11-25",
    location: "日本 · 东京 · 新宿",
    description: "红叶还没落尽，草坪上有人在写生。风一吹，落叶就铺了一地。",
    seed: 221125,
    images: [
      { label: "红叶", sub: "新宿御苑", hue: 20 },
      { label: "草坪", sub: "深秋", hue: 45 },
    ],
    tones: null,
  },
  {
    id: "m_ueno",
    categoryId: "tokyo",
    title: "上野公园的樱花",
    date: "2023-03-28",
    location: "日本 · 东京 · 上野",
    description: "樱花开了七分。树下铺着蓝色塑料布，人们席地而坐，花瓣落进酒杯里。",
    seed: 230328,
    images: [
      { label: "樱花", sub: "上野公园", hue: 340 },
      { label: "花见", sub: "春", hue: 355 },
    ],
    tones: [523.25, 659.25, 783.99],
  },
  {
    id: "m_skytree",
    categoryId: "tokyo",
    title: "晴空塔的夜色",
    date: "2023-06-10",
    location: "日本 · 东京 · 押上",
    description: "从塔顶往下看，整座城市像一片发光的电路板。隅田川安静地流过脚下。",
    seed: 230610,
    images: [
      { label: "塔顶", sub: "晴空塔", hue: 215 },
      { label: "夜景", sub: "俯望", hue: 240 },
    ],
    tones: [261.63, 329.63, 392.0],
  },
  {
    id: "m_tsukiji",
    categoryId: "tokyo",
    title: "筑地市场的早餐",
    date: "2023-09-02",
    location: "日本 · 东京 · 筑地",
    description: "天没亮就排上了队。第一口玉子烧是热的，师傅的手很快，几乎看不清。",
    seed: 230902,
    images: [
      { label: "玉子烧", sub: "筑地", hue: 40 },
      { label: "摊位", sub: "清晨", hue: 15 },
    ],
    tones: null,
  },
  {
    id: "m_meiji",
    categoryId: "tokyo",
    title: "明治神宫的静谧",
    date: "2024-01-15",
    location: "日本 · 东京 · 原宿",
    description: "穿过巨大的鸟居，城市的喧闹一下子被隔绝在外。碎石路踩上去沙沙作响。",
    seed: 240115,
    images: [
      { label: "鸟居", sub: "明治神宫", hue: 120 },
      { label: "参道", sub: "冬", hue: 100 },
    ],
    tones: [220.0, 277.18, 329.63],
  },
  {
    id: "m_odaiba",
    categoryId: "tokyo",
    title: "台场的海边",
    date: "2024-05-20",
    location: "日本 · 东京 · 台场",
    description: "傍晚的风带着海味。彩虹大桥亮起灯，海面上碎成一片金红。",
    seed: 240520,
    images: [
      { label: "彩虹大桥", sub: "台场", hue: 205 },
      { label: "海面", sub: "黄昏", hue: 25 },
    ],
    tones: [392.0, 493.88, 587.33],
  },
  {
    id: "m_ginza",
    categoryId: "tokyo",
    title: "银座的圣诞灯",
    date: "2024-12-24",
    location: "日本 · 东京 · 银座",
    description: "街道两旁的灯饰一直亮到很远。橱窗里都是暖光，行人说话时呵出白气。",
    seed: 241224,
    images: [
      { label: "灯饰", sub: "银座", hue: 300 },
      { label: "橱窗", sub: "平安夜", hue: 270 },
    ],
    tones: [440.0, 523.25, 659.25],
  },
  {
    id: "m_arashiyama",
    categoryId: "jp",
    title: "岚山的竹林",
    date: "2024-04-02",
    location: "日本 · 京都 · 岚山",
    description: "竹林里风穿过叶梢的声音很轻。阳光从缝隙落下，在地上摇晃。",
    seed: 40402,
    images: [
      { label: "竹林小径", sub: "岚山 · 京都", hue: 140 },
      { label: "渡月桥", sub: "桂川", hue: 190 },
    ],
    tones: [293.66, 369.99, 440.0],
  },
  {
    id: "m_dali",
    categoryId: "yunnan",
    title: "大理古城的午后",
    date: "2022-10-01",
    location: "中国 · 云南 · 大理",
    description:
      "在人民路的一家小咖啡馆坐了一整个下午。阳光很好，猫在脚边睡觉，时间好像变慢了。",
    seed: 31001,
    images: [
      { label: "古城街角", sub: "大理 · 云南", hue: 168 },
      { label: "咖啡馆", sub: "人民路", hue: 24 },
    ],
    tones: null,
  },
  {
    id: "m_erhai",
    categoryId: "yunnan",
    title: "洱海边的骑行",
    date: "2022-10-03",
    location: "中国 · 云南 · 大理",
    description:
      "租了一辆自行车沿着环海路骑。风很大，云影落在水面上，停下来的时候只听见浪声。",
    seed: 31003,
    images: [
      { label: "环海路", sub: "洱海", hue: 200 },
      { label: "水天一色", sub: "午后", hue: 190 },
      { label: "苍山", sub: "远望", hue: 150 },
    ],
    tones: [329.63, 392.0, 493.88],
  },
];

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const reset = db.transaction(() => {
  db.exec("DELETE FROM media; DELETE FROM memories; DELETE FROM categories;");

  const insCat = db.prepare(
    "INSERT INTO categories (id, parent_id, name, kind, sort_order) VALUES (?, ?, ?, ?, ?)",
  );
  for (const c of categories) insCat.run(c.id, c.parentId, c.name, c.kind, c.sortOrder);

  const insMem = db.prepare(
    "INSERT INTO memories (id, category_id, title, date, description, location, seed) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insMedia = db.prepare(
    "INSERT INTO media (id, memory_id, type, path, sort_order, caption) VALUES (?, ?, ?, ?, ?, ?)",
  );

  for (const m of memories) {
    insMem.run(m.id, m.categoryId, m.title, m.date, m.description, m.location, m.seed);

    m.images.forEach((img, i) => {
      const file = `${m.id}-${i + 1}.svg`;
      const rel = writeMedia(file, Buffer.from(makeSvg(img.label, img.sub, img.hue), "utf8"));
      insMedia.run(`${m.id}_img_${i + 1}`, m.id, "image", rel, i, img.label);
    });

    if (m.tones) {
      const file = `${m.id}.wav`;
      const rel = writeMedia(file, toneWav(m.tones, 6));
      insMedia.run(`${m.id}_audio`, m.id, "audio", rel, 0, "背景音乐");
    }
  }
});

reset();
db.close();

console.log(`Seeded ${categories.length} categories, ${memories.length} memories.`);
console.log(`Media written to ${MEDIA_DIR}`);
console.log(`Database: ${DB_PATH}`);
