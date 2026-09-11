"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { hashSeed, mulberry32 } from "@/lib/layout-seed";
import type { Category, CategoryWithCount, MemoryCard } from "@/lib/db/queries";
import StarBackground from "./StarBackground";
import Breadcrumb from "./Breadcrumb";
import CategoryStars from "./CategoryStars";
import MemoryCylinder from "./MemoryCylinder";

export default function StarfieldPage({
  path,
  categories,
  memories,
  breadcrumb,
}: {
  path: string[];
  current: Category;
  categories: CategoryWithCount[];
  memories: MemoryCard[];
  breadcrumb: Category[];
}) {
  const router = useRouter();
  const [zoom, setZoom] = useState<{ id: string; x: number; y: number } | null>(null);

  const hasChildren = categories.length > 0;
  const hasMemories = memories.length > 0;

  function goUp() {
    if (path.length <= 1) return;
    router.push(`/star/${path.slice(0, -1).join("/")}`);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && path.length > 1) {
        router.push(`/star/${path.slice(0, -1).join("/")}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, router]);

  function onSelectCategory(id: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setZoom({ id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    window.setTimeout(() => {
      router.push(`/star/${[...path, id].join("/")}`);
    }, 100);
  }

  const spots = useMemo(() => {
    if (!zoom) return [];
    const rnd = mulberry32(hashSeed(`glow:${zoom.id}`));
    return Array.from({ length: 5 }, () => ({
      dx: (rnd() - 0.5) * 320,
      dy: (rnd() - 0.5) * 320,
      size: 140 + rnd() * 200,
      delay: rnd() * 0.03,
    }));
  }, [zoom]);

  return (
    <div className="relative h-screen overflow-hidden text-white">
      <StarBackground />

      <div className="relative z-10 flex h-full flex-col motion-safe:animate-[sceneIn_0.6s_ease-out_both]">
        <header className="flex shrink-0 items-center justify-between px-6 py-5">
          <Breadcrumb items={breadcrumb.map((c) => ({ id: c.id, name: c.name }))} />
          <button
            type="button"
            onClick={goUp}
            disabled={path.length <= 1}
            className="text-sm text-white/60 transition-colors hover:text-white disabled:opacity-30"
          >
            ↑ 上一级
          </button>
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
              className="pointer-events-none fixed inset-0 z-40 bg-[#070a14]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
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
                  "radial-gradient(circle, rgba(215,230,255,0.8) 0%, rgba(150,185,255,0.5) 30%, rgba(120,160,255,0.22) 60%, rgba(120,160,255,0) 80%)",
                filter: "blur(14px)",
                mixBlendMode: "screen",
              }}
              initial={{ scale: 0.2, opacity: 1 }}
              animate={{ scale: 12, opacity: 1 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
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
                    "radial-gradient(circle, rgba(170,200,255,0.4) 0%, rgba(120,160,255,0) 70%)",
                  filter: "blur(18px)",
                  mixBlendMode: "screen",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 5, opacity: 0.7 }}
                transition={{ duration: 0.1, delay: s.delay, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
