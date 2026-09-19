"use client";

import { useSyncExternalStore } from "react";
import { identifyAll, identifyFromVisionAll } from "./engine";
import { cameras as seedCameras, knowledgeCards, locations as seedLocations } from "./seed";
import { defaultCampusMap } from "./map";
import { collectScheduledReports } from "./reports";
import { requestVisionIdentify, visionConfigured } from "./vision";
import type {
  Camera,
  CampusMapState,
  CampusState,
  Finding,
  KnowledgeCard,
  Location,
  MapLandmark,
  MapLandmarkKind,
  Observation,
  Period,
  Report,
  ReportType,
  ReviewStatus,
  Ticket,
  UserRole,
  VisionIdentifyResult,
} from "./types";

const KEY = "campus-safety-workbench-v3";
const listeners = new Set<() => void>();

function defaultMatrix() {
  return Object.fromEntries(seedLocations.map((item) => [item.zoneType, item.department]));
}

function mergeKnowledgeCards(saved: KnowledgeCard[] | undefined): KnowledgeCard[] {
  const savedCards = saved ?? [];
  const seedIds = new Set(knowledgeCards.map((card) => card.id));
  const savedById = new Map(savedCards.map((card) => [card.id, card]));
  const fromSeed = knowledgeCards.map((card) => {
    const prev = savedById.get(card.id);
    if (prev?.status && prev.status !== card.status) return { ...card, status: prev.status };
    return { ...card };
  });
  const custom = savedCards.filter((card) => !seedIds.has(card.id)).map((card) => ({ ...card }));
  return [...fromSeed, ...custom];
}

function emptyState(): CampusState {
  return {
    role: "security",
    cards: knowledgeCards.map((card) => ({ ...card })),
    customLocations: [],
    cameras: seedCameras.map((item) => ({ ...item })),
    observations: [],
    findings: [],
    tickets: [],
    traces: [],
    reports: [],
    reviews: [],
    jobs: [],
    matrix: defaultMatrix(),
    campusMap: defaultCampusMap(),
  };
}

function load(): CampusState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as CampusState;
    const base = emptyState();
    return {
      ...base,
      ...parsed,
      cards: mergeKnowledgeCards(parsed.cards),
      cameras: (parsed.cameras?.length ? parsed.cameras : base.cameras).map((item) => ({
        ...item,
        sourceType: item.sourceType ?? "mock",
      })),
      customLocations: parsed.customLocations ?? [],
      reviews: parsed.reviews ?? [],
      jobs: parsed.jobs ?? [],
      matrix: parsed.matrix ?? base.matrix,
      role: parsed.role ?? "security",
      campusMap: {
        ...defaultCampusMap(),
        ...(parsed.campusMap ?? {}),
        landmarks: parsed.campusMap?.landmarks ?? defaultCampusMap().landmarks,
        locationPins: parsed.campusMap?.locationPins ?? {},
        hiddenLocationIds: parsed.campusMap?.hiddenLocationIds ?? [],
        locationLabels: parsed.campusMap?.locationLabels ?? {},
      },
    };
  } catch {
    return emptyState();
  }
}

let state: CampusState = emptyState();
let hydrated = false;
let scheduleTimer: number | undefined;

function withScheduledReports(current: CampusState): CampusState {
  const others = current.reports.filter(
    (item) => item.type !== "daily" && item.type !== "weekly" && item.type !== "monthly",
  );
  const previous = new Map(
    current.reports.filter((item) => item.periodKey).map((item) => [item.periodKey as string, item]),
  );
  const scheduled = collectScheduledReports(new Date(), current.findings).map((item) => {
    const prev = item.periodKey ? previous.get(item.periodKey) : undefined;
    return prev ? { ...prev, ...item, id: prev.id } : { ...item, id: nid("rp") };
  });
  const reports = [...scheduled, ...others].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const unchanged =
    reports.length === current.reports.length &&
    reports.every((item, index) => {
      const prev = current.reports[index];
      return prev && prev.id === item.id && prev.periodKey === item.periodKey && prev.findingIds.join() === item.findingIds.join();
    });
  return unchanged ? current : { ...current, reports };
}

