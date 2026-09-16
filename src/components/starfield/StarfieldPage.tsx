"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { hashSeed, mulberry32 } from "@/lib/layout-seed";
import type { Category, CategoryWithCount, MemoryCard } from "@/lib/db/queries";
import { shouldIgnorePageShortcut } from "@/lib/dom";
import { useSpriteStore } from "@/store/sprite";
import StarBackground from "./StarBackground";
import Breadcrumb from "./Breadcrumb";
import CategoryEditDialog from "./CategoryEditDialog";
import CategoryStars from "./CategoryStars";
import MemoryCylinder from "./MemoryCylinder";

export default function StarfieldPage({
  path,
  current,
  currentCount,
  categories,
  memories,
  breadcrumb,
}: {
  path: string[];
  current: Category;
  currentCount: number;
  categories: CategoryWithCount[];
  memories: MemoryCard[];
  breadcrumb: Category[];
}) {
  const router = useRouter();
  const navRequest = useSpriteStore((s) => s.navRequest);
  const clearNavRequest = useSpriteStore((s) => s.clearNavRequest);
  const [zoom, setZoom] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  const hasChildren = categories.length > 0;
  const hasMemories = memories.length > 0;

  /** 删除当前类别：purge=一并遗忘其下回忆，move=回忆迁移到父类别 */
  async function doDelete(mode: "purge" | "move") {
    if (deleting) return;
    setDeleting(true);
    setDelError(null);
    try {
      const res = await fetch(`/api/categories/${current.id}?mode=${mode}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "删除失败");
      }
      router.push(`/star/${path.slice(0, -1).join("/")}`);
      router.refresh();
    } catch (e) {
      setDelError(e instanceof Error ? e.message : "删除失败");
      setDeleting(false);
    }
  }

  function goUp() {
    if (path.length <= 1) return;
    router.push(`/star/${path.slice(0, -1).join("/")}`);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 输入中 / 有弹层 / 小精灵面板打开时不抢按键（避免 Esc 在编辑面板里误返回）
      if (shouldIgnorePageShortcut(e)) return;
      if (e.key === "Escape" && path.length > 1) {
        router.push(`/star/${path.slice(0, -1).join("/")}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, router]);

  // 响应小精灵的导航请求：从屏幕中心播放迷雾过渡后跳转
  useEffect(() => {
    if (!navRequest) return;
    const showFog = window.setTimeout(() => {
      setZoom({ id: "nav", x: window.innerWidth / 2, y: window.innerHeight / 2 });
      useSpriteStore.getState().setSceneTransitioning(true);
      window.setTimeout(() => useSpriteStore.getState().setSceneTransitioning(false), 600);
    }, 0);
    const go = window.setTimeout(() => {
      router.push(navRequest);
      clearNavRequest();
    }, 120);
    return () => {
      window.clearTimeout(showFog);
      window.clearTimeout(go);
    };
  }, [navRequest, router, clearNavRequest]);

  function onSelectCategory(id: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setZoom({ id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    useSpriteStore.getState().setSceneTransitioning(true);
    window.setTimeout(() => useSpriteStore.getState().setSceneTransitioning(false), 600);
    window.setTimeout(() => {
      router.push(`/star/${[...path, id].join("/")}`);
    }, 120);
  }

  const spots = useMemo(() => {
    if (!zoom) return [];
    const rnd = mulberry32(hashSeed(`glow:${zoom.id}`));
    return Array.from({ length: 3 }, () => ({
      dx: (rnd() - 0.5) * 300,
      dy: (rnd() - 0.5) * 300,
      size: 120 + rnd() * 160,
      delay: rnd() * 0.03,
    }));
  }, [zoom]);

  return (
    <div className="relative h-dvh overflow-hidden text-white">
      <StarBackground />

      <div className="relative z-10 flex h-full flex-col motion-safe:animate-[sceneIn_0.6s_ease-out_both]">
        <header className="flex shrink-0 items-start justify-between gap-4 px-4 py-3 pt-[calc(var(--safe-top)+12px)] sm:px-6 sm:py-5 sm:pt-5">
          <div className="flex flex-col gap-2">
            <Breadcrumb items={breadcrumb.map((c) => ({ id: c.id, name: c.name }))} />
            {path.length > 1 && (
              <button
                type="button"
                onClick={goUp}
                className="inline-flex w-fit items-center gap-1 text-sm text-white/60 transition-colors hover:text-white"
              >
                ← 返回
              </button>
            )}
          </div>
          {current.parentId && (
            <div className="flex shrink-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => setDelOpen(true)}
                className="text-sm text-red-300/80 transition-colors hover:text-red-300"
              >
                遗忘
              </button>
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {hasChildren && (
            <section
              className={hasMemories ? "relative min-h-0 flex-[3]" : "relative min-h-0 flex-1"}
            >
              <CategoryStars
                items={categories}
                onSelect={onSelectCategory}
                zoomedId={zoom?.id ?? null}
                mode={hasMemories ? "arc" : "scatter"}
              />
            </section>
          )}

          {hasMemories && (
            <section
              className={hasChildren ? "relative min-h-0 flex-[7]" : "relative min-h-0 flex-1"}
            >
              <MemoryCylinder memories={memories} />
            </section>
          )}

          {!hasChildren && !hasMemories && (
            <div className="flex flex-1 items-center justify-center text-sm text-white/40">
              这里还是一片空的星空
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {zoom && (
          <>
            <motion.div
              key="fog-bg"
              className="pointer-events-none fixed inset-0 z-40 bg-veil"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            />
            <motion.div
              key="fog-core"
              className="pointer-events-none fixed z-50"
              style={{
                left: zoom.x,
                top: zoom.y,
                translateX: "-50%",
                translateY: "-50%",
                width: 340,
                height: 340,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgb(var(--sky-star) / 0.45) 0%, rgb(var(--sky-beam) / 0.22) 26%, rgb(var(--sky-beam) / 0.08) 48%, rgb(var(--sky-beam) / 0.02) 66%, rgb(var(--sky-beam) / 0) 82%)",
                willChange: "transform, opacity",
                transform: "translateZ(0)",
              }}
              initial={{ scale: 0.2, opacity: 1 }}
              animate={{ scale: 7, opacity: 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            />
            {spots.map((s, i) => (
              <motion.div
                key={`spot-${i}`}
                className="pointer-events-none fixed z-50"
                style={{
                  left: zoom.x + s.dx,
                  top: zoom.y + s.dy,
                  translateX: "-50%",
                  translateY: "-50%",
                  width: s.size,
                  height: s.size,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgb(var(--sky-star) / 0.22) 0%, rgb(var(--sky-beam) / 0.08) 40%, rgb(var(--sky-beam) / 0) 72%)",
                  willChange: "transform, opacity",
                  transform: "translateZ(0)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 4, opacity: 0.3 }}
                transition={{ duration: 0.18, delay: s.delay, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* 编辑此分类：改名 / 移动到其它父级（保存后刷新路由） */}
      <CategoryEditDialog
        current={current}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={(newPath) => {
          setEditOpen(false);
          // 移动后当前 URL 失效：跳到新的完整路径；仅改名则原地刷新
          if (newPath) router.push(`/star/${newPath.join("/")}`);
          else router.refresh();
        }}
      />

      {/* 删除此分类：确认弹层（有回忆时可选「迁移」或「一并遗忘」） */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogTitle>删除「{current.name}」？</DialogTitle>
          <DialogDescription>
            「{current.name}」及其下属子分类
            {currentCount > 0
              ? `将被删除，其中包含 ${currentCount} 条回忆，请选择处理方式。`
              : "将被永久删除。"}
          </DialogDescription>

          {currentCount > 0 ? (
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => doDelete("move")}
                disabled={deleting}
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/85 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                迁移到上一级（保留回忆）
              </button>
              <button
                type="button"
                onClick={() => doDelete("purge")}
                disabled={deleting}
                className="rounded-full bg-red-500/80 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500 disabled:opacity-40"
              >
                一并遗忘（删除回忆）
              </button>
              <button
                type="button"
                onClick={() => setDelOpen(false)}
                className="rounded-full px-4 py-2 text-sm text-white/50 transition-colors hover:text-white"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="mt-5 flex justify-end gap-2">
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                >
                  取消
                </button>
              </DialogClose>
              <button
                type="button"
                onClick={() => doDelete("purge")}
                disabled={deleting}
                className="rounded-full bg-red-500/80 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500 disabled:opacity-40"
              >
                {deleting ? "删除中…" : "确认删除"}
              </button>
            </div>
          )}

          {delError && <p className="mt-2 text-xs text-red-400">{delError}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
