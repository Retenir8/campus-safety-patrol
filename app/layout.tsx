import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "校安智巡 2.0 · Campus Safety World Agent",
  description: "校园位置级多模态感知、主动取证与动态风险研判演示系统。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
