import { NextRequest } from "next/server";

const location = {
  id: "loc_teaching_b_2f_east",
  name: "教学楼B二层东侧疏散通道",
  building_id: "building_b",
  floor: 2,
  zone_type: "evacuation_corridor",
  position_3d: { x: 12.4, y: 5.8, z: -18.2 },
  camera_ids: ["cam_b2_east_01"],
  static_risk_tags: ["high_crowd_period", "evacuation_route"],
  mock_scenario: "corridor_obstruction_need_probe",
};

const riskState = {
  level: "WATCH", score: 0.64, primary_risk: "疏散通道疑似堆物",
  factors: ["纸箱位于疏散走廊", "靠近安全出口标识"],
  clause_refs: ["GB-55037-4.2.1"], evidence_completeness: 0.58, confidence: 0.76,
};

const cameras = [
  { id: "cam_b2_east_01", campus: "青澜大学", building: "教学楼B", floor: 2, location: location.id, status: "ONLINE", stream_url: "/mock/corridor_cam_01.mp4" },
  { id: "cam_lab_302_03", campus: "青澜大学", building: "实验楼", floor: 3, location: "loc_lab_302", status: "ONLINE", stream_url: "/mock/lab_cam_03.mp4" },
];

const cards = [
  { id: "GB-55037-4.2.1", source: "建筑防火通用规范", clause: "4.2.1", text: "疏散走道、楼梯间及安全出口应保持畅通。", domain: "消防安全", zone_type: "evacuation_corridor", risk_type: "obstruction", risk_level: "HIGH", version: "v2.1", status: "ACTIVE" },
  { id: "LAB-OPS-7.3", source: "校级实验室安全管理办法", clause: "7.3", text: "无人值守期间不得运行高风险设备。", domain: "实验室安全", zone_type: "laboratory", risk_type: "unattended_operation", risk_level: "HIGH", version: "v1.4", status: "ACTIVE" },
];

function json(data: unknown, status = 200) {
  return Response.json({ data, mock: true, timestamp: "2026-09-14T09:31:16+08:00" }, { status });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  if (route === "campus/scene") return json({ campus_id: "campus_qinglan", buildings: 12, locations: 128, model_ref: "/mock/campus.glb" });
  if (route === "locations") return json([location]);
  if (route.match(/^locations\/[^/]+\/state$/)) return json({ location_id: location.id, risk_state: riskState, evidence_gap: "缺少安全出口与纸箱整体空间关系" });
  if (route.match(/^locations\/[^/]+\/timeline$/)) return json([{ at: "09:31:04", type: "observation.created" }, { at: "09:31:09", type: "agent.waiting.evidence" }]);
  if (route.match(/^locations\/[^/]+\/evidence$/)) return json([{ id: "ev_image_01", modality: "image", reliability: 0.82 }, { id: "ev_schedule_01", modality: "system", reliability: 1 }]);
  if (route.match(/^locations\/[^/]+$/)) return json(location);
  if (route === "cameras") return json(cameras);
  if (route.match(/^cameras\/[^/]+\/perception$/)) return json({ scene_summary: "纸箱靠近安全出口，通行路径可能受影响", relations: ["boxes inside corridor", "boxes near exit"], risk_hypothesis: "corridor_obstruction" });
  if (route.match(/^cameras\/[^/]+\/stream$/)) return json({ stream_url: "/mock/corridor_cam_01.mp4", fallback: "synthetic_scene" });
  if (route === "kb/cards") return json(cards);
  if (route.match(/^kb\/cards\/[^/]+$/)) return json({ ...cards[0], visual_cues: ["纸箱", "出口标识", "通行宽度"], negative_cues: ["位于边界外"], rectification: ["移除障碍物", "补拍整改全景"] });
  if (route === "governance/traces") return json([{ trace_id: "tr_20260914_00031", location_id: location.id, status: "WAITING_EVIDENCE", model: "mock-mm-v2" }]);
  if (route === "governance/metrics") return json({ calls: 1286, latency_ms: 1800, error_rate: 0.013, human_review_rate: 0.084, probe_rate: 0.21, evidence_completeness: 0.92 });
  if (route.match(/^governance\/traces\/[^/]+$/) || route.match(/^agent\/runs\/[^/]+$/)) return json({ trace_id: "tr_20260914_00031", session_id: "ses_demo_a_01", location_id: location.id, status: "WAITING_EVIDENCE", nodes: ["ingest", "privacy", "scene_fusion", "grounding", "retrieve", "hypothesis", "evidence_gap", "active_probe"] });
  if (route.match(/^agent\/runs\/[^/]+\/events$/)) {
    const body = [
      "event: agent.node.updated\ndata: {\"node\":\"evidence_gap\",\"status\":\"SUCCESS\",\"progress\":0.58}\n\n",
      "event: agent.waiting.evidence\ndata: {\"probe_id\":\"probe_cam_01\",\"status\":\"WAITING\"}\n\n",
      "event: location.risk.updated\ndata: {\"from\":\"WATCH\",\"to\":\"HIGH\",\"risk_score\":0.88}\n\n",
    ].join("");
    return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  }
  return json({ error: "Mock route not found", route }, 404);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  const payload = await request.json().catch(() => ({}));
  if (route === "observations") return json({ id: "obs_demo_00041", status: "CREATED", ...payload }, 201);
  if (route.match(/^observations\/[^/]+\/attach$/)) return json({ observation_id: path[1], attached: true });
  if (route === "agent/runs") return json({ trace_id: "tr_20260914_00031", status: "RUNNING", current_node: "ingest" }, 201);
  if (route === "agent/sessions") return json({ session_id: "ses_demo_a_01", location_id: location.id }, 201);
  if (route.match(/^agent\/sessions\/[^/]+\/messages$/)) return json({ message_id: "msg_demo_12", accepted: true, content: payload });
  if (route.match(/^agent\/probes\/[^/]+\/complete$/)) return json({ probe_id: path[2], status: "COMPLETED", run_resumed: true });
  if (route.match(/^cameras\/[^/]+\/(snapshot|clip)$/)) return json({ camera_id: path[1], media_ref: `/mock/${path[2]}_demo_01`, captured: true });
  if (route === "kb/search") return json({ results: cards, query: payload });
  if (route === "kb/cards") return json({ id: "TEMP-NEW-02", status: "DRAFT", ...payload }, 201);
  if (route.match(/^kb\/cards\/[^/]+\/activate$/)) return json({ id: path[2], status: "ACTIVE", effective_immediately: true });
  if (route.match(/^governance\/reviews\/[^/]+$/)) return json({ trace_id: path[2], review: payload, saved: true });
  return json({ error: "Mock route not found", route }, 404);
}
