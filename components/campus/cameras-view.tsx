"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Plus, RefreshCw, Trash2, Video, Wifi } from "lucide-react";
import { toast } from "sonner";
import { zoneCatalog } from "@/lib/campus/seed";
import { addCamera, addCustomLocation, removeCamera, useCampusStore, useLocations } from "@/lib/campus/store";
import type { CameraSource } from "@/lib/campus/types";
import { fetchCameraSnapshot } from "@/lib/campus/vision";
import { PageHeader } from "./bits";

const departments = ["保卫处", "后勤处", "学生处", "实验室与设备管理处", "总务/食堂"];

function sourceLabel(source: CameraSource) {
  if (source === "webcam") return "本机摄像头";
  if (source === "snapshot") return "IP 抓拍";
  return "演示画面";
}

export default function CamerasView() {
  const store = useCampusStore();
  const locations = useLocations();
  const cameras = store.cameras;
  const [activeId, setActiveId] = useState(cameras[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [shotUrl, setShotUrl] = useState<string>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const [sceneForm, setSceneForm] = useState({
    name: "",
    building: "",
    floor: "1F",
    zoneType: zoneCatalog[0]?.id ?? "evacuation_corridor",
    department: zoneCatalog[0]?.department ?? "保卫处",
  });
  const [camForm, setCamForm] = useState({
    name: "",
    locationId: locations[0]?.id ?? "",
    coverage: "现场全景",
    sourceType: "webcam" as CameraSource,
    snapshotUrl: "",
    deviceId: "",
  });

  useEffect(() => {
    if (!camForm.locationId && locations[0]) setCamForm((prev) => ({ ...prev, locationId: locations[0].id }));
  }, [locations, camForm.locationId]);

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
    async function startPreview() {
      stopPreview();
      setShotUrl(undefined);
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
          const list = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) setDevices(list.filter((item) => item.kind === "videoinput"));
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

  async function refreshSnapshot() {
    if (!camera?.snapshotUrl) return;
    setBusy(true);
    try {
      const url = await fetchCameraSnapshot(camera.snapshotUrl);
      setShotUrl(url);
      toast.success("已刷新画面");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新失败");
    } finally {
      setBusy(false);
    }
  }

  function submitScene() {
    if (!sceneForm.name.trim() || !sceneForm.building.trim()) {
      toast.error("请填写场景名称和建筑");
      return;
    }
    const zone = zoneCatalog.find((item) => item.id === sceneForm.zoneType) ?? zoneCatalog[0];
    const created = addCustomLocation({
      name: sceneForm.name,
      building: sceneForm.building,
      floor: sceneForm.floor,
      zoneType: zone.id,
      zoneLabel: zone.label,
      department: sceneForm.department,
    });
    setCamForm((prev) => ({ ...prev, locationId: created.id }));
    setSceneForm({ name: "", building: "", floor: "1F", zoneType: zone.id, department: sceneForm.department });
    toast.success(`已登记场景：${created.short}`);
  }

  function submitCamera() {
    if (!camForm.name.trim() || !camForm.locationId) {
      toast.error("请填写摄像头名称并选择场景");
      return;
    }
    if (camForm.sourceType === "snapshot" && !camForm.snapshotUrl.trim()) {
      toast.error("IP 摄像头需要填写 JPEG 抓拍地址");
      return;
    }
    const created = addCamera({
      name: camForm.name,
      locationId: camForm.locationId,
      coverage: camForm.coverage,
      sourceType: camForm.sourceType,
      snapshotUrl: camForm.snapshotUrl,
      deviceId: camForm.deviceId || undefined,
    });
    setActiveId(created.id);
    setCamForm((prev) => ({ ...prev, name: "", snapshotUrl: "" }));
    toast.success(`已接入 ${created.name}`);
  }

  function handleRemove() {
    if (!camera) return;
    const remaining = cameras.filter((item) => item.id !== camera.id);
    removeCamera(camera.id);
    setActiveId(remaining[0]?.id ?? "");
    toast.success("已移除摄像头");
  }

  return (
    <div className="page-stack camera-page">
      <PageHeader
        title="摄像头"
        desc="接入摄像头并绑定场景，供隐患识别监测使用。"
      />
      <div className="camera-work">
        <aside className="panel camera-tree">
          <header className="panel-head">
            <div>
              <h3>设备树</h3>
              <p>{cameras.filter((item) => item.status === "ONLINE").length} 路在线 / {cameras.length} 路接入</p>
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
              <img src={shotUrl} alt={camera?.name ?? "预览"} />
            ) : (
              <div className="live-empty">{camera?.sourceType === "mock" ? "演示画面" : "等待摄像头画面"}</div>
            )}
            <div className="live-overlay">
              <span className="live-dot" />
              {camera?.name ?? "未选择"}
            </div>
          </div>
          <p className="muted">{camera ? `${camera.coverage} · ${location?.name ?? "未绑定场景"}` : "当前没有接入摄像头"}</p>
          <div className="action-row">
            {camera?.sourceType === "snapshot" ? (
              <button className="secondary-action" disabled={busy} onClick={() => void refreshSnapshot()}>
                <RefreshCw size={14} /> 刷新画面
              </button>
            ) : null}
            <button className="secondary-action" disabled={!camera} onClick={handleRemove}>
              <Trash2 size={14} /> 删除摄像头
            </button>
          </div>
        </section>

        <aside className="panel camera-side camera-side-forms">
          <section className="side-block">
            <header className="panel-head">
              <div>
                <h3>登记场景</h3>
                <p>填写名称、建筑和责任部门</p>
              </div>
            </header>
            <div className="form-stack">
              <label className="field"><span>场景名称</span><input value={sceneForm.name} onChange={(event) => setSceneForm({ ...sceneForm, name: event.target.value })} placeholder="例如：图书馆西侧疏散通道" /></label>
              <div className="field-row">
                <label className="field"><span>建筑</span><input value={sceneForm.building} onChange={(event) => setSceneForm({ ...sceneForm, building: event.target.value })} placeholder="图书馆" /></label>
                <label className="field"><span>楼层</span><input value={sceneForm.floor} onChange={(event) => setSceneForm({ ...sceneForm, floor: event.target.value })} /></label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>区域类型</span>
                  <select value={sceneForm.zoneType} onChange={(event) => {
                    const zone = zoneCatalog.find((item) => item.id === event.target.value);
                    setSceneForm({ ...sceneForm, zoneType: event.target.value, department: zone?.department ?? sceneForm.department });
                  }}>
                    {zoneCatalog.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>责任部门</span>
                  <select value={sceneForm.department} onChange={(event) => setSceneForm({ ...sceneForm, department: event.target.value })}>
                    {departments.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <button className="primary-action" onClick={submitScene}><Plus size={14} /> 添加场景</button>
            </div>
          </section>
          <section className="side-block">
            <header className="panel-head">
              <div>
                <h3>接入摄像头</h3>
                <p>填写名称、场景和接入方式</p>
              </div>
            </header>
            <div className="form-stack">
              <label className="field"><span>摄像头名称</span><input value={camForm.name} onChange={(event) => setCamForm({ ...camForm, name: event.target.value })} placeholder="西侧走廊枪机" /></label>
              <div className="field-row">
                <label className="field">
                  <span>绑定场景</span>
                  <select value={camForm.locationId} onChange={(event) => setCamForm({ ...camForm, locationId: event.target.value })}>
                    {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>接入方式</span>
                  <select value={camForm.sourceType} onChange={(event) => setCamForm({ ...camForm, sourceType: event.target.value as CameraSource })}>
                    <option value="webcam">本机 / USB 摄像头</option>
                    <option value="snapshot">IP 摄像头 JPEG 抓拍</option>
                  </select>
                </label>
              </div>
              <div className="field-row">
                {camForm.sourceType === "webcam" ? (
                  <label className="field">
                    <span>选择设备</span>
                    <select value={camForm.deviceId} onChange={(event) => setCamForm({ ...camForm, deviceId: event.target.value })}>
                      <option value="">默认摄像头</option>
                      {devices.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label || item.deviceId}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="field">
                    <span>抓拍地址</span>
                    <input value={camForm.snapshotUrl} onChange={(event) => setCamForm({ ...camForm, snapshotUrl: event.target.value })} placeholder="http://192.168.1.64/snapshot.jpg" />
                  </label>
                )}
                <label className="field"><span>覆盖范围</span><input value={camForm.coverage} onChange={(event) => setCamForm({ ...camForm, coverage: event.target.value })} /></label>
              </div>
              <button className="primary-action" onClick={submitCamera}><Plus size={14} /> 添加摄像头</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
