import type { Period } from "./types";

export const MOCK_SHOTS: Record<string, { name: string; period: Period }> = {
  loc_b2_east: { name: "corridor_boxes.jpg", period: "peak" },
  loc_lab_302: { name: "lab_unattended_night.jpg", period: "night" },
  loc_dorm3: { name: "dorm_ebike_lobby.jpg", period: "night" },
  loc_elec: { name: "electrical_unsealed_hole.jpg", period: "normal" },
  loc_parking: { name: "outdoor_marked_ebike.jpg", period: "normal" },
  loc_canteen: { name: "canteen_gas_valve_燃气阀门后厨.jpg", period: "peak" },
  loc_south_gate: { name: "gate_crowd_mix_校门人车混行.jpg", period: "peak" },
  loc_site: { name: "scaffold_edge_harness_临边脚手架.jpg", period: "normal" },
};

export function captureFromVideo(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  const max = 1280;
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  const scale = Math.min(1, max / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法抓拍画面");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function currentPeriod(): Period {
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) return "night";
  if ((hour >= 11 && hour <= 13) || (hour >= 16 && hour <= 18)) return "peak";
  return "normal";
}
