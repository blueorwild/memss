import { NextRequest } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { requireReadAccess } from "@/lib/auth";

export const runtime = "nodejs";

const MEDIA_ROOT = path.join(process.cwd(), "media");

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
};

function toWeb(stream: Readable): ReadableStream {
  return Readable.toWeb(stream) as unknown as ReadableStream;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  // 图片/音乐：站长永远可读；访客在「允许访客浏览」打开时可读（回忆内容本身已可见）
  const denied = await requireReadAccess();
  if (denied) return denied;
  const { path: parts } = await ctx.params;
  const abs = path.normalize(path.join(MEDIA_ROOT, parts.join("/")));

  if (abs !== MEDIA_ROOT && !abs.startsWith(MEDIA_ROOT + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("Not Found", { status: 404 });

  const type = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number.parseInt(match[1], 10) : 0;
      const end = match[2] ? Number.parseInt(match[2], 10) : stat.size - 1;
      if (start >= stat.size || start > end) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      }
      const clampedEnd = Math.min(end, stat.size - 1);
      const stream = createReadStream(abs, { start, end: clampedEnd });
      return new Response(toWeb(stream), {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Length": String(clampedEnd - start + 1),
          "Content-Range": `bytes ${start}-${clampedEnd}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  return new Response(toWeb(createReadStream(abs)), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
