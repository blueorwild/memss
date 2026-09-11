"use client";

import Link from "next/link";

type Item = { id: string; name: string };

export default function Breadcrumb({ items }: { items: Item[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-white/60">
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        const href = `/star/${items
          .slice(0, i + 1)
          .map((x) => x.id)
          .join("/")}`;
        return (
          <span key={it.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-white/25">/</span>}
            {isLast ? (
              <span className="text-white">{it.name}</span>
            ) : (
              <Link href={href} className="transition-colors hover:text-white">
                {it.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
