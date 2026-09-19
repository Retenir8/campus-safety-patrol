"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { setCardStatus, upsertCard, useCampusStore } from "@/lib/campus/store";
import { zoneCatalog } from "@/lib/campus/seed";
import type { KnowledgeCard, RiskLevel } from "@/lib/campus/types";
import { PageHeader } from "./bits";

const emptyCard = (): KnowledgeCard => ({
  id: `SCHOOL-${Date.now().toString(36).toUpperCase()}`,
  source: "校本补充规定",
  clause: "新增",
  title: "",
  text: "",
  domain: "消防安全",
  zoneType: "evacuation_corridor",
  riskType: "custom",
  baseLevel: "MEDIUM",
  judgmentType: "semantic",
  visualCues: [],
  negativeCues: [],
  keywords: [],
  fixes: [],
  checklist: [],
  version: "v1.0",
  status: "DRAFT",
});

export default function KnowledgeView() {
  const { cards } = useCampusStore();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");
  const [draft, setDraft] = useState<KnowledgeCard | null>(null);
  const filtered = useMemo(
    () => cards.filter((card) => `${card.title}${card.id}${card.domain}${card.zoneType}${card.text}`.includes(query)),
    [cards, query],
  );
  const selected = cards.find((card) => card.id === selectedId) ?? filtered[0];

  function saveDraft() {
    if (!draft?.title || !draft.text) {
      toast.error("请填写隐患名称和条款原文");
      return;
    }
    const keywords = draft.keywords.length ? draft.keywords : draft.title.split(/[、，\s]/).filter(Boolean);
    upsertCard({ ...draft, keywords, status: "ACTIVE" });
    setSelectedId(draft.id);
    setDraft(null);
    toast.success("条款卡已激活，下一次识别立即生效，无需重新训练");
  }

  return (
    <div className="page-stack knowledge-page">
      <PageHeader kicker="CLAUSE CARDS" title="条款知识库" desc="查看和管理用于隐患判定的安全条款。"
        action={
          <button className="primary-action" onClick={() => setDraft(emptyCard())}>
            <Plus size={16} /> 新建条款卡
          </button>
        }
      />
      <div className="knowledge-grid">
        <aside className="panel knowledge-list">
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索条款、区域或隐患类型" />
          </div>
          <p className="muted" style={{ margin: "0 4px 8px", flex: "none" }}>{filtered.length} 条条款</p>
          <div className="card-scroll">
            {filtered.map((card) => (
              <button
                key={card.id}
                className={`knowledge-item ${selected?.id === card.id ? "selected" : ""}`}
                onClick={() => { setSelectedId(card.id); setDraft(null); }}
              >
                <div>
                  <strong>{card.title}</strong>
                  <small>{card.source} · {card.clause}</small>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <article className={`panel knowledge-detail ${draft ? "is-editing" : ""}`}>
          {draft ? (
            <div className="form-stack">
              <h3>新增知识卡</h3>
              <label className="field"><span>隐患名称</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <label className="field"><span>条款原文</span><textarea value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} /></label>
              <div className="field-row">
                <label className="field">
                  <span>适用区域</span>
                  <select value={draft.zoneType} onChange={(event) => setDraft({ ...draft, zoneType: event.target.value })}>
                    <option value="evacuation_corridor">疏散通道</option>
                    <option value="laboratory">实验室</option>
                    <option value="dorm_lobby">宿舍门厅</option>
                    <option value="canteen">食堂后厨</option>
                    <option value="electrical">配电房</option>
                    <option value="construction">施工区域</option>
                    <option value="outdoor_parking">室外划线区</option>
                    <option value="gate">出入口</option>
                  </select>
                </label>
                <label className="field">
                  <span>风险等级</span>
                  <select value={draft.baseLevel} onChange={(event) => setDraft({ ...draft, baseLevel: event.target.value as RiskLevel })}>
                    <option value="HIGH">高风险</option>
                    <option value="MEDIUM">中风险</option>
                    <option value="WATCH">待观察</option>
                    <option value="NORMAL">负例 / 正常</option>
                  </select>
                </label>
              </div>
              <label className="field"><span>视觉线索（顿号分隔）</span><input onChange={(event) => setDraft({ ...draft, visualCues: event.target.value.split("、").filter(Boolean) })} placeholder="堆物、出口标识" /></label>
              <label className="field"><span>匹配关键词（顿号分隔，用于图片文件名/场景）</span><input onChange={(event) => setDraft({ ...draft, keywords: event.target.value.split("、").filter(Boolean) })} placeholder="围挡、临边" /></label>
              <label className="field"><span>整改建议（顿号分隔）</span><input onChange={(event) => setDraft({ ...draft, fixes: event.target.value.split("、").filter(Boolean) })} /></label>
              <button className="primary-action" onClick={saveDraft}>保存并立即生效</button>
            </div>
          ) : selected ? (
            <>
              <div className="detail-heading">
                <div>
                  <span>{selected.source} · {selected.clause}</span>
                  <h3>{selected.title}</h3>
                </div>
                <div className="detail-heading-tags">
                  <em className={`status-tag ${selected.status === "ACTIVE" ? "active" : ""}`}>{selected.status === "ACTIVE" ? "启用中" : "已停用"}</em>
                  {selected.status === "ACTIVE" ? (
                    <button className="secondary-action" onClick={() => setCardStatus(selected.id, "DRAFT")}>停用</button>
                  ) : (
                    <button className="primary-action" onClick={() => { setCardStatus(selected.id, "ACTIVE"); toast.success("已激活"); }}>激活</button>
                  )}
                </div>
              </div>
              <div className="knowledge-body">
                <section className="knowledge-section">
                  <h4>条款原文</h4>
                  <p>{selected.text || "暂无"}</p>
                </section>
                <dl className="meta-grid">
                  <div><dt>领域</dt><dd>{selected.domain || "—"}</dd></div>
                  <div><dt>适用区域</dt><dd>{zoneCatalog.find((item) => item.id === selected.zoneType)?.label ?? selected.zoneType}</dd></div>
                  <div><dt>风险等级</dt><dd>{selected.baseLevel === "HIGH" ? "高风险" : selected.baseLevel === "MEDIUM" ? "中风险" : selected.baseLevel === "WATCH" ? "待观察" : "正常"}</dd></div>
                  <div><dt>版本</dt><dd>{selected.version || "—"}</dd></div>
                </dl>
                <section className="knowledge-section">
                  <h4>视觉线索</h4>
                  <div className="tag-row">{selected.visualCues.length ? selected.visualCues.map((item) => <span key={item}>{item}</span>) : <span className="placeholder">暂无</span>}</div>
                </section>
                <section className="knowledge-section">
                  <h4>反向证据</h4>
                  <div className="tag-row">{selected.negativeCues.length ? selected.negativeCues.map((item) => <span key={item}>{item}</span>) : <span className="placeholder">暂无</span>}</div>
                </section>
                <section className="knowledge-section">
                  <h4>整改与验收</h4>
                  <div className="tag-row">{selected.fixes.length ? selected.fixes.map((item) => <span key={item}>{item}</span>) : <span className="placeholder">暂无</span>}</div>
                </section>
              </div>
            </>
          ) : null}
        </article>
      </div>
    </div>
  );
}
