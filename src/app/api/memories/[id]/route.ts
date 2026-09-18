import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { media, memories } from "@/lib/db/schema";
import { getMemoryWithMedia } from "@/lib/db/queries";
import {
  deleteMediaByIds,
  deleteMemoryById,
  setMediaOrder,
  updateMemory,
} from "@/lib/db/mutations";
import {
  saveUpload,
  validFiles,
  parseCropArray,
  parseImageMeta,
  type ImageMeta,
} from "@/lib/media-upload";
import { isValidTitle, TITLE_MAX } from "@/lib/title-limit";

export const runtime = "nodejs";

/** GET /api/memories/[id]：取回忆及其媒体（供编辑表单回填） */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;
  const { id } = await params;
  const memory = getMemoryWithMedia(id);
  if (!memory) return Response.json({ error: "回忆不存在" }, { status: 404 });
  return Response.json({ memory });
}

/** DELETE /api/memories/[id]：删除一条回忆及其媒体记录与物理文件 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;
  const { id } = await params;
  const ok = await deleteMemoryById(id);
  if (!ok) {
    return Response.json({ error: "回忆不存在" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

/** 解析 "new:<index>" 形式的封面指代，越界或非法返回 null */
function parseNewIndex(ref: string): number | null {
  if (!ref.startsWith("new:")) return null;
  const idx = Number(ref.slice(4));
  return Number.isInteger(idx) && idx >= 0 ? idx : null;
}

/**
 * PATCH /api/memories/[id]：编辑回忆（multipart）。
 * 字段：title / categoryId / date / description / location
 *      keepImageIds（有序 JSON：要保留的现有图片 id）
 *      coverRef（现有 mediaId 或 "new:<index>"；不传则保留原封面，失效则退回首张）
 *      removeAudio（"1" 表示删除背景音乐）
 *      images[]（新增图片）/ audio（新音乐，存在即替换旧音乐）
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner();
  if (denied) return denied;
  const { id } = await params;
  const memory = db.select().from(memories).where(eq(memories.id, id)).get();
  if (!memory) return Response.json({ error: "回忆不存在" }, { status: 404 });

  const form = await req.formData();
  // 标题/描述不 trim（保留首尾空白与换行）；校验时另行 trim
  const title = String(form.get("title") ?? "");
  const description = String(form.get("description") ?? "");
  const categoryId = String(form.get("categoryId") ?? "").trim();
  const date = String(form.get("date") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const coverRef = String(form.get("coverRef") ?? "").trim();
  const removeAudio = form.get("removeAudio") === "1";

  if (!title.trim() || !categoryId) {
    return Response.json({ error: "标题与类别为必填项" }, { status: 400 });
  }
  if (!isValidTitle(title)) {
    return Response.json({ error: `标题过长（上限 ${TITLE_MAX} 半角，约 20 汉字）` }, { status: 400 });
  }

  // 现有媒体
  const assets = db.select().from(media).where(eq(media.memoryId, id)).all();
  const images = assets
    .filter((a) => a.type === "image")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const audios = assets.filter((a) => a.type === "audio");
  const imageIdSet = new Set(images.map((a) => a.id));

  // 要保留的现有图片：字段缺失默认全保留（原裁剪）；否则按 imageMeta 顺序 + 过滤非本回忆的 id
  const meta = parseImageMeta(form.get("imageMeta"));
  const kept: ImageMeta[] =
    meta === null
      ? images.map((a) => ({ id: a.id, x: a.focalX, y: a.focalY, scale: a.cropScale }))
      : meta.filter((m) => imageIdSet.has(m.id));
  const keptIds = kept.map((k) => k.id);
  const keptSet = new Set(keptIds);

  // 1) 删除被移除的图片（记录 + 物理文件）
  const toDelete = images.filter((a) => !keptSet.has(a.id)).map((a) => a.id);
  await deleteMediaByIds(toDelete);

  // 2) 保存新增图片（裁剪参数与 images[] 同序）
  const crops = parseCropArray(form.get("newFocal"));
  const newImageIds: string[] = [];
  let order = keptIds.length;
  const newImageFiles = validFiles(form, "images");
  for (let i = 0; i < newImageFiles.length; i++) {
    const rel = await saveUpload(newImageFiles[i]);
    const mid = crypto.randomUUID();
    newImageIds.push(mid);
    const c = crops[i] ?? { x: 50, y: 50, scale: 100 };
    db.insert(media)
      .values({
        id: mid,
        memoryId: id,
        type: "image",
        path: rel,
        sortOrder: order++,
        caption: null,
        focalX: c.x,
        focalY: c.y,
        cropScale: c.scale,
      })
      .run();
  }

  // 3) 归一化图片顺序（保留的在前、新增的在后）并写回保留图片的裁剪
  const finalImageIds = [...keptIds, ...newImageIds];
  setMediaOrder(finalImageIds);
  for (const k of kept) {
    db.update(media)
      .set({ focalX: k.x, focalY: k.y, cropScale: k.scale })
      .where(eq(media.id, k.id))
      .run();
  }

  // 4) 音乐：有新媒体则替换旧音乐，否则按 removeAudio 删除
  const audioFiles = validFiles(form, "audio");
  if (audioFiles.length > 0) {
    await deleteMediaByIds(audios.map((a) => a.id));
    let aOrder = 0;
    for (const file of audioFiles) {
      const rel = await saveUpload(file);
      db.insert(media)
        .values({
          id: crypto.randomUUID(),
          memoryId: id,
          type: "audio",
          path: rel,
          sortOrder: aOrder++,
          caption: "背景音乐",
        })
        .run();
    }
  } else if (removeAudio) {
    await deleteMediaByIds(audios.map((a) => a.id));
  }

  // 5) 封面归一化：指定项有效则用它；否则保留原封面（若仍存在）；最终退回首张
  let coverMediaId: string | null = null;
  const newIdx = parseNewIndex(coverRef);
  if (newIdx !== null) {
    coverMediaId = newImageIds[newIdx] ?? null;
  } else if (coverRef && keptSet.has(coverRef)) {
    coverMediaId = coverRef;
  } else if (memory.coverMediaId && finalImageIds.includes(memory.coverMediaId)) {
    coverMediaId = memory.coverMediaId;
  }
  if (!coverMediaId) coverMediaId = finalImageIds[0] ?? null;

  updateMemory(id, {
    title,
    categoryId,
    date: date || null,
    description: description.trim() ? description : null,
    location: location || null,
    coverMediaId,
  });

  return Response.json({ ok: true, id });
}
