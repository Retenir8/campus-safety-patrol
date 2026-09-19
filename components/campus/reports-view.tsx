"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { reportTypeLabel } from "@/lib/campus/reports";
import { useCampusStore, useLocations } from "@/lib/campus/store";
import type { ReportType } from "@/lib/campus/types";
import { ClauseBox, LevelBadge, PageHeader } from "./bits";

const typeFilters: { id: "all" | "daily" | "weekly" | "monthly"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "daily", label: "日报" },
  { id: "weekly", label: "周报" },
  { id: "monthly", label: "月报" },
];

export default function ReportsView() {
  const { reports, findings, cards } = useCampusStore();
  const locations = useLocations();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "daily" | "weekly" | "monthly">("all");
  const [activeId, setActiveId] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, "");
    return reports.filter((item) => {
      if (item.type !== "daily" && item.type !== "weekly" && item.type !== "monthly") return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!needle) return true;
      const hay = `${item.title}${item.periodKey ?? ""}${reportTypeLabel(item.type)}`.toLowerCase().replace(/\s+/g, "");
      return hay.includes(needle) || hay.includes(needle.replace(/-/g, ""));
    });
  }, [reports, query, typeFilter]);
  const report = filtered.find((item) => item.id === activeId) ?? filtered[0];
  const rows = findings.filter((item) => report?.findingIds.includes(item.id));

  useEffect(() => {
    if (report && activeId !== report.id) setActiveId(report.id);
  }, [report, activeId]);

  return (
    <div className="page-stack split-page">
      <PageHeader
        title="报告中心"
        desc="每日 0 点生成日报，每周一 0 点生成周报，每月 1 日 0 点生成月报。"
      />
      <div className="split-grid">
        <section className="panel">
          <header className="panel-head"><div><h3>定期报告</h3><p>{filtered.length} 份</p></div></header>
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索日期，如 2026-09-19 或 9月19日" />
          </div>
          <div className="filter-row">
            {typeFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip-btn ${typeFilter === item.id ? "active" : ""}`}
                onClick={() => setTypeFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="empty-block"><p>没有匹配的报告。</p></div>
          ) : (
            <div className="list-block">
              {filtered.map((item) => (
                <button key={item.id} className={`list-row ${report?.id === item.id ? "selected" : ""}`} onClick={() => setActiveId(item.id)}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{reportTypeLabel(item.type)} · {item.findingIds.length} 条隐患</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
        <article className="panel">
          <header className="panel-head"><div><h3>报告正文</h3><p>{report ? `${rows.length} 条隐患` : "未选择"}</p></div></header>
          {!report ? (
            <div className="empty-block"><p>选择一份报告查看内容</p></div>
          ) : (
            <div className="report-paper">
              <header>
                <span>青澜大学 · 校安智巡</span>
                <h3>{report.title}</h3>
                <p>{reportTypeLabel(report.type as ReportType)} · 共 {rows.length} 条识别结果</p>
              </header>
              <div className="report-stats">
                <span>高风险 {rows.filter((item) => item.level === "HIGH").length}</span>
                <span>待补证 {rows.filter((item) => item.level === "WATCH").length}</span>
                <span>已销号 {rows.filter((item) => item.status === "closed").length}</span>
                <span>误报 {rows.filter((item) => item.status === "false_positive").length}</span>
              </div>
              <div className="report-stats">
                <span>位置维 {new Set(rows.map((item) => item.locationId)).size} 个点位</span>
                <span>条款维 {new Set(rows.map((item) => item.cardId).filter(Boolean)).size} 条</span>
                <span>等级维 HIGH {rows.filter((item) => item.level === "HIGH").length} / WATCH {rows.filter((item) => item.level === "WATCH").length}</span>
                <span>部门维 {new Set(rows.map((item) => item.department)).size} 个责任主体</span>
              </div>
              {rows.length === 0 ? <p className="muted">该周期内没有识别记录。</p> : rows.map((item) => {
                const location = locations.find((entry) => entry.id === item.locationId);
                const card = cards.find((entry) => entry.id === item.cardId);
                return (
                  <section className="report-item" key={item.id}>
                    <div className="report-item-head">
                      <h4>{item.title}</h4>
                      <LevelBadge level={item.level} />
                    </div>
                    <p>{item.description}</p>
                    <p className="muted">{location?.name} · {item.department}</p>
                    {card ? <ClauseBox card={card} /> : <p className="muted">未命中条款</p>}
                  </section>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
