import path from "node:path";

/**
 * 媒体文件根目录（图片 / 音乐）。
 *
 * - 本机开发：不设 `MEDIA_ROOT` 时回退到 `<项目根>/media`，与改造前行为一致。
 * - 容器部署：必须用 `MEDIA_ROOT` 指到挂载卷（如 `/media`）——容器是一次性的，
 *   写进容器内部的文件重启即丢。
 */
export function mediaRoot(): string {
  const configured = process.env.MEDIA_ROOT?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "media");
}

/** 上传文件落盘目录：`<mediaRoot>/uploads` */
export function uploadDir(): string {
  return path.join(mediaRoot(), "uploads");
}
