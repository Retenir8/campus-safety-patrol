"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fileToImageUrl, submitRectification, updateTicketStatus, useCampusStore, useLocations } from "@/lib/campus/store";
import { ClauseBox, formatDue, formatTime, LevelBadge, PageHeader } from "./bits";

export default function TicketsView() {
  const { tickets, findings, cards } = useCampusStore();
  const locations = useLocations();
  const [activeId, setActiveId] = useState(tickets[0]?.id ?? "");
  const ticket = tickets.find((item) => item.id === (activeId || tickets[0]?.id));
  const finding = findings.find((item) => item.id === ticket?.findingId);
  const location = locations.find((item) => item.id === ticket?.locationId);
  const card = cards.find((item) => item.id === finding?.cardId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [checks, setChecks] = useState(ticket?.checklist ?? []);
  useEffect(() => {
    setChecks(ticket?.checklist ?? []);
  }, [ticket?.id]);

  function select(id: string) {
    const next = tickets.find((item) => item.id === id);
    setActiveId(id);
    setChecks(next?.checklist ?? []);
  }

  return (
    <div className="page-stack split-page">
      <PageHeader kicker="CLOSED LOOP" title="整改工单" desc="分派整改任务，完成后复核销号。" />
      <div className="split-grid">
        <section className="panel">
          <header className="panel-head"><div><h3>工单池</h3><p>{tickets.filter((item) => item.status !== "closed").length} 张未关闭</p></div></header>
          {tickets.length === 0 ? (
            <div className="empty-block"><p>在识别结果里点「派发工单」</p></div>
          ) : (
            <div className="list-block">
              {tickets.map((item) => (
                <button key={item.id} className={`list-row ${ticket?.id === item.id ? "selected" : ""}`} onClick={() => select(item.id)}>
                  <span className={`dot ${item.status === "closed" ? "normal" : "high"}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.department} · {item.assignee} · 截止 {formatDue(item.dueAt)}</small>
                  </div>
                  <em className="status-tag">{ticketStatus(item.status)}</em>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <header className="panel-head"><div><h3>整改详情</h3><p>{ticket ? ticketStatus(ticket.status) : "未选择"}</p></div></header>
          {!ticket || !finding ? (
            <div className="empty-block"><p>选择一张工单查看整改闭环</p></div>
          ) : (
            <div className="result-body">
              <div className="detail-heading">
                <div>
                  <span>{ticket.id}</span>
                  <h3>{ticket.title}</h3>
                </div>
                <LevelBadge level={finding.level} />
              </div>
              <dl className="meta-grid">
                <div><dt>位置</dt><dd>{location?.name}</dd></div>
                <div><dt>责任部门</dt><dd>{ticket.department}</dd></div>
                <div><dt>时限</dt><dd>{formatTime(ticket.dueAt)}</dd></div>
                <div><dt>条款</dt><dd>{finding.cardId ?? "—"}</dd></div>
              </dl>
              <p>{finding.description}</p>
              {card ? <ClauseBox card={card} /> : null}
              <div className="action-row">
                {ticket.status === "assigned" ? (
                  <button className="secondary-action" onClick={() => updateTicketStatus(ticket.id, "in_progress")}>开始整改</button>
                ) : null}
              </div>
              <h4>验收 Checklist</h4>
              <div className="check-list">
                {checks.map((item, index) => (
                  <label key={item.item}>
                    <input
                      type="checkbox"
                      checked={item.pass === true}
                      onChange={(event) => {
                        const next = checks.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, pass: event.target.checked } : entry,
                        );
                        setChecks(next);
                      }}
                    />
                    {item.item}
                  </label>
                ))}
              </div>
              <div className="action-row">
                <button className="primary-action" onClick={() => fileRef.current?.click()}>上传整改后照片并复验</button>
                <input
                  ref={fileRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const url = await fileToImageUrl(file);
                    submitRectification(ticket.id, url, checks);
                    const passed = checks.every((item) => item.pass === true);
                    toast.success(passed ? "Checklist 通过，已销号并写入位置记忆" : "已提交复验，仍有未勾选项");
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              {ticket.rectifyImageUrl ? <img className="result-image" src={ticket.rectifyImageUrl} alt="整改后" /> : null}
              {ticket.status === "closed" ? <div className="ok-box">已销号。该位置风险恢复正常，复发将对照历史记录。</div> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ticketStatus(status: string) {
  return { assigned: "已分派", in_progress: "整改中", pending_verify: "待复验", closed: "已销号" }[status] ?? status;
}
