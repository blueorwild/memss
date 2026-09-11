import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { media, memories } from "@/lib/db/schema";

export const runtime = "nodejs";

/** 上传文件落盘目录：media/uploads（与 /api/media 路由共用 media 根目录） */
const UPLOAD_DIR = path.join(process.cwd(), "media", "uploads");

/** 根据 MIME 判断媒体类型：音频 / 图片 */
function mediaTypeOf(file: File): "image" | "audio" {
  return file.type.startsWith("audio") ? "audio" : "image";
}

/** 推断文件扩展名：优先用原始文件名，兜底按类型给默认值 */
function extOf(file: File): string {
  const fromName = path.extname(file.name || "");
  if (fromName) return fromName;
  return mediaTypeOf(file) === "audio" ? ".mp3" : ".jpg";
}

/** 把单个上传文件写入上传目录，返回其在 media 下的相对路径 */
async function saveFile(file: File): Promise<string> {
  const fileName = `${crypto.randomUUID()}${extOf(file)}`;
  await fs.writeFile(
    path.join(UPLOAD_DIR, fileName),
    Buffer.from(await file.arrayBuffer()),
  );
  return `uploads/${fileName}`;
}

/** POST /api/memories：接收 multipart 表单，保存媒体文件并写入一条回忆 */
export async function POST(req: NextRequest) {
  const form = await req.formData();

  const title = String(form.get("title") ?? "").trim();
  const categoryId = String(form.get("categoryId") ?? "").trim();
  const date = String(form.get("date") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  // 标题与归属类别为必填
  if (!title || !categoryId) {
    return Response.json({ error: "标题与类别为必填项" }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const memoryId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1_000_000);

  // 过滤出有效文件（file 类型且大小 > 0）
  const validFiles = (name: string) =>
    form
      .getAll(name)
      .filter((v): v is File => v instanceof File && v.size > 0);

  const images = validFiles("images");
  const audios = validFiles("audio");

  // 逐张保存图片，记录相对路径与顺序
  const mediaRows: {
    id: string;
    memoryId: string;
    type: string;
    path: string;
    sortOrder: number;
    caption: string | null;
  }[] = [];

  for (let i = 0; i < images.length; i++) {
    const rel = await saveFile(images[i]);
    mediaRows.push({
      id: crypto.randomUUID(),
      memoryId,
      type: "image",
      path: rel,
      sortOrder: i,
      caption: null,
    });
  }

  // 背景音乐（通常单条）
  for (const file of audios) {
    const rel = await saveFile(file);
    mediaRows.push({
      id: crypto.randomUUID(),
      memoryId,
      type: "audio",
      path: rel,
      sortOrder: 0,
      caption: "背景音乐",
    });
  }

  // 写入回忆主记录
  db.insert(memories)
    .values({
      id: memoryId,
      categoryId,
      title,
      date: date || null,
      description: description || null,
      location: location || null,
      seed,
    })
    .run();

  // 写入媒体记录
  for (const row of mediaRows) {
    db.insert(media).values(row).run();
  }

  return Response.json({ id: memoryId });
}
