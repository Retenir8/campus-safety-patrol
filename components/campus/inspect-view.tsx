"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Radio, Video, Wifi } from "lucide-react";
import { toast } from "sonner";
import { MOCK_SHOTS, captureFromVideo, currentPeriod } from "@/lib/campus/shots";
import { isEmergencyRisk } from "@/lib/campus/knowledge-cards";
import {
  createTicket,
  getStore,
  identifyFromCapture,
  identifyFromMeta,
  markFalsePositive,
  useCampusStore,
  useLocations,
} from "@/lib/campus/store";
import type { CameraSource, Finding } from "@/lib/campus/types";
import { fetchCameraSnapshot, visionConfigured } from "@/lib/campus/vision";
import { ClauseBox, LevelBadge, PageHeader } from "./bits";

function sourceLabel(source: CameraSource) {
  if (source === "webcam") return "本机摄像头";
  if (source === "snapshot") return "IP 抓拍";
  return "演示画面";
}

export default function InspectView() {
  const store = useCampusStore();
  const locations = useLocations();
  const cameras = store.cameras;
  const [activeId, setActiveId] = useState(cameras[0]?.id ?? "");
  const [monitoring, setMonitoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liveHits, setLiveHits] = useState<Finding[]>([]);
  const [lastChecked, setLastChecked] = useState<string>();
  const [shotUrl, setShotUrl] = useState<string>();
  const [visionReady, setVisionReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);

  const camera = cameras.find((item) => item.id === activeId) ?? cameras[0];
  const location = locations.find((item) => item.id === camera?.locationId);
  const treeGroups = useMemo(() => {
    const grouped = new Map<string, typeof cameras>();
    for (const item of cameras) {
      const loc = locations.find((entry) => entry.id === item.locationId);
      const key = loc?.building ?? "未绑定场景";
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }
    return [...grouped.entries()].map(([building, items]) => ({ building, items }));
  }, [cameras, locations]);

  useEffect(() => {
    if (camera && !cameras.some((item) => item.id === activeId)) setActiveId(camera.id);
  }, [cameras, camera, activeId]);

  function stopPreview() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    let cancelled = false;
    void visionConfigured().then((ready) => {
      if (!cancelled) setVisionReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function startPreview() {
      stopPreview();
      setShotUrl(undefined);
      setLiveHits([]);
      setLastChecked(undefined);
      if (!camera) return;
      if (camera.sourceType === "webcam") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: camera.deviceId
              ? { deviceId: { exact: camera.deviceId } }
              : { facingMode: "environment", width: { ideal: 1280 } },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
        } catch {
          if (!cancelled) toast.error("无法打开本机摄像头，请检查浏览器权限");
        }
        return;
      }
      if (camera.sourceType === "snapshot" && camera.snapshotUrl) {
        try {
          const url = await fetchCameraSnapshot(camera.snapshotUrl);
          if (!cancelled) setShotUrl(url);
        } catch (error) {
          if (!cancelled) toast.error(error instanceof Error ? error.message : "IP 摄像头抓拍失败");
        }
      }
    }
    void startPreview();
    return () => {
      cancelled = true;
      stopPreview();
    };
  }, [camera?.id, camera?.sourceType, camera?.deviceId, camera?.snapshotUrl]);

  async function grabFrame() {
    if (!camera || !location) throw new Error("请先选择摄像头");
    let imageUrl = shotUrl;
    let imageName = `${camera.id}_${Date.now()}.jpg`;
    let shotPeriod = currentPeriod();
    if (camera.sourceType === "webcam") {
      if (!videoRef.current) throw new Error("预览尚未就绪");
      imageUrl = captureFromVideo(videoRef.current);
    } else if (camera.sourceType === "snapshot") {
      imageUrl = camera.snapshotUrl ? await fetchCameraSnapshot(camera.snapshotUrl) : shotUrl;
      if (imageUrl) setShotUrl(imageUrl);
    } else {
      const shot = MOCK_SHOTS[location.id];
      imageUrl = "";
      imageName = `${shot?.name ?? imageName} ${location.zoneLabel} ${location.name}`;
      shotPeriod = shot?.period ?? shotPeriod;
    }
    if (!imageUrl && camera.sourceType !== "mock") throw new Error("还没有可监测的画面");
    return { imageUrl, imageName, shotPeriod };
  }

  async function scanOnce() {
    if (!camera || !location || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const { imageUrl, imageName, shotPeriod } = await grabFrame();
      const useVision = visionReady && camera.sourceType !== "mock";
      const ids = useVision
        ? await identifyFromCapture({
            locationId: location.id,
            imageName,
            imageUrl,
            cameraName: camera.name,
            period: shotPeriod,
            weather: "晴",
            useVision: true,
            live: true,
          })
        : identifyFromMeta({
            locationId: location.id,
            imageName,
            imageUrl,
            source: "camera",
            period: shotPeriod,
            weather: "晴",
            live: true,
          });
      const hits = getStore().findings.filter((item) => ids.includes(item.id) && item.cardId && item.level !== "NORMAL");
      setLiveHits(hits);
      setLastChecked(new Date().toISOString());
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!monitoring || !camera) return;
    let cancelled = false;
    busyRef.current = false;
    const tick = async () => {
      if (cancelled || busyRef.current) return;
      try {
        await scanOnce();
      } catch (error) {
        const message = error instanceof Error ? error.message : "监测已停止";
        if (message.includes("预览尚未就绪") || message.includes("还没有可监测")) return;
        if (!cancelled) {
          setMonitoring(false);
          toast.error(message);
        }
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), camera.sourceType === "mock" ? 8000 : 5000);
    return () => {
      cancelled = true;
      busyRef.current = false;
      window.clearInterval(timer);
    };
  }, [monitoring, camera?.id, camera?.sourceType, visionReady]);

  function toggleMonitor() {
    if (monitoring) {
      setMonitoring(false);
      return;
    }
    if (!camera) return;
    if (camera.sourceType !== "mock" && !visionReady) {
      toast.error("请在项目根目录 .env.local 中配置 VISION_API_KEY");
      return;
    }
    setMonitoring(true);
  }

  const orderedHits = [...liveHits].sort((a, b) => {
    const emergencyA = isEmergencyRisk(store.cards.find((card) => card.id === a.cardId)?.riskType) ? 0 : 1;
    const emergencyB = isEmergencyRisk(store.cards.find((card) => card.id === b.cardId)?.riskType) ? 0 : 1;
    return emergencyA - emergencyB;
  });

  return (
    <div className="page-stack camera-page">
      <PageHeader
        title="隐患识别"
        desc="监测画面中已经发生的危险，并对照知识库识别隐患。"
      />
      <div className="camera-work">
        <aside className="panel camera-tree">
          <header className="panel-head">
            <div>
              <h3>监测点位</h3>
              <p>{cameras.filter((item) => item.status === "ONLINE").length} 路在线</p>
            </div>
          </header>
          <div className="camera-tree-scroll">
            {treeGroups.map((group) => (
              <div key={group.building} className="tree-group">
                <div className="tree-group-title">{group.building}</div>
                {group.items.map((item) => {
                  const loc = locations.find((entry) => entry.id === item.locationId);
                  return (
                    <button
                      key={item.id}
                      className={`list-row ${item.id === camera?.id ? "selected" : ""}`}
                      onClick={() => setActiveId(item.id)}
                    >
                      {item.sourceType === "webcam" ? <Video size={16} /> : item.sourceType === "snapshot" ? <Wifi size={16} /> : <Camera size={16} />}
                      <div>
                        <strong>{item.name}</strong>
                        <small>{loc?.short ?? "未绑定点位"} · {sourceLabel(item.sourceType)}</small>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        <section className="panel camera-preview">
          <div className="live-stage">
            {camera?.sourceType === "webcam" ? (
              <video ref={videoRef} playsInline muted />
            ) : shotUrl ? (
              <img src={shotUrl} alt={camera?.name ?? "监测画面"} />
            ) : (
              <div className="live-empty">{camera?.sourceType === "mock" ? "演示画面" : "等待摄像头画面"}</div>
            )}
            <div className={`live-overlay ${monitoring ? "watching" : ""}`}>
              <span className="live-dot" />
              {monitoring ? "正在监测" : "未监测"}
            </div>
          </div>
          <p className="muted">
            {location?.name ?? "未绑定场景"}
            {monitoring ? " · 正在识别紧急危险并对照知识库" : " · 开始监测后识别紧急危险和隐患"}
          </p>
          <div className="action-row">
            <button className={monitoring ? "secondary-action" : "primary-action"} disabled={!camera} onClick={toggleMonitor}>
              <Radio size={14} /> {monitoring ? (busy ? "监测中…" : "停止监测") : "开始监测"}
            </button>
          </div>
        </section>

        <aside className="panel camera-side">
          <header className="panel-head">
            <div>
              <h3>识别结果</h3>
              <p>{liveHits.length ? `命中 ${liveHits.length} 条条款` : "只显示违反的条例"}</p>
            </div>
          </header>
          {!liveHits.length ? (
            <div className="empty-block">
              <p>
                {!monitoring
                  ? "开始监测后，违反的条例会显示在这里"
                  : lastChecked
                    ? "当前画面未命中条例"
                    : "正在对照知识库…"}
              </p>
            </div>
          ) : (
            <div className="inspect-hits">
              {orderedHits.map((item) => {
                const card = store.cards.find((entry) => entry.id === item.cardId);
                if (!card) return null;
                const emergency = isEmergencyRisk(card.riskType);
                return (
                  <article key={item.id} className={`inspect-hit${emergency ? " is-emergency" : ""}`}>
                    <div className="detail-heading">
                      <h3>{card.title}</h3>
                      <LevelBadge level={item.level} />
                    </div>
                    <ClauseBox card={card} />
                    <div className="action-row">
                      {item.level !== "NORMAL" && item.status !== "ticketed" && item.status !== "closed" && item.status !== "rectifying" ? (
                        <button className="primary-action" onClick={() => {
                          createTicket(item.id);
                          setLiveHits((current) => current.map((hit) => hit.id === item.id ? { ...hit, status: "ticketed" } : hit));
                          toast.success("已派发工单");
                        }}>
                          派发工单
                        </button>
                      ) : null}
                      <button className="secondary-action" onClick={() => { markFalsePositive(item.id); setLiveHits((current) => current.filter((hit) => hit.id !== item.id)); toast.message("已标为误报"); }}>
                        标为误报
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
