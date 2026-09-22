import { promises as fs } from "node:fs";
import path from "node:path";
import { uploadDir } from "./paths";

/** 根据 MIME 判断媒体类型：音频 / 图片 */
export function mediaTypeOf(file: File): "image" | "audio" {
  return file.type.startsWith("audio") ? "audio" : "image";
}

/** 推断文件扩展名：优先用原始文件名，兜底按类型给默认值 */
export function extOf(file: File): string {
  const fromName = path.extname(file.name || "");
  if (fromName) return fromName;
  return mediaTypeOf(file) === "audio" ? ".mp3" : ".jpg";
}

/** 把单个上传文件写入上传目录，返回其在 media 下的相对路径 */
export async function saveUpload(file: File): Promise<string> {
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${crypto.randomUUID()}${extOf(file)}`;
  await fs.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
  return `uploads/${fileName}`;
}

/** 从 FormData 中取出指定字段的有效文件（File 且大小 > 0） */
export function validFiles(form: FormData, name: string): File[] {
  return form.getAll(name).filter((v): v is File => v instanceof File && v.size > 0);
}

/** 裁剪参数（焦点百分比 0-100 + 缩放百分比 100-600） */
export type CropInput = { x: number; y: number; scale: number };

const CROP_MIN_SCALE = 100;
const CROP_MAX_SCALE = 600;

function clampRange(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : fallback;
}

/** 归一化裁剪参数：非法/越界回退居中与不缩放 */
export function clampCropInput(x: unknown, y: unknown, scale: unknown): CropInput {
  return {
    x: clampRange(x, 0, 100, 50),
    y: clampRange(y, 0, 100, 50),
    scale: clampRange(scale, CROP_MIN_SCALE, CROP_MAX_SCALE, 100),
  };
}

/** 解析与 images[] 同序的裁剪数组（缺省为空 → 调用方回退默认） */
export function parseCropArray(raw: FormDataEntryValue | null): CropInput[] {
  if (raw === null) return [];
  try {
    const arr = JSON.parse(String(raw));
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => {
      const o = (it ?? {}) as { x?: unknown; y?: unknown; scale?: unknown };
      return clampCropInput(o.x, o.y, o.scale);
    });
  } catch {
    return [];
  }
}

/** 图片媒体元数据（保留顺序 + 裁剪） */
export type ImageMeta = { id: string; x: number; y: number; scale: number };

/** 解析 imageMeta；字段缺失/非法返回 null（调用方据此保持"全保留"语义） */
export function parseImageMeta(raw: FormDataEntryValue | null): ImageMeta[] | null {
  if (raw === null) return null;
  try {
    const arr = JSON.parse(String(raw));
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((it): it is { id: string } => Boolean(it) && typeof it.id === "string")
      .map((it) => {
        const o = it as { id: string; x?: unknown; y?: unknown; scale?: unknown };
        const c = clampCropInput(o.x, o.y, o.scale);
        return { id: o.id, x: c.x, y: c.y, scale: c.scale };
      });
  } catch {
    return null;
  }
}
