"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  CloudSun,
  Database,
  FileSearch,
  Fingerprint,
  History,
  MapPin,
  Play,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Users,
  Video,
  WandSparkles,
  Wrench,
  Zap,
} from "lucide-react";

type Risk = "WATCH" | "HIGH" | "NORMAL";
type RunStage = "idle" | "gap" | "probe" | "verify" | "done";

type Props = {
  risk: Risk;
  stage: RunStage;
  onProbe: () => void;
  onReset: () => void;
};

const stageIndex: Record<RunStage, number> = { idle: 0, gap: 1, probe: 2, verify: 3, done: 4 };

const contextItems = [
  { icon: CloudSun, value: "晴 26°C", label: "天气" },
  { icon: Users, value: "1,240人", label: "当前在校" },
  { icon: BookOpen, value: "大课间", label: "09:30—10:00" },
  { icon: History, value: "教学日", label: "周二 2026.09.14" },
];

const flow = [
  { icon: AlertTriangle, label: "发现隐患", tone: "danger" },
  { icon: Camera, label: "主动补证", tone: "cyan" },
  { icon: FileSearch, label: "条款判定", tone: "cyan" },
  { icon: CircleDot, label: "动态定级", tone: "cyan" },
  { icon: Wrench, label: "整改指导", tone: "cyan" },
  { icon: CheckCircle2, label: "复验销号", tone: "green" },
];

function PanelTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <div className="screen-panel-title">
    <span>{number}</span>
    <div><h2>{title}</h2><p>{subtitle}</p></div>
  </div>;
}

function MiniStep({ n, children }: { n: string; children: React.ReactNode }) {
  return <li><b>{n}</b><span>{children}</span></li>;
}