function startScheduleWatch() {
  if (typeof window === "undefined" || scheduleTimer) return;
  scheduleTimer = window.setInterval(() => {
    mutate((current) => withScheduledReports(current));
  }, 60_000);
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = withScheduledReports(load());
  hydrated = true;
  startScheduleWatch();
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota errors are handled on later writes.
  }
}

function persist() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      const slim = {
        ...state,
        observations: state.observations.map((item) => ({
          ...item,
          imageUrl: item.imageUrl.startsWith("data:") ? "" : item.imageUrl,
        })),
      };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(slim));
      } catch {
        // Keep the in-memory workbench even if the browser quota is exhausted.
      }
    }
  }
  listeners.forEach((listener) => listener());
}

function mutate(updater: (current: CampusState) => CampusState) {
  state = updater(state);
  persist();
}

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function privacyOf(name: string) {
  let h = 0;
  const text = `${name}:${Date.now()}`;
  for (let i = 0; i < text.length; i += 1) h = (h * 33 + text.charCodeAt(i)) >>> 0;
  const hash = `phash:${h.toString(16).padStart(8, "0")}`;
  return { desensitized: true, hash, credentialId: `pvc_${h.toString(16)}` };
}

function changeTypeFor(locationId: string, cardId: string | undefined, level: Finding["level"], extraEvidence?: boolean): Finding["changeType"] {
  const history = state.findings.filter((item) => item.locationId === locationId && item.cardId === cardId);
  const closed = history.some((item) => item.status === "closed");
  if (closed) return "复发";
  if (extraEvidence) return "扩大";
  if (level === "NORMAL") return "恢复";
  return history.length ? "扩大" : "新增";
}

export function hydrateStore() {
  ensureHydrated();
  listeners.forEach((listener) => listener());
}

export function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverState = emptyState();

export function getStore() {
  ensureHydrated();
  return state;
}

export function getServerStore() {
  return serverState;
}

export function useCampusStore() {
  return useSyncExternalStore(subscribeStore, getStore, getServerStore);
}

export function allLocations(current: CampusState = state): Location[] {
  const pins = current.campusMap?.locationPins ?? {};
  const labels = current.campusMap?.locationLabels ?? {};
  return [...seedLocations, ...current.customLocations].map((item) => {
    const pin = pins[item.id];
    const label = labels[item.id];
    return {
      ...item,
      ...(pin ? { x: pin.x, y: pin.y } : {}),
      ...(label
        ? {
            short: label.short || item.short,
            name: label.name || item.name,
            building: label.building || item.building,
            floor: label.floor || item.floor,
          }
        : {}),
    };
  });
}

export function useLocations() {
  const store = useCampusStore();
  return allLocations(store);
}

function findLocation(locationId: string, current: CampusState = state) {
  return allLocations(current).find((item) => item.id === locationId);
}

export async function fileToImageUrl(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const max = 960;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}

function isOpenFinding(item: Finding) {
  return item.status !== "closed" && item.status !== "false_positive";
}

function findOpenFinding(locationId: string, cardId: string | undefined) {
  if (!cardId) return undefined;
  return state.findings.find((item) => item.locationId === locationId && item.cardId === cardId && isOpenFinding(item));
}

