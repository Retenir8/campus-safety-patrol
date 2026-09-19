"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Bot,
  Camera,
  ClipboardList,
  FileText,
  GitBranch,
  Layers3,
  Menu,
  RefreshCw,
  ScanSearch,
  SquareStack,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { hydrateStore, resetStore, setRole, useCampusStore } from "@/lib/campus/store";
import type { UserRole } from "@/lib/campus/types";

const groups = [
  {
    label: "感知",
    items: [
      { href: "/", label: "风险态势", icon: Layers3, roles: ["inspector", "security", "leader"] },
      { href: "/inspect", label: "隐患识别", icon: ScanSearch, roles: ["inspector", "security"] },
      { href: "/batch", label: "批量任务", icon: SquareStack, roles: ["inspector", "security"] },
      { href: "/cameras", label: "摄像头", icon: Camera, roles: ["inspector", "security"] },
    ],
  },
  {
    label: "研判",
    items: [
      { href: "/agent", label: "研判助手", icon: Bot, roles: ["inspector", "security"] },
      { href: "/knowledge", label: "条款知识库", icon: BookOpen, roles: ["inspector", "security", "leader"] },
      { href: "/review", label: "人工复核", icon: UserCheck, roles: ["security", "leader"] },
    ],
  },
  {
    label: "闭环",
    items: [
      { href: "/tickets", label: "整改工单", icon: ClipboardList, roles: ["inspector", "security", "leader"] },
      { href: "/matrix", label: "责任矩阵", icon: Users, roles: ["security", "leader"] },
      { href: "/reports", label: "报告中心", icon: FileText, roles: ["security", "leader"] },
      { href: "/audit", label: "审计中心", icon: GitBranch, roles: ["security", "leader"] },
    ],
  },
] as const;

const titles: Record<string, string> = {
  "/": "风险态势",
  "/inspect": "隐患识别",
  "/batch": "批量任务",
  "/cameras": "摄像头",
  "/agent": "研判助手",
  "/knowledge": "条款知识库",
  "/review": "人工复核",
  "/tickets": "整改工单",
  "/matrix": "责任矩阵",
  "/reports": "报告中心",
  "/audit": "审计中心",
};

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { hydrateStore(); }, []);
  const store = useCampusStore();
  const openCount = store.findings.filter((item) => item.status !== "closed" && item.status !== "false_positive").length;
  const highCount = store.findings.filter((item) => item.level === "HIGH" && item.status !== "closed" && item.status !== "false_positive").length;
  const title = titles[pathname] ?? "校安智巡";
  const pendingReview = store.reviews.filter((item) => item.status === "pending").length;

  return (
    <div className="app-shell">
      {open ? <button className="nav-scrim" aria-label="关闭导航" onClick={() => setOpen(false)} /> : null}
      <aside className={`side-nav ${open ? "is-open" : ""}`}>
        <div className="brand-block">
          <img className="brand-logo" src="/brand-logo.png" alt="校安智巡" />
          <div>
            <strong>校安智巡</strong>
            <span>校园隐患智能巡检</span>
          </div>
          <button className="icon-button nav-close" onClick={() => setOpen(false)} aria-label="关闭"><X size={18} /></button>
        </div>
        <nav>
          {groups.map((group) => {
            const items = group.items.filter((item) => item.roles.includes(store.role));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <div className="nav-group">{group.label}</div>
                {items.map(({ href, label, icon: Icon }) => {
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`} onClick={() => setOpen(false)}>
                      <Icon size={17} />
                      <span>{label}</span>
                      {href === "/review" && pendingReview ? <em style={{ marginLeft: "auto", fontSize: 11, color: "#0f766e" }}>{pendingReview}</em> : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="打开导航"><Menu size={18} /></button>
            <div>
              <span>校安智巡</span>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="top-actions">
            <select className="role-select" value={store.role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="inspector">巡检员</option>
              <option value="security">保卫处</option>
              <option value="leader">分管领导</option>
            </select>
            <div className={`global-risk ${highCount ? "high" : openCount ? "" : "normal"}`}>
              <Bell size={13} />
              {highCount ? `${highCount} 条高风险` : openCount ? `${openCount} 条待处理` : "运行正常"}
            </div>
            <button className="icon-button" title="清空本地数据" onClick={() => { resetStore(); toast.success("已复位工作台"); }}>
              <RefreshCw size={16} />
            </button>
            <div className="avatar">安</div>
          </div>
        </header>
        <main className="workspace">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
