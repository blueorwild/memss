"use client";

import { motion } from "framer-motion";
import type { MemoryCard } from "@/lib/db/queries";

const CX = 500;
const CY = 200;
const RX = 462;
const RY = 160;

const HAND_FONT =
  '"Snell Roundhand", "Savoye LET", "Bradley Hand", "Segoe Script", cursive';

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function arcPoint(t: number) {
  const theta = ((180 - t * 180) * Math.PI) / 180;
  return { x: r3(CX + RX * Math.cos(theta)), y: r3(CY - RY * Math.sin(theta)) };
}

function inward(p: { x: number; y: number }, dist: number) {
  const dx = CX - p.x;
  const dy = CY - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: r3(p.x + (dx / len) * dist), y: r3(p.y + (dy / len) * dist) };
}

function monthIndex(date: string | null): number | null {
  if (!date) return null;
  const [y, m] = date.split("-").map(Number);
  if (!y || !m) return null;
  return y * 12 + (m - 1);
}

export default function TimelineRail({
  memories,
  activeId,
  showCursor = false,
}: {
  memories: MemoryCard[];
  activeId?: string | null;
  showCursor?: boolean;
}) {
  const months = memories
    .map((m) => monthIndex(m.date))
    .filter((v): v is number => v !== null);
  if (months.length === 0) return null;

  const minM = Math.min(...months);
  const maxM = Math.max(...months);
  const span = Math.max(1, maxM - minM);
  const toT = (mi: number) => (mi - minM) / span;

  const arc = Array.from({ length: 81 }, (_, i) => arcPoint(i / 80));

  const years = Array.from(
    new Set(memories.map((m) => (m.date ?? "").slice(0, 4)).filter(Boolean)),
  );
  const yearMarks = years.map((year, i) => {
    const t = years.length === 1 ? 0.5 : i / (years.length - 1);
    return { year, label: inward(arcPoint(t), 24) };
  });

  const active = showCursor && activeId ? memories.find((m) => m.id === activeId) : null;
  const activeMi = active ? monthIndex(active.date) : null;
  const cursor = activeMi !== null ? arcPoint(toT(activeMi)) : null;

  return (
    <svg
      viewBox="0 0 1000 260"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[180px] w-full"
    >
      <defs>
        <linearGradient id="railGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(150,180,255,0)" />
          <stop offset="50%" stopColor="rgba(150,180,255,0.5)" />
          <stop offset="100%" stopColor="rgba(150,180,255,0)" />
        </linearGradient>
      </defs>

      <polyline
        points={arc.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="url(#railGrad)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        style={{ filter: "blur(0.4px) drop-shadow(0 0 6px rgba(150,180,255,0.35))" }}
      />
      {yearMarks.map(({ year, label }) => (
        <text
          key={year}
          x={label.x}
          y={label.y}
          fill="rgba(255,255,255,0.65)"
          fontSize="12"
          fontFamily={HAND_FONT}
          textAnchor="middle"
        >
          {year}
        </text>
      ))}
      {cursor && (
        <motion.g
          initial={false}
          animate={{ x: cursor.x, y: cursor.y }}
          transition={{ type: "spring", stiffness: 110, damping: 22 }}
        >
          <circle r="22" fill="rgba(255,240,190,0.2)" style={{ filter: "blur(12px)" }} />
          <circle r="11" fill="rgba(255,246,214,0.4)" style={{ filter: "blur(5px)" }} />
          <path
            d="M 0 -19 L 1.8 -2 L 3.2 0 L 1.8 2 L 0 19 L -1.8 2 L -3.2 0 L -1.8 -2 Z"
            fill="rgba(255,249,224,1)"
            style={{
              filter:
                "blur(0.8px) drop-shadow(0 0 8px rgba(255,238,180,0.9)) drop-shadow(0 0 18px rgba(255,238,180,0.5))",
            }}
          />
          <circle r="3.2" fill="#fffaf0" />
        </motion.g>
      )}
    </svg>
  );
}
