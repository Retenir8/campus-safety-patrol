export type RiskLevel = "NORMAL" | "WATCH" | "MEDIUM" | "HIGH";
export type Period = "normal" | "peak" | "night";
export type CardStatus = "ACTIVE" | "DRAFT";
export type JudgmentType = "hard" | "semantic";
export type FindingStatus =
  | "watch"
  | "confirmed"
  | "ticketed"
  | "rectifying"
  | "closed"
  | "false_positive";
export type TicketStatus = "assigned" | "in_progress" | "pending_verify" | "closed";
export type ReportType = "single" | "batch" | "daily" | "weekly" | "monthly";
export type UserRole = "inspector" | "security" | "leader";
export type ReviewStatus = "pending" | "approved" | "rejected" | "relabeled";
export type BatchStatus = "queued" | "running" | "done" | "paused";

export type Location = {
  id: string;
  name: string;
  short: string;
  building: string;
  floor: string;
  zoneType: string;
  zoneLabel: string;
  x: number;
  y: number;
  cameraIds: string[];
  department: string;
  crowdHint: "low" | "medium" | "high";
  schedule: string;
};

export type MapLandmarkKind =
  | "teach"
  | "lab"
  | "library"
  | "dorm"
  | "canteen"
  | "gym"
  | "gate"
  | "field"
  | "admin"
  | "custom";

export type MapLandmark = {
  id: string;
  kind: MapLandmarkKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CampusMapState = {
  landmarks: MapLandmark[];
  locationPins: Record<string, { x: number; y: number }>;
  hiddenLocationIds: string[];
  locationLabels: Record<string, { short: string; name?: string; building: string; floor: string }>;
};

export type CameraSource = "webcam" | "snapshot" | "mock";

export type VisionConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type VisionHazard = {
  title: string;
  description: string;
  level: RiskLevel;
  objects: string[];
  relations: string[];
  cardId?: string;
  evidenceComplete: boolean;
  evidenceGap?: string;
  confidence: number;
  score: number;
};

export type VisionIdentifyResult = {
  sceneSummary: string;
  hazards: VisionHazard[];
  model: string;
  promptVersion: string;
  tokens: number;
  latencyMs: number;
};

export type Camera = {
  id: string;
  name: string;
  locationId: string;
  status: "ONLINE" | "OFFLINE";
  coverage: string;
  sourceType: CameraSource;
  snapshotUrl?: string;
  deviceId?: string;
};

export type KnowledgeCard = {
  id: string;
  source: string;
  clause: string;
  title: string;
  text: string;
  domain: string;
  zoneType: string;
  riskType: string;
  baseLevel: RiskLevel;
  judgmentType: JudgmentType;
  visualCues: string[];
  negativeCues: string[];
  keywords: string[];
  fixes: string[];
  checklist: string[];
  version: string;
  status: CardStatus;
};

export type Hypothesis = {
  name: string;
  support: string;
  counter: string;
  confidence: number;
};

export type Observation = {
  id: string;
  locationId: string;
  imageName: string;
  imageUrl: string;
  source: "upload" | "camera" | "sample" | "voice" | "video";
  createdAt: string;
  privacy: {
    desensitized: boolean;
    hash: string;
    credentialId: string;
  };
};

export type Finding = {
  id: string;
  observationId: string;
  locationId: string;
  title: string;
  description: string;
  sceneSummary: string;
  objects: string[];
  relations: string[];
  hypotheses: Hypothesis[];
  evidenceGap?: string;
  evidenceComplete: boolean;
  cardId?: string;
  level: RiskLevel;
  score: number;
  confidence: number;
  deadlineHours: number;
  department: string;
  status: FindingStatus;
  period: Period;
  weather: string;
  createdAt: string;
  traceId: string;
  recurrence: boolean;
  changeType: "新增" | "扩大" | "移除" | "恢复" | "复发";
};

export type Ticket = {
  id: string;
  findingId: string;
  locationId: string;
  title: string;
  department: string;
  assignee: string;
  status: TicketStatus;
  dueAt: string;
  checklist: { item: string; pass: boolean | null }[];
  rectifyImageUrl?: string;
  createdAt: string;
  closedAt?: string;
};

export type TraceEvent = {
  node: string;
  title: string;
  summary: string;
  status: "success" | "waiting" | "skipped";
  latencyMs: number;
  tokens: number;
};

export type Trace = {
  id: string;
  findingId: string;
  locationId: string;
  model: string;
  promptVersion: string;
  knowledgeVersion: string;
  ruleVersion: string;
  outputHash: string;
  latencyMs: number;
  tokens: number;
  createdAt: string;
  events: TraceEvent[];
};

export type Report = {
  id: string;
  type: ReportType;
  title: string;
  findingIds: string[];
  createdAt: string;
  periodKey?: string;
};

export type Review = {
  id: string;
  findingId: string;
  status: ReviewStatus;
  note: string;
  createdAt: string;
};

export type BatchJob = {
  id: string;
  title: string;
  locationId: string;
  total: number;
  done: number;
  status: BatchStatus;
  findingIds: string[];
  createdAt: string;
};

export type CampusState = {
  role: UserRole;
  cards: KnowledgeCard[];
  customLocations: Location[];
  cameras: Camera[];
  observations: Observation[];
  findings: Finding[];
  tickets: Ticket[];
  traces: Trace[];
  reports: Report[];
  reviews: Review[];
  jobs: BatchJob[];
  matrix: Record<string, string>;
  campusMap: CampusMapState;
};
