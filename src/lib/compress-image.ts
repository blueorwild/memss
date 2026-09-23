/**
 * 上传前的图片压缩（纯浏览器端；**不裁剪**，只做等比缩放 + EXIF 方向校正）。
 *
 * 动机：公网经 Cloudflare Tunnel 的上传吞吐约 120~360KB/s，且 CF 对代理请求约 100 秒断流，
 * 手机原图（两张 3~8MB）会撞上限导致「上传失败」（详见 PLAN §32）。
 *
 * 约定：
 * - 等比缩放到最长边 `UPLOAD_MAX_EDGE`，JPEG 质量 `UPLOAD_JPEG_QUALITY`（体积通常降到 1/5~1/10）；
 * - 已经小于阈值、或压缩后反而更大 → 原样返回原文件；
 * - 浏览器解不开的格式（例如桌面 Chrome 遇到 HEIC）→ 回退原文件，不阻断上传。
 */
export const UPLOAD_MAX_EDGE = 2048;
export const UPLOAD_JPEG_QUALITY = 0.85;

/** 动图/矢量不压缩（压了会丢动画或分辨率无关特性） */
function skippable(type: string): boolean {
  return !type.startsWith("image/") || type === "image/gif" || type === "image/svg+xml";
}

/** 解码为可绘制源：优先 createImageBitmap（可带 EXIF 方向），失败退回 <img> */
async function decode(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; dispose: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    };
  }
}

/** 压缩单张图片；任何失败都回退原文件（不抛错） */
export async function compressImage(file: File): Promise<File> {
  if (skippable(file.type)) return file;
  try {
    const { source, width, height, dispose } = await decode(file);
    const scale = Math.min(1, UPLOAD_MAX_EDGE / Math.max(width, height));
    if (scale >= 1 || width <= 0 || height <= 0) {
      dispose();
      return file;
    }
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      dispose();
      return file;
    }
    // JPEG 不支持透明通道：先铺白底，避免带透明区域的图片转 JPEG 后发黑
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    dispose();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
