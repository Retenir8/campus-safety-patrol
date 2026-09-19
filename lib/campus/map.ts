import type { CampusMapState, MapLandmark, MapLandmarkKind } from "./types";

export const LANDMARK_KINDS: { id: MapLandmarkKind; label: string }[] = [
  { id: "teach", label: "教学楼" },
  { id: "lab", label: "实验楼" },
  { id: "library", label: "图书馆" },
  { id: "dorm", label: "宿舍" },
  { id: "canteen", label: "食堂" },
  { id: "gym", label: "体育馆" },
  { id: "admin", label: "行政楼" },
  { id: "gate", label: "校门" },
  { id: "field", label: "运动场" },
  { id: "custom", label: "其他建筑" },
];

export const defaultLandmarks: MapLandmark[] = [
  { id: "lm_lab", kind: "lab", label: "实验楼", x: 20, y: 28, w: 20, h: 18 },
  { id: "lm_teach", kind: "teach", label: "教学楼 B", x: 50, y: 32, w: 22, h: 20 },
  { id: "lm_lib", kind: "library", label: "图书馆", x: 36, y: 68, w: 20, h: 18 },
  { id: "lm_dorm", kind: "dorm", label: "学生公寓", x: 76, y: 66, w: 20, h: 18 },
  { id: "lm_canteen", kind: "canteen", label: "食堂", x: 16, y: 70, w: 18, h: 16 },
  { id: "lm_field", kind: "field", label: "运动场", x: 82, y: 18, w: 18, h: 14 },
];

export function defaultCampusMap(): CampusMapState {
  return {
    landmarks: defaultLandmarks.map((item) => ({ ...item })),
    locationPins: {},
    hiddenLocationIds: [],
    locationLabels: {},
  };
}

export function landmarkKindLabel(kind: MapLandmarkKind) {
  return LANDMARK_KINDS.find((item) => item.id === kind)?.label ?? "建筑";
}
