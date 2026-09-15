/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  cylinderSlot,
  r3,
  radiusForCount,
  timelineScatter,
  verticalCylinderSlot,
  verticalRadiusForCount,
} from "@/lib/layout-seed";
import { useElementSize } from "@/lib/use-element-size";
import { useIsMobile } from "@/lib/use-media-query";
import type { MemoryCard } from "@/lib/db/queries";
import TimelineRail, { VerticalTimelineRail } from "./TimelineRail";

const FLAT_THRESHOLD = 5;

export default function MemoryCylinder({ memories }: { memories: MemoryCard[] }) {
  const isMobile = useIsMobile();
  if (memories.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/35">
        这个分类下还没有回忆
      </div>
    );
  }
  // 窄屏统一走纵向滚筒：横向滚筒在手机上半径远大于屏宽，卡片会大量出屏
  if (isMobile) return <VerticalCylinder memories={memories} />;
  return memories.length <= FLAT_THRESHOLD ? (
    <FlatMemories memories={memories} />
  ) : (
    <CylinderMemories memories={memories} />
  );
}

/** 回忆卡片外观：白色常驻微光 + hover 增强（平面 / 滚筒 / 纵向滚筒共用） */
function MemoryCardFace({ memory, compact = false }: { memory: MemoryCard; compact?: boolean }) {
  return (
    <div
      className={`block overflow-hidden rounded-xl border border-white/15 bg-black/40 ring-1 ring-white/20 shadow-[0_0_18px_2px_rgba(255,255,255,0.18)] transition-shadow duration-300 hover:ring-white/45 hover:shadow-[0_0_28px_6px_rgba(255,255,255,0.32)] ${
        compact ? "h-[105px] w-[150px]" : "h-[140px] w-[200px]"
      }`}
    >
      {memory.cover ? (
        <img
          src={`/api/media/${memory.cover}`}
          alt={memory.title}
          draggable={false}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm text-white/50">
          {memory.title}
        </span>
      )}
    </div>
  );
}

function FlatMemories({ memories }: { memories: MemoryCard[] }) {
  const router = useRouter();
  const slots = useMemo(
    () => memories.map((m, i) => ({ m, slot: timelineScatter(m.seed, i, memories.length) })),
    [memories],
  );

  return (
    <div className="absolute inset-0">
      {slots.map(({ m, slot }) => (
        <div
          key={m.id}
          className="absolute"
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            transform: `translate(-50%, -50%) rotate(${slot.rotate}deg) scale(${slot.scale})`,
          }}
        >
          <motion.div
            animate={{ y: [0, -slot.floatAmp, 0, slot.floatAmp, 0] }}
            transition={{
              duration: 5 + (slot.floatPhase % 3),
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={() => router.push(`/memory/${m.id}`)}
              className="block cursor-pointer outline-none"
            >
              <MemoryCardFace memory={m} />
              <p className="mt-2 w-[200px] truncate text-center text-xs text-white/70">
                {m.title}
              </p>
            </motion.button>
          </motion.div>
        </div>
      ))}
      <TimelineRail memories={memories} />
    </div>
  );
}

function CylinderMemories({ memories }: { memories: MemoryCard[] }) {
  const router = useRouter();
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [rotation, setRotation] = useState(0);

  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const movedRef = useRef(false);

  // 矮容器（手机横屏）→ 紧凑卡片并收敛半径，避免卡片超出上下边界
  const compact = size.h > 0 && size.h < 480;
  const radius = useMemo(() => {
    const base = radiusForCount(memories.length);
    if (!compact) return base;
    return Math.max(200, Math.round(Math.min(base, size.h * 0.95)));
  }, [memories.length, compact, size.h]);
  const slots = useMemo(
    () =>
      memories.map((m, i) => ({
        m,
        slot: cylinderSlot(m.seed, i, memories.length, radius),
      })),
    [memories, radius],
  );

  const activeId = useMemo(() => {
    if (slots.length === 0) return null;
    let best = slots[0].m.id;
    let bestF = -Infinity;
    for (const { m, slot } of slots) {
      const f = Math.cos(((slot.angle + rotation) * Math.PI) / 180);
      if (f > bestF) {
        bestF = f;
        best = m.id;
      }
    }
    return best;
  }, [slots, rotation]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 0.02) {
          rotationRef.current += velocityRef.current;
          velocityRef.current *= 0.94;
        } else {
          velocityRef.current = 0;
          rotationRef.current -= 0.05;
        }
      }
      setRotation(rotationRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    movedRef.current = false;
    lastXRef.current = e.clientX;
    velocityRef.current = 0;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    if (Math.abs(dx) > 2) {
      movedRef.current = true;
      containerRef.current?.setPointerCapture(e.pointerId);
    }
    rotationRef.current += dx * 0.3;
    velocityRef.current = dx * 0.3;
  }

  function endDrag(e: React.PointerEvent) {
    draggingRef.current = false;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }

  function openMemory(id: string) {
    if (movedRef.current) return;
    router.push(`/memory/${id}`);
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none select-none"
      style={{ perspective: "1200px", cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transformStyle: "preserve-3d",
          transform: `translateZ(-${radius}px) rotateY(${r3(rotation)}deg)`,
        }}
      >
        {slots.map(({ m, slot }) => {
          const facing = Math.cos(((slot.angle + rotation) * Math.PI) / 180);
          // 背面卡片不渲染（约省一半节点）；接近阈值时先淡出，避免闪现
          if (facing < -0.5) return null;
          const intensity = (facing + 1) / 2;
          const front = facing > 0.25;
          const fade = facing < 0 ? Math.max(0, (facing + 0.5) / 0.5) : 1;
          return (
            <div
              key={m.id}
              className="absolute left-0 top-0"
              style={{
                transform: `translate(-50%, -50%) rotateY(${slot.angle}deg) translateZ(${slot.radius}px) translateY(${r3(compact ? slot.y * 0.45 : slot.y)}px) rotate(${slot.rotate}deg) scale(${slot.scale})`,
                opacity: r3((0.2 + 0.8 * intensity) * fade),
                filter: `brightness(${r3(0.61 + 0.39 * intensity)})`,
                pointerEvents: front ? "auto" : "none",
                zIndex: Math.round(intensity * 1000),
              }}
            >
              <button
                type="button"
                onClick={() => openMemory(m.id)}
                className="block cursor-pointer outline-none"
              >
                <MemoryCardFace memory={m} compact={compact} />
                <p
                  className={`mt-2 truncate text-center text-xs text-white/70 ${
                    compact ? "w-[150px]" : "w-[200px]"
                  }`}
                >
                  {m.title}
                </p>
              </button>
            </div>
          );
        })}
      </div>

      <TimelineRail memories={memories} activeId={activeId} showCursor />
    </div>
  );
}

