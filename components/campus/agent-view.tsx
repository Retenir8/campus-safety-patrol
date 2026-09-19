"use client";

import { useState } from "react";
import { Bot, Mic, Send } from "lucide-react";
import { toast } from "sonner";
import { periodLabel } from "@/lib/campus/engine";
import { createTicket, probeFinding, useCampusStore, useLocations } from "@/lib/campus/store";
import { LevelBadge, PageHeader } from "./bits";

type ChatMsg = { role: "user" | "agent"; text: string };

export default function AgentView() {
  const store = useCampusStore();
  const locations = useLocations();
  const finding = store.findings[0];
  const location = locations.find((item) => item.id === finding?.locationId);
  const card = store.cards.find((item) => item.id === finding?.cardId);
  const [input, setInput] = useState("");
  const intro = finding
    ? `当前绑定位置「${location?.name}」。最新结论：${finding.title}，等级 ${finding.level}。你可以问依据、补证、派单或整改建议。`
    : "还没有监测记录。请先到「隐患识别」对照摄像头画面。";
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "agent", text: intro }]);
  const [boundId, setBoundId] = useState(finding?.id);
  if (finding?.id !== boundId) {
    setBoundId(finding?.id);
    setMessages([{ role: "agent", text: intro }]);
  }

  function reply(text: string) {
    if (!finding || !location) {
      return "我现在没有可对话的位置对象。请先完成一次图片识别。";
    }
    if (/补证|摄像头|证据/.test(text)) {
      if (finding.evidenceGap) {
        probeFinding(finding.id);
        toast.success("已发起摄像头补证");
        return `证据缺口是：${finding.evidenceGap}。我已经调用 ${location.cameraIds[0] ?? "附近摄像头"} 补拍。补证后会重新核验，不再用低置信度敷衍。`;
      }
      return "当前证据已经完整，不必再调摄像头。";
    }
    if (/条款|依据|哪一条/.test(text)) {
      return card
        ? `依据 ${card.id}《${card.source}》：${card.text} 大模型只在召回的候选条款里判定，不会凭空编造条文。`
        : "这次没有命中激活条款卡。可以在知识库补一张卡后再识别。";
    }
    if (/派单|工单|谁来改/.test(text)) {
      if (finding.level === "NORMAL") return "这是负例 / 正常状态，不需要派单。";
      createTicket(finding.id);
      toast.success("已派单");
      return `已派给${finding.department}，时限 ${finding.deadlineHours} 小时。整改完成后按条款 Checklist 复验才能销号。`;
    }
    if (/整改|怎么改|建议/.test(text)) {
      return card ? `整改建议：${card.fixes.join("；")}` : "请先确认隐患类型。";
    }
    return `${location.short}当前为${periodLabel(finding.period)}，风险 ${finding.level}，分数 ${finding.score}。场景：${finding.sceneSummary}。${finding.evidenceGap ?? "证据完整。"}`;
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    const answer = reply(text);
    setMessages((current) => [...current, { role: "user", text }, { role: "agent", text: answer }]);
    setInput("");
  }

  return (
    <div className="page-stack split-page">
      <PageHeader kicker="LOCATION AGENT" title="研判助手" desc="针对已识别隐患追问依据、补证或派发工单。" />
      <div className="agent-grid">
        <aside className="panel">
          <div className="agent-side">
            <div className="brand-mark"><Bot size={20} /></div>
            <h3>{location?.short ?? "未绑定位置"}</h3>
            <p>{location?.name ?? "请先识别一张巡检照片"}</p>
            {finding ? <LevelBadge level={finding.level} /> : null}
            {finding ? <p className="muted">{finding.description}</p> : null}
          </div>
        </aside>
        <section className="panel chat-panel">
          <div className="chat-stream">
            {messages.map((item, index) => (
              <div key={index} className={`chat-msg ${item.role}`}>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              value={input}
              placeholder="例如：依据哪一条？要不要补证？谁来改？"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && send()}
            />
            <button
              className="icon-button"
              onClick={() => {
                const Speech = (window as Window & { webkitSpeechRecognition?: new () => { lang: string; start: () => void; onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null } }).webkitSpeechRecognition;
                if (!Speech) {
                  setInput("依据哪一条？");
                  toast.message("当前浏览器无语音接口，已填入常用问句");
                  return;
                }
                const rec = new Speech();
                rec.lang = "zh-CN";
                rec.onresult = (event) => setInput(event.results[0][0].transcript);
                rec.start();
              }}
              aria-label="语音"
            >
              <Mic size={16} />
            </button>
            <button className="primary-action" onClick={send}><Send size={16} /></button>
          </div>
        </section>
      </div>
    </div>
  );
}
