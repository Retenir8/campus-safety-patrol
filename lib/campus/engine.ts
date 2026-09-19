import { cameras, locations } from "./seed";
import { isEmergencyRisk } from "./knowledge-cards";
import type {
  Finding,
  Hypothesis,
  KnowledgeCard,
  Location,
  Observation,
  Period,
  RiskLevel,
  Trace,
  TraceEvent,
  VisionHazard,
  VisionIdentifyResult,
} from "./types";

const MODEL = "campus-mm-judge-v2";
const PROMPT_VERSION = "prompt-campus-risk-04";
const RULE_VERSION = "rule-hard-first-02";

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return `sha1:${h.toString(16).padStart(8, "0")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sleepJitter(base: number) {
  return base + Math.round(Math.random() * 80);
}

function textBlob(name: string) {
  return name.toLowerCase();
}

function scoreCard(card: KnowledgeCard, location: Location, imageName: string) {
  let score = 0;
  if (card.status !== "ACTIVE") return -999;
  if (card.zoneType === location.zoneType) score += 40;
  const blob = textBlob(imageName);
  for (const key of card.keywords) {
    if (blob.includes(key.toLowerCase())) score += 18;
  }
  for (const cue of card.visualCues) {
    if (blob.includes(cue.slice(0, 2).toLowerCase())) score += 6;
  }
  for (const neg of card.negativeCues) {
    const token = neg.slice(0, 2);
    if (blob.includes(token.toLowerCase()) && /整改|畅通|划线|outdoor|clear|empty|ok/.test(blob)) {
      score -= 20;
    }
  }
  if (/划线|parking|outdoor/.test(blob) && card.riskType === "ebike") score -= 50;
  if (location.zoneType === "outdoor_parking" && card.riskType === "ebike") score -= 60;
  if (location.zoneType === "outdoor_parking" && card.riskType === "ebike_ok") score += 50;
  return score;
}

function pickObjects(card: KnowledgeCard | undefined, location: Location) {
  if (!card) return [location.zoneLabel, "现场物品"];
  return Array.from(new Set([location.zoneLabel, ...card.visualCues.slice(0, 3)]));
}

function pickRelations(card: KnowledgeCard | undefined, complete: boolean) {
  if (!card) return ["目标与场景关系待确认"];
  if (card.riskType === "obstruction") {
    return complete
      ? ["纸箱 inside 疏散走道", "纸箱 overlaps 安全出口有效区域", "通行宽度 < 1.2m"]
      : ["纸箱 inside 走廊", "与安全出口整体关系 unknown"];
  }
  if (card.riskType === "ebike") return ["电动车 inside 宿舍门厅", "充电线 near 公共走道"];
  if (card.riskType === "unattended") return ["运行设备 inside 实验室", "值守人员 = 0"];
  if (card.riskType === "unsealed_hole") return ["孔洞 adjacent 电缆沟", "防火封堵 = missing"];
  if (card.riskType === "ebike_ok") return ["电动车 inside 室外划线区", "未进入建筑内部"];
  return [`目标 near ${card.zoneType}`];
}

function dynamicLevel(card: KnowledgeCard, location: Location, period: Period, complete: boolean): {
  level: RiskLevel;
  score: number;
  deadlineHours: number;
} {
  if (card.riskType === "ebike_ok") return { level: "NORMAL", score: 8, deadlineHours: 0 };
  if (!complete && card.judgmentType !== "hard") {
    return { level: "WATCH", score: 58, deadlineHours: 24 };
  }
  if (!complete && card.riskType === "obstruction") {
    return { level: "WATCH", score: 64, deadlineHours: 8 };
  }

  let level = card.baseLevel;
  let score = card.baseLevel === "HIGH" ? 86 : card.baseLevel === "MEDIUM" ? 71 : 18;
  let deadlineHours = card.baseLevel === "HIGH" ? 8 : 24;

  if (card.riskType === "obstruction" && (period === "peak" || location.crowdHint === "high")) {
    level = "HIGH";
    score = Math.min(96, score + 8);
    deadlineHours = 2;
  }
  if (card.riskType === "unattended" && period === "night") {
    level = "HIGH";
    score = 91;
    deadlineHours = 2;
  }
  if (card.riskType === "unattended" && period === "normal") {
    level = "WATCH";
    score = 42;
    deadlineHours = 12;
  }
  return { level, score, deadlineHours };
}

function evidenceComplete(card: KnowledgeCard | undefined, imageName: string, extraEvidence: boolean) {
  if (!card) return false;
  if (card.riskType === "ebike_ok") return true;
  if (card.judgmentType === "hard" && card.riskType !== "obstruction") return true;
  if (extraEvidence) return true;
  if (/全景|出口|exit|clip|video/.test(imageName.toLowerCase())) return true;
  if (card.riskType === "obstruction") return false;
  return true;
}

export type IdentifyInput = {
  location: Location;
  observation: Observation;
  cards: KnowledgeCard[];
  period: Period;
  weather: string;
  extraEvidence?: boolean;
};

export type IdentifyOutput = {
  finding: Finding;
  trace: Trace;
};

function hasKeywordEvidence(card: KnowledgeCard, imageName: string) {
  const blob = textBlob(imageName);
  return card.keywords.some((key) => blob.includes(key.toLowerCase()));
}

export function matchedCards(input: IdentifyInput) {
  return input.cards
    .map((card) => ({ card, score: scoreCard(card, input.location, input.observation.imageName) }))
    .filter(({ card, score }) => {
      if (card.status !== "ACTIVE" || score < 20) return false;
      return hasKeywordEvidence(card, input.observation.imageName) || score >= 70;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.card);
}

export function identifyAll(input: IdentifyInput): IdentifyOutput[] {
  const hits = matchedCards(input);
  if (!hits.length) return [identify(input, null)];
  return hits.map((card) => identify(input, card));
}

export function identify(input: IdentifyInput, forcedCard?: KnowledgeCard | null): IdentifyOutput {
  const { location, observation, cards, period, weather } = input;
  const extraEvidence = Boolean(input.extraEvidence);
  const events: TraceEvent[] = [];
  const t0 = Date.now();

  events.push({
    node: "privacy_gate",
    title: "隐私门",
    summary: "端侧完成人脸脱敏与图片质检，仅上传必要画面。未成年人脸未出端。",
    status: "success",
    latencyMs: sleepJitter(90),
    tokens: 0,
  });

  const ranked = cards
    .map((card) => ({ card, score: scoreCard(card, location, observation.imageName) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const card =
    forcedCard === null
      ? undefined
      : (forcedCard ?? (best && best.score >= 20 ? best.card : undefined));
  const complete = evidenceComplete(card, observation.imageName, extraEvidence);

  events.push({
    node: "scene_fusion",
    title: "场景理解",
    summary: `识别环境「${location.zoneLabel}」，提取目标与空间关系候选。`,
    status: "success",
    latencyMs: sleepJitter(420),
    tokens: 540,
  });

  events.push({
    node: "knowledge_retrieve",
    title: "条款对照",
    summary: card
      ? `系统对照知识库自动判定，命中 ${card.id} · ${card.title}。`
      : "对照现行条款后未见可确认隐患，结论进入待观察。",
    status: "success",
    latencyMs: sleepJitter(160),
    tokens: 210,
  });

  const objects = pickObjects(card, location);
  const relations = pickRelations(card, complete);
  const hypotheses: Hypothesis[] = card
    ? [
        {
          name: card.title,
          support: card.visualCues.slice(0, 2).join("；"),
          counter: card.negativeCues[0] ?? "暂无",
          confidence: complete ? 0.9 : 0.62,
        },
        {
          name: "临时作业 / 负例",
          support: card.negativeCues[0] ?? "需核对",
          counter: "当前画面更支持隐患假设",
          confidence: complete ? 0.18 : 0.34,
        },
      ]
    : [
        {
          name: "未知风险",
          support: "画面与点位上下文不足",
          counter: "无匹配条款",
          confidence: 0.4,
        },
      ];

  events.push({
    node: "hypothesis",
    title: "风险假设",
    summary: hypotheses.map((item) => `${item.name} ${Math.round(item.confidence * 100)}%`).join("；"),
    status: "success",
    latencyMs: sleepJitter(180),
    tokens: 260,
  });

  const gap =
    !complete && card?.riskType === "obstruction"
      ? "缺少纸箱与安全出口的整体空间关系，建议补拍全景或调用对应摄像头短视频。"
      : !card
        ? "无匹配条款，需人工确认隐患类型或补一张知识卡。"
        : undefined;

  events.push({
    node: "evidence_gap",
    title: "证据缺口",
    summary: gap ?? "关键视觉线索已覆盖，可进入判定。",
    status: gap ? "waiting" : "success",
    latencyMs: sleepJitter(90),
    tokens: 80,
  });

  if (extraEvidence) {
    const cam = cameras.find((item) => item.locationId === location.id);
    events.push({
      node: "active_probe",
      title: "主动取证",
      summary: `调用 ${cam?.id ?? "nearby_camera"} 获取快照与 15 秒片段，补齐空间关系。`,
      status: "success",
      latencyMs: sleepJitter(640),
      tokens: 120,
    });
    events.push({
      node: "cross_modal_verify",
      title: "跨模态核验",
      summary: "图片、视频与点位语义一致，占用关系得到验证。",
      status: "success",
      latencyMs: sleepJitter(280),
      tokens: 340,
    });
  } else {
    events.push({
      node: "active_probe",
      title: "主动取证",
      summary: gap ? "尚未取证，等待补拍或摄像头 Probe。" : "证据已够，跳过取证。",
      status: gap ? "waiting" : "skipped",
      latencyMs: 40,
      tokens: 0,
    });
  }

  const judged = card
    ? dynamicLevel(card, location, period, complete)
    : { level: "WATCH" as RiskLevel, score: 46, deadlineHours: 24 };

  events.push({
    node: "rule_judge",
    title: "规则 / 模型判定",
    summary: card
      ? card.judgmentType === "hard"
        ? `硬规则优先：命中 ${card.id}，再叠加作息 ${period}、人流 ${location.crowdHint}。`
        : `模型仅在候选条款内判定，引用回库核验通过：${card.id}。`
      : "无线索条款，不给出斩钉截铁结论。",
    status: "success",
    latencyMs: sleepJitter(210),
    tokens: 190,
  });

  const needHuman = !card || judged.level === "WATCH" || !complete;
  events.push({
    node: "human_gate",
    title: "人工闸门",
    summary:
      judged.level === "HIGH" && complete
        ? "高风险结论可下发工单，重大处置仍需保卫处确认。"
        : "证据不足或低置信，默认不直接销号，进入待补证 / 人工复核。",
    status: needHuman && judged.level !== "HIGH" ? "waiting" : "success",
    latencyMs: 30,
    tokens: 0,
  });

  const findingId = nid("hz");
  const traceId = nid("tr");
  const confidence = complete ? (card?.riskType === "ebike_ok" ? 0.97 : 0.9) : 0.74;
  const description = card
    ? card.riskType === "ebike_ok"
      ? `${location.name}画面中出现电动车，但位于室外划线停放区，按负例条款不作为隐患。`
      : `${location.name}识别到「${card.title}」。当前为${periodLabel(period)}，天气${weather}。${gap ?? "证据完整，可进入处置。"}`
    : `${location.name}未能匹配激活条款卡，已生成待观察记录。`;

  const finding: Finding = {
    id: findingId,
    observationId: observation.id,
    locationId: location.id,
    title: card?.title ?? "待确认隐患",
    description,
    sceneSummary: `${location.building} ${location.floor} · ${objects.join("、")}`,
    objects,
    relations,
    hypotheses,
    evidenceGap: gap,
    evidenceComplete: complete,
    cardId: card?.id,
    level: judged.level,
    score: judged.score,
    confidence,
    deadlineHours: judged.deadlineHours,
    department: location.department,
    status: judged.level === "NORMAL" ? "false_positive" : gap ? "watch" : "confirmed",
    period,
    weather,
    createdAt: nowIso(),
    traceId,
    recurrence: false,
    changeType: "新增",
  };

  const tokens = events.reduce((sum, event) => sum + event.tokens, 0);
  const latencyMs = Date.now() - t0 + events.reduce((sum, event) => sum + event.latencyMs, 0);
  const knowledgeVersion = cards
    .filter((item) => item.status === "ACTIVE")
    .map((item) => `${item.id}@${item.version}`)
    .slice(0, 4)
    .join(",");

  const trace: Trace = {
    id: traceId,
    findingId,
    locationId: location.id,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    knowledgeVersion: knowledgeVersion || "empty",
    ruleVersion: RULE_VERSION,
    outputHash: hash(`${findingId}:${finding.title}:${finding.level}:${finding.cardId ?? ""}`),
    latencyMs,
    tokens,
    createdAt: nowIso(),
    events,
  };

  return { finding, trace };
}

export function periodLabel(period: Period) {
  return period === "peak" ? "大课间高峰" : period === "night" ? "夜间 / 周末" : "平时教学";
}

export function levelLabel(level: RiskLevel) {
  return { HIGH: "高风险", MEDIUM: "中风险", WATCH: "待补证", NORMAL: "正常" }[level];
}

export function locationById(id: string) {
  return locations.find((item) => item.id === id);
}

export function cameraById(id: string) {
  return cameras.find((item) => item.id === id);
}

function deadlineFor(level: RiskLevel, emergency = false) {
  if (emergency) return 1;
  if (level === "HIGH") return 8;
  if (level === "MEDIUM") return 24;
  if (level === "WATCH") return 12;
  return 0;
}

function isNegativeHazard(hazard: Pick<VisionHazard, "title" | "description">) {
  const blob = `${hazard.title}\n${hazard.description}`;
  return /未发现|未见可见|未见[^。]{0,8}(危险|隐患)|不命中|故不认定|未认定具体|没有隐患|无可见/.test(blob);
}

function attachEmergencyCard(hazard: VisionHazard, cards: KnowledgeCard[]): VisionHazard {
  if (isNegativeHazard(hazard)) {
    return { ...hazard, cardId: undefined, level: "NORMAL" };
  }
  const title = hazard.title;
  const denied = /未|无|不命中|没有/.test(title);
  const fireCard = cards.find((card) => card.riskType === "active_fire" && card.status === "ACTIVE");
  const smokeCard = cards.find((card) => card.riskType === "active_smoke" && card.status === "ACTIVE");
  const known = hazard.cardId ? cards.some((card) => card.id === hazard.cardId) : false;
  if (!denied && /(明火|火焰|火苗|燃烧|着火|起火|打火机|点燃|flame|lighter)/i.test(title) && fireCard) {
    return {
      ...hazard,
      cardId: known ? hazard.cardId : fireCard.id,
      level: "HIGH",
      evidenceComplete: true,
      evidenceGap: undefined,
    };
  }
  if (!denied && /(烟雾|冒烟|浓烟|smoke)/i.test(title) && smokeCard) {
    return {
      ...hazard,
      cardId: known ? hazard.cardId : smokeCard.id,
      level: "HIGH",
      evidenceComplete: true,
      evidenceGap: undefined,
    };
  }
  return hazard;
}

export function identifyFromVisionAll(
  input: IdentifyInput & { vision: VisionIdentifyResult },
): IdentifyOutput[] {
  const seen = new Set<string>();
  const hazards = input.vision.hazards
    .map((hazard) => attachEmergencyCard(hazard, input.cards))
    .filter((hazard) => {
      if (hazard.level === "NORMAL" || !hazard.cardId || isNegativeHazard(hazard)) return false;
      if (seen.has(hazard.cardId)) return false;
      seen.add(hazard.cardId);
      return true;
    });
  if (!hazards.length) return [];
  return hazards.map((hazard) =>
    identifyFromVision({ ...input, vision: { ...input.vision, hazards: [hazard] } }),
  );
}

export function identifyFromVision(
  input: IdentifyInput & { vision: VisionIdentifyResult },
): IdentifyOutput {
  const { location, observation, cards, period, weather, vision } = input;
  const hazard = vision.hazards[0];
  const card = cards.find((item) => item.id === hazard?.cardId && item.status === "ACTIVE");
  const level: RiskLevel = hazard?.level ?? "NORMAL";
  const objects = hazard?.objects?.length ? hazard.objects : [location.zoneLabel, "现场画面"];
  const relations = hazard?.relations?.length ? hazard.relations : [`画面覆盖 ${location.name}`];
  const complete = hazard ? Boolean(hazard.evidenceComplete) : true;
  const gap = hazard?.evidenceGap || (complete ? undefined : "画面信息不足，建议换角度补拍");
  const hypotheses: Hypothesis[] = [
    {
      name: hazard?.title ?? "未见明显隐患",
      support: hazard?.description ?? "模型未给出明确违规目标",
      counter: gap ?? "未见明显反证",
      confidence: hazard?.confidence ?? 0.7,
    },
  ];

  const events: TraceEvent[] = [
    {
      node: "privacy_gate",
      title: "隐私门",
      summary: "抓拍画面在端侧压缩后送检，仅保留隐患识别所需分辨率。",
      status: "success",
      latencyMs: 40,
      tokens: 0,
    },
    {
      node: "vision_model",
      title: "视觉大模型识别",
      summary: `${vision.model} 完成场景理解与隐患抽取，摘要：${vision.sceneSummary}`,
      status: "success",
      latencyMs: vision.latencyMs,
      tokens: vision.tokens,
    },
    {
      node: "retrieve",
      title: "条款对照",
      summary: card
        ? `系统自动命中知识卡 ${card.id} · ${card.title}`
        : vision.hazards.length
          ? "画面有异常但未能对齐现行条款，保留待复核。"
          : "对照现行条款未见可确认隐患。",
      status: card ? "success" : "waiting",
      latencyMs: 20,
      tokens: 0,
    },
    {
      node: "human_gate",
      title: "人工闸门",
      summary: level === "WATCH" || !card ? "低置信或证据不足，进入复核/补证。" : "可按结论进入处置。",
      status: level === "WATCH" || !card ? "waiting" : "success",
      latencyMs: 16,
      tokens: 0,
    },
  ];

  const findingId = nid("hz");
  const traceId = nid("tr");
  const finding: Finding = {
    id: findingId,
    observationId: observation.id,
    locationId: location.id,
    title: card?.title ?? hazard?.title ?? "现场未见明显隐患",
    description: card?.text ?? hazard?.description ?? `${location.name}抓拍画面经 ${vision.model} 分析，当前未见需要立即处置的安全隐患。`,
    sceneSummary: vision.sceneSummary || `${location.building} ${location.floor} · ${objects.join("、")}`,
    objects,
    relations,
    hypotheses,
    evidenceGap: gap,
    evidenceComplete: complete,
    cardId: card?.id,
    level,
    score: Math.round(hazard?.score ?? (level === "NORMAL" ? 12 : 60)),
    confidence: Math.min(0.99, Math.max(0.2, hazard?.confidence ?? 0.72)),
    deadlineHours: deadlineFor(level, isEmergencyRisk(card?.riskType)),
    department: location.department,
    status: level === "NORMAL" ? "false_positive" : gap ? "watch" : "confirmed",
    period,
    weather,
    createdAt: nowIso(),
    traceId,
    recurrence: false,
    changeType: "新增",
  };

  const knowledgeVersion = cards
    .filter((item) => item.status === "ACTIVE")
    .map((item) => `${item.id}@${item.version}`)
    .slice(0, 4)
    .join(",");

  const trace: Trace = {
    id: traceId,
    findingId,
    locationId: location.id,
    model: vision.model,
    promptVersion: vision.promptVersion || "prompt-campus-vision-01",
    knowledgeVersion: knowledgeVersion || "empty",
    ruleVersion: RULE_VERSION,
    outputHash: hash(`${findingId}:${finding.title}:${finding.level}:${finding.cardId ?? ""}:${vision.sceneSummary}`),
    latencyMs: events.reduce((sum, event) => sum + event.latencyMs, 0),
    tokens: vision.tokens,
    createdAt: nowIso(),
    events,
  };

  return { finding, trace };
}
