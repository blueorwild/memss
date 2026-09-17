"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Category, MemoryWithMedia } from "@/lib/db/queries";
import CategoryPicker from "@/components/ui/category-picker";
import NewCategoryDialog from "@/components/ui/new-category-dialog";
import { useSpriteStore } from "@/store/sprite";
import { TITLE_MAX, TITLE_MAX_HAN, titleWidth } from "@/lib/title-limit";
import { DEFAULT_CROP, coverStyle, type Crop } from "@/lib/crop";
import CropDialog from "./CropDialog";

/** 从当前 URL 解析所处类别 id：/star/a/b → "b" */
function currentCategoryFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "star") return null;
  return parts[parts.length - 1] ?? null;
}

/** 输入框通用样式（移动端 16px 字号，避免 iOS 聚焦时自动放大） */
const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white outline-none placeholder:text-white/35 focus:border-white/30 sm:text-sm";

/** 文件选择框通用样式 */
const fileCls =
  "block w-full text-sm text-white/60 file:mr-2 file:rounded-full file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-white sm:text-xs sm:file:py-1.5";

type ExistingImage = { id: string; path: string; crop: Crop };
type NewImage = { file: File; url: string; crop: Crop };
/** 封面选择：现有图片 / 本次新增文件 / 未指定（回退首张） */
type CoverSel = { kind: "existing"; id: string } | { kind: "new"; item: NewImage } | null;
/** 正在裁剪的目标（按 id / objectURL 定位，避免对象引用失效） */
type CropTarget = { kind: "existing"; id: string } | { kind: "new"; url: string } | null;

/** 单击判定延迟（ms）：避免双击打开裁剪时也触发一次「设封面」 */
const CLICK_DELAY = 230;

/**
 * 固定 3:2 裁剪预览瓷砖：所见即最终卡片/详情页构图。
 * - 单击 = 设为封面
 * - 双击 = 打开裁剪弹窗
 */