function runMany(input: {
  locationId: string;
  imageName: string;
  imageUrl: string;
  source: Observation["source"];
  period: Period;
  weather: string;
  extraEvidence?: boolean;
  replaceFindingId?: string;
  vision?: VisionIdentifyResult;
  live?: boolean;
}) {
  const location = findLocation(input.locationId);
  if (!location) throw new Error("location not found");
  const payload = {
    location,
    observation: {
      id: nid("obs"),
      locationId: input.locationId,
      imageName: input.imageName,
      imageUrl: input.imageUrl,
      source: input.source,
      createdAt: new Date().toISOString(),
      privacy: privacyOf(input.imageName),
    } satisfies Observation,
    cards: state.cards,
    period: input.period,
    weather: input.weather,
    extraEvidence: input.extraEvidence,
  };
  const observation = payload.observation;
  const results = input.vision
    ? identifyFromVisionAll({ ...payload, vision: input.vision })
    : identifyAll(payload);
  const actionable = input.live
    ? results.filter((item) => item.finding.level !== "NORMAL" && item.finding.cardId)
    : results;
  if (input.live && !actionable.length) return [];

  const prepared = actionable.map((result, index) => {
    const existing =
      (index === 0 && input.replaceFindingId
        ? state.findings.find((item) => item.id === input.replaceFindingId)
        : undefined) ?? findOpenFinding(input.locationId, result.finding.cardId);
    const locked =
      existing &&
      (existing.status === "ticketed" ||
        existing.status === "rectifying" ||
        existing.status === "closed" ||
        existing.status === "confirmed");
    const changeType = changeTypeFor(
      input.locationId,
      result.finding.cardId,
      result.finding.level,
      input.extraEvidence,
    );
    const finding: Finding = {
      ...result.finding,
      id: existing?.id ?? result.finding.id,
      observationId: observation.id,
      createdAt: existing?.createdAt ?? result.finding.createdAt,
      recurrence: changeType === "复发",
      changeType,
      department: state.matrix[location.zoneType] ?? location.department,
      status: locked ? existing.status : result.finding.status,
      level: locked ? existing.level : result.finding.level,
      score: locked ? existing.score : result.finding.score,
      evidenceComplete: locked ? existing.evidenceComplete : result.finding.evidenceComplete,
      evidenceGap: locked ? existing.evidenceGap : result.finding.evidenceGap,
    };
    return {
      finding,
      trace: { ...result.trace, findingId: finding.id },
      replaced: Boolean(existing),
      needsReview: finding.status === "watch" || finding.level === "WATCH" || !finding.cardId,
    };
  });

  mutate((current) => {
    let findings = current.findings;
    for (const item of prepared) {
      findings = item.replaced
        ? findings.map((row) => (row.id === item.finding.id ? item.finding : row))
        : [item.finding, ...findings];
    }
    const newReviews = prepared
      .filter((item) => item.needsReview && !item.replaced)
      .map((item) => ({
        id: nid("rv"),
        findingId: item.finding.id,
        status: "pending" as const,
        note: item.finding.evidenceGap ?? "待人工复核",
        createdAt: new Date().toISOString(),
      }));
    return {
      ...current,
      observations: [observation, ...current.observations].slice(0, 80),
      findings: findings.slice(0, 80),
      traces: [...prepared.map((item) => item.trace), ...current.traces].slice(0, 80),
      reviews: [...newReviews, ...current.reviews],
    };
  });
  return prepared.map((item) => item.finding.id);
}

function runOne(input: Parameters<typeof runMany>[0]) {
  return runMany(input)[0] ?? "";
}

export function identifyFromMeta(input: {
  locationId: string;
  imageName: string;
  imageUrl: string;
  source?: Observation["source"];
  period: Period;
  weather: string;
  live?: boolean;
}) {
  return runMany({ ...input, source: input.source ?? "sample" });
}

export async function identifyFromCapture(input: {
  locationId: string;
  imageName: string;
  imageUrl: string;
  cameraName?: string;
  period: Period;
  weather: string;
  useVision?: boolean;
  live?: boolean;
}) {
  const location = findLocation(input.locationId);
  if (!location) throw new Error("location not found");
  const vision = input.useVision
    ? await requestVisionIdentify({
        imageDataUrl: input.imageUrl,
        location,
        period: input.period,
        weather: input.weather,
        cards: state.cards,
        cameraName: input.cameraName,
      })
    : undefined;
  return runMany({
    locationId: input.locationId,
    imageName: input.imageName,
    imageUrl: input.imageUrl,
    source: "camera",
    period: input.period,
    weather: input.weather,
    vision,
    live: input.live,
  });
}

