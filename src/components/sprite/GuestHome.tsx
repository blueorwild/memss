import StarBackground from "@/components/starfield/StarBackground";

/**
 * 未登录访客的首页：一片空的星空，只有居中的小精灵（小精灵由根布局常驻，见 Sprite 的居中逻辑）。
 * 刻意不放任何文案与入口——所有交互都收在小精灵面板里。
 */
export default function GuestHome() {
  return (
    <div className="relative h-dvh overflow-hidden text-white">
      <StarBackground />
    </div>
  );
}