function ImageTile({
  src,
  crop,
  cover,
  onPickCover,
  onOpenCrop,
  onRemove,
}: {
  src: string;
  crop: Crop;
  cover: boolean;
  onPickCover: () => void;
  onOpenCrop: () => void;
  onRemove: () => void;
}) {
  const timer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-label="单击设为封面，双击调整展示区域"
        onClick={() => {
          if (timer.current !== null) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(onPickCover, CLICK_DELAY);
        }}
        onDoubleClick={() => {
          if (timer.current !== null) {
            window.clearTimeout(timer.current);
            timer.current = null;
          }
          onOpenCrop();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPickCover();
          }
        }}
        style={{ aspectRatio: "3 / 2" }}
        className={`relative w-full cursor-pointer overflow-hidden rounded-lg border transition-colors ${
          cover ? "border-accent" : "border-white/10 hover:border-white/30"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          style={coverStyle(crop)}
          className="h-full w-full object-cover"
        />
      </div>
      {cover && (
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-accent-deep/90 px-1.5 py-0.5 text-[10px] text-white">
          封面
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="移除图片"
        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-neutral-900/90 text-sm leading-none text-white/80 hover:bg-red-500/80"
      >
        ×
      </button>
    </div>
  );
}

/**
 * 回忆表单（新建 / 编辑共用）。
 * - create：图片可多选、音乐可选；由小精灵「上传回忆」进入。
 * - edit：先拉取该回忆，可改标题/描述/类别/日期，增删图片、设封面、替换或删除音乐。
 * 图片始终保留「保留的旧图在前、新增图在后」的顺序。
 */
export default function MemoryForm({
  mode,
  memoryId,
  onDone,
}: {
  mode: "create" | "edit";
  memoryId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const uploadDraft = useSpriteStore((s) => s.uploadDraft);
  const clearUploadDraft = useSpriteStore((s) => s.clearUploadDraft);

  const [serverCategories, setServerCategories] = useState<Category[]>([]);
  const [drafts, setDrafts] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState(uploadDraft?.title ?? "");
  const [date, setDate] = useState(uploadDraft?.date ?? "");
  const [description, setDescription] = useState(uploadDraft?.description ?? "");

  // 图片：现有（编辑）与本次新增（各带裁剪参数）
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [coverSel, setCoverSel] = useState<CoverSel>(null);
  // 裁剪弹窗
  const [cropTarget, setCropTarget] = useState<CropTarget>(null);
  const [cropOpen, setCropOpen] = useState(false);

  // 音乐：现有（编辑）与本次新增
  const [existingAudio, setExistingAudio] = useState<{ id: string; path: string } | null>(null);
  const [newAudio, setNewAudio] = useState<File | null>(null);
  const [removeAudio, setRemoveAudio] = useState(false);

  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新建类别弹层状态
  const [newParent, setNewParent] = useState<Category | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const imagesRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLInputElement | null>(null);

  // 记录当前新增图片的 objectURL（在 effect 中同步），卸载时统一释放，避免内存泄漏
  const newUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    newUrlsRef.current = newImages.map((it) => it.url);
  }, [newImages]);
  useEffect(() => {
    return () => {
      for (const url of newUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  const categories = useMemo(() => [...serverCategories, ...drafts], [serverCategories, drafts]);

  // location 由所选类别路径自动生成（去掉根节点）
  const locationText = useMemo(() => {
    if (!categoryId) return "";
    const byId = new Map(categories.map((c) => [c.id, c]));
    const names: string[] = [];
    let cur = byId.get(categoryId);
    while (cur) {
      names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return names.length > 1 ? names.slice(1).join(" / ") : names.join(" / ");
  }, [categories, categoryId]);

  const width = titleWidth(title);
  const overLimit = width > TITLE_MAX;

  // 载入类别；编辑模式再拉取该回忆并回填
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = (await (await fetch("/api/categories")).json()) as Category[];
        if (!alive) return;
        setServerCategories(list);

        if (mode === "create") {
          const cur = currentCategoryFromPath(pathname);
          const preferred = uploadDraft?.categoryId ?? cur;
          setCategoryId(
            preferred && list.some((c) => c.id === preferred)
              ? preferred
              : (list.find((c) => !c.parentId)?.id ?? list[0]?.id ?? ""),
          );
          return;
        }

        if (!memoryId) throw new Error("缺少回忆 id");
        const res = await fetch(`/api/memories/${memoryId}`);
        if (!res.ok) throw new Error("回忆加载失败");
        const d = (await res.json()) as { memory: MemoryWithMedia };
        if (!alive) return;
        const m = d.memory;
        setTitle(m.title);
        setDate(m.date ?? "");
        setDescription(m.description ?? "");
        setCategoryId(list.some((c) => c.id === m.categoryId) ? m.categoryId : (list[0]?.id ?? ""));
        const imgs = m.media
          .filter((x) => x.type === "image")
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((x) => ({
            id: x.id,
            path: x.path,
            crop: { x: x.focalX, y: x.focalY, scale: x.cropScale },
          }));
        setExistingImages(imgs);
        const audio = m.media.find((x) => x.type === "audio");
        setExistingAudio(audio ? { id: audio.id, path: audio.path } : null);
        // 默认封面：显式封面，否则首张
        setCoverSel(
          m.coverMediaId && imgs.some((i) => i.id === m.coverMediaId)
            ? { kind: "existing", id: m.coverMediaId }
            : imgs[0]
              ? { kind: "existing", id: imgs[0].id }
              : null,
        );
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, memoryId, pathname, uploadDraft]);

  /** 新建类别（草稿）：加入本地列表并选中；提交时才落库 */
  function handleDraftCreated(draft: Category) {
    setDrafts((prev) => [...prev, draft]);
    setCategoryId(draft.id);
  }

  /** 创建类别：同级已存在同名则复用其 id */
  async function ensureCategory(parentId: string, name: string): Promise<string> {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, name }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (res.ok && data.id) return data.id;
    if (res.status === 409) {
      const list = (await (await fetch("/api/categories")).json()) as Category[];
      const found = list.find((c) => c.parentId === parentId && c.name === name);
      if (found) return found.id;
    }
    throw new Error(data.error ?? "新建类别失败");
  }

  /** 解析所选类别到根的链，把其中草稿依次落库，返回最终真实类别 id */
  async function resolveCategoryId(): Promise<string> {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const chain: Category[] = [];
    let cur = byId.get(categoryId);
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }

    let resolved = categoryId;
    let parentRealId: string | null = null;
    for (const cat of chain) {
      if (cat.id.startsWith("draft-")) {
        const realId = await ensureCategory(parentRealId ?? cat.parentId ?? "globe", cat.name);
        resolved = realId;
        parentRealId = realId;
      } else {
        resolved = cat.id;
        parentRealId = cat.id;
      }
    }
    return resolved;
  }

  /** 新增图片选择：追加到本次新增列表（可再次选择），并为每张生成预览 objectURL */
  function handlePickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setNewImages((prev) => [
        ...prev,
        ...files.map((file) => ({
          file,
          url: URL.createObjectURL(file),
          crop: DEFAULT_CROP,
        })),
      ]);
    }
    e.target.value = "";
  }

  /** 移除一张现有图片；若它正是当前封面则清空封面选择（提交时回退首张） */
  function removeExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((img) => img.id !== id));
    setCoverSel((c) => (c?.kind === "existing" && c.id === id ? null : c));
  }

  /** 移除一张新增图片：释放 objectURL；若它被设为封面则清空封面选择 */
  function removeNewImage(item: NewImage) {
    URL.revokeObjectURL(item.url);
    setNewImages((prev) => prev.filter((it) => it !== item));
    setCoverSel((c) => (c?.kind === "new" && c.item === item ? null : c));
  }

  /** 更新某张已有图片的裁剪参数 */
  function setExistingCrop(id: string, crop: Crop) {
    setExistingImages((prev) => prev.map((img) => (img.id === id ? { ...img, crop } : img)));
  }

  /** 更新某张新增图片的裁剪参数 */
  function setNewCrop(url: string, crop: Crop) {
    setNewImages((prev) => prev.map((it) => (it.url === url ? { ...it, crop } : it)));
  }

  /** 当前裁剪目标对应的图片地址与裁剪值 */
  const cropExisting =
    cropTarget?.kind === "existing" ? existingImages.find((i) => i.id === cropTarget.id) : undefined;
  const cropNew =
    cropTarget?.kind === "new" ? newImages.find((i) => i.url === cropTarget.url) : undefined;
  const cropSrc = cropExisting ? `/api/media/${cropExisting.path}` : (cropNew?.url ?? "");
  const cropValue = cropExisting?.crop ?? cropNew?.crop ?? DEFAULT_CROP;

  /** 确定裁剪：写回对应图片 */
  function applyCrop(crop: Crop) {
    if (cropExisting) setExistingCrop(cropExisting.id, crop);
    else if (cropNew) setNewCrop(cropNew.url, crop);
  }

  /** 是否为当前选中的封面 */
  function isCover(sel: CoverSel): boolean {
    if (!coverSel || !sel) return false;
    if (coverSel.kind === "existing" && sel.kind === "existing") return coverSel.id === sel.id;
    if (coverSel.kind === "new" && sel.kind === "new") return coverSel.item === sel.item;
    return false;
  }

  /** 提交：编辑走 PATCH，新建走 POST；均先把草稿类别落库 */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !categoryId) {
      setError("请填写标题并选择类别");
      return;
    }
    if (overLimit) {
      setError(`标题过长：上限 ${TITLE_MAX_HAN} 字（${TITLE_MAX} 半角）`);
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const finalCategoryId = await resolveCategoryId();

      const fd = new FormData();
      fd.set("title", title);
      fd.set("categoryId", finalCategoryId);
      fd.set("date", date);
      fd.set("location", locationText);
      fd.set("description", description);

      // 封面指代：现有 mediaId 或 new:<index>
      if (coverSel?.kind === "existing") fd.set("coverRef", coverSel.id);
      else if (coverSel?.kind === "new") {
        const idx = newImages.indexOf(coverSel.item);
        if (idx >= 0) fd.set("coverRef", `new:${idx}`);
      }

      for (const it of newImages) fd.append("images", it.file);
      // 新增图片的裁剪参数：与 images[] 同序
      fd.set("newFocal", JSON.stringify(newImages.map((it) => it.crop)));
      if (newAudio) fd.append("audio", newAudio);

      let url = "/api/memories";
      let method = "POST";
      if (mode === "edit") {
        if (!memoryId) throw new Error("缺少回忆 id");
        url = `/api/memories/${memoryId}`;
        method = "PATCH";
        // 保留的现有图片（有序 + 各自裁剪）；封面由 coverRef 表达，顺序即展示顺序
        fd.set(
          "imageMeta",
          JSON.stringify(
            existingImages.map((img) => ({
              id: img.id,
              x: img.crop.x,
              y: img.crop.y,
              scale: img.crop.scale,
            })),
          ),
        );
        if (removeAudio && !newAudio) fd.set("removeAudio", "1");
      }

      const res = await fetch(url, { method, body: fd });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? (mode === "edit" ? "保存失败" : "上传失败"));
      }

      router.refresh();
      clearUploadDraft();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-center text-xs text-white/40">载入中…</p>;
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          <label className="block text-[11px] text-white/45">
            图片（单击设为封面，双击调整展示区域）
          </label>

          <div className="grid grid-cols-3 gap-2">
            {existingImages.map((img) => (
              <ImageTile
                key={img.id}
                src={`/api/media/${img.path}`}
                crop={img.crop}
                cover={isCover({ kind: "existing", id: img.id })}
                onPickCover={() => setCoverSel({ kind: "existing", id: img.id })}
                onOpenCrop={() => {
                  setCropTarget({ kind: "existing", id: img.id });
                  setCropOpen(true);
                }}
                onRemove={() => removeExistingImage(img.id)}
              />
            ))}

            {newImages.map((item) => (
              <ImageTile
                key={item.url}
                src={item.url}
                crop={item.crop}
                cover={isCover({ kind: "new", item })}
                onPickCover={() => setCoverSel({ kind: "new", item })}
                onOpenCrop={() => {
                  setCropTarget({ kind: "new", url: item.url });
                  setCropOpen(true);
                }}
                onRemove={() => removeNewImage(item)}
              />
            ))}
          </div>

          <input
            ref={imagesRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePickImages}
            className={fileCls}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] text-white/45">背景音乐（可选，单条）</label>
          {(existingAudio && !removeAudio) || newAudio ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <span className="min-w-0 flex-1 truncate">
                {newAudio ? `新：${newAudio.name}` : "已设置背景音乐"}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (newAudio) {
                    setNewAudio(null);
                    if (audioRef.current) audioRef.current.value = "";
                  } else {
                    setRemoveAudio(true);
                  }
                }}
                className="shrink-0 text-red-300/80 hover:text-red-300"
              >
                移除
              </button>
            </div>
          ) : (
            <input
              ref={audioRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setNewAudio(f);
                if (f) setRemoveAudio(false);
              }}
              className={fileCls}
            />
          )}
          {removeAudio && !newAudio && (
            <button
              type="button"
              onClick={() => {
                setRemoveAudio(false);
                if (audioRef.current) audioRef.current.value = "";
              }}
              className="text-[11px] text-white/50 hover:text-white"
            >
              ↺ 撤销删除音乐
            </button>
          )}
        </div>

        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题（必填）"
            className={`${inputCls} ${overLimit ? "border-red-400/60" : ""}`}
          />
          <p className={`mt-1 text-right text-[11px] ${overLimit ? "text-red-400" : "text-white/35"}`}>
            {Math.ceil(width / 2)}/{TITLE_MAX_HAN} 字
          </p>
        </div>

        <label className="block text-[11px] text-white/45">类别（即地点）</label>
        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          onRequestNew={(parent) => {
            setNewParent(parent);
            setNewOpen(true);
          }}
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputCls} [color-scheme:dark]`}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述"
          rows={3}
          className={`${inputCls} resize-none`}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="border-t border-white/10 p-3">
        <button
          type="submit"
          disabled={submitting || overLimit}
          className="w-full rounded-full bg-accent-deep/80 py-3 text-sm text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
        >
          {submitting ? "保存中…" : mode === "edit" ? "保存修改" : "保存回忆"}
        </button>
      </div>

      <NewCategoryDialog
        parent={newParent}
        categories={categories}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={handleDraftCreated}
      />

      {cropOpen && cropSrc && (
        <CropDialog
          onOpenChange={setCropOpen}
          src={cropSrc}
          value={cropValue}
          onConfirm={applyCrop}
        />
      )}
    </form>
  );
}