export default function BigScreenDashboard({ risk, stage, onProbe, onReset }: Props) {
  const isHigh = risk === "HIGH";
  const isNormal = risk === "NORMAL";
  const progress = stageIndex[stage];
  const statusText = isHigh ? "高风险已确认" : isNormal ? "整改复验通过" : "证据不足 · 待补证";

  return <div className={`safety-screen risk-${risk.toLowerCase()}`}>
    <div className="screen-sky" />
    <div className="screen-scanlines" />

    <header className="screen-hero">
      <div className="hero-note hero-note-left"><strong>AI 守护校园</strong><span>让每一份青春都更安全</span></div>
      <div className="hero-center">
        <div className="hero-kicker"><span /> CAMPUS SAFETY INTELLIGENCE <span /></div>
        <h1>校安智巡 <em>Demo 2.0</em></h1>
        <h2>主动取证 <i>×</i> 时态风险研判 <i>×</i> 反事实整改</h2>
        <p>不是只识别图片，而是完成从发现、判定、整改到销号的闭环</p>
      </div>
      <div className="hero-note hero-note-right"><strong>更安全的校园</strong><span>成就更美好的未来</span><small>SAFER CAMPUS · BRIGHTER TOMORROW</small></div>
      <nav className="screen-nav" aria-label="大屏快捷导航">
        <Link href="/demo-guide">演示导览</Link><Link href="/cameras">视频感知</Link><Link href="/agent">智能体</Link><Link href="/knowledge">知识库</Link><Link href="/governance">审计中心</Link>
      </nav>
    </header>

    <main className="screen-grid">
      <section className="neon-panel evidence-panel">
        <PanelTitle number="01" title="主动取证" subtitle="AI主动发现问题，引导多角度取证" />
        <div className="evidence-stage">
          <div className="phone-frame">
            <div className="phone-top"><span>9:41</span><i /><b>●</b></div>
            <div className="phone-shot corridor-left">
              <div className="detect-tag"><AlertTriangle size={13} />堆物遮挡<br /><small>疑似占用疏散通道</small></div>
              <span className="detect-box" />
            </div>
            <div className="phone-tabs"><span>视频</span><b>照片</b><span>文档</span></div>
            <div className="phone-camera"><i /><span /><i /></div>
          </div>
          <div className="probe-side">
            <div className={`ai-orb ${stage !== "idle" ? "working" : ""}`}><Bot size={25} /><span>AI</span></div>
            <div className="ai-callout">
              <strong>{isHigh ? "证据链已补全" : "证据不足，请补拍"}</strong>
              <p>{isHigh ? "视频、位置与条款已完成交叉验证。" : "安全出口与堆物整体空间关系。"}</p>
            </div>
            <div className="after-label">补拍后</div>
            <div className="after-shot corridor-right"><span><Check size={13} /> 出口关系清晰</span></div>
            <button className={`probe-button ${stage !== "idle" && stage !== "done" ? "is-running" : ""}`} onClick={onProbe} disabled={stage !== "idle" && stage !== "done"}>
              {stage !== "idle" && stage !== "done" ? <><RefreshCw size={15} className="spin" /> 正在联合补证</> : <><Sparkles size={15} /> {isHigh ? "重新运行补证" : "让智能体补证"}</>}
            </button>
            <div className="evidence-chips"><span><Camera size={12} /> 图像</span><span className={progress >= 2 ? "active" : ""}><Video size={12} /> 视频</span><span className={progress >= 3 ? "active" : ""}><MapPin size={12} /> 位置</span></div>
          </div>
        </div>
        <div className="evidence-summary"><Fingerprint size={19} /><div><strong>多视角证据</strong><span>{isHigh ? "6项证据已对齐 · 完整度 92%" : "3项已获取 · 完整度 58%"}</span></div><b>{isHigh ? "已完成" : "待补全"}</b></div>
      </section>

      <section className="neon-panel risk-panel">
        <PanelTitle number="02" title="校园时态风险沙盘" subtitle="融合时空、天气、人流、课程的动态风险研判" />
        <div className="context-strip">{contextItems.map(({ icon: Icon, value, label }) => <div key={value}><Icon size={20} /><strong>{value}</strong><span>{label}</span></div>)}</div>
        <div className="campus-aerial">
          <div className="aerial-vignette" />
          <div className="campus-chip library" style={{ left: "22%", top: "32%" }}><i className="safe" />图书馆</div>
          <div className="campus-chip dining" style={{ left: "14%", top: "57%" }}><i className="watch" />食堂</div>
          <div className="campus-chip lab" style={{ left: "62%", top: "62%" }}><i className="watch" />实验楼</div>
          <div className="campus-chip gym" style={{ left: "84%", top: "45%" }}><i className="safe" />体育馆</div>
          <div className="campus-chip dorm" style={{ left: "25%", top: "76%" }}><i className="safe" />宿舍楼</div>
          <button className={`hot-building ${isHigh ? "high" : "watch"}`} onClick={onProbe} style={{ left: "59%", top: "35%" }}>
            <span className="hot-pulse" /><AlertTriangle size={20} /><strong>教学楼 B</strong><small>{isHigh ? "高风险" : "待补证"}</small>
          </button>
          <div className="aerial-meta"><span><i /> 128 个位置在线</span><span><i /> 42 路实时感知</span></div>
        </div>
        <div className="risk-timeline">
          <div className="time-scene"><time>09:00</time><span className="building-cube low"><Building2 size={19} /><i>!</i></span><b>低风险</b></div>
          <ArrowRight size={22} />
          <div className={`time-scene focus ${isHigh ? "high" : "watch"}`}><time>09:30 · 大课间</time><span className="building-cube"><Building2 size={21} /><i>!</i></span><b>{isHigh ? "高风险" : "风险上升"}</b></div>
          <ArrowRight size={22} />
          <div className="time-scene"><time>11:40 · 放学</time><span className="building-cube medium"><Building2 size={19} /><i>!</i></span><b>中风险</b></div>
          <div className="timeline-track"><span className={progress >= 1 ? "active" : ""} /><span className={progress >= 3 ? "danger" : ""} /><span /></div>
        </div>
        <div className="reasoning-chain"><span>纸箱占用<br />疏散区域</span><ChevronRight /><span>大课间<br />人流上升</span><ChevronRight /><span>疏散风险<br />动态升级</span><ChevronRight /><span>处置时限<br /><b>24h → 2h</b></span></div>
      </section>

      <section className="neon-panel rectify-panel">
        <PanelTitle number="03" title="反事实整改引擎" subtitle="生成可落地的整改方案，并验证效果" />
        <div className="ask-chip"><WandSparkles size={15} /> 怎样把风险降一级？</div>
        <div className="before-after">
          <div className="rectify-image corridor-left"><b className="before">整改前</b><span>占用疏散通道</span><i className="rectify-box" /></div>
          <div className="transition-chevrons">›››</div>
          <div className="rectify-image corridor-right"><b className="after">整改后</b><span>通道畅通</span><i className="clear-path" /></div>
        </div>
        <div className="rectify-columns">
          <div className="rectify-list"><h3>整改建议 <span>反事实生成</span></h3><ol>
            <MiniStep n="1">将纸箱移至指定储物间</MiniStep>
            <MiniStep n="2">保持疏散通道 ≥ 1.2 米</MiniStep>
            <MiniStep n="3">不得遮挡消防设施与安全出口</MiniStep>
            <MiniStep n="4">建立定期巡查机制</MiniStep>
          </ol></div>
          <div className="verify-list"><h3>整改验证清单</h3>{["堆物已移除", "疏散区域恢复", "安全出口可见", "无新增遮挡"].map((item, index) => <span key={item} className={isNormal || (isHigh && index < 2) ? "done" : ""}><Check size={13} />{item}</span>)}</div>
        </div>
        <div className={`rectify-status ${isNormal ? "passed" : isHigh ? "ready" : "waiting"}`}><CheckCircle2 size={21} /><strong>{isNormal ? "整改通过，允许销号" : isHigh ? "方案已生成，等待整改" : "完成研判后生成方案"}</strong></div>
      </section>

      <section className="neon-panel loop-panel">
        <div className="loop-heading"><span>04</span><h2>全流程闭环管理</h2><p>从发现到销号，形成管理闭环</p></div>
        <div className="loop-flow">{flow.map(({ icon: Icon, label, tone }, index) => <div className="loop-node-wrap" key={label}><div className={`loop-node ${tone} ${progress >= Math.min(index, 4) && stage !== "idle" ? "active" : ""}`}><Icon size={24} /></div><strong>{label}</strong>{index < flow.length - 1 && <ArrowRight className="loop-arrow" size={24} />}</div>)}</div>
      </section>

      <section className="neon-panel audit-panel">
        <div className="audit-heading"><div><Database size={17} /><strong>证据链 / 审计中心</strong><span>全过程留痕，可解释、可追溯、可重放</span></div><div className={`live-status ${isHigh ? "alert" : ""}`}><i />{statusText}</div></div>
        <div className="audit-cards">
          <Link href="/knowledge"><BookOpen /><span><strong>条款依据</strong><small>法规 / 校规</small></span></Link>
          <Link href="/governance"><ClipboardCheck /><span><strong>模型日志</strong><small>推理过程</small></span></Link>
          <Link href="/agent"><Bot /><span><strong>人工复核</strong><small>标注 / 审批</small></span></Link>
          <Link href="/cameras"><Play /><span><strong>可回放</strong><small>完整证据链</small></span></Link>
        </div>
      </section>
    </main>

    <footer className="screen-footer">
      <span><ShieldCheck size={15} />开放词表识别 · 适配更多校园场景</span>
      <strong>用 AI 守护校园的每一个明天</strong>
      <button onClick={onReset}><TimerReset size={14} />复位演示</button>
    </footer>
  </div>;
}
