"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, BookOpen, Bot, Box, Building2, Camera, Check, ChevronDown, ChevronRight, CircleDashed, Clock3, GitBranch, History, Image as ImageIcon, Layers3, MapPin, Menu, MessageSquareText, Mic2, Network, Play, Plus, Radio, RefreshCw, Route, Search, Send, ShieldCheck, Sparkles, Upload, Video, X, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

type View = "dashboard" | "knowledge" | "governance" | "cameras" | "agent";
type Risk = "WATCH" | "HIGH" | "NORMAL";
type RunStage = "idle" | "gap" | "probe" | "verify" | "done";
type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown }, options?: { signal?: AbortSignal }) => void | Promise<void> };

const nav = [
  { id: "dashboard", href: "/", label: "风险态势", icon: Layers3 },
  { id: "cameras", href: "/cameras", label: "视频感知", icon: Camera },
  { id: "agent", href: "/agent", label: "智能体", icon: Bot },
  { id: "knowledge", href: "/knowledge", label: "知识库", icon: BookOpen },
  { id: "governance", href: "/governance", label: "治理轨迹", icon: GitBranch },
] as const;

const scenarioLocations = [
  { id: "corridor", name: "教学楼 B · 二层东侧", short: "B2 东侧通道", level: "WATCH", score: 64, status: "证据待补", x: "64%", y: "38%" },
  { id: "lab", name: "实验楼 · 302 实验室", short: "实验室 302", level: "HIGH", score: 86, status: "时空异常", x: "27%", y: "27%" },
  { id: "dorm", name: "学生公寓 3 号楼 · 门厅", short: "3 号楼门厅", level: "MEDIUM", score: 71, status: "室内车辆", x: "76%", y: "67%" },
  { id: "gate", name: "南门 · 值守区", short: "南门值守区", level: "NORMAL", score: 18, status: "持续感知", x: "44%", y: "79%" },
] as const;

const graphNodes = ["ingest", "privacy", "scene_fusion", "grounding", "retrieve", "hypothesis", "evidence_gap", "active_probe", "verify", "risk", "action", "human_gate", "memory", "publish"];

const knowledgeCards = [
  { id: "GB-55037-4.2.1", source: "建筑防火通用规范", title: "疏散通道与安全出口应保持畅通", domain: "消防安全", zone: "疏散通道", level: "HIGH", active: true, version: "v2.1" },
  { id: "LAB-OPS-7.3", source: "校级实验室安全管理办法", title: "无人值守期间不得运行高风险设备", domain: "实验室安全", zone: "实验室", level: "HIGH", active: true, version: "v1.4" },
  { id: "DORM-FIRE-3.6", source: "学生公寓消防安全细则", title: "电动车不得进入建筑内部或占用公共走道", domain: "消防安全", zone: "宿舍门厅", level: "HIGH", active: true, version: "v3.0" },
  { id: "TEMP-NEW-01", source: "校内临时治理要求", title: "楼梯前室不得临时堆放快递与纸箱", domain: "空间治理", zone: "楼梯前室", level: "MEDIUM", active: false, version: "草稿" },
];

function getStoredRisk(): Risk {
  if (typeof window === "undefined") return "WATCH";
  return (window.localStorage.getItem("campus-demo-risk") as Risk) || "WATCH";
}

