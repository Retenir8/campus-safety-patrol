"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { LANDMARK_KINDS, defaultCampusMap } from "@/lib/campus/map";
import { zoneCatalog } from "@/lib/campus/seed";
import {
  addCustomLocation,
  addMapLandmark,
  hideLocationPin,
  locationState,
  moveLocationPin,
  removeMapLandmark,
  resetCampusMap,
  restoreLocationPin,
  updateLocationLabel,
  updateMapLandmark,
  useCampusStore,
} from "@/lib/campus/store";
import type { Finding, Location, MapLandmark } from "@/lib/campus/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type DragState =
  | { type: "landmark" | "pin" | "resize"; id: string }
  | null;

export function CampusSandbox({
  locations,
  findings,
  focusId,
  editing,
  onEditingChange,
  onFocus,
}: {
  locations: Location[];
  findings: Finding[];
  focusId?: string;
  editing: boolean;
  onEditingChange: (value: boolean) => void;
  onFocus: (id: string) => void;
}) {
  const store = useCampusStore();
  const campusMap = store.campusMap ?? defaultCampusMap();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const movedRef = useRef(false);
  const mapRef = useRef(campusMap);
  mapRef.current = campusMap;
  const [selected, setSelected] = useState<{ type: "landmark" | "pin"; id: string }>();
  const hidden = new Set(campusMap.hiddenLocationIds);
  const pins = locations.filter((item) => !hidden.has(item.id));
  const selectedLandmark = campusMap.landmarks.find((item) => selected?.type === "landmark" && item.id === selected.id);
  const selectedPin = pins.find((item) => selected?.type === "pin" && item.id === selected.id);

  function pointFromClient(clientX: number, clientY: number) {
    const board = boardRef.current;
    if (!board) return { x: 50, y: 50 };
    const rect = board.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 6, 94),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 6, 94),
    };
  }

  function applyDrag(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag) return;
    movedRef.current = true;
    const point = pointFromClient(clientX, clientY);
    if (drag.type === "pin") {
      moveLocationPin(drag.id, point.x, point.y);
      return;
    }
    const landmark = mapRef.current.landmarks.find((item) => item.id === drag.id);
    if (!landmark) return;
    if (drag.type === "resize") {
      updateMapLandmark(drag.id, {
        w: clamp(Math.abs(point.x - landmark.x) * 2, 8, 36),
        h: clamp(Math.abs(point.y - landmark.y) * 2, 8, 28),
      });
      return;
    }
    updateMapLandmark(drag.id, { x: point.x, y: point.y });
  }

  useEffect(() => {
    if (!editing) return;
    function onMove(event: PointerEvent) {
      applyDrag(event.clientX, event.clientY);
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [editing]);

  function startDrag(event: React.PointerEvent, next: Exclude<DragState, null>) {
    if (!editing) return;
    event.stopPropagation();
    movedRef.current = false;
    dragRef.current = next;
    try {
      boardRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional; window listeners still move the piece.
    }
  }

  return (
    <section className={`panel command-board ${editing ? "is-editing" : ""}`}>
      <header className="panel-head">
        <div>
          <h3>校园风险沙盘</h3>
          <p>{editing ? "拖动建筑和监测点，按本校地图摆放" : "点位颜色表示正常 / 待补证 / 高风险"}</p>
        </div>
        {editing ? (
          <button className="primary-action" onClick={() => { onEditingChange(false); setSelected(undefined); }}>
            <Check size={14} /> 完成
          </button>
        ) : (
          <button className="secondary-action" onClick={() => onEditingChange(true)}>
            <Pencil size={14} /> 编辑沙盘
          </button>
        )}
      </header>
      {editing ? (
        <div className="map-palette">
          {LANDMARK_KINDS.map((item) => (
            <button key={item.id} className="chip-btn" type="button" onClick={() => {
              const id = addMapLandmark(item.id);
              setSelected({ type: "landmark", id });
            }}>
              <Plus size={12} /> {item.label}
            </button>
          ))}
          <button className="chip-btn" type="button" onClick={() => {
            const created = addCustomLocation({
              name: "新监测点",
              short: "新点位",
              building: selectedLandmark?.label || "校园",
              floor: "1F",
              zoneType: zoneCatalog[0]?.id ?? "evacuation_corridor",
              zoneLabel: zoneCatalog[0]?.label ?? "疏散通道",
              department: zoneCatalog[0]?.department ?? "保卫处",
              x: 22 + Math.round(Math.random() * 56),
              y: 18 + Math.round(Math.random() * 58),
            });
            setSelected({ type: "pin", id: created.id });
            onFocus(created.id);
          }}>
            <Plus size={12} /> 监测点
          </button>
        </div>
      ) : null}
      <div
        ref={boardRef}
        className="campus-iso"
        onPointerMove={(event) => applyDrag(event.clientX, event.clientY)}
        onPointerUp={() => { dragRef.current = null; }}
        onClick={(event) => {
          if (editing && event.target === event.currentTarget && !movedRef.current) setSelected(undefined);
        }}
      >
        {campusMap.landmarks.map((item) => (
          <LandmarkBlock
            key={item.id}
            item={item}
            editing={editing}
            selected={selected?.type === "landmark" && selected.id === item.id}
            onPointerDown={(event) => {
              if (!editing) return;
              setSelected({ type: "landmark", id: item.id });
              startDrag(event, { type: "landmark", id: item.id });
            }}
            onResize={(event) => {
              setSelected({ type: "landmark", id: item.id });
              startDrag(event, { type: "resize", id: item.id });
            }}
          />
        ))}
        {pins.map((location) => {
          const stateNow = locationState(findings, location.id);
          return (
            <button
              key={location.id}
              type="button"
              className={`map-dot ${stateNow.level.toLowerCase()} ${focusId === location.id ? "is-focus" : ""} ${selected?.type === "pin" && selected.id === location.id ? "is-selected" : ""}`}
              style={{ left: `${location.x}%`, top: `${location.y}%` }}
              onPointerDown={(event) => {
                if (!editing) return;
                setSelected({ type: "pin", id: location.id });
                startDrag(event, { type: "pin", id: location.id });
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (editing && movedRef.current) return;
                onFocus(location.id);
                if (editing) setSelected({ type: "pin", id: location.id });
              }}
            >
              <b>{location.short}</b>
              <em>{location.building} · {location.floor}</em>
            </button>
          );
        })}
      </div>
      {editing ? (
        <div className="map-editor-bar">
          {selectedLandmark ? (
            <div className="map-editor-row is-building">
              <label className="field"><span>建筑名称</span><input value={selectedLandmark.label} onChange={(event) => updateMapLandmark(selectedLandmark.id, { label: event.target.value })} /></label>
              <button className="secondary-action" type="button" onClick={() => { removeMapLandmark(selectedLandmark.id); setSelected(undefined); }}>
                <Trash2 size={14} /> 删除建筑
              </button>
            </div>
          ) : selectedPin ? (
            <div className="map-editor-row is-pin">
              <label className="field"><span>监测点名称</span><input value={selectedPin.short} onChange={(event) => updateLocationLabel(selectedPin.id, { short: event.target.value })} /></label>
              <label className="field"><span>所属建筑</span><input value={selectedPin.building} onChange={(event) => updateLocationLabel(selectedPin.id, { building: event.target.value })} /></label>
              <label className="field"><span>楼层</span><input value={selectedPin.floor} onChange={(event) => updateLocationLabel(selectedPin.id, { floor: event.target.value })} /></label>
              <button className="secondary-action" type="button" onClick={() => { hideLocationPin(selectedPin.id); setSelected(undefined); }}>
                <Trash2 size={14} /> 从沙盘移除
              </button>
            </div>
          ) : (
            <p className="muted map-editor-hint">点选建筑或监测点后可拖动、改名或删除。右下角圆点可调整建筑大小。</p>
          )}
          <div className="map-editor-foot">
            {campusMap.hiddenLocationIds.length ? (
              <div className="map-hidden">
                {campusMap.hiddenLocationIds.map((id) => {
                  const loc = locations.find((item) => item.id === id);
                  if (!loc) return null;
                  return (
                    <button key={id} className="chip-btn" type="button" onClick={() => restoreLocationPin(id)}>恢复 {loc.short}</button>
                  );
                })}
              </div>
            ) : null}
            <button className="text-link" type="button" onClick={() => { resetCampusMap(); setSelected(undefined); }}>
              <RotateCcw size={14} /> 恢复默认布局
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LandmarkBlock({
  item,
  editing,
  selected,
  onPointerDown,
  onResize,
}: {
  item: MapLandmark;
  editing: boolean;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  onResize: (event: React.PointerEvent) => void;
}) {
  return (
    <div
      className={`map-landmark kind-${item.kind} ${editing ? "is-edit" : ""} ${selected ? "is-selected" : ""}`}
      style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
      role="button"
      aria-label={item.label}
      tabIndex={editing ? 0 : -1}
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
    >
      <span>{item.label}</span>
      {editing && selected ? (
        <i
          className="map-resize"
          onPointerDown={(event) => {
            event.stopPropagation();
            onResize(event);
          }}
        />
      ) : null}
    </div>
  );
}
