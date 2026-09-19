import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/campus/shell";

export const metadata: Metadata = {
  title: "校安智巡 · 图片隐患识别智能体",
  description: "面向校园巡检图片的隐患识别、条款判定、整改闭环与审计留痕工作台。",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png", apple: "/brand-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
