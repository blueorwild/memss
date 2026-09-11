/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cylinderSlot, radiusForCount, timelineScatter } from "@/lib/layout-seed";
import type { MemoryCard } from "@/lib/db/queries";
import TimelineRail from "./TimelineRail";

const FLAT_THRESHOLD = 5;

export default function MemoryCylinder({ memories }: { memories: MemoryCard[] }) {
  if (memories.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/35">
        这个分类下还没有回忆
      </div>
    );
  }
  return memories.length <= FLAT_THRESHOLD ? (
    <FlatMemories memories={memories} />
  ) : (
    <CylinderMemories memories={memories} />
  );
}

function MemoryCardFace({ memory }: { memory: MemoryCard }) {
  return (
    <div className="block h-[140px] w-[200px] overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-2xl">
      {memory.cover ? (
        <img
          src={`/api/media/${memory.cover}`}
          alt={memory.title}
          draggable={false}
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
  const [rotation, setRotation] = useState(0);

  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const movedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const radius = radiusForCount(memories.length);
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
          transform: `translateZ(-${radius}px) rotateY(${rotation}deg)`,
        }}
      >
        {slots.map(({ m, slot }) => {
          const facing = Math.cos(((slot.angle + rotation) * Math.PI) / 180);
          const intensity = (facing + 1) / 2;
          const front = facing > 0.25;
          return (
            <div
              key={m.id}
              className="absolute left-0 top-0"
              style={{
                transform: `translate(-50%, -50%) rotateY(${slot.angle}deg) translateZ(${slot.radius}px) translateY(${slot.y}px) rotate(${slot.rotate}deg) scale(${slot.scale})`,
                opacity: 0.35 + 0.65 * intensity,
                filter: `brightness(${0.68 + 0.32 * intensity})`,
                pointerEvents: front ? "auto" : "none",
                zIndex: Math.round(intensity * 1000),
              }}
            >
              <button
                type="button"
                onClick={() => openMemory(m.id)}
                className="block cursor-pointer outline-none"
              >
                <MemoryCardFace memory={m} />
                <p className="mt-2 w-[200px] truncate text-center text-xs text-white/70">
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
