"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { resolveReview, useCampusStore, useLocations } from "@/lib/campus/store";
import type { FindingStatus, ReviewStatus } from "@/lib/campus/types";
import { ClauseBox, formatTime, LevelBadge, PageHeader } from "./bits";

function reviewLabel(status: ReviewStatus) {
  if (status === "approved") return "已确认";
  if (status === "rejected") return "误报";
  if (status === "relabeled") return "已改条款";
  return "待复核";
}

function findingLabel(status: FindingStatus) {
  if (status === "ticketed") return "已派发工单";
  if (status === "confirmed") return "已确认隐患";
  if (status === "false_positive") return "已判定误报";
  if (status === "rectifying") return "整改中";
  if (status === "closed") return "已销号";
  return "待复核";
}

export default function ReviewView() {
  const { reviews, findings, cards, tickets } = useCampusStore();
  const locations = useLocations();
  const ordered = useMemo(
    () => [...reviews].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    }),
    [reviews],
  );
  const [activeId, setActiveId] = useState(ordered.find((item) => item.status === "pending")?.id ?? ordered[0]?.id ?? "");
  const review = reviews.find((item) => item.id === activeId) ?? ordered.find((item) => item.status === "pending") ?? ordered[0];
  const finding = findings.find((item) => item.id === review?.findingId);
  const location = locations.find((item) => item.id === finding?.locationId);
  const card = cards.find((item) => item.id === finding?.cardId);
  const ticket = tickets.find((item) => item.findingId === finding?.id);
  const [note, setNote] = useState("");
  const pendingCount = reviews.filter((item) => item.status === "pending").length;
  const nextPending = ordered.find((item) => item.status === "pending" && item.id !== review?.id);

  function decide(status: ReviewStatus, fallback: string, message: string) {
    if (!review) return;
    resolveReview(review.id, status, note.trim() || fallback);
    setActiveId(review.id);
    setNote("");
    if (status === "approved") toast.success(message);
    else toast.message(message);
  }

  return (
    <div className="page-stack split-page">
      <PageHeader
        title="人工复核"
        desc="对存疑识别结果进行确认或否决。"
      />
      <div className="split-grid">
        <section className="panel">
          <header className="panel-head"><div><h3>复核队列</h3><p>{pendingCount} 条待处理</p></div></header>
          <div className="list-block">
            {ordered.length === 0 ? <div className="empty-block compact"><p>识别时若证据不足，会自动进入这里。</p></div> : ordered.map((item) => {
              const hz = findings.find((entry) => entry.id === item.findingId);
              return (
                <button key={item.id} className={`list-row ${review?.id === item.id ? "selected" : ""}`} onClick={() => { setActiveId(item.id); setNote(""); }}>
                  <div>
                    <strong>{hz?.title ?? item.findingId}</strong>
                    <small>{reviewLabel(item.status)} · {formatTime(item.createdAt)}</small>
                  </div>
                  <em className={`status-tag ${item.status}`}>{reviewLabel(item.status)}</em>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <header className="panel-head"><div><h3>复核详情</h3><p>{review ? reviewLabel(review.status) : "未选择"}</p></div></header>
          {!review || !finding ? <div className="empty-block"><p>选择一条待复核记录</p></div> : (
            <div className="result-body">
              <div className="detail-heading">
                <div>
                  <span>{location?.name ?? "未绑定场景"} · {findingLabel(finding.status)}</span>
                  <h3>{finding.title}</h3>
                </div>
                <LevelBadge level={finding.level} />
              </div>
              {card ? <ClauseBox card={card} /> : <p className="muted">未命中条款</p>}
              {review.status === "pending" ? (
                <>
                  <label className="field"><span>复核意见</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="确认依据或误报原因" /></label>
                  <div className="action-row">
                    <button className="primary-action" onClick={() => decide("approved", "确认隐患", "已确认隐患并派发工单")}>确认隐患</button>
                    <button className="secondary-action" onClick={() => decide("rejected", "误报", "已否决为误报")}>否决误报</button>
                  </div>
                </>
              ) : (
                <div className="review-result">
                  <strong>{review.status === "rejected" ? "已否决为误报" : "已确认隐患"}</strong>
                  <p>
                    {review.status === "rejected"
                      ? "该条已从未闭环隐患中移除，风险等级改为正常。"
                      : ticket
                        ? "已按条款确认隐患，并派发整改工单。"
                        : "已按条款确认隐患。"}
                  </p>
                  {review.note ? <small>{review.note}</small> : null}
                  <div className="action-row">
                    {ticket ? <Link className="primary-action" href="/tickets">查看工单</Link> : null}
                    {nextPending ? (
                      <button className="secondary-action" onClick={() => { setActiveId(nextPending.id); setNote(""); }}>下一条待复核</button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
