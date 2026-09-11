"use client";

import { motion } from "framer-motion";
import { hashSeed, mulberry32 } from "@/lib/layout-seed";
import type { CategoryWithCount } from "@/lib/db/queries";

function scatterPos(index: number, total: number, id: string) {
  const rnd = mulberry32(hashSeed(`scatter:${id}`));
  const GA = 137.508 * (Math.PI / 180);
  const t = (index + 0.5) / Math.max(total, 1);
  const r = Math.sqrt(t) * 40;
  const theta = index * GA + (rnd() - 0.5) * 0.6;
  return {
    x: 50 + Math.cos(theta) * r + (rnd() - 0.5) * 8,
    y: 50 + Math.sin(theta) * r + (rnd() - 0.5) * 8,
  };
}

/** 星星白色呼吸粒子参数：固定种子保证 SSR 与客户端一致，中等密度（5 颗/星） */
const starRand = mulberry32(hashSeed("star-particles"));
const STAR_PARTICLES = Array.from({ length: 12 }, () => ({
  dx: (starRand() - 0.5) * 52,
  dy: (starRand() - 0.5) * 52,
  dur: 2.4 + starRand() * 2,
  delay: starRand() * 2.5,
  size: 1.5 + starRand() * 1.5,
}));

export default function CategoryStars({
  items,
  onSelect,
  zoomedId,
  mode,
}: {
  items: CategoryWithCount[];
  onSelect: (id: string, e: React.MouseEvent) => void;
  zoomedId: string | null;
  mode: "arc" | "scatter";
}) {
  const n = items.length;
  const spread = Math.min(760, 200 * n);

  return (
    <div className="relative h-full w-full">
      {items.map((c, i) => {
        const clickable = c.memoryCount > 0;
        const isZoomed = zoomedId === c.id;

        let position: React.CSSProperties;
        if (mode === "scatter") {
          const p = scatterPos(i, n, c.id);
          position = {
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
          };
        } else {
          const t = n === 1 ? 0.5 : i / (n - 1);
          const x = n === 1 ? 0 : (t - 0.5) * spread;
          const y = n === 1 ? 0 : Math.sin(t * Math.PI) * -52;
          position = {
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
          };
        }

        return (
          <div key={c.id} className="absolute" style={position}>
            {/* 可点星星的白色呼吸粒子（不拦截点击） */}
            {clickable && (
              <div className="pointer-events-none absolute left-1/2 top-2 h-0 w-0">
                {STAR_PARTICLES.map((p, i) => (
                  <motion.span
                    key={i}
                    className="absolute rounded-full bg-white"
                    style={{
                      width: p.size,
                      height: p.size,
                      boxShadow: "0 0 5px 1.5px rgba(255,255,255,0.85)",
                    }}
                    animate={{
                      x: [0, p.dx],
                      y: [0, p.dy],
                      opacity: [0, 0.9, 0],
                      scale: [0.5, 1, 0.3],
                    }}
                    transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
                  />
                ))}
              </div>
            )}
            <motion.button
              type="button"
              disabled={!clickable}
              onClick={(e) => clickable && onSelect(c.id, e)}
              className="group flex flex-col items-center outline-none"
              animate={
                clickable
                  ? { opacity: isZoomed ? 0 : 1, scale: isZoomed ? 1.8 : 1 }
                  : { opacity: 1, scale: 1 }
              }
              transition={{ duration: isZoomed ? 0.1 : 0.3 }}
            >
              <motion.span
                className={
                  clickable
                    ? "block h-4 w-4 rounded-full bg-white shadow-[0_0_22px_7px_rgba(147,197,253,0.55)]"
                    : "block h-2.5 w-2.5 rounded-full bg-white/25"
                }
                animate={clickable ? { scale: [1, 1.35, 1], opacity: [0.85, 1, 0.85] } : {}}
                transition={
                  clickable ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : {}
                }
              />
              <span
                className={
                  clickable
                    ? "mt-3 text-sm text-white/80 transition-colors group-hover:text-white"
                    : "mt-3 text-xs text-white/35"
                }
              >
                {c.name}
              </span>
              {clickable && (
                <span className="mt-0.5 text-[10px] text-white/35">{c.memoryCount} 段回忆</span>
              )}
            </motion.button>
          </div>
        );
      })}

      {items.length === 0 && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-white/35">
          这里没有更细的分类
        </p>
      )}
    </div>
  );
}
