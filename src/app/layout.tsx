import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sprite from "@/components/sprite/Sprite";
import { AuthedProvider } from "@/components/sprite/AuthContext";
import { isOwner } from "@/lib/auth";
import { guestBrowseAllowed } from "@/lib/settings";
import { SKY_VOID_HEX } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MemSS",
  description: "以星空承载个人回忆，并常驻可对话的悬浮小精灵。",
};

/** 移动端视口：铺满安全区（viewport-fit=cover），主题色取星空底色 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // 与 globals.css 的 --sky-void 同源（元数据只能用字面量）
  themeColor: SKY_VOID_HEX,
  // 声明深色（输出 <meta name="color-scheme" content="dark">）：移动端深色主题的退出方式
  colorScheme: "dark",
  // 软键盘弹出时收缩布局视口（Android），避免输入框被键盘遮住
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 登录态与「允许访客浏览」都在服务端判定：首屏就是正确的一版，不会闪烁
  const authed = await isOwner();
  const browseOpen = guestBrowseAllowed();
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 登录态要包住 children：页面里的客户端组件（星空页 / 回忆详情）也靠它判断读写权限 */}
        <AuthedProvider value={authed} browseOpen={browseOpen}>
          {children}
          {/* 全局悬浮小精灵（跨页面常驻） */}
          <Sprite authed={authed} />
        </AuthedProvider>
      </body>
    </html>
  );
}