export function addCustomLocation(input: {
  name: string;
  short?: string;
  building: string;
  floor: string;
  zoneType: string;
  zoneLabel: string;
  department: string;
  x?: number;
  y?: number;
}) {
  const location: Location = {
    id: nid("loc"),
    name: input.name.trim(),
    short: (input.short || input.name).trim().slice(0, 12),
    building: input.building.trim() || "现场建筑",
    floor: input.floor.trim() || "1F",
    zoneType: input.zoneType,
    zoneLabel: input.zoneLabel,
    x: input.x ?? 18 + Math.round(Math.random() * 64),
    y: input.y ?? 16 + Math.round(Math.random() * 64),
    cameraIds: [],
    department: input.department.trim() || "保卫处",
    crowdHint: "medium",
    schedule: "现场值守点位，按实际巡检节奏识别",
  };
  mutate((current) => ({
    ...current,
    customLocations: [location, ...current.customLocations],
    matrix: current.matrix[location.zoneType]
      ? current.matrix
      : { ...current.matrix, [location.zoneType]: location.department },
  }));
  return location;
}

export function addCamera(input: {
  name: string;
  locationId: string;
  coverage: string;
  sourceType: Camera["sourceType"];
  snapshotUrl?: string;
  deviceId?: string;
}) {
  const camera: Camera = {
    id: nid("cam"),
    name: input.name.trim(),
    locationId: input.locationId,
    status: "ONLINE",
    coverage: input.coverage.trim() || "现场全景",
    sourceType: input.sourceType,
    snapshotUrl: input.snapshotUrl?.trim() || undefined,
    deviceId: input.deviceId || undefined,
  };
  mutate((current) => ({
    ...current,
    cameras: [camera, ...current.cameras],
    customLocations: current.customLocations.map((item) =>
      item.id === input.locationId ? { ...item, cameraIds: [camera.id, ...item.cameraIds] } : item,
    ),
  }));
  return camera;
}

export function removeCamera(id: string) {
  mutate((current) => ({
    ...current,
    cameras: current.cameras.filter((item) => item.id !== id),
    customLocations: current.customLocations.map((item) => ({
      ...item,
      cameraIds: item.cameraIds.filter((cameraId) => cameraId !== id),
    })),
  }));
}

function campusMapOf(current: CampusState): CampusMapState {
  const map = current.campusMap ?? defaultCampusMap();
  return {
    ...defaultCampusMap(),
    ...map,
    landmarks: map.landmarks ?? defaultCampusMap().landmarks,
    locationPins: map.locationPins ?? {},
    hiddenLocationIds: map.hiddenLocationIds ?? [],
    locationLabels: map.locationLabels ?? {},
  };
}

export function addMapLandmark(kind: MapLandmarkKind, label?: string) {
  const landmark: MapLandmark = {
    id: nid("lm"),
    kind,
    label: label?.trim() || LANDMARK_KIND_LABEL[kind],
    x: 28 + Math.round(Math.random() * 44),
    y: 22 + Math.round(Math.random() * 48),
    w: kind === "field" ? 18 : 18,
    h: kind === "field" ? 14 : 16,
  };
  mutate((current) => {
    const campusMap = campusMapOf(current);
    return { ...current, campusMap: { ...campusMap, landmarks: [...campusMap.landmarks, landmark] } };
  });
  return landmark.id;
}

export function updateMapLandmark(id: string, patch: Partial<MapLandmark>) {
  mutate((current) => {
    const campusMap = campusMapOf(current);
    return {
      ...current,
      campusMap: {
        ...campusMap,
        landmarks: campusMap.landmarks.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      },
    };
  });
}

export function removeMapLandmark(id: string) {
  mutate((current) => {
    const campusMap = campusMapOf(current);
    return {
      ...current,
      campusMap: { ...campusMap, landmarks: campusMap.landmarks.filter((item) => item.id !== id) },
    };
  });
}

export function moveLocationPin(id: string, x: number, y: number) {
  mutate((current) => {
    const campusMap = campusMapOf(current);
    const custom = current.customLocations.some((item) => item.id === id);
    return {
      ...current,
      customLocations: custom
        ? current.customLocations.map((item) => (item.id === id ? { ...item, x, y } : item))
        : current.customLocations,
      campusMap: {
        ...campusMap,
        locationPins: { ...campusMap.locationPins, [id]: { x, y } },
      },
    };
  });
}