export default function CampusApp({ view }: { view: View }) {
  const [risk, setRiskState] = useState<Risk>("WATCH");
  const [stage, setStage] = useState<RunStage>("idle");
  const [selectedLocation, setSelectedLocation] = useState("corridor");
  const [mobileNav, setMobileNav] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setRiskState(getStoredRisk());
    const onStorage = () => setRiskState(getStoredRisk());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const setRisk = (next: Risk) => {
    setRiskState(next);
    window.localStorage.setItem("campus-demo-risk", next);
    window.dispatchEvent(new Event("storage"));
  };
  const startProbe = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRisk("WATCH"); setStage("gap");
    toast.info("智能体发现证据缺口，正在规划补证");
    timers.current.push(setTimeout(() => setStage("probe"), 900));
    timers.current.push(setTimeout(() => setStage("verify"), 1900));
    timers.current.push(setTimeout(() => { setStage("done"); setRisk("HIGH"); toast.error("跨模态验证完成：风险升级为 HIGH"); }, 3000));
  };
  const resetDemo = () => {
    timers.current.forEach(clearTimeout); setStage("idle"); setRisk("WATCH"); setSelectedLocation("corridor");
    toast.success("演示已复位，可重新运行固定剧本");
  };

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext["registerTool"]>[0]) => {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); } catch { /* Unsupported preview contexts can ignore WebMCP. */ }
    };
    register({ name: "start_location_risk_probe", title: "启动位置风险补证", description: "为教学楼 B 二层东侧疏散通道启动固定主动取证流程，并更新页面中的研判状态。", inputSchema: { type: "object", properties: { location_id: { type: "string", const: "loc_teaching_b_2f_east" } }, required: ["location_id"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { const value = input as { location_id?: string }; if (value?.location_id !== "loc_teaching_b_2f_east") throw new Error("Unsupported location_id"); startProbe(); return { trace_id: "tr_20260914_00031", status: "RUNNING" }; } });
    register({ name: "reset_campus_safety_demo", title: "复位校安智巡演示", description: "把固定演示剧本恢复到 WATCH 与证据不足的初始状态。", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input as object).length) throw new Error("Expected an empty object"); resetDemo(); return { risk: "WATCH", stage: "idle" }; } });
    return () => lifecycle.abort();
  });

  return <TooltipProvider><div className="app-shell">
    <Sidebar view={view} open={mobileNav} onClose={() => setMobileNav(false)} />
    <div className="app-main">
      <Header view={view} risk={risk} onMenu={() => setMobileNav(true)} onReset={resetDemo} />
      <main className="workspace">
        {view === "dashboard" && <Dashboard risk={risk} stage={stage} selected={selectedLocation} onSelect={(id) => { setSelectedLocation(id); if (window.innerWidth < 1100) setDetailOpen(true); }} onProbe={startProbe} onOpenDetail={() => setDetailOpen(true)} />}
        {view === "knowledge" && <Knowledge onNew={() => setNewCardOpen(true)} />}
        {view === "governance" && <Governance risk={risk} stage={stage} onRun={startProbe} />}
        {view === "cameras" && <Cameras risk={risk} onAnalyze={startProbe} />}
        {view === "agent" && <AgentChat risk={risk} stage={stage} onProbe={startProbe} onRectified={() => { setRisk("NORMAL"); setStage("done"); toast.success("整改证据已写入位置记忆，风险恢复正常"); }} />}
      </main>
    </div>
    <LocationSheet open={detailOpen} onOpenChange={setDetailOpen} risk={risk} stage={stage} onProbe={startProbe} />
    <NewCardDialog open={newCardOpen} onOpenChange={setNewCardOpen} />
    <Toaster position="top-center" richColors />
  </div></TooltipProvider>;
}

function Sidebar({ view, open, onClose }: { view: View; open: boolean; onClose: () => void }) {
  return <>{open && <button className="nav-scrim" aria-label="关闭导航" onClick={onClose} />}<aside className={`side-nav ${open ? "is-open" : ""}`} aria-label="主导航">
    <div className="brand-block"><div className="brand-mark"><ShieldCheck size={25} strokeWidth={2.2} /></div><div><strong>校安智巡</strong><span>Campus Sentinel</span></div><button className="icon-button nav-close" onClick={onClose} aria-label="关闭"><X size={18} /></button></div>
    <div className="system-pill"><span className="live-dot" /> 世界状态在线 <em>LIVE</em></div>
    <nav><p className="nav-eyebrow">工作台</p>{nav.map(({ id, href, label, icon: Icon }) => <Link key={id} href={href} className={`nav-item ${view === id ? "active" : ""}`} onClick={onClose}><Icon size={19} /><span>{label}</span>{view === id && <span className="nav-active-line" />}</Link>)}</nav>
    <div className="nav-scenario"><span className="scenario-kicker">当前演示剧本</span><strong>疏散通道堆物</strong><p>Scenario A · 固定数据</p><div><span>01</span><i /><span>09</span></div></div>
    <div className="nav-footer"><Radio size={15} /> Mock Provider <span>v2.0</span></div>
  </aside></>;
}

function Header({ view, risk, onMenu, onReset }: { view: View; risk: Risk; onMenu: () => void; onReset: () => void }) {
  const title = { dashboard: "校园风险态势", knowledge: "条款知识库", governance: "智能体治理", cameras: "视频感知中心", agent: "主动研判智能体" }[view];
  return <header className="topbar"><div className="topbar-title"><button className="icon-button menu-button" onClick={onMenu} aria-label="打开导航"><Menu size={20} /></button><div><span>校安智巡 2.0</span><h1>{title}</h1></div></div><div className="top-actions"><div className="time-chip"><Clock3 size={15} /><span>2026-09-14</span><strong>09:31:12</strong></div><div className={`global-risk ${risk.toLowerCase()}`}><span /> {risk === "WATCH" ? "待补证" : risk === "HIGH" ? "高风险" : "已恢复"}</div><Tooltip><TooltipTrigger asChild><button className="icon-button" onClick={onReset} aria-label="复位演示"><RefreshCw size={17} /></button></TooltipTrigger><TooltipContent>复位固定演示</TooltipContent></Tooltip><div className="avatar">安</div></div></header>;
}

