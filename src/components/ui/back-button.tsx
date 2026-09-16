"use client";

/**
 * 极简返回按钮：只有一个「弯曲左箭头」符号，不带文字（现代简约风格）。
 * 用 SVG 而非「←/↩」字形，保证各平台笔画一致。
 */
export default function BackButton({ onClick, label = "返回" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="-my-1 flex h-8 w-8 items-center justify-center rounded-full text-white/60 outline-none transition-colors hover:bg-white/10 hover:text-white"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-5 w-5"
      >
        {/* 箭头 */}
        <path d="M9 14 4 9l5-5" />
        {/* 弯曲的回转轨迹 */}
        <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
      </svg>
    </button>
  );
}