export function updateLocationLabel(id: string, patch: { short?: string; name?: string; building?: string; floor?: string }) {
  mutate((current) => {
    const campusMap = campusMapOf(current);
    const existing = allLocations(current).find((item) => item.id === id);
    if (!existing) return current;
    const next = {
      short: (patch.short ?? existing.short).trim().slice(0, 12) || existing.short,
      name: (patch.name ?? existing.name).trim() || existing.name,
      building: (patch.building ?? existing.building).trim() || existing.building,
      floor: (patch.floor ?? existing.floor).trim() || existing.floor,
    };
    const custom = current.customLocations.some((item) => item.id === id);
    return {
      ...current,
      customLocations: custom
        ? current.customLocations.map((item) => (item.id === id ? { ...item, ...next } : item))
        : current.customLocations,
      campusMap: {
        ...campusMap,
        locationLabels: { ...campusMap.locationLabels, [id]: next },
      },
    };
  });
}

export function hideLocationPin(id: string) {
  mutate((current) => {
    const campusMap = campusMapOf(current);
    if (campusMap.hiddenLocationIds.includes(id)) return current;
    return {
      ...current,
      campusMap: { ...campusMap, hiddenLocationIds: [...campusMap.hiddenLocationIds, id] },
    };
  });
}

export function restoreLocationPin(id: string) {
  mutate((current) => {
    const campusMap = campusMapOf(current);
    return {
      ...current,
      campusMap: {
        ...campusMap,
        hiddenLocationIds: campusMap.hiddenLocationIds.filter((item) => item !== id),
      },
    };
  });
}

export function resetCampusMap() {
  mutate((current) => {
    const customIds = new Set(current.customLocations.map((item) => item.id));
    return {
      ...current,
      customLocations: [],
      cameras: current.cameras.filter((item) => !customIds.has(item.locationId)),
      campusMap: defaultCampusMap(),
    };
  });
}

const LANDMARK_KIND_LABEL: Record<MapLandmarkKind, string> = {
  teach: "教学楼",
  lab: "实验楼",
  library: "图书馆",
  dorm: "宿舍",
  canteen: "食堂",
  gym: "体育馆",
  gate: "校门",
  field: "运动场",
  admin: "行政楼",
  custom: "其他建筑",
};

export async function identifyFiles(input: {
  files: File[];
  locationId: string;
  period: Period;
  weather: string;
}) {
  const jobId = nid("job");
  mutate((current) => ({
    ...current,
    jobs: [{
      id: jobId,
      title: `${input.files.length} 张批量判图`,
      locationId: input.locationId,
      total: input.files.length,
      done: 0,
      status: "running",
      findingIds: [],
      createdAt: new Date().toISOString(),
    }, ...current.jobs],
  }));
  const ids: string[] = [];
  for (const file of input.files) {
    const isVideo = file.type.startsWith("video/");
    const imageUrl = isVideo ? "" : await fileToImageUrl(file);
    let created: string[];
    if (isVideo) {
      created = runMany({
        locationId: input.locationId,
        imageName: file.name,
        imageUrl,
        source: "video",
        period: input.period,
        weather: input.weather,
      });
    } else if (await visionConfigured()) {
      created = await identifyFromCapture({
        locationId: input.locationId,
        imageName: file.name,
        imageUrl,
        period: input.period,
        weather: input.weather,
        useVision: true,
      });
    } else {
      created = runMany({
        locationId: input.locationId,
        imageName: file.name,
        imageUrl,
        source: "upload",
        period: input.period,
        weather: input.weather,
      });
    }
    ids.push(...created);
    mutate((current) => ({
      ...current,
      jobs: current.jobs.map((job) => {
        if (job.id !== jobId) return job;
        const nextDone = job.done + 1;
        return { ...job, done: nextDone, findingIds: ids, status: nextDone >= job.total ? "done" : "running" };
      }),
    }));
  }
  return ids;
}