function Dashboard({ risk, stage, selected, onSelect, onProbe, onOpenDetail }: { risk: Risk; stage: RunStage; selected: string; onSelect: (id: string) => void; onProbe: () => void; onOpenDetail: () => void }) {
  const completeness = risk === "HIGH" ? 92 : risk === "NORMAL" ? 96 : 58;
  return <div className="dashboard-grid">
    <section className="stats-rail"><div className="section-intro"><span className="eyebrow">WORLD STATE</span><h2>校园安全总览</h2><p>共 128 个位置持续建模</p></div><div className="risk-score-card"><div className="score-head"><span>全校风险指数</span><Activity size={17} /></div><div className="score-value"><strong>67</strong><span>/ 100</span><em>+8.2%</em></div><div className="sparkline" aria-label="24小时风险指数趋势">{[28,42,34,58,48,72,62,86,74,92].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div><div className="score-foot"><span>过去 24 小时</span><strong>中度关注</strong></div></div>
      <div className="risk-counts"><RiskCount color="red" value="3" label="高风险" note="较昨日 +1" /><RiskCount color="orange" value="7" label="中风险" note="持续研判" /><RiskCount color="yellow" value="12" label="待观察" note="5 项待补证" /><RiskCount color="green" value="106" label="正常" note="82.8%" /></div>
      <div className="attention-list"><div className="panel-heading"><span>重点关注</span><button>全部 <ChevronRight size={14} /></button></div><button className="attention-item selected" onClick={() => onSelect("corridor")}><span className={`risk-beacon ${risk.toLowerCase()}`} /><div><strong>教学楼 B · 二层东侧</strong><small>{risk === "HIGH" ? "已确认占用疏散空间" : "证据完整度 58%"}</small></div><b>{risk === "HIGH" ? "高" : "待"}</b></button><button className="attention-item" onClick={() => onSelect("lab")}><span className="risk-beacon high" /><div><strong>实验楼 · 302 实验室</strong><small>夜间无人值守运行</small></div><b>高</b></button><button className="attention-item" onClick={() => onSelect("dorm")}><span className="risk-beacon medium" /><div><strong>学生公寓 3 号楼</strong><small>疑似电动车入楼</small></div><b>中</b></button></div>
    </section>
    <section className="campus-panel"><div className="map-toolbar"><div><span className="eyebrow">DIGITAL TWIN · CAMPUS</span><h2>位置风险世界模型</h2></div><div className="map-controls"><button className="active"><Box size={15} /> 立体</button><button><Route size={15} /> 路径</button><button><Network size={15} /> 图层</button></div></div><CampusMap risk={risk} selected={selected} onSelect={onSelect} /><div className="map-legend"><span><i className="legend-ring active" />主动感知</span><span><i className="legend-ring gap" />证据不足</span><span><i className="legend-ring conflict" />跨模态冲突</span></div><div className="map-status"><span className="live-dot" /> 数据流正常 <b>42 CAMERAS</b><b>128 LOCATIONS</b></div></section>
    <aside className="detail-rail"><div className="location-top"><div className="location-icon"><MapPin size={20} /></div><div><span>LOC-B2-EAST-021</span><h2>教学楼 B 二层<br />东侧疏散通道</h2></div><button className="icon-button" onClick={onOpenDetail} aria-label="展开详情"><ArrowRight size={17} /></button></div><div className={`risk-verdict ${risk.toLowerCase()}`}><span>{risk === "HIGH" ? "HIGH RISK" : risk === "NORMAL" ? "NORMAL" : "WATCH"}</span><strong>{risk === "HIGH" ? "确认疏散通道被占用" : risk === "NORMAL" ? "整改验证通过" : "疑似疏散通道堆物"}</strong><p>{risk === "HIGH" ? "摄像头补证已确认纸箱进入安全出口有效疏散区域。" : risk === "NORMAL" ? "新证据显示障碍物已移除，通道恢复畅通。" : "单图不足以确认纸箱与出口的整体空间关系。"}</p></div><div className="metric-pair"><Metric label="风险分" value={risk === "HIGH" ? "88" : risk === "NORMAL" ? "12" : "64"} suffix="/100" /><Metric label="置信度" value={risk === "HIGH" ? "91" : "76"} suffix="%" /></div><div className="completeness"><div><span>证据完整度</span><strong>{completeness}%</strong></div><Progress value={completeness} className="evidence-progress" /></div><div className="evidence-strip"><Evidence icon={ImageIcon} label="图像" on /><Evidence icon={Video} label="视频" on={risk === "HIGH"} /><Evidence icon={Mic2} label="声音" /><Evidence icon={Clock3} label="时段" on /><Evidence icon={History} label="历史" on /><Evidence icon={BookOpen} label="知识" on /></div>{risk === "WATCH" ? <div className="gap-card"><div><CircleDashed size={18} /><strong>缺失证据</strong></div><p>无法确认安全出口与纸箱整体空间关系</p><button className="primary-action" onClick={onProbe}><Sparkles size={17} /> 让智能体补证</button></div> : <div className={`result-card ${risk.toLowerCase()}`}><div><Check size={18} /><strong>{risk === "HIGH" ? "跨模态验证完成" : "整改闭环完成"}</strong></div><p>{risk === "HIGH" ? "图片 + 视频 + 位置 + 时段 + 条款已完成联合研判。" : "风险状态已写入位置长期记忆。"}</p><Link href="/governance">查看治理轨迹 <ArrowRight size={14} /></Link></div>}<div className="quick-links"><Link href="/cameras"><Camera size={16} /> 打开摄像头</Link><Link href="/agent"><MessageSquareText size={16} /> 进入对话</Link></div></aside>
    <section className="event-stream"><div className="event-title"><span className="live-dot" /><strong>实时事件流</strong><span>LIVE EVENT STREAM</span></div><Event time="09:31:09" type="gap" title="发现证据缺口" desc="缺少出口与堆物整体空间关系" active={stage === "gap"} /><Event time="09:31:11" type="probe" title="调用摄像头" desc="cam_b2_east_01 · 前后 15 秒" active={stage === "probe"} /><Event time="09:31:14" type="verify" title="跨模态验证" desc="位置语义与视频关系一致" active={stage === "verify"} /><Event time="09:31:16" type="risk" title="风险状态更新" desc={risk === "HIGH" ? "WATCH → HIGH · 0.88" : "等待新证据返回"} active={stage === "done"} /></section>
  </div>;
}

function CampusMap({ risk, selected, onSelect }: { risk: Risk; selected: string; onSelect: (id: string) => void }) {
  return <div className="campus-map" role="img" aria-label="校园立体位置风险图"><div className="map-grid" /><div className="road road-a" /><div className="road road-b" /><div className="pond" /><Building className="building-a" label="实验楼" floors={3} /><Building className="building-b" label="教学楼 B" floors={5} /><Building className="building-c" label="学生公寓" floors={4} /><Building className="building-d" label="图书馆" floors={2} /><div className="field"><span>运动场</span>{[1,2,3,4].map(i=><i key={i}/>)}</div>{scenarioLocations.map((loc) => <button key={loc.id} className={`map-pin ${loc.id === selected ? "selected" : ""} ${loc.id === "corridor" ? risk.toLowerCase() : loc.level.toLowerCase()}`} style={{left:loc.x, top:loc.y}} onClick={() => onSelect(loc.id)} aria-label={`${loc.name} ${loc.status}`}><span className="pin-wave" /><span className="pin-core"><MapPin size={17} /></span><em>{loc.id === "corridor" && risk === "HIGH" ? "88" : loc.score}</em>{loc.id === selected && <div className="pin-label"><b>{loc.short}</b><span>{loc.id === "corridor" ? (risk === "HIGH" ? "确认高风险" : "Evidence incomplete") : loc.status}</span></div>}</button>)}<div className="north">N<span>↑</span></div></div>;
}

function Building({ className, label, floors }: { className: string; label: string; floors: number }) { return <div className={`iso-building ${className}`}><div className="roof" /><div className="front">{Array.from({length:floors}).map((_,i)=><i key={i} />)}</div><div className="side" /><span>{label}</span></div>; }
function RiskCount({ color, value, label, note }: { color: string; value: string; label: string; note: string }) { return <div className="risk-count"><span className={`count-mark ${color}`} /><strong>{value}</strong><div><b>{label}</b><small>{note}</small></div></div>; }
function Metric({ label, value, suffix }: { label: string; value: string; suffix: string }) { return <div className="metric"><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>; }
function Evidence({ icon: Icon, label, on = false }: { icon: typeof ImageIcon; label: string; on?: boolean }) { return <div className={on ? "on" : ""}><Icon size={15} /><span>{label}</span></div>; }
function Event({ time, type, title, desc, active }: { time: string; type: string; title: string; desc: string; active: boolean }) { return <div className={`event-item ${active ? "active" : ""}`}><time>{time}</time><span className={`event-icon ${type}`} /><div><strong>{title}</strong><small>{desc}</small></div>{active && <em>RUNNING</em>}</div>; }

function Knowledge({ onNew }: { onNew: () => void }) {
  const [selected, setSelected] = useState(knowledgeCards[0]);
  const [activeDraft, setActiveDraft] = useState(false);
  const [query, setQuery] = useState("");
  const cards = knowledgeCards.filter(c => `${c.title}${c.source}${c.domain}`.includes(query));
  return <div className="page-stack"><PageHeader eyebrow="CLAUSE-LEVEL KNOWLEDGE" title="条款知识库" desc="把法规拆成智能体可检索、可引用、可立即生效的知识卡片。" action={<button className="primary-action compact" onClick={onNew}><Plus size={16}/> 新建条款卡</button>} />
    <div className="knowledge-layout"><aside className="filter-panel panel"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索条款或风险类型" /></div><Filter title="知识领域" options={["全部领域  24","消防安全  11","实验室安全  7","校舍设施  6"]}/><Filter title="适用区域" options={["疏散通道","实验室","宿舍门厅","室外空间"]}/><Filter title="状态" options={["已激活  22","草稿  2"]}/></aside>
      <section className="card-list panel"><div className="list-head"><strong>知识卡</strong><span>{cards.length} 条结果</span><button>版本 <ChevronDown size={14}/></button></div>{cards.map(card=><button key={card.id} className={`knowledge-item ${selected.id===card.id?"selected":""}`} onClick={()=>setSelected(card)}><div><span className={`status-tag ${card.active||activeDraft?"active":"draft"}`}>{card.active||activeDraft?"ACTIVE":"DRAFT"}</span><em>{card.version}</em></div><strong>{card.title}</strong><p>{card.source} · {card.id}</p><footer><span>{card.domain}</span><span>{card.zone}</span><b className={card.level.toLowerCase()}>{card.level}</b></footer></button>)}</section>
      <article className="knowledge-detail panel"><div className="detail-heading"><div><span>CLAUSE DETAIL</span><h2>{selected.title}</h2></div><button className="icon-button"><Box size={17}/></button></div><div className="detail-meta"><span>法规来源<strong>{selected.source}</strong></span><span>条款编号<strong>{selected.id}</strong></span><span>适用位置<strong>{selected.zone}</strong></span></div><KnowledgeSection title="条款原文"><p>疏散走道、楼梯间及安全出口应保持畅通，不得堆放影响人员安全疏散的物品。</p></KnowledgeSection><KnowledgeSection title="视觉线索"><div className="cue-row"><span>纸箱 / 快递堆物</span><span>出口标识</span><span>有效通行宽度</span></div></KnowledgeSection><KnowledgeSection title="反向证据"><ul><li>物品位于通道边界之外</li><li>有效疏散宽度仍满足要求</li><li>临时作业且有人现场值守</li></ul></KnowledgeSection><KnowledgeSection title="整改清单"><ol><li><Check size={14}/>移除疏散路径内障碍物</li><li><Check size={14}/>补拍包含出口标识的全景证据</li><li><Check size={14}/>复核有效通行宽度</li></ol></KnowledgeSection>{!selected.active && !activeDraft ? <button className="primary-action full" onClick={()=>{setActiveDraft(true);toast.success("条款卡已激活，下一次智能体运行立即生效")}}><Zap size={17}/> Activate · 立即生效</button>:<div className="activated-banner"><Check size={17}/> 已激活 · Agent 下一次 Run 可检索</div>}</article>
    </div></div>;
}

function Filter({ title, options }: { title: string; options: string[] }) { return <div className="filter-group"><strong>{title}</strong>{options.map((o,i)=><label key={o}><input type={i?"checkbox":"radio"} name={title} defaultChecked={!i}/><span>{o}</span></label>)}</div>; }
function KnowledgeSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="knowledge-section"><h3>{title}</h3>{children}</section>; }

