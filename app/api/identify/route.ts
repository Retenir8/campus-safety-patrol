import { loadServerVision } from "@/lib/campus/vision-env";
import { VISION_PROMPT_VERSION, normalizeHazards } from "@/lib/campus/vision-schema";

export const runtime = "edge";

type IdentifyBody = {
  image?: string;
  period?: string;
  weather?: string;
  cameraName?: string;
  location?: {
    name?: string;
    building?: string;
    floor?: string;
    zoneType?: string;
    zoneLabel?: string;
    schedule?: string;
    crowdHint?: string;
  };
  cards?: Array<{
    id: string;
    title: string;
    clause: string;
    source: string;
    text: string;
    zoneType: string;
    riskType: string;
    baseLevel: string;
    visualCues: string[];
    negativeCues: string[];
  }>;
};

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型未返回 JSON");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

export async function POST(request: Request) {
  const body = (await request.json()) as IdentifyBody;
  const image = body.image?.trim() ?? "";
  if (!image.startsWith("data:image/")) {
    return Response.json({ error: "需要摄像头抓拍后的图片" }, { status: 400 });
  }
  if (image.length > 6_000_000) {
    return Response.json({ error: "抓拍图片过大，请降低分辨率后重试" }, { status: 413 });
  }

  const vision = loadServerVision();
  const baseUrl = vision.baseUrl;
  const apiKey = vision.apiKey;
  const model = vision.model;
  if (!apiKey) {
    return Response.json({ error: "VISION_NOT_CONFIGURED" }, { status: 400 });
  }

  const location = body.location ?? {};
  const cards = (body.cards ?? []).slice(0, 48);
  const cardHint = cards
    .map((card) => `- ${card.id}｜${card.title}｜${card.zoneType}｜${card.baseLevel}｜线索:${card.visualCues.join("、")}｜排除:${card.negativeCues.join("、")}｜${card.text.slice(0, 80)}`)
    .join("\n");

  const userText = [
    "你是校园安全视觉巡检模型。只根据图片中可见事实判断，不要臆造看不见的物体。",
    "只输出真正违反的知识库条款。画面里没有违规时，hazards 必须是空数组。",
    "禁止把“逐项核对”“未发现”“不命中某条款”写成一条 hazard。这些分析不要出现在 hazards 里。",
    "紧急危险（明火、火焰、打火机正在点火、燃烧、烟雾、冒烟）只要看得见，就命中对应条款，level 为 HIGH。",
    "其他隐患仅在画面证据足够时命中条款。看不清就不要写进 hazards。",
    `点位：${location.name ?? "未知"}（${location.building ?? ""} ${location.floor ?? ""}）`,
    `区域类型：${location.zoneLabel ?? location.zoneType ?? "未知"}`,
    `摄像头：${body.cameraName ?? "现场抓拍"}`,
    "知识库条款：",
    cardHint || "（无）",
    "输出 JSON：sceneSummary, hazards[{title,level,cardId,evidenceComplete,confidence,score}]。",
    "每条 hazard 必须带 cardId，title 必须用该条款的 title，不要自行写长段分析。",
    "看见明火用 CAMPUS-FIRE-NOW；看见烟雾用 CAMPUS-SMOKE-NOW。",
  ].join("\n");

  const started = Date.now();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You are a campus safety vision inspector. Return only violated knowledge-base clauses. If nothing is violated, return hazards as []. Never write a no-finding analysis as a hazard. Reply with a single JSON object.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
    model?: string;
  };
  if (!response.ok) {
    return Response.json({ error: payload.error?.message || "视觉模型调用失败" }, { status: 502 });
  }

  const content = payload.choices?.[0]?.message?.content ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "模型输出无法解析" }, { status: 502 });
  }

  const hazards = normalizeHazards(parsed.hazards);
  return Response.json({
    sceneSummary: String(parsed.sceneSummary ?? location.name ?? "现场抓拍"),
    hazards,
    model: payload.model || model,
    promptVersion: VISION_PROMPT_VERSION,
    tokens: payload.usage?.total_tokens ?? 0,
    latencyMs: Date.now() - started,
  });
}