/**
 * 纵向滚筒（窄屏）：卡片绕 X 轴排在竖直圆柱上，上下拖拽切换。
 * 背面卡片不渲染（手机降载），半径按容器高度收敛避免转到屏外。
 */
function VerticalCylinder({ memories }: { memories: MemoryCard[] }) {
  const router = useRouter();
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [rotation, setRotation] = useState(0);

  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastYRef = useRef(0);
  const movedRef = useRef(false);
  // 自动旋转的帧计数（每 2 帧推进一次 ≈ 1.5°/秒）
  const frameRef = useRef(0);

  // 半径同时受「卡片数」与「容器高度」约束：卡片多要更大，但不能超出屏幕
  const radius = useMemo(() => {
    const byCount = verticalRadiusForCount(memories.length);
    const byHeight = (size.h || 420) * 0.42;
    return Math.round(Math.max(180, Math.min(byCount, byHeight)));
  }, [memories.length, size.h]);

  const slots = useMemo(
    () =>
      memories.map((m, i) => ({
        m,
        slot: verticalCylinderSlot(m.seed, i, memories.length, radius),
      })),
    [memories, radius],
  );

  /** 当前正对观察者的卡片（纵向星轨光标跟随它） */
  const activeId = useMemo(() => {
    if (slots.length === 0) return null;
    let best = slots[0].m.id;
    let bestF = -Infinity;
    for (const { m, slot } of slots) {
      const f = Math.cos(((slot.angle + rotation) * Math.PI) / 180);
      if (f > bestF) {
        bestF = f;
        best = m.id;
      }
    }
    return best;
  }, [slots, rotation]);

  // 惯性滑行 + 静止后自动缓缓上滚（每 2 帧推进一次，约 1.5°/秒）
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 0.02) {
          rotationRef.current += velocityRef.current;
          velocityRef.current *= 0.94;
          setRotation(rotationRef.current);
        } else {
          velocityRef.current = 0;
          frameRef.current += 1;
          if (frameRef.current % 2 === 0) {
            // rotation 增大 => 卡片向上移动 => 更新的内容从下方进入
            rotationRef.current += 0.05;
            setRotation(rotationRef.current);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    movedRef.current = false;
    lastYRef.current = e.clientY;
    velocityRef.current = 0;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dy = e.clientY - lastYRef.current;
    lastYRef.current = e.clientY;
    if (Math.abs(dy) > 2) {
      movedRef.current = true;
      containerRef.current?.setPointerCapture(e.pointerId);
    }
    // 手指下拉时内容跟随下移（rotation 减小）
    rotationRef.current -= dy * 0.28;
    velocityRef.current = -dy * 0.28;
    setRotation(rotationRef.current);
  }

  function endDrag(e: React.PointerEvent) {
    draggingRef.current = false;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }

  function openMemory(id: string) {
    if (movedRef.current) return;
    router.push(`/memory/${id}`);
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none select-none"
      style={{ perspective: "1000px", cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transformStyle: "preserve-3d",
          transform: `translateZ(-${radius}px) rotateX(${r3(rotation)}deg)`,
        }}
      >
        {slots.map(({ m, slot }) => {
          const facing = Math.cos(((slot.angle + rotation) * Math.PI) / 180);
          // 背面卡片不渲染：手机上通常能省掉一半以上的节点
          if (facing < -0.5) return null;
          const intensity = (facing + 1) / 2;
          const front = facing > 0.25;
          // 接近剔除阈值时先淡出，避免卡片「闪现」
          const fade = facing < 0 ? Math.max(0, (facing + 0.5) / 0.5) : 1;
          return (
            <div
              key={m.id}
              className="absolute left-0 top-0"
              style={{
                transform: `translate(-50%, -50%) rotateX(${slot.angle}deg) translateZ(${slot.radius}px) translateX(${slot.x}px) rotate(${slot.rotate}deg) scale(${slot.scale})`,
                opacity: r3((0.2 + 0.8 * intensity) * fade),
                filter: `brightness(${r3(0.61 + 0.39 * intensity)})`,
                pointerEvents: front ? "auto" : "none",
                zIndex: Math.round(intensity * 1000),
              }}
            >
              <button
                type="button"
                onClick={() => openMemory(m.id)}
                className="block cursor-pointer outline-none"
              >
                <MemoryCardFace memory={m} compact />
                <p className="mt-2 w-[150px] truncate text-center text-xs text-white/70">
                  {m.title}
                </p>
              </button>
            </div>
          );
        })}
      </div>

      <VerticalTimelineRail memories={memories} activeId={activeId} showCursor />
    </div>
  );
}
