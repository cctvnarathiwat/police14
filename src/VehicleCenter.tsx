import { useMemo, useState } from "react";
import { BellRing, Car, CheckCircle2, Clock3, MapPin, Plus, Search, ShieldAlert, Siren, X } from "lucide-react";
import MapView from "./MapView";
import { Badge, Empty } from "./components";
import { useStore } from "./context";
import { displayCode, hasPosition, meters, position, s, statusLabels, type Data, type RecordRow } from "./domain";

type Props = {
  onOpen: (record: RecordRow) => void;
  onNew: (kind: "vehicle" | "sighting", parent?: string, initial?: Partial<Data>) => void;
  onEdit: (record: RecordRow) => void;
  onInvestigation: (record: RecordRow) => void;
};

type VehiclePoint = { record: RecordRow; kind: "origin" | "detection"; at: string };

function readableTime(value: string) {
  if (!value) return "ไม่ระบุเวลา";
  const date = new Date(value);
  return Number.isFinite(+date)
    ? date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
    : value;
}

function pointLabel(point: VehiclePoint, index: number, total: number) {
  if (point.kind === "origin") return "จุดหาย / จุดเกิดเหตุ";
  return index === total - 1 ? "พบล่าสุด" : `ตรวจพบ #${index}`;
}

export default function VehicleCenter({ onOpen, onNew, onEdit, onInvestigation }: Props) {
  const { rows, profile, save } = useStore();
  const vehicles = rows.filter((r) => r.kind === "vehicle" && !r.archived);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showPredicted, setShowPredicted] = useState(false);
  const visibleVehicles = vehicles
    .filter((r) =>
      Object.values(r.data).join(" ").toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const selected =
    vehicles.find((r) => r.id === selectedId) ??
    visibleVehicles.find((r) => s(r, "status") !== "closed") ??
    visibleVehicles[0];
  const sightings = selected
    ? rows
        .filter((r) => r.kind === "sighting" && !r.archived && r.parent_id === selected.id)
        .sort((a, b) => s(a, "occurred_at").localeCompare(s(b, "occurred_at")))
    : [];
  const linkedCase = selected
    ? rows.find((r) => r.kind === "case" && !r.archived && s(r, "vehicle_id") === selected.id)
    : undefined;
  const points = useMemo<VehiclePoint[]>(() => {
    if (!selected) return [];
    const origin = hasPosition(selected)
      ? [{ record: selected, kind: "origin" as const, at: s(selected, "occurred_at") }]
      : [];
    return [
      ...origin,
      ...sightings.filter(hasPosition).map((record) => ({ record, kind: "detection" as const, at: s(record, "occurred_at") })),
    ].sort((a, b) => a.at.localeCompare(b.at));
  }, [selected, sightings]);
  const route = points.map((point) => position(point.record));
  const confirmedRoute = points.filter((point) => point.kind === "origin" || s(point.record, "status") === "confirmed");
  const totalDistance = route.slice(1).reduce((total, point, index) => total + meters(route[index], point), 0);
  const activeCount = vehicles.filter((r) => ["active", "detected", "tracking"].includes(s(r, "status"))).length;
  const lastSighting = sightings.at(-1);
  const canWrite = profile?.role !== "viewer";
  async function createInvestigationCase() {
    if (!selected || !profile) return;
    const created = await save("case", {
      code: `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      title: `ติดตามรถ ${s(selected, "plate")} ${s(selected, "province")}`,
      status: "investigating",
      vehicle_id: selected.id,
      incident_id: s(selected, "incident_id"),
      area: s(selected, "area") || "รอตรวจสอบพื้นที่",
      assignee: profile.display_name,
      occurred_at: s(selected, "occurred_at") || new Date().toISOString(),
      notes: `สร้างจากเคสติดตามรถ ${s(selected, "case_id") || displayCode(selected)}`,
    });
    onInvestigation(created);
  }
  return (
    <div className="vehicle-center">
      <section className="vehicle-center-head">
        <div>
          <span className="eyebrow">VEHICLE INTELLIGENCE</span>
          <h2><Siren size={24} /> ศูนย์ติดตามรถและการตรวจพบ</h2>
          <p>เชื่อมรถเฝ้าระวัง จุดพบ กล้อง CCTV หลักฐาน และเส้นทางตามลำดับเวลา</p>
        </div>
        <div className="vehicle-kpis">
          <span><b>{activeCount}</b> เคสกำลังติดตาม</span>
          <span><b>{vehicles.filter((r) => s(r, "status") === "closed").length}</b> รถได้คืน</span>
          <span><b>{rows.filter((r) => r.kind === "sighting" && !r.archived).length}</b> จุดพบรถ</span>
        </div>
        {canWrite && <button className="button primary" onClick={() => onNew("vehicle", undefined, { status: "active", priority: "high" })}><Plus size={16} /> เพิ่มรถเฝ้าระวัง</button>}
      </section>
      <div className="vehicle-workspace">
        <aside className="vehicle-list panel">
          <div className="input-icon"><Search size={16} /><input aria-label="ค้นหารถหรือเคส" placeholder="ค้นหาทะเบียน / Case ID / สี / สถานที่" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="vehicle-list-caption">พบ {visibleVehicles.length} รายการ</div>
          {visibleVehicles.length ? visibleVehicles.map((vehicle) => (
            <button key={vehicle.id} className={`vehicle-row ${selected?.id === vehicle.id ? "selected" : ""}`} onClick={() => setSelectedId(vehicle.id)}>
              <span className={`priority-dot ${s(vehicle, "priority")}`} />
              <span><strong>{s(vehicle, "plate") || s(vehicle, "title")}</strong><small>{s(vehicle, "case_id") || displayCode(vehicle)} · {s(vehicle, "brand") || "ไม่ระบุรุ่น"}</small></span>
              <Badge status={s(vehicle, "status")} />
            </button>
          )) : <Empty>ไม่พบรถตามคำค้นหา</Empty>}
        </aside>
        <section className="vehicle-case panel">
          {!selected ? <Empty>เลือกหรือเพิ่มรถเฝ้าระวังเพื่อเริ่มสร้างเคสติดตาม</Empty> : <>
            <header className="vehicle-case-header">
              <div className="vehicle-plate"><Car size={25} /><div><span>{s(selected, "case_id") || displayCode(selected)}</span><h2>{s(selected, "plate")} {s(selected, "province")}</h2><p>{s(selected, "brand") || "ไม่ระบุยี่ห้อ / รุ่น"} {s(selected, "color") ? `· สี${s(selected, "color")}` : ""}</p></div></div>
              <div><Badge status={s(selected, "status")} /><button className="button" onClick={() => onOpen(selected)}>รายละเอียดรถ</button></div>
            </header>
            <div className="case-metrics"><span><MapPin size={15} /> {points.length} จุดบนเส้นทาง</span><span><Clock3 size={15} /> {totalDistance ? `${(totalDistance / 1000).toFixed(1)} กม. ที่ตรวจพบจริง` : "รอพิกัดจุดพบ"}</span><span><CheckCircle2 size={15} /> หลักฐานยืนยัน {confirmedRoute.length} จุด</span></div>
            <div className="vehicle-map-wrap">
              <MapView cameras={[]} route={route} routeLabels={points.map((point, index) => `${index + 1}`)} showRouteLine={points.length > 1} onRouteSelect={(index) => onOpen(points[index].record)} focus={route.at(-1)}>
                {showPredicted && route.length > 1 && <div className="map-predicted-note">เส้นประสีฟ้า: เส้นทางตามจุดที่บันทึก ไม่ใช่เส้นทางการเดินทางจริง</div>}
              </MapView>
            </div>
            <div className="route-legend"><span><i className="origin" /> จุดหาย / จุดเริ่มต้น</span><span><i className="confirmed" /> จุดพบที่ยืนยัน</span><span><i className="latest" /> จุดพบล่าสุด</span><label><input type="checkbox" checked={showPredicted} onChange={(e) => setShowPredicted(e.target.checked)} /> แสดงคำอธิบายเส้นทาง</label></div>
            <div className="vehicle-actions">
              {canWrite && <button className="button primary" onClick={() => onNew("sighting", selected.id, { title: `พบรถ ${s(selected, "plate")}`, status: "unverified", occurred_at: new Date().toISOString(), camera_id: "" })}><Plus size={16} /> เพิ่มจุดพบรถ</button>}
              <button className="button" onClick={() => onEdit(selected)}>แก้ไขเคส</button>
              {linkedCase ? <button className="button" onClick={() => onInvestigation(linkedCase)}>เปิด Timeline CCTV</button> : canWrite && <button className="button" onClick={() => void createInvestigationCase()}>สร้างแฟ้มสืบสวน</button>}
              {lastSighting && <button className="button" onClick={() => onOpen(lastSighting)}>ดูหลักฐานล่าสุด</button>}
            </div>
          </>}
        </section>
        <aside className="vehicle-timeline panel">
          <header><h3>Timeline การพบรถ</h3><span>{sightings.length} ครั้ง</span></header>
          {selected && <button className="timeline-event origin-event" onClick={() => onOpen(selected)}><time>{readableTime(s(selected, "occurred_at"))}</time><strong>จุดหาย / เหตุเริ่มต้น</strong><p>{s(selected, "area") || s(selected, "reason") || "ยังไม่ระบุสถานที่"}</p></button>}
          {sightings.length ? sightings.map((sighting, index) => <button className={`timeline-event ${index === sightings.length - 1 ? "latest-event" : ""}`} key={sighting.id} onClick={() => onOpen(sighting)}><time>{readableTime(s(sighting, "occurred_at"))}</time><strong>{index === sightings.length - 1 ? "พบล่าสุด" : `ตรวจพบ #${index + 1}`}</strong><p>{s(sighting, "area") || s(sighting, "title")}</p><small>{s(sighting, "camera_id") ? "กล้อง CCTV ที่เกี่ยวข้อง" : "รอระบุกล้อง"} {s(sighting, "direction") && `· ${s(sighting, "direction")}`}</small></button>) : <Empty>ยังไม่มีจุดพบรถในเคสนี้</Empty>}
          {selected && canWrite && <button className="button timeline-add" onClick={() => onNew("sighting", selected.id, { title: `พบรถ ${s(selected, "plate")}`, status: "unverified" })}><Plus size={15} /> บันทึกการพบรถ</button>}
        </aside>
      </div>
      {lastSighting && ["active", "detected", "tracking"].includes(s(selected!, "status")) && <section className="vehicle-alert"><BellRing size={22} /><div><b>พบรถเฝ้าระวัง {s(selected!, "plate")} {s(selected!, "province")}</b><span> {s(lastSighting, "area") || "จุดตรวจพบ"} · {readableTime(s(lastSighting, "occurred_at"))}{s(lastSighting, "direction") ? ` · ${s(lastSighting, "direction")}` : ""}</span></div><button className="button" onClick={() => onOpen(lastSighting)}>ดูบนแผนที่และหลักฐาน</button><button className="icon-button" aria-label="ปิดการแจ้งเตือน" onClick={() => undefined}><X size={17} /></button></section>}
    </div>
  );
}
