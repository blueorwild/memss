import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sprite from "@/components/sprite/Sprite";
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
  title: "回忆星空",
  description: "以星空承载个人回忆，并常驻可对话的悬浮小精灵。",
};

/** 移动端视口：铺满安全区（viewport-fit=cover），主题色取星空底色 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05060a",
  // 软键盘弹出时收缩布局视口（Android），避免输入框被键盘遮住
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* 全局悬浮小精灵（跨页面常驻） */}
        <Sprite />
      </body>
    </html>
  );
}