export function identifyVoice(input: { locationId: string; transcript: string; period: Period; weather: string }) {
  return runOne({
    locationId: input.locationId,
    imageName: `voice_${input.transcript}.jpg`,
    imageUrl: "",
    source: "voice",
    period: input.period,
    weather: input.weather,
  });
}

export function probeFinding(findingId: string) {
  const finding = state.findings.find((item) => item.id === findingId);
  if (!finding) return;
  const observation = state.observations.find((item) => item.id === finding.observationId);
  runOne({
    locationId: finding.locationId,
    imageName: `${observation?.imageName ?? "probe"}_exit_clip.jpg`,
    imageUrl: observation?.imageUrl ?? "",
    source: "camera",
    period: finding.period,
    weather: finding.weather,
    extraEvidence: true,
    replaceFindingId: finding.id,
  });
}

export function createTicket(findingId: string, assignee = "值班员") {
  const finding = state.findings.find((item) => item.id === findingId);
  if (!finding) return;
  const card = state.cards.find((item) => item.id === finding.cardId);
  const ticket: Ticket = {
    id: nid("wo"),
    findingId,
    locationId: finding.locationId,
    title: finding.title,
    department: finding.department,
    assignee,
    status: "assigned",
    dueAt: new Date(Date.now() + finding.deadlineHours * 3600 * 1000).toISOString(),
    checklist: (card?.checklist ?? ["现场已整改"]).map((item) => ({ item, pass: null })),
    createdAt: new Date().toISOString(),
  };
  mutate((current) => ({
    ...current,
    tickets: [ticket, ...current.tickets],
    findings: current.findings.map((item) => (item.id === findingId ? { ...item, status: "ticketed" } : item)),
  }));
  return ticket.id;
}

export function updateTicketStatus(ticketId: string, status: Ticket["status"]) {
  mutate((current) => ({
    ...current,
    tickets: current.tickets.map((item) => (item.id === ticketId ? { ...item, status } : item)),
    findings: current.findings.map((finding) => {
      const ticket = current.tickets.find((item) => item.id === ticketId);
      if (!ticket || finding.id !== ticket.findingId) return finding;
      if (status === "in_progress" || status === "pending_verify") return { ...finding, status: "rectifying" };
      return finding;
    }),
  }));
}

export function submitRectification(ticketId: string, imageUrl: string, checklist: Ticket["checklist"]) {
  const passed = checklist.every((item) => item.pass === true);
  mutate((current) => ({
    ...current,
    tickets: current.tickets.map((item) =>
      item.id === ticketId
        ? {
            ...item,
            rectifyImageUrl: imageUrl,
            checklist,
            status: passed ? "closed" : "pending_verify",
            closedAt: passed ? new Date().toISOString() : undefined,
          }
        : item,
    ),
    findings: current.findings.map((finding) => {
      const ticket = current.tickets.find((item) => item.id === ticketId);
      if (!ticket || finding.id !== ticket.findingId) return finding;
      return passed
        ? { ...finding, status: "closed", level: "NORMAL", score: 12, evidenceGap: undefined, evidenceComplete: true }
        : { ...finding, status: "rectifying" };
    }),
  }));
}

export function markFalsePositive(findingId: string) {
  mutate((current) => ({
    ...current,
    findings: current.findings.map((item) =>
      item.id === findingId ? { ...item, status: "false_positive", level: "NORMAL", score: 10 } : item,
    ),
  }));
}

export function upsertCard(card: KnowledgeCard) {
  mutate((current) => {
    const exists = current.cards.some((item) => item.id === card.id);
    return {
      ...current,
      cards: exists ? current.cards.map((item) => (item.id === card.id ? card : item)) : [card, ...current.cards],
    };
  });
}

export function setCardStatus(cardId: string, status: KnowledgeCard["status"]) {
  mutate((current) => ({
    ...current,
    cards: current.cards.map((item) => (item.id === cardId ? { ...item, status } : item)),
  }));
}

