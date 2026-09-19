import type { VisionHazard } from "./types";

export const VISION_PROMPT_VERSION = "prompt-campus-vision-04";

export function normalizeHazards(raw: unknown): VisionHazard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const levelRaw = String(row.level ?? "WATCH").toUpperCase();
      const level =
        levelRaw === "HIGH" || levelRaw === "MEDIUM" || levelRaw === "WATCH" || levelRaw === "NORMAL"
          ? levelRaw
          : "WATCH";
      return {
        title: String(row.title ?? "待确认隐患"),
        description: String(row.description ?? ""),
        level,
        objects: Array.isArray(row.objects) ? row.objects.map((value) => String(value)) : [],
        relations: Array.isArray(row.relations) ? row.relations.map((value) => String(value)) : [],
        cardId: row.cardId ? String(row.cardId) : undefined,
        evidenceComplete: Boolean(row.evidenceComplete),
        evidenceGap: row.evidenceGap ? String(row.evidenceGap) : undefined,
        confidence: Number(row.confidence ?? 0.7),
        score: Number(row.score ?? 60),
      } satisfies VisionHazard;
    })
    .filter((item) => {
      if (!item.title || !item.cardId || item.level === "NORMAL") return false;
      const blob = `${item.title}\n${item.description}`;
      return !/未发现|未见可见|不命中|故不认定|未认定具体|没有隐患/.test(blob);
    });
}
