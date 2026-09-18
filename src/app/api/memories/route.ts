import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { media, memories } from "@/lib/db/schema";
import { saveUpload, validFiles, parseCropArray } from "@/lib/media-upload";
import { isValidTitle, TITLE_MAX } from "@/lib/title-limit";

export const runtime = "nodejs";

/** POST /api/memories：接收 multipart 表单，保存媒体文件并写入一条回忆 */
export async function POST(req: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;
  const form = await req.formData();

  // 标题/描述不 trim（保留用户输入的首尾空白与换行）；仅用于校验时另行 trim
  const title = String(form.get("title") ?? "");
  const description = String(form.get("description") ?? "");
  const categoryId = String(form.get("categoryId") ?? "").trim();
  const date = String(form.get("date") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  // 封面：新建时只可能是本次上传的图片，格式 "new:<index>"（images 顺序）
  const coverRef = String(form.get("coverRef") ?? "").trim();

  // 标题与归属类别为必填（纯空白标题视为空）
  if (!title.trim() || !categoryId) {
    return Response.json({ error: "标题与类别为必填项" }, { status: 400 });
  }
  if (!isValidTitle(title)) {
    return Response.json({ error: `标题过长（上限 ${TITLE_MAX} 半角，约 20 汉字）` }, { status: 400 });
  }

  const memoryId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1_000_000);

  const images = validFiles(form, "images");
  const audios = validFiles(form, "audio");
  // 新增图片的裁剪参数（与 images[] 同序，缺省居中 + 不缩放）
  const crops = parseCropArray(form.get("newFocal"));

  // 逐张保存图片，记录相对路径与顺序
  const mediaRows: {
    id: string;
    memoryId: string;
    type: string;
    path: string;
    sortOrder: number;
    caption: string | null;
    focalX: number;
    focalY: number;
    cropScale: number;
  }[] = [];
  const imageIds: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const rel = await saveUpload(images[i]);
    const id = crypto.randomUUID();
    imageIds.push(id);
    const c = crops[i] ?? { x: 50, y: 50, scale: 100 };
    mediaRows.push({
      id,
      memoryId,
      type: "image",
      path: rel,
      sortOrder: i,
      caption: null,
      focalX: c.x,
      focalY: c.y,
      cropScale: c.scale,
    });
  }

  // 背景音乐（通常单条）
  for (const file of audios) {
    const rel = await saveUpload(file);
    mediaRows.push({
      id: crypto.randomUUID(),
      memoryId,
      type: "audio",
      path: rel,
      sortOrder: 0,
      caption: "背景音乐",
      focalX: 50,
      focalY: 50,
      cropScale: 100,
    });
  }

  // 解析封面：new:<i> → 第 i 张新图片；无有效指代则默认首张
  const coverMediaId = resolveNewCover(coverRef, imageIds) ?? imageIds[0] ?? null;

  // 写入回忆主记录
  db.insert(memories)
    .values({
      id: memoryId,
      categoryId,
      title,
      date: date || null,
      description: description.trim() ? description : null,
      location: location || null,
      seed,
      createdAt: Date.now(),
      coverMediaId,
    })
    .run();

  // 写入媒体记录
  for (const row of mediaRows) {
    db.insert(media).values(row).run();
  }

  return Response.json({ id: memoryId });
}

/** 解析 "new:<index>" 形式的封面指代，越界或非法返回 null */
function resolveNewCover(ref: string, imageIds: string[]): string | null {
  if (!ref.startsWith("new:")) return null;
  const idx = Number(ref.slice(4));
  if (!Number.isInteger(idx) || idx < 0 || idx >= imageIds.length) return null;
  return imageIds[idx];
}
