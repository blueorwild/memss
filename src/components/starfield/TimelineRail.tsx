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
    return { year, label: inward(arcPoint(t), 26) };
  });

  const active = showCursor && activeId ? memories.find((m) => m.id === activeId) : null;
  const activeMi = active ? monthIndex(active.date) : null;
  const cursor = activeMi !== null ? arcPoint(toT(activeMi)) : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px] w-full">
      <svg
        viewBox="0 0 1000 260"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="railGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(150,180,255,0)" />
            <stop offset="50%" stopColor="rgba(150,180,255,0.72)" />
            <stop offset="100%" stopColor="rgba(150,180,255,0)" />
          </linearGradient>
        </defs>
        <polyline
          points={arc.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="url(#railGrad)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "blur(0.4px) drop-shadow(0 0 6px rgba(150,180,255,0.55))" }}
        />
      </svg>

      {yearMarks.map(({ year, label }) => (
        <span
          key={year}
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[15px] tracking-wide"
          style={{
            left: `${r3((label.x / 1000) * 100)}%`,
            top: `${r3((label.y / 260) * 100)}%`,
            color: "rgba(255,255,255,0.85)",
            fontFamily: HAND_FONT,
          }}
        >
          {year}
        </span>
      ))}

      {cursor && (
        <motion.div
          className="absolute"
          initial={false}
          animate={{
            left: `${r3((cursor.x / 1000) * 100)}%`,
            top: `${r3((cursor.y / 260) * 100)}%`,
          }}
          transition={{ type: "spring", stiffness: 110, damping: 22 }}
          style={{ x: "-50%", y: "-50%" }}
        >
          <div
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: 46,
              height: 46,
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255,240,190,0.3) 0%, rgba(255,240,190,0) 70%)",
              filter: "blur(6px)",
            }}
          />
          <div
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: 3,
              height: 30,
              transform: "translate(-50%, -50%)",
              background:
                "linear-gradient(to bottom, rgba(255,249,224,0.15), rgba(255,249,224,1), rgba(255,249,224,0.15))",
              filter: "blur(1px)",
              boxShadow: "0 0 8px rgba(255,238,180,0.9), 0 0 18px rgba(255,238,180,0.5)",
            }}
          />
          <div
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: 16,
              height: 3,
              transform: "translate(-50%, -50%)",
              background:
                "linear-gradient(to right, rgba(255,249,224,0.15), rgba(255,249,224,1), rgba(255,249,224,0.15))",
              filter: "blur(1px)",
              boxShadow: "0 0 8px rgba(255,238,180,0.9), 0 0 18px rgba(255,238,180,0.5)",
            }}
          />
          <div
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: 4,
              height: 4,
              transform: "translate(-50%, -50%)",
              background: "#fffaf0",
            }}
          />
        </motion.div>
      )}
    </div>
  );
}

/**
 * 纵向时间轴（窄屏）：贴左侧竖直排列（下早、上晚），
 * 与纵向滚筒的当前卡片联动显示光标。
 */
export function VerticalTimelineRail({
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

  // 竖直弧线：x 在 0..56（中间略外凸），t=0 在下（早）、t=1 在上（晚）
  const arc = Array.from({ length: 61 }, (_, i) => {
    const t = i / 60;
    return { x: r3(28 + 14 * Math.sin(t * Math.PI)), y: r3(1000 - t * 1000) };
  });

  const years = Array.from(
    new Set(memories.map((m) => (m.date ?? "").slice(0, 4)).filter(Boolean)),
  );
  const yearMarks = years.map((year, i) => {
    const t = years.length === 1 ? 0.5 : i / (years.length - 1);
    return { year, t };
  });

  const active = showCursor && activeId ? memories.find((m) => m.id === activeId) : null;
  const activeMi = active ? monthIndex(active.date) : null;
  const cursorT = activeMi !== null ? toT(activeMi) : null;

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-14">
      <svg
        viewBox="0 0 56 1000"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="vRailGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(150,180,255,0)" />
            <stop offset="50%" stopColor="rgba(150,180,255,0.72)" />
            <stop offset="100%" stopColor="rgba(150,180,255,0)" />
          </linearGradient>
        </defs>
        <polyline
          points={arc.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="url(#vRailGrad)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "blur(0.4px) drop-shadow(0 0 6px rgba(150,180,255,0.55))" }}
        />
      </svg>

      {yearMarks.map(({ year, t }) => (
        <span
          key={year}
          className="absolute text-[12px] tracking-wide"
          style={{
            left: "50%",
            top: `${r3((1 - t) * 100)}%`,
            transform: "translate(-50%, -50%)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: HAND_FONT,
          }}
        >
          {year}
        </span>
      ))}

      {cursorT !== null && (
        <motion.div
          className="absolute"
          initial={false}
          animate={{ left: "50%", top: `${r3((1 - cursorT) * 100)}%` }}
          transition={{ type: "spring", stiffness: 110, damping: 22 }}
          style={{ x: "-50%", y: "-50%" }}
        >
          <div
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: 40,
              height: 40,
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255,240,190,0.3) 0%, rgba(255,240,190,0) 70%)",
              filter: "blur(6px)",
            }}
          />
          <div
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: 26,
              height: 3,
              transform: "translate(-50%, -50%)",
              background:
                "linear-gradient(to right, rgba(255,249,224,0.15), rgba(255,249,224,1), rgba(255,249,224,0.15))",
              filter: "blur(1px)",
              boxShadow: "0 0 8px rgba(255,238,180,0.9), 0 0 18px rgba(255,238,180,0.5)",
            }}
          />
          <div
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: 4,
              height: 4,
              transform: "translate(-50%, -50%)",
              background: "#fffaf0",
            }}
          />
        </motion.div>
      )}
    </div>
  );
}
