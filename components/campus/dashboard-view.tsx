"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ScanSearch } from "lucide-react";
import { locationState, useCampusStore, useLocations } from "@/lib/campus/store";
import { formatTime, LevelBadge, PageHeader } from "./bits";
import { CampusSandbox } from "./campus-map";

function wrapHazard(text: string, size = 15) {
  const chars = Array.from(text);
  const lines: string[] = [];
  for (let i = 0; i < chars.length; i += size) lines.push(chars.slice(i, i + size).join(""));
  return lines.join("\n");
}

export default function DashboardView() {
  const store = useCampusStore();
  const locations = useLocations();
  const { findings } = store;
  const [editing, setEditing] = useState(false);
  const open = findings.filter((item) => item.status !== "closed" && item.status !== "false_positive");
  const [focus, setFocus] = useState(locations[0]?.id ?? "");
  const currentLoc = locations.find((item) => item.id === focus) ?? locations[0];
  const current = currentLoc ? locationState(findings, currentLoc.id) : { level: "NORMAL" as const, finding: undefined };
  const timeline = findings
    .filter((item) => item.locationId === currentLoc?.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 8);

  return (
    <div className="page-stack">
      <PageHeader
        title="校园风险态势"
        desc="查看校园各点位的风险情况和未闭环隐患。"
        action={<Link className="primary-action" href="/inspect"><ScanSearch size={16} /> 开始监测</Link>}
      />
      <div className="dash-grid">
        <CampusSandbox
          locations={locations}
          findings={findings}
          focusId={currentLoc?.id}
          editing={editing}
          onEditingChange={setEditing}
          onFocus={setFocus}
        />
        <aside className="panel">
          {!currentLoc ? (
            <div className="empty-block"><p>还没有监测点，请先编辑沙盘添加。</p></div>
          ) : (
            <>
              <header className="panel-head">
                <div>
                  <h3>{currentLoc.short}</h3>
                  <p>{currentLoc.name}</p>
                </div>
                <LevelBadge level={current.level} />
              </header>
              <p className="muted">{currentLoc.schedule}</p>
              <dl className="meta-grid">
                <div><dt>责任部门</dt><dd>{store.matrix[currentLoc.zoneType] ?? currentLoc.department}</dd></div>
                <div><dt>摄像头</dt><dd>{store.cameras.filter((item) => item.locationId === currentLoc.id).map((item) => item.name).join("、") || "未接入"}</dd></div>
              </dl>
              <h4>位置时间线</h4>
              <div className="list-block">
                {timeline.length === 0 ? <div className="empty-block compact"><p>该点位还没有观测。</p></div> : timeline.map((item) => (
                  <div className="list-row" key={item.id}>
                    <span className={`dot ${item.level.toLowerCase()}`} />
                    <div>
                      <strong>{item.changeType} · {item.title}</strong>
                      <small>{formatTime(item.createdAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="action-row">
                <Link className="primary-action" href="/inspect">监测这个位置</Link>
                <Link className="secondary-action" href="/cameras">调用摄像头</Link>
              </div>
            </>
          )}
        </aside>
      </div>
      <section className="panel">
        <header className="panel-head">
          <div><h3>实时预警</h3><p>高风险与证据不足优先</p></div>
          <Link href="/review" className="text-link">人工复核 <ArrowRight size={14} /></Link>
        </header>
        {open.length === 0 ? (
          <div className="empty-block"><p>当前没有未闭环隐患。可到隐患识别监测摄像头。</p></div>
        ) : (
          <div className="alert-table">
            <div className="alert-row is-head">
              <span>时间</span>
              <span>位置</span>
              <span>变化</span>
              <span>隐患</span>
              <span>等级</span>
              <span>证据</span>
            </div>
            {open.slice(0, 8).map((item) => {
              const loc = locations.find((entry) => entry.id === item.locationId);
              return (
                <div className="alert-row" key={item.id}>
                  <span>{formatTime(item.createdAt)}</span>
                  <span>{loc?.short}</span>
                  <span>{item.changeType}{item.recurrence ? " · 复发" : ""}</span>
                  <span className="alert-hazard">{wrapHazard(item.title)}</span>
                  <span><LevelBadge level={item.level} /></span>
                  <span>{item.evidenceComplete ? "完整" : "缺口"}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
