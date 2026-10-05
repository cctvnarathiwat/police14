import { displayCode } from "./domain";
import { CAMERA_TYPES } from "./domain";
import { useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  Route,
  Layers,
  Undo2,
  Trash2,
  Save,
  Plus,
  MapPin,
  Flame,
  Play,
  Pause,
} from "lucide-react";
import MapView from "./MapView";
import { Badge, Empty } from "./components";
import {
  CENTER,
  coverage,
  hasPosition,
  inside,
  meters,
  n,
  position,
  routeDistance,
  s,
  type Data,
  type Point,
  type RecordRow,
} from "./domain";
import { useStore } from "./context";
interface Props {
  mode: "map" | "area" | "route" | "heat";
  initial?: Point;
  initialRoute?: Point[];
  onOpen: (r: RecordRow) => void;
  onTimeline: (r: RecordRow, parent: string) => void;
  onSaveRoute: (data: Partial<Data>) => void;
  onEdit: (r: RecordRow) => void;
  onCreate: (kind: "camera" | "incident", data: Partial<Data>) => void;
}
export default function Analysis({
  mode,
  initial,
  initialRoute,
  onOpen,
  onTimeline,
  onSaveRoute,
  onEdit,
  onCreate,
}: Props) {
  const { rows, profile, archive } = useStore();
  const [center, setCenter] = useState<Point>(initial ?? CENTER),
    [radius, setRadius] = useState(500),
    [tool, setTool] = useState<"point" | "polygon" | "route">(
      mode === "route" ? "route" : "point",
    ),
    [vertices, setVertices] = useState<Point[]>(initialRoute ?? []),
    [fov, setFov] = useState(false),
    [multi, setMulti] = useState(false),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<RecordRow | null>(null),
    [focus, setFocus] = useState<Point>(),
    [caseId, setCaseId] = useState(""),
    [days, setDays] = useState(7),
    [heatLayers, setHeatLayers] = useState({ incident: true, sighting: true, vehicle: false }),
    [heatPlaying, setHeatPlaying] = useState(false),
    [selectedHotspot, setSelectedHotspot] = useState(""),
    [showCameras, setShowCameras] = useState(true),
    [showIncidents, setShowIncidents] = useState(mode === "map"),
    [showVehicleAlerts, setShowVehicleAlerts] = useState(mode === "map"),
    [showRecoveredVehicles, setShowRecoveredVehicles] = useState(mode === "map"),
    [showSightings, setShowSightings] = useState(mode === "map"),
    [coordinate, setCoordinate] = useState(""),
    [coordError, setCoordError] = useState(""),
    [onlyFov, setOnlyFov] = useState(false),
    [agency, setAgency] = useState(""),
    [cameraType, setCameraType] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState(""),
    [archiveError, setArchiveError] = useState("");
  const [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [hour, setHour] = useState(""),
    [category, setCategory] = useState("");
  const cameras = rows.filter((r) => r.kind === "camera" && hasPosition(r));
  const vehicles = rows.filter((r) => r.kind === "vehicle" && hasPosition(r));
  const vehicleAlerts = vehicles.filter((r) => s(r, "status") === "active");
  const recoveredVehicles = vehicles.filter((r) => s(r, "status") === "closed");
  const sightings = rows.filter((r) => r.kind === "sighting" && hasPosition(r));
  const result = useMemo(
    () =>
      cameras
        .filter(
          (c) =>
            (!status || s(c, "status") === status) &&
            (!agency || s(c, "agency") === agency) &&
            (!cameraType || s(c, "type") === cameraType) &&
            (!onlyFov || inside(center, coverage(c))),
        )
        .map((c) => ({
          ...c,
          dist:
            tool === "route"
              ? routeDistance(position(c), vertices).distance
              : meters(center, position(c)),
          along:
            tool === "route" ? routeDistance(position(c), vertices).along : 0,
        }))
        .filter(
          (c) =>
            mode === "map" ||
            mode === "heat" ||
            (tool === "polygon"
              ? inside(position(c), vertices)
              : c.dist <= radius),
        )
        .sort((a, b) =>
          tool === "route" ? a.along - b.along : a.dist - b.dist,
        ),
    [
      rows,
      status,
      agency,
      cameraType,
      onlyFov,
      center,
      vertices,
      tool,
      radius,
      mode,
    ],
  );
  const heat = rows
    .filter((r) =>
      (r.kind === "incident" && heatLayers.incident) ||
      (r.kind === "sighting" && heatLayers.sighting) ||
      (r.kind === "vehicle" && heatLayers.vehicle && !["closed", "recovered"].includes(s(r, "status"))),
    )
    .filter((r) => {
      const time = Date.parse(s(r, "occurred_at") || r.updated_at);
      const bangkokHour = new Date(time + 7 * 3600000).getUTCHours();
      return (
        time >=
          (dateFrom
            ? Date.parse(`${dateFrom}T00:00:00+07:00`)
            : Date.now() - days * 86400000) &&
        (!dateTo || time <= Date.parse(`${dateTo}T23:59:59.999+07:00`)) &&
        (!hour ||
          (bangkokHour >= Number(hour) && bangkokHour < Number(hour) + 3)) &&
        (!category || r.kind !== "incident" || s(r, "category") === category)
      );
    })
    .map((r) => {
      const c = rows.find((c) => c.id === r.data.camera_id);
      return hasPosition(r)
        ? r
        : c
          ? { ...r, data: { ...r.data, lat: c.data.lat, lng: c.data.lng } }
          : null;
    })
    .filter((r): r is RecordRow => !!r && hasPosition(r));
  const hotspots = useMemo(() => {
    const buckets = new Map<string, { records: RecordRow[]; center: Point }>();
    heat.forEach((record) => {
      const [lat, lng] = position(record);
      const key = `${Math.round(lat / 0.004)}:${Math.round(lng / 0.004)}`;
      const current = buckets.get(key) ?? { records: [], center: [lat, lng] as Point };
      current.records.push(record);
      current.center = [
        current.records.reduce((sum, row) => sum + position(row)[0], 0) / current.records.length,
        current.records.reduce((sum, row) => sum + position(row)[1], 0) / current.records.length,
      ];
      buckets.set(key, current);
    });
    return [...buckets.entries()]
      .map(([id, bucket], index) => {
        const incidents = bucket.records.filter((r) => r.kind === "incident").length;
        const sightings = bucket.records.filter((r) => r.kind === "sighting").length;
        const vehicles = bucket.records.filter((r) => r.kind === "vehicle").length;
        const nearbyCameras = cameras.filter((camera) => meters(bucket.center, position(camera)) <= 450).length;
        const score = incidents * 3 + sightings * 2 + vehicles;
        const color = score >= 9 ? "#dc2626" : score >= 5 ? "#f97316" : score >= 2 ? "#eab308" : "#16a34a";
        return { id, center: bucket.center, count: bucket.records.length, incidents, sightings, vehicles, nearbyCameras, score, color, label: `HOTSPOT #${String(index + 1).padStart(2, "0")}` };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [heat, cameras]);
  const activeHotspot = hotspots.find((spot) => spot.id === selectedHotspot) ?? hotspots[0];
  const hotspotRecords = activeHotspot
    ? heat.filter((record) => meters(activeHotspot.center, position(record)) <= 450)
    : [];
  const hotspotCameras = activeHotspot
    ? cameras.filter((camera) => meters(activeHotspot.center, position(camera)) <= 450)
    : [];
  useEffect(() => {
    if (!heatPlaying || mode !== "heat") return;
    const timer = window.setInterval(() => {
      setHour((value) => String(((Number(value || 0) + 3) % 24)));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [heatPlaying, mode]);
  const routes = rows.filter((r) => r.kind === "route");
  const pick = (r: RecordRow) => {
    setSelected(r);
    setFocus(position(r));
  };
  return (
    <>
      <div className="toolbar">
        {mode === "heat" && (
          <div className="heat-kpis">
            <span><Flame size={15} /> {hotspots.length} Hotspots</span>
            <span>🚨 {heat.filter((r) => r.kind === "incident").length} เหตุการณ์</span>
            <span>🚗 {heat.filter((r) => r.kind === "sighting").length} จุดพบรถ</span>
            <span>📹 {cameras.length} CCTV</span>
          </div>
        )}
        <div className="segmented">
          {mode !== "route" && (
            <button
              className={tool === "point" ? "active" : ""}
              onClick={() => {
                setTool("point");
                setVertices([]);
              }}
            >
              <Crosshair size={15} />
              รัศมี
            </button>
          )}
          {mode !== "route" && (
            <button
              className={tool === "polygon" ? "active" : ""}
              onClick={() => {
                setTool("polygon");
                setVertices([]);
              }}
            >
              วาดพื้นที่
            </button>
          )}
          <button
            className={tool === "route" ? "active" : ""}
            onClick={() => {
              setTool("route");
              setVertices([]);
            }}
          >
            <Route size={15} />
            วาดเส้นทาง
          </button>
        </div>
        {tool !== "polygon" && (
          <>
            {(tool === "route"
              ? [50, 100, 200, 500]
              : [200, 500, 1000, 2000]
            ).map((v) => (
              <button
                key={v}
                className={`chip ${radius === v ? "active" : ""}`}
                onClick={() => setRadius(v)}
              >
                {v >= 1000 ? `${v / 1000} กม.` : `${v} ม.`}
              </button>
            ))}
            <input
              className="radius-input"
              aria-label="รัศมีกำหนดเอง เมตร"
              type="number"
              min={1}
              max={10000}
              value={radius}
              onChange={(e) =>
                setRadius(Math.max(1, Math.min(10000, Number(e.target.value))))
              }
            />
          </>
        )}
        <button
          className="icon-button"
          title="ย้อนจุดล่าสุด"
          onClick={() => setVertices((v) => v.slice(0, -1))}
        >
          <Undo2 size={17} />
        </button>
        <button
          className="icon-button"
          title="ล้างพื้นที่"
          onClick={() => {
            setVertices([]);
            setSelected(null);
          }}
        >
          <Trash2 size={17} />
        </button>
        {tool === "route" &&
          vertices.length > 1 &&
          profile!.role !== "viewer" && (
            <button
              className="button push"
              onClick={() =>
                onSaveRoute({ points: vertices, corridor: radius })
              }
            >
              <Save size={15} />
              บันทึกเส้นทาง
            </button>
          )}
        {profile!.role !== "viewer" && (
          <div className="analysis-create-actions">
            <button
              className="button"
              onClick={() =>
                onCreate("camera", { lat: center[0], lng: center[1] })
              }
            >
              <Plus size={15} /> เพิ่มกล้อง
            </button>
            <button
              className="button primary"
              onClick={() =>
                onCreate("incident", { lat: center[0], lng: center[1] })
              }
            >
              <Plus size={15} /> เพิ่มเหตุการณ์
            </button>
          </div>
        )}
      </div>
      <div className="analysis-grid">
        <div className="panel map-panel">
          <div className="panel-heading">
            <h3>
              <MapPin size={17} />{" "}
              {mode === "heat" ? "HEATMAP & AREA ANALYTICS" : "แผนที่ปฏิบัติการ"}
            </h3>
            <span className="muted">
              {mode === "heat"
                ? "คลิก Hotspot เพื่อดูองค์ประกอบและคะแนนความเสี่ยง"
                : tool === "point"
                ? "คลิกแผนที่เพื่อเลือกจุดวิเคราะห์"
                : `คลิกเพิ่มจุด • ${vertices.length} จุด`}
            </span>
          </div>
          <MapView
            cameras={
              showCameras
                ? mode === "map" || mode === "heat"
                  ? cameras
                  : result
                : []
            }
            incidents={
              showIncidents
                ? rows.filter((r) => r.kind === "incident" && hasPosition(r))
                : []
            }
            vehicles={[
              ...(showVehicleAlerts ? vehicleAlerts : []),
              ...(showRecoveredVehicles ? recoveredVehicles : []),
            ]}
            sightings={showSightings ? sightings : []}
            onSelect={pick}
            onClick={(p) => {
              if (tool === "point") setCenter(p);
              else setVertices((v) => [...v, p]);
            }}
            center={
              tool === "point" && mode !== "map"
                ? center
                : undefined
            }
            radius={radius}
            multi={multi}
            route={tool === "route" ? vertices : undefined}
            polygon={tool === "polygon" ? vertices : undefined}
            fov={fov}
            focus={focus}
            selected={selected?.id}
            heat={mode === "heat" ? heat : undefined}
            hotspots={mode === "heat" ? hotspots : undefined}
            onHotspotSelect={setSelectedHotspot}
          />
          <div className="map-bottom">
            <span>
              <i className="dot" /> Online
            </span>
            <span>
              <i className="dot red" /> Offline
            </span>
            <span>
              <i className="dot amber" /> ซ่อมบำรุง
            </span>
            <span className="push mono">
              {center.map((v) => v.toFixed(5)).join(", ")}
            </span>
          </div>
        </div>
        <aside className="panel analysis-sidebar">
          <div className="panel-heading">
            <h3>
              <Layers size={16} />
              เครื่องมือวิเคราะห์
            </h3>
          </div>
          <div className="sidebar-content">
            <div className="coords">
              <input
                aria-label="พิกัดวิเคราะห์"
                placeholder="6.4264, 101.8231"
                value={coordinate}
                onChange={(e) => setCoordinate(e.target.value)}
              />
              <button
                className="button"
                onClick={() => {
                  const p = coordinate.split(",").map(Number);
                  if (
                    p.length !== 2 ||
                    p.some((v) => !Number.isFinite(v)) ||
                    Math.abs(p[0]) > 90 ||
                    Math.abs(p[1]) > 180
                  ) {
                    setCoordError("รูปแบบ: ละติจูด, ลองจิจูด");
                    return;
                  }
                  setCenter(p as Point);
                  setFocus(p as Point);
                  setCoordError("");
                }}
              >
                ไป
              </button>
            </div>
            {coordError && <small className="error">{coordError}</small>}
            <div className="checks">
              <label>
                <input
                  type="checkbox"
                  checked={showCameras}
                  onChange={(e) => setShowCameras(e.target.checked)}
                />
                กล้อง CCTV
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showIncidents}
                  onChange={(e) => setShowIncidents(e.target.checked)}
                />
                เหตุการณ์
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showVehicleAlerts}
                  onChange={(e) => setShowVehicleAlerts(e.target.checked)}
                />
                รถแจ้งเตือน ({vehicleAlerts.length})
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showRecoveredVehicles}
                  onChange={(e) => setShowRecoveredVehicles(e.target.checked)}
                />
                รถได้คืน ({recoveredVehicles.length})
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showSightings}
                  onChange={(e) => setShowSightings(e.target.checked)}
                />
                จุดพบรถ ({sightings.length})
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={fov}
                  onChange={(e) => setFov(e.target.checked)}
                />
                มุมมองกล้อง FOV
              </label>
              {tool === "point" && (
                <label>
                  <input
                    type="checkbox"
                    checked={multi}
                    onChange={(e) => setMulti(e.target.checked)}
                  />
                  วงรัศมีซ้อน
                </label>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={onlyFov}
                  onChange={(e) => setOnlyFov(e.target.checked)}
                />
                เฉพาะกล้องที่ FOV ครอบคลุมจุด
              </label>
            </div>
            <select
              aria-label="สถานะกล้องบนแผนที่"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">ทุกสถานะกล้อง</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">ซ่อมบำรุง</option>
              <option value="disposed">จำหน่าย</option>
              <option value="inventory">คงคลัง</option>
            </select>
            <select
              aria-label="ประเภทกล้อง"
              value={cameraType}
              onChange={(e) => setCameraType(e.target.value)}
            >
              <option value="">ทุกประเภท</option>
              {CAMERA_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <select
              aria-label="หน่วยงานกล้อง"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
            >
              <option value="">ทุกหน่วยงาน</option>
              {[...new Set(cameras.map((c) => s(c, "agency")))]
                .filter(Boolean)
                .map((a) => (
                  <option key={a}>{a}</option>
                ))}
            </select>
            {mode === "heat" && (
              <>
                <div className="heat-layer-picker">
                  <strong>ชั้นข้อมูลความหนาแน่น</strong>
                  {([
                    ["incident", "เหตุการณ์"],
                    ["sighting", "จุดพบรถ"],
                    ["vehicle", "รถเฝ้าระวัง"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      <input type="checkbox" checked={heatLayers[key]} onChange={(e) => setHeatLayers((layers) => ({ ...layers, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
                <label>
                  ช่วงเวลา
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  >
                    {[1, 7, 30, 90].map((v) => (
                      <option key={v} value={v}>
                        {v} วันล่าสุด
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ตั้งแต่วันที่ (กำหนดเอง)
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label>
                  ถึงวันที่
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
                <label>
                  ช่วงเวลาในวัน
                  <select
                    value={hour}
                    onChange={(e) => setHour(e.target.value)}
                  >
                    <option value="">ตลอดวัน</option>
                    {[0, 3, 6, 9, 12, 15, 18, 21].map((v) => (
                      <option key={v} value={String(v)}>
                        {String(v).padStart(2, "0")}:00–{String((v + 3) % 24).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button" onClick={() => setHeatPlaying((value) => !value)}>
                  {heatPlaying ? <Pause size={15} /> : <Play size={15} />}
                  {heatPlaying ? "หยุดเล่นเวลา" : "เล่นย้อนหลังตามเวลา"}
                </button>
                <label>
                  ประเภทเหตุ / งาน
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">ทั้งหมด</option>
                    {[
                      ...new Set(
                        rows
                          .filter((r) => r.kind === "incident")
                          .map((r) => s(r, "category")),
                      ),
                    ]
                      .filter(Boolean)
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                  </select>
                </label>
                <p className="muted">
                  {heat.length} จุด • แดงสูงมาก · ส้มสูง · เหลืองปานกลาง · เขียวต่ำ
                </p>
                <p className="heat-score-note">Risk score = เหตุการณ์ ×3 + จุดพบรถ ×2 + รถเฝ้าระวัง ×1; CCTV ใช้แสดงความครอบคลุมรอบจุด ไม่ใช่การตัดสินความเสี่ยง</p>
                {activeHotspot && (
                  <section className="hotspot-card">
                    <span>🔥 {activeHotspot.label}</span>
                    <h4>Risk score {activeHotspot.score}</h4>
                    <p>เหตุการณ์ {activeHotspot.incidents} · จุดพบรถ {activeHotspot.sightings} · รถเฝ้าระวัง {activeHotspot.vehicles} · CCTV รอบพื้นที่ {activeHotspot.nearbyCameras}</p>
                    <small>คะแนน = เหตุการณ์ ×3 + จุดพบรถ ×2 + รถเฝ้าระวัง ×1; ใช้ข้อมูลที่เลือกเท่านั้น</small>
                    <div className="hotspot-actions">
                      <button onClick={() => { setCenter(activeHotspot.center); setFocus(activeHotspot.center); setTool("point"); }}>วิเคราะห์พื้นที่</button>
                      {hotspotRecords.filter((record) => record.kind === "incident").slice(0, 1).map((record) => <button key={record.id} onClick={() => onOpen(record)}>ดูเหตุการณ์</button>)}
                      {hotspotCameras.slice(0, 1).map((camera) => <button key={camera.id} onClick={() => onOpen(camera)}>ดูกล้อง CCTV</button>)}
                    </div>
                    <div className="hotspot-list">
                      {hotspotRecords.slice(0, 5).map((record) => <button key={record.id} onClick={() => onOpen(record)}><span>{record.kind === "incident" ? "🚨" : record.kind === "sighting" ? "🚗" : "⚠️"}</span>{s(record, "title") || displayCode(record)}</button>)}
                    </div>
                  </section>
                )}
                {hotspots.length > 1 && <div className="hotspot-ranking"><strong>อันดับพื้นที่น่าสนใจ</strong>{hotspots.map((spot, index) => <button key={spot.id} className={spot.id === activeHotspot?.id ? "active" : ""} onClick={() => { setSelectedHotspot(spot.id); setFocus(spot.center); }}><b>{index + 1}</b><span>{spot.label}</span><em>{spot.count} จุด · {spot.score} คะแนน</em></button>)}</div>}
              </>
            )}
            {multi && (
              <div className="radius-summary">
                {[200, 500, 1000, 2000].map((v) => (
                  <button key={v} onClick={() => setRadius(v)}>
                    {v} ม.
                    <b>
                      {
                        cameras.filter((c) => meters(center, position(c)) <= v)
                          .length
                      }
                    </b>
                  </button>
                ))}
              </div>
            )}
            {routes.length > 0 && (
              <label>
                โหลดเส้นทางที่บันทึก
                <select
                  value=""
                  onChange={(e) => {
                    const r = routes.find((r) => r.id === e.target.value);
                    if (r) {
                      setTool("route");
                      setVertices((r.data.points ?? []) as Point[]);
                      setRadius(n(r, "corridor"));
                    }
                  }}
                >
                  <option value="">เลือกเส้นทาง…</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {s(r, "title")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tool === "route" && vertices.length > 1 && (
              <p className="muted">
                ระยะแนวเส้น{" "}
                {(
                  vertices
                    .slice(1)
                    .reduce((sum, p, i) => sum + meters(vertices[i], p), 0) /
                  1000
                ).toFixed(2)}{" "}
                กม. · Corridor {radius} ม.
              </p>
            )}
            {mode === "route" && routes.length > 0 && (
              <div className="route-comparison">
                <h3>เปรียบเทียบเส้นทางสมมติ</h3>
                {routes.map((r) => {
                  const points = r.data.points as Point[];
                  return (
                    <button
                      className="camera-result"
                      key={r.id}
                      onClick={() => {
                        setVertices(points);
                        setRadius(n(r, "corridor"));
                      }}
                    >
                      <div>
                        <span>{s(r, "title")}</span>
                        <b>
                          {
                            cameras.filter(
                              (c) =>
                                routeDistance(position(c), points).distance <=
                                n(r, "corridor"),
                            ).length
                          }{" "}
                          กล้อง
                        </b>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="result-title">
              <strong>พบ {result.length} กล้อง</strong>
              <span>
                {result.filter((c) => s(c, "status") === "online").length}{" "}
                Online
              </span>
            </div>
            <div className="camera-results">
              {result.length ? (
                result.map((c) => (
                  <button
                    className={`camera-result ${selected?.id === c.id ? "selected" : ""}`}
                    key={c.id}
                    onClick={() => pick(c)}
                  >
                    <div>
                      <span className="mono">{displayCode(c)}</span>
                      <small>
                        {Number.isFinite(c.dist)
                          ? `${Math.round(c.dist).toLocaleString()} ม.`
                          : "—"}
                      </small>
                    </div>
                    <strong>{s(c, "title")}</strong>
                    <Badge status={s(c, "status")} />
                  </button>
                ))
              ) : (
                <Empty>เลือกจุด / วาดพื้นที่เพื่อค้นหากล้อง</Empty>
              )}
            </div>
            {selected && (
              <div className="selected-camera">
                <strong>{s(selected, "title")}</strong>
                <button className="button" onClick={() => onOpen(selected)}>
                  ดูรายละเอียด
                </button>
                {profile!.role !== "viewer" && (
                  <>
                    <button className="button" onClick={() => onEdit(selected)}>
                      แก้ไขกล้อง
                    </button>
                    <button
                      className="button danger"
                      onClick={async () => {
                        if (archiveConfirm !== selected.id) {
                          setArchiveConfirm(selected.id);
                          setArchiveError("");
                          return;
                        }
                        try {
                          await archive(selected);
                          setArchiveConfirm("");
                          setSelected(null);
                        } catch (error) {
                          setArchiveError(
                            error instanceof Error
                              ? error.message
                              : String(error),
                          );
                        }
                      }}
                    >
                      <Trash2 size={15} />
                      {archiveConfirm === selected.id ? "ยืนยันลบ" : "ลบกล้อง"}
                    </button>
                    <select
                      aria-label="แฟ้มปลายทาง"
                      value={caseId}
                      onChange={(e) => setCaseId(e.target.value)}
                    >
                      <option value="">เลือกแฟ้มสืบสวน</option>
                      {rows
                        .filter((r) => r.kind === "case")
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {displayCode(r)}
                          </option>
                        ))}
                    </select>
                    <button
                      className="button primary"
                      disabled={!caseId}
                      onClick={() => onTimeline(selected, caseId)}
                    >
                      <Plus size={15} />
                      เพิ่มจุด Timeline
                    </button>
                  </>
                )}
                {archiveError && <p className="error">{archiveError}</p>}
              </div>
            )}
          </div>
        </aside>
      </div>
      <p className="footnote">
        เส้นทางที่วาดเป็นแนวค้นหาสมมติ ระยะทางและ FOV คำนวณจากข้อมูลที่บันทึก •
        การยืนยันต้องอ้างอิงหลักฐาน
      </p>
    </>
  );
}
