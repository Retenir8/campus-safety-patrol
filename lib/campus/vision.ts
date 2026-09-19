import { isEmergencyRisk } from "./knowledge-cards";
import type { KnowledgeCard, Location, Period, VisionIdentifyResult } from "./types";
import { VISION_PROMPT_VERSION } from "./vision-schema";

export { VISION_PROMPT_VERSION };

let configuredCache: boolean | undefined;
let configuredPending: Promise<boolean> | undefined;

export async function visionConfigured() {
  if (typeof window === "undefined") return false;
  if (configuredCache !== undefined) return configuredCache;
  if (!configuredPending) {
    configuredPending = (async () => {
      try {
        const response = await fetch("/api/vision/status");
        const payload = (await response.json()) as { configured?: boolean };
        configuredCache = Boolean(payload.configured);
      } catch {
        configuredCache = false;
      }
      return configuredCache ?? false;
    })();
  }
  return configuredPending;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function fetchCameraSnapshot(url: string) {
  try {
    const direct = await fetch(url, { cache: "no-store" });
    if (direct.ok) {
      const blob = await direct.blob();
      if (blob.type.startsWith("image/") || blob.size > 0) return blobToDataUrl(blob);
    }
  } catch {
    // CORS or mixed-content: fall through to the same-origin proxy.
  }
  const response = await fetch("/api/camera/snapshot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const payload = (await response.json()) as { dataUrl?: string; error?: string };
  if (!response.ok || !payload.dataUrl) throw new Error(payload.error || "摄像头抓拍失败");
  return payload.dataUrl;
}

export function pickCardsForVision(cards: KnowledgeCard[], location: Location) {
  const active = cards.filter((card) => card.status === "ACTIVE");
  const emergency = active.filter((card) => isEmergencyRisk(card.riskType));
  const rest = active.filter((card) => !isEmergencyRisk(card.riskType));
  const sameZone = rest.filter((card) => card.zoneType === location.zoneType);
  const others = rest.filter((card) => card.zoneType !== location.zoneType);
  return [...emergency, ...sameZone, ...others].slice(0, 48);
}

export async function requestVisionIdentify(input: {
  imageDataUrl: string;
  location: Location;
  period: Period;
  weather: string;
  cards: KnowledgeCard[];
  cameraName?: string;
}) {
  const cards = pickCardsForVision(input.cards, input.location);
  const response = await fetch("/api/identify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      image: input.imageDataUrl,
      period: input.period,
      weather: input.weather,
      cameraName: input.cameraName,
      location: {
        id: input.location.id,
        name: input.location.name,
        building: input.location.building,
        floor: input.location.floor,
        zoneType: input.location.zoneType,
        zoneLabel: input.location.zoneLabel,
        schedule: input.location.schedule,
        crowdHint: input.location.crowdHint,
      },
      cards: cards.map((card) => ({
          id: card.id,
          title: card.title,
          clause: card.clause,
          source: card.source,
          text: card.text,
          zoneType: card.zoneType,
          riskType: card.riskType,
          baseLevel: card.baseLevel,
          visualCues: card.visualCues,
          negativeCues: card.negativeCues,
        })),
    }),
  });
  const payload = (await response.json()) as VisionIdentifyResult & { error?: string };
  if (!response.ok) {
    const message = payload.error === "VISION_NOT_CONFIGURED" ? "请在本地 .env.local 中配置 VISION_API_KEY" : payload.error || "大模型识别失败";
    throw new Error(message);
  }
  return payload;
}
