"use client";

import { useState } from "react";
import { useCampusStore, useLocations } from "@/lib/campus/store";
import { formatTime, LevelBadge, PageHeader, ClauseBox } from "./bits";

function sourceLabel(source?: string) {
  if (source === "camera") return "摄像头";
  if (source === "upload") return "现场上传";
  if (source === "video") return "视频截帧";
  if (source === "voice") return "语音口报";
  if (source === "sample") return "示例画面";
  return "现场识别";
}

export default function AuditView() {
  const { findings, observations, cards } = useCampusStore();
  const locations = useLocations();
  const [activeId, setActiveId] = useState(findings[0]?.id ?? "");
  const finding = findings.find((item) => item.id === (activeId || findings[0]?.id));
  const observation = observations.find((item) => item.id === finding?.observationId);
  const location = locations.find((item) => item.id === finding?.locationId);
  const card = cards.find((item) => item.id === finding?.cardId);

  return (
    <div className="page-stack split-page">
      <PageHeader kicker="AUDIT" title="审计中心" desc="查询历史识别记录，核对结论和条款依据。" />
      <div className="split-grid">
        <section className="panel">
          <header className="panel-head">
            <div>
              <h3>识别记录</h3>
              <p>{findings.length} 条</p>
            </div>
          </header>
          {findings.length === 0 ? (
            <div className="empty-block"><p>完成一次隐患识别后，这里会留下可追溯记录</p></div>
          ) : (
            <div className="list-block">
              {findings.map((item) => {
                const place = locations.find((entry) => entry.id === item.locationId);
                return (
                  <button
                    key={item.id}
                    className={`list-row ${finding?.id === item.id ? "selected" : ""}`}
                    onClick={() => setActiveId(item.id)}
                  >
                    <span className={`dot ${item.level.toLowerCase()}`} />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{place?.short ?? "未知点位"} · {formatTime(item.createdAt)}</small>
                    </div>
                    <LevelBadge level={item.level} />
                  </button>
                );
              })}
            </div>
          )}
        </section>
        <section className="panel">
          <header className="panel-head">
            <div>
              <h3>记录详情</h3>
              <p>{finding ? sourceLabel(observation?.source) : "未选择"}</p>
            </div>
            {finding ? <LevelBadge level={finding.level} /> : null}
          </header>
          {!finding ? (
            <div className="empty-block"><p>选择一条记录查看结论和依据</p></div>
          ) : (
            <div className="result-body">
              {observation?.imageUrl ? (
                <img className="result-image" src={observation.imageUrl} alt={observation.imageName} />
              ) : null}
              <div className="detail-heading">
                <div>
                  <span>{formatTime(finding.createdAt)}</span>
                  <h3>{finding.title}</h3>
                </div>
              </div>
              <p>{finding.description}</p>
              <dl className="meta-grid">
                <div><dt>位置</dt><dd>{location?.name ?? "—"}</dd></div>
                <div><dt>来源</dt><dd>{sourceLabel(observation?.source)}</dd></div>
                <div><dt>责任部门</dt><dd>{finding.department}</dd></div>
                <div><dt>条款编号</dt><dd>{finding.cardId ?? "未命中"}</dd></div>
              </dl>
              {card ? (
                <ClauseBox card={card} />
              ) : (
                <div className="gap-box">
                  <p>这次识别没有绑定条款，结论需人工核对</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
