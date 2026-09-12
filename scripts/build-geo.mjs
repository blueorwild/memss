import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// 用 createRequire 加载 CJS 数据集（world-countries / china-division 均为 CJS）
const require = createRequire(import.meta.url);
const countries = require("world-countries");
const { pc } = require("china-division");

const OUT_DIR = path.join(process.cwd(), "public", "geo");

// 世界国家：取中文常用名，按中文拼音/笔画排序
const countryList = countries
  .map((c) => ({
    code: c.cca2,
    name: c.translations?.zho?.common || c.name.common,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

// 中国省市：数据集为 { 省: [市, ...] }，转为 [{ name, cities }]
const china = Object.entries(pc).map(([name, cities]) => ({ name, cities }));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "countries.json"), JSON.stringify(countryList));
fs.writeFileSync(path.join(OUT_DIR, "china.json"), JSON.stringify(china));

console.log(`countries: ${countryList.length} -> public/geo/countries.json`);
console.log(`china provinces: ${china.length} -> public/geo/china.json`);