function Governance({ risk, stage, onRun }: { risk: Risk; stage: RunStage; onRun: () => void }) {
  const progressIndex = stage === "idle" ? 6 : stage === "gap" ? 6 : stage === "probe" ? 7 : stage === "verify" ? 8 : 13;
  return <div className="page-stack"><PageHeader eyebrow="OBSERVABLE AGENT" title="智能体治理轨迹" desc="展示节点状态、条件分支与决策依据，不暴露私有思维链。" action={<button className="primary-action compact" onClick={onRun}><Play size={15}/> 重放当前轨迹</button>} />
    <div className="governance-kpis"><Kpi label="调用次数" value="1,286" note="今日 +84"/><Kpi label="平均延迟" value="1.8s" note="P95 3.2s"/><Kpi label="证据完整度" value={risk==="HIGH"?"92%":"58%"} note="目标 ≥ 85%"/><Kpi label="人工复核率" value="8.4%" note="低于阈值"/></div>
    <div className="governance-layout"><section className="graph-panel panel"><div className="panel-title"><div><span>LANGGRAPH DAG</span><h2>风险研判流程</h2></div><div className="node-legend"><span className="success">SUCCESS</span><span className="running">RUNNING</span><span className="pending">PENDING</span></div></div><div className="agent-graph">{graphNodes.map((node,i)=><div key={node} className={`graph-node ${i<progressIndex||(stage==="done"&&i<=progressIndex)?"success":i===progressIndex&&stage!=="idle"?"running":"pending"} ${node==="evidence_gap"||node==="active_probe"?"emphasis":""}`}><span>{i+1}</span><strong>{node}</strong>{i<graphNodes.length-1&&<i className="edge"><ChevronRight size={14}/></i>}{node==="active_probe"&&<div className="loop-edge"><RefreshCw size={13}/> WAIT · RESUME</div>}</div>)}</div><div className="conditional-note"><GitBranch size={16}/><div><strong>Conditional edge</strong><p>evidence_complete = false → active_probe → WAIT → scene_fusion</p></div></div></section>
      <aside className="trace-panel panel"><div className="trace-head"><div><span>TRACE TIMELINE</span><h2>tr_20260914_00031</h2></div><span className={`status-tag ${stage==="done"?"active":"running"}`}>{stage==="done"?"COMPLETED":"RUNNING"}</span></div><div className="trace-meta"><span>session_id<b>ses_demo_a_01</b></span><span>location_id<b>loc_teaching_b_2f_east</b></span></div><div className="trace-timeline"><Trace status="success" node="scene_fusion" time="09:31:04" summary="识别纸箱、出口标识与走廊边界" meta="1,084 ms · 612 tokens"/><Trace status="success" node="hypothesis" time="09:31:07" summary="形成“疏散通道疑似被占用”假设" meta="842 ms · 438 tokens"/><Trace status={stage==="idle"?"running":"success"} node="evidence_gap" time="09:31:09" summary="缺少纸箱与出口整体空间关系" meta="confidence 0.76"/><Trace status={stage==="probe"?"running":stage==="verify"||stage==="done"?"success":"pending"} node="active_probe" time="09:31:11" summary="调用 cam_b2_east_01 · snapshot + clip" meta="tool: camera_provider"/><Trace status={stage==="verify"?"running":stage==="done"?"success":"pending"} node="verify" time="09:31:14" summary="视频连续帧支持空间占用关系" meta="model: mock-mm-v2"/><Trace status={stage==="done"?"success":"pending"} node="risk" time="09:31:16" summary={risk==="HIGH"?"风险更新 WATCH → HIGH":"等待补证结果"} meta="score 0.88 · evidence 0.92"/></div><div className="trace-footer"><ShieldCheck size={16}/><span>Prompt v2.3 · Policy campus-risk-04</span><b>可审计</b></div></aside>
    </div></div>;
}

