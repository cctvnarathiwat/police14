import { displayCode } from "./domain";
import { CAMERA_TYPES } from "./domain";
import { useState } from "react";
import { Camera, Grid2X2, List, Map, Plus, Search } from "lucide-react";
import { useStore } from "./context";
import { canWrite, dateTime, hasPosition, s, type RecordRow } from "./domain";
import { Badge, Empty, RecordTable } from "./components";
import MapView from "./MapView";
import { inspectCameras } from "./cameraQuality";
export default function CameraHealth({
  onOpen,
  onNew,
  onEdit,
}: {
  onOpen: (r: RecordRow) => void;
  onNew: () => void;
  onEdit: (r: RecordRow) => void;
}) {
  const { rows, profile, archive } = useStore();
  const [view, setView] = useState("table"),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [area, setArea] = useState(""),
    [agency, setAgency] = useState(""),
    [type, setType] = useState(""),
    [quality, setQuality] = useState(""),
    [old, setOld] = useState(false),
    [page, setPage] = useState(0);
  const cameras = rows.filter((r) => r.kind === "camera");
  const checks = inspectCameras(cameras);
  const qualityOptions = [
    ["missing", "ยังไม่มี UID", checks.missing],
    ["duplicate", "UID ซ้ำ", checks.duplicate],
    ["differentSites", "UID ซ้ำต่างพิกัด", checks.differentSites],
    ["coordinates", "พิกัดไม่ครบหรือไม่ถูกต้อง", checks.coordinates],
    ["text", "ตัวอักษรผิดรูปแบบ", checks.text],
  ] as const;
  const items = cameras.filter(
    (r) =>
      (!q ||
        Object.values(r.data)
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!status || s(r, "status") === status) &&
      (!area || s(r, "area") === area) &&
      (!agency || s(r, "agency") === agency) &&
      (!type || s(r, "type") === type) &&
      (!quality ||
        qualityOptions.find(([key]) => key === quality)?.[2].has(r.id)) &&
      (!old ||
        (s(r, "status") === "offline" &&
          s(r, "last_seen") &&
          Date.now() - Date.parse(s(r, "last_seen")) > 86400000)),
  );
  const filter = (set: (v: string) => void, v: string) => {
    set(v);
    setPage(0);
  };
  return (
    <>
      <section className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <strong>
          {cameras.length} กล้อง · {checks.sites.length} จุดพิกัด
        </strong>
        <p className="muted">
          นับจุดจากพิกัดที่ตรงกัน กล้องหลายตัวในจุดเดียวเก็บแยกครบทุกตัว
        </p>
        <details>
          <summary>ตรวจคุณภาพทะเบียน</summary>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <label>
              รายการที่ต้องการตรวจ
              <select
                value={quality}
                onChange={(e) => filter(setQuality, e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                {qualityOptions.map(([key, label, ids]) => (
                  <option key={key} value={key}>
                    {label} ({ids.size} รายการ)
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              ใช้ค้นหารายการเท่านั้น ไม่มีการลบหรือรวมข้อมูลอัตโนมัติ
            </p>
          </div>
        </details>
        {quality && (
          <button className="button" onClick={() => filter(setQuality, "")}>
            ล้างตัวกรองคุณภาพทะเบียน
          </button>
        )}
      </section>
      <div className="toolbar">
        <div className="input-icon">
          <Search size={16} />
          <input
            aria-label="ค้นหากล้อง"
            placeholder="รหัสกล้อง ชื่อ จุดติดตั้ง…"
            value={q}
            onChange={(e) => filter(setQ, e.target.value)}
          />
        </div>
        <select
          aria-label="สถานะกล้อง"
          value={status}
          onChange={(e) => filter(setStatus, e.target.value)}
        >
          <option value="">ทุกสถานะ</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="maintenance">ซ่อมบำรุง</option>
          <option value="disposed">จำหน่าย</option>
          <option value="inventory">คงคลัง</option>
        </select>
        <select
          aria-label="พื้นที่กล้อง"
          value={area}
          onChange={(e) => filter(setArea, e.target.value)}
        >
          <option value="">ทุกพื้นที่</option>
          {[...new Set(cameras.map((r) => s(r, "area")))]
            .filter(Boolean)
            .map((v) => (
              <option key={v}>{v}</option>
            ))}
        </select>
        <select
          aria-label="หน่วยงานเจ้าของ"
          value={agency}
          onChange={(e) => filter(setAgency, e.target.value)}
        >
          <option value="">ทุกหน่วยงาน</option>
          {[...new Set(cameras.map((r) => s(r, "agency")))]
            .filter(Boolean)
            .map((v) => (
              <option key={v}>{v}</option>
            ))}
        </select>
        <select
          aria-label="ชนิดกล้อง"
          value={type}
          onChange={(e) => filter(setType, e.target.value)}
        >
          <option value="">ทุกประเภท</option>
          {CAMERA_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
        {canWrite(profile!.role, "camera") && (
          <button className="button primary push" onClick={onNew}>
            <Plus size={15} />
            เพิ่มกล้อง
          </button>
        )}
      </div>
      <div className="toolbar">
        <div className="segmented">
          {[
            ["table", "ตาราง", List],
            ["cards", "การ์ด", Grid2X2],
            ["map", "แผนที่", Map],
          ].map(([v, label, Icon]) => {
            const I = Icon as typeof List;
            return (
              <button
                key={String(v)}
                className={view === v ? "active" : ""}
                onClick={() => setView(String(v))}
              >
                <I size={15} />
                {String(label)}
              </button>
            );
          })}
        </div>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={old}
            onChange={(e) => {
              setOld(e.target.checked);
              setPage(0);
            }}
          />
          Offline และไม่มีการตรวจพบมากกว่า 24 ชม.
        </label>
        <span className="muted push">พบ {items.length} กล้อง</span>
      </div>
      {view === "map" ? (
        <section className="panel">
          <MapView cameras={items.filter(hasPosition)} onSelect={onOpen} />
        </section>
      ) : view === "cards" ? (
        <div className="camera-card-grid">
          {items.length ? (
            items.slice(page * 24, page * 24 + 24).map((r) => (
              <button
                key={r.id}
                className="panel camera-card"
                onClick={() => onOpen(r)}
              >
                <div>
                  <Camera size={23} />
                  <Badge status={s(r, "status")} />
                </div>
                <span className="mono">{displayCode(r)}</span>
                <h3>{s(r, "title")}</h3>
                <p>
                  {s(r, "area")} · {s(r, "type")}
                </p>
                <small>ตรวจล่าสุด {dateTime(s(r, "last_seen"))}</small>
              </button>
            ))
          ) : (
            <Empty />
          )}
        </div>
      ) : (
        <section className="panel">
          <RecordTable
            rows={items.slice(page * 24, page * 24 + 24)}
            onOpen={onOpen}
            onEdit={onEdit}
            onArchive={archive}
          />
        </section>
      )}
      {view !== "map" && (
        <div className="pagination">
          <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil(items.length / 24))}
          </span>
          <button
            disabled={(page + 1) * 24 >= items.length}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป
          </button>
        </div>
      )}
    </>
  );
}