export function generateReport(type: ReportType, findingIds: string[], title?: string) {
  const report: Report = {
    id: nid("rp"),
    type,
    title:
      title ??
      ({
        single: "单条隐患识别报告",
        batch: "批量判图汇总报告",
        daily: "校园安全日报",
        weekly: "校园安全周报",
        monthly: "校园安全月报",
      }[type]),
    findingIds,
    createdAt: new Date().toISOString(),
  };
  mutate((current) => ({ ...current, reports: [report, ...current.reports] }));
  return report.id;
}

export function ensureScheduledReports() {
  ensureHydrated();
  mutate((current) => withScheduledReports(current));
}

export function resetStore() {
  state = emptyState();
  hydrated = true;
  persist();
}

export function setRole(role: UserRole) {
  mutate((current) => ({ ...current, role }));
}

export function setMatrix(zoneType: string, department: string) {
  mutate((current) => ({ ...current, matrix: { ...current.matrix, [zoneType]: department } }));
}

export function resolveReview(reviewId: string, status: ReviewStatus, note: string) {
  mutate((current) => {
    const review = current.reviews.find((item) => item.id === reviewId);
    if (!review) return current;
    const finding = current.findings.find((item) => item.id === review.findingId);
    const card = finding ? current.cards.find((item) => item.id === finding.cardId) : undefined;
    const alreadyTicketed = finding ? current.tickets.some((item) => item.findingId === finding.id) : false;
    const findings = current.findings.map((item) => {
      if (item.id !== review.findingId) return item;
      if (status === "rejected") {
        return {
          ...item,
          status: "false_positive" as const,
          level: "NORMAL" as const,
          score: 8,
          evidenceComplete: true,
          evidenceGap: undefined,
        };
      }
      if (status === "approved") {
        const nextLevel =
          item.level === "WATCH" || item.level === "NORMAL"
            ? card?.baseLevel && card.baseLevel !== "WATCH" && card.baseLevel !== "NORMAL"
              ? card.baseLevel
              : "MEDIUM"
            : item.level;
        return {
          ...item,
          status: alreadyTicketed ? "ticketed" as const : "confirmed" as const,
          level: nextLevel,
          score: Math.max(item.score, nextLevel === "HIGH" ? 86 : 72),
          evidenceComplete: true,
          evidenceGap: undefined,
        };
      }
      return { ...item, status: "watch" as const };
    });
    let tickets = current.tickets;
    if (status === "approved" && finding && !alreadyTicketed) {
      const updated = findings.find((item) => item.id === finding.id) ?? finding;
      tickets = [{
        id: nid("wo"),
        findingId: finding.id,
        locationId: finding.locationId,
        title: finding.title,
        department: finding.department,
        assignee: "值班员",
        status: "assigned",
        dueAt: new Date(Date.now() + updated.deadlineHours * 3600 * 1000).toISOString(),
        checklist: (card?.checklist ?? ["现场已整改"]).map((item) => ({ item, pass: null })),
        createdAt: new Date().toISOString(),
      }, ...tickets];
    }
    return {
      ...current,
      reviews: current.reviews.map((item) => (item.id === reviewId ? { ...item, status, note } : item)),
      findings: status === "approved" && finding && !alreadyTicketed
        ? findings.map((item) => (item.id === finding.id ? { ...item, status: "ticketed" } : item))
        : findings,
      tickets,
    };
  });
}

export function pauseJob(jobId: string) {
  mutate((current) => ({
    ...current,
    jobs: current.jobs.map((item) => (item.id === jobId ? { ...item, status: item.status === "paused" ? "running" : "paused" } : item)),
  }));
}

export function locationState(findings: Finding[], locationId: string) {
  const open = findings.filter(
    (item) => item.locationId === locationId && item.status !== "closed" && item.status !== "false_positive",
  );
  if (!open.length) return { level: "NORMAL" as const, finding: undefined };
  const order = { HIGH: 4, MEDIUM: 3, WATCH: 2, NORMAL: 1 };
  const finding = [...open].sort((a, b) => order[b.level] - order[a.level])[0];
  return { level: finding.level, finding };
}