function Kpi({ label,value,note }:{label:string;value:string;note:string}){return <div className="kpi panel"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function Trace({status,node,time,summary,meta}:{status:string;node:string;time:string;summary:string;meta:string}){return <div className={`trace-item ${status}`}><i/><div><header><strong>{node}</strong><time>{time}</time></header><p>{summary}</p><small>{meta}</small></div></div>}

function Cameras({ risk, onAnalyze }: { risk: Risk; onAnalyze: () => void }) {
  const cameras = ["cam_b2_east_01","cam_b2_west_02","cam_lab_302_03","cam_dorm3_lobby_01"];
  const [active, setActive] = useState(cameras[0]);
  return <div className="page-stack"><PageHeader eyebrow="MULTIMODAL PERCEPTION" title="视频感知中心" desc="关注场景状态变化与风险假设，而不是单一目标检测分数。" action={<button className="primary-action compact" onClick={onAnalyze}><Sparkles size={16}/> 交给智能体研判</button>}/><div className="camera-layout"><aside className="camera-tree panel"><div className="search-box"><Search size={16}/><input placeholder="搜索摄像头"/></div><div className="tree-root"><strong><ChevronDown size={15}/> 青澜大学</strong><span><ChevronDown size={15}/> 教学楼 B</span><em><ChevronDown size={15}/> 2F</em>{cameras.slice(0,2).map((c,i)=><button className={active===c?"active":""} onClick={()=>setActive(c)} key={c}><Camera size={15}/>{c}<b>{i?"在线":"研判中"}</b></button>)}<span><ChevronRight size={15}/> 实验楼</span><span><ChevronRight size={15}/> 学生公寓</span></div><footer><span className="live-dot"/> 42 / 44 在线</footer></aside><section className="video-wall"><div className="video-main panel"><div className="video-surface"><div className="video-grid-lines"/><div className="detection-box box-one"><span>纸箱堆物</span></div><div className="detection-box box-two"><span>安全出口</span></div><div className="corridor-perspective"><i/><i/><i/><i/></div><div className="video-overlay-top"><span className="live-dot"/> LIVE <b>{active}</b><em>1080P · 25 FPS</em></div><div className="video-time">2026-09-14 09:31:12</div><div className="video-controls"><button><Play size={16}/></button><div><i/></div><span>00:12 / LIVE</span><button><Camera size={16}/></button></div></div></div><div className="camera-thumbs">{cameras.slice(1).map((c,i)=><button key={c} onClick={()=>setActive(c)} className="camera-thumb"><div><Camera size={22}/><span className="live-dot"/></div><strong>{c}</strong><small>{["西侧走廊","实验室 302","3 号楼门厅"][i]}</small></button>)}</div></section><aside className="perception-panel panel"><div className="panel-title"><div><span>REALTIME PERCEPTION</span><h2>场景理解</h2></div><Radio size={18}/></div><div className="scene-summary"><span>SCENE SUMMARY</span><p>疏散走廊内可见多组纸箱，靠近安全出口导向标识，通行路径可能受影响。</p></div><div className="state-change"><header><Activity size={16}/><strong>状态变化</strong><time>09:30:58</time></header><p>纸箱由墙侧移动至通道中央区域</p><span>relation: object overlaps evacuation_path</span></div><div className={`camera-hypothesis ${risk.toLowerCase()}`}><span>RISK HYPOTHESIS · 0.88</span><strong>{risk==="HIGH"?"疏散通道已被占用":"疑似占用疏散通道"}</strong><div><i style={{width:risk==="HIGH"?"88%":"64%"}}/></div></div><div className="relation-list"><strong>空间关系</strong><span><b>纸箱</b> inside <b>疏散走廊</b></span><span><b>纸箱</b> near <b>安全出口</b></span><span><b>通行区域</b> partially_occluded</span></div><button className="primary-action full" onClick={onAnalyze}><Sparkles size={17}/> 截取前后 15 秒并研判</button></aside></div></div>;
}

function AgentChat({ risk, stage, onProbe, onRectified }: { risk: Risk; stage: RunStage; onProbe: () => void; onRectified: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return <div className="agent-page"><section className="agent-context"><div className="agent-identity"><div><Bot size={23}/><span className="live-dot"/></div><span>LOCATION AGENT</span><h2>教学楼 B 二层东侧<br/>安全智能体</h2><p>聚合这个位置的视觉、视频、时间、历史与规则知识。</p></div><div className="context-block"><span>当前位置</span><strong><MapPin size={16}/> 教学楼 B · 2F 东侧</strong><p>zone: evacuation_corridor</p></div><div className="context-block"><span>可用工具</span><div className="tool-list"><i><Camera size={15}/>摄像头</i><i><Video size={15}/>视频片段</i><i><BookOpen size={15}/>知识检索</i><i><History size={15}/>位置记忆</i></div></div><Link href="/governance" className="trace-link"><GitBranch size={16}/> 查看当前治理轨迹 <ArrowRight size={14}/></Link></section><section className="conversation"><header><div><span className="live-dot"/><strong>主动研判会话</strong><small>ses_demo_a_01 · 已绑定位置</small></div><button><History size={16}/> 历史会话</button></header><div className="messages"><div className="message agent"><div className="message-avatar"><Bot size={18}/></div><div className="message-body"><p>我在单张巡查图片中发现纸箱靠近安全出口，但当前证据不足以确认是否真正占用有效疏散区域。</p><time>09:31:08</time></div></div><div className="tool-call"><header><Camera size={17}/><div><span>TOOL CALL</span><strong>camera.get_context</strong></div><em>SUCCESS</em></header><p>已定位附近设备 <b>cam_b2_east_01</b>，视角覆盖出口与通道整体关系。</p></div>{risk === "WATCH" && <div className="probe-card"><header><CircleDashed size={20}/><div><span>EVIDENCE GAP</span><strong>需要补充证据</strong></div></header><p>当前无法确认纸箱是否进入安全出口有效疏散区域。</p><div className="probe-instruction"><MapPin size={17}/><span>建议调用东侧摄像头，同时获取全景快照与前后 15 秒视频。</span></div><footer><button onClick={()=>fileRef.current?.click()}><Upload size={16}/> 拍照上传</button><button className="primary-action" onClick={onProbe}><Camera size={16}/> 调用摄像头</button></footer></div>}{stage !== "idle" && <div className="tool-call running"><header><Sparkles size={17}/><div><span>AGENT RUN</span><strong>{stage==="gap"?"规划补证":stage==="probe"?"摄像头取证":stage==="verify"?"跨模态验证":"研判完成"}</strong></div><em>{stage==="done"?"SUCCESS":"RUNNING"}</em></header><Progress value={stage==="gap"?28:stage==="probe"?56:stage==="verify"?78:100}/></div>}{risk === "HIGH" && <><div className="message agent"><div className="message-avatar"><Bot size={18}/></div><div className="message-body"><p>补证完成。视频连续帧确认纸箱进入有效疏散区域，且当前为教学时段。结合条款 <b>GB-55037-4.2.1</b>，风险由 WATCH 升级为 HIGH。</p><time>09:31:16</time></div></div><div className="risk-result"><header><AlertTriangle size={19}/><strong>高风险 · 疏散通道占用</strong><em>置信度 91%</em></header><div><span>证据完整度<strong>92%</strong></span><Progress value={92}/></div><ul><li>移除通道内全部纸箱</li><li>拍摄包含出口标识的整改后全景</li><li>复核并写入位置整改记录</li></ul><Link href="/knowledge"><BookOpen size={15}/> 引用：建筑防火通用规范 4.2.1</Link><button className="primary-action full" onClick={()=>fileRef.current?.click()}><Upload size={16}/> 上传整改后照片</button></div></>}{risk === "NORMAL" && <div className="rectified-result"><ShieldCheck size={23}/><div><span>RECTIFICATION VERIFIED</span><strong>整改验证通过，风险恢复 NORMAL</strong><p>通道已恢复畅通。本次处置写入位置记忆，用于后续复发识别。</p></div></div>}</div><footer className="composer"><button aria-label="添加附件"><Plus size={19}/></button><input placeholder="询问这个位置的风险、证据或处置建议…"/><button className="send-button" aria-label="发送"><Send size={18}/></button><input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>{if(e.target.files?.length)onRectified()}}/></footer></section></div>;
}

function LocationSheet({ open, onOpenChange, risk, stage, onProbe }: { open:boolean; onOpenChange:(v:boolean)=>void; risk:Risk; stage:RunStage; onProbe:()=>void }) {
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="location-sheet sm:max-w-[520px]"><SheetHeader><SheetDescription>LOC-B2-EAST-021 · evacuation_corridor</SheetDescription><SheetTitle>教学楼 B 二层东侧疏散通道</SheetTitle></SheetHeader><div className="sheet-body"><div className={`risk-verdict ${risk.toLowerCase()}`}><span>{risk} · SCORE {risk==="HIGH"?"88":"64"}</span><strong>{risk==="HIGH"?"确认疏散通道被占用":"疑似疏散通道堆物"}</strong><p>最近观测 2026-09-14 09:31:04 · 置信度 {risk==="HIGH"?"91":"76"}%</p></div><h3>多模态证据</h3><div className="sheet-evidence"><span><ImageIcon/>巡查图片 <b>1</b></span><span><Video/>摄像头视频 <b>{risk==="HIGH"?"1":"待获取"}</b></span><span><Clock3/>课程时段 <b>教学中</b></span><span><History/>位置历史 <b>2 条</b></span><span><BookOpen/>知识条款 <b>3 条</b></span></div><h3>风险假设</h3><div className="hypothesis-table"><span>支持证据<b>纸箱位于疏散走廊内；靠近出口导向标识</b></span><span>反向证据<b>单图透视关系不完整</b></span><span>缺失证据<b>{risk==="HIGH"?"已补齐":"出口与纸箱的整体空间关系"}</b></span><span>下一步 Probe<b>{risk==="HIGH"?"无":"camera snapshot + 15s clip"}</b></span></div>{risk==="WATCH"?<button className="primary-action full" onClick={onProbe}><Sparkles size={17}/>{stage==="idle"?"让智能体补证":"智能体运行中…"}</button>:<Link className="primary-action full" href="/governance"><GitBranch size={17}/>查看完整治理轨迹</Link>}</div></SheetContent></Sheet>;
}

function NewCardDialog({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="new-card-dialog"><DialogHeader><DialogTitle>新建条款知识卡</DialogTitle><DialogDescription>新增后可直接激活，无需重新训练模型。</DialogDescription></DialogHeader><label>法规来源<input defaultValue="校内消防安全补充规定"/></label><label>条款原文<textarea defaultValue="楼梯前室及疏散走道不得临时堆放快递、纸箱等物品。"/></label><div className="form-row"><label>适用区域<input defaultValue="楼梯前室"/></label><label>风险等级<select defaultValue="HIGH"><option>HIGH</option><option>MEDIUM</option><option>WATCH</option></select></label></div><button className="primary-action full" onClick={()=>{onOpenChange(false);toast.success("条款卡已创建并保存为草稿")}}><Plus size={16}/> 创建知识卡</button></DialogContent></Dialog>}
function PageHeader({eyebrow,title,desc,action}:{eyebrow:string;title:string;desc:string;action:React.ReactNode}){return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{desc}</p></div>{action}</div>}
