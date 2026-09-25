import {
  Camera,
  Wifi,
  WifiOff,
  Wrench,
  ArrowUpRight,
  Activity,
  Map,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { useStore, demo } from "./context";
import { dateTime, hasPosition, s, type RecordRow } from "./domain";
import { Badge, Empty } from "./components";
import MapView from "./MapView";
export default function Dashboard({
  onOpen,
  onNavigate,
}: {
  onOpen: (r: RecordRow) => void;
  onNavigate: (page: string) => void;
}) {
  const { rows } = useStore();
  const cameras = rows.filter((r) => r.kind === "camera"),
    incidents = rows.filter((r) => r.kind === "incident");
  const online = cameras.filter((r) => s(r, "status") === "online").length,
    offline = cameras.filter((r) => s(r, "status") === "offline").length,
    maintenance = cameras.length - online - offline;
  const recent = [...rows]
    .filter((r) => ["incident", "job", "case", "sighting"].includes(r.kind))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);
  const stats = [
    {
      label: "กล้องทั้งหมด",
      value: cameras.length,
      icon: Camera,
      tone: "blue",
      note: "กล้องในพื้นที่รับผิดชอบ",
      page: "camera",
    },
    {
      label: "ออนไลน์",
      value: online,
      icon: Wifi,
      tone: "green",
      note: "สถานะล่าสุดที่บันทึก",
      page: "camera",
    },
    {
      label: "ออฟไลน์",
      value: offline,
      icon: WifiOff,
      tone: "red",
      note: "ต้องตรวจสอบการเชื่อมต่อ",
      page: "camera",
    },
    {
      label: "ซ่อมบำรุง",
      value: maintenance,
      icon: Wrench,
      tone: "amber",
      note: `${rows.filter((r) => r.kind === "job" && s(r, "status") !== "completed").length} งานอยู่ระหว่างดำเนินการ`,
      page: "job",
    },
  ];
  return (
    <>
      <div className="hero-line">
        <div>
          <span className="eyebrow">OPERATIONS OVERVIEW</span>
          <h1>
            ภาพรวมศูนย์ปฏิบัติการ
            <span className="title-dot" />
          </h1>
          <p>ติดตามสถานะกล้องและสถานการณ์ในพื้นที่ สภ.เมืองนราธิวาส</p>
        </div>
        <button className="button" onClick={() => onNavigate("map")}>
          <Map size={16} />
          เปิดแผนที่ปฏิบัติการ
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="stat-grid">
        {stats.map((v) => (
          <button
            key={v.label}
            className={`stat-card ${v.tone}`}
            onClick={() => onNavigate(v.page)}
          >
            <div className="stat-top">
              <span>{v.label}</span>
              <v.icon size={20} />
            </div>
            <div className="stat-value">
              {v.value.toString().padStart(2, "0")}
              <span>กล้อง</span>
            </div>
            <div className="stat-note">
              <i className="dot" />
              {v.note}
              <ArrowUpRight size={13} />
            </div>
          </button>
        ))}
      </div>
      <section className="panel summary-panel">
        <div className="panel-heading">
          <h3>
            <Camera size={18} />
            สถานะกล้องวงจรปิด CCTV แยกตามประเภทกล้อง
          </h3>
          <span className="muted">ข้อมูลจากทะเบียน</span>
        </div>
        <div className="table-scroll">
          <table className="summary-table">
            <thead>
              <tr>
                <th scope="col">ประเภทกล้อง</th>
                <th scope="col">ออนไลน์</th>
                <th scope="col">ออฟไลน์</th>
                <th scope="col">ซ่อมบำรุง</th>
                <th scope="col">รวม</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...new Set([
                  "Fixed",
                  "PTZ",
                  ...cameras.map((c) => s(c, "type") || "ไม่ระบุ"),
                ]),
              ].map((type) => {
                const group = cameras.filter(
                  (c) => (s(c, "type") || "ไม่ระบุ") === type,
                );
                return (
                  <tr key={type}>
                    <th scope="row">
                      <span className="table-label">
                        <Camera size={20} />
                        {type}
                      </span>
                    </th>
                    {["online", "offline", "maintenance"].map((status) => (
                      <td key={status}>
                        {group.filter((c) => s(c, "status") === status).length}
                      </td>
                    ))}
                    <td>
                      <strong>{group.length}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">รวมทั้งหมด</th>
                <td>{online}</td>
                <td>{offline}</td>
                <td>{maintenance}</td>
                <td>{cameras.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel dashboard-map">
          <div className="panel-heading">
            <h3>
              <Map size={17} />
              แผนที่กล้อง CCTV <span className="counter">{cameras.length}</span>
            </h3>
            <button className="text-button" onClick={() => onNavigate("map")}>
              ดูแผนที่เต็ม
              <ArrowUpRight size={14} />
            </button>
          </div>
          <MapView cameras={cameras.filter(hasPosition)} onSelect={onOpen} />
          <div className="map-bottom">
            <span>
              <i className="dot" /> Online {online}
            </span>
            <span>
              <i className="dot red" /> Offline {offline}
            </span>
            <span>
              <i className="dot amber" /> Maintenance {maintenance}
            </span>
            <span className="push muted">
              {demo ? "ตำแหน่งจำลอง" : "ตำแหน่งจากทะเบียนกล้อง"}
            </span>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <h3>
              <Activity size={17} />
              ความเคลื่อนไหวล่าสุด
            </h3>
            <span className="live-label">{demo ? "DEMO" : "บันทึก"}</span>
          </div>
          <div className="activity-list">
            {recent.length ? (
              recent.map((r) => (
                <button
                  key={r.id}
                  className="activity-item"
                  onClick={() => onOpen(r)}
                >
                  <span className={`activity-icon ${r.kind}`}>
                    <Clock size={16} />
                  </span>
                  <div>
                    <small>
                      {s(r, "code")} · {dateTime(r.updated_at)}
                    </small>
                    <strong>{s(r, "title")}</strong>
                    <Badge status={s(r, "status")} />
                  </div>
                </button>
              ))
            ) : (
              <Empty />
            )}
          </div>
          <button
            className="activity-footer"
            onClick={() => onNavigate("audit")}
          >
            ดูประวัติการทำงานทั้งหมด
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <ShieldCheck size={17} />
              ความพร้อมของกล้อง
            </h3>
            <span className="muted">สถานะจากทะเบียน</span>
          </div>
          <div className="health-content">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#35d7ac 0 ${cameras.length ? (online / cameras.length) * 100 : 0}%, #fb7185 0 ${cameras.length ? ((online + offline) / cameras.length) * 100 : 0}%, #fbbf24 0 100%)`,
              }}
            >
              <div>
                <strong>
                  {cameras.length
                    ? Math.round((online / cameras.length) * 100)
                    : 0}
                  <small>%</small>
                </strong>
                <span>Online</span>
              </div>
            </div>
            <div className="health-legend">
              {[
                ["Online", online, "green"],
                ["Offline", offline, "red"],
                ["Maintenance", maintenance, "amber"],
              ].map(([label, count, color]) => (
                <div key={label}>
                  <span>
                    <i className={`dot ${color}`} />
                    {label}
                  </span>
                  <b>{count}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>ประเภทเหตุการณ์</h3>
            <span className="muted">ข้อมูลที่เข้าถึงได้ทั้งหมด</span>
          </div>
          <div className="bar-chart">
            {["อุบัติเหตุ", "ลักทรัพย์", "ทะเลาะวิวาท", "อื่น ๆ"].map((t) => {
              const count = incidents.filter(
                (r) => s(r, "category") === t,
              ).length;
              return (
                <div className="bar-row" key={t}>
                  <span>{t}</span>
                  <div>
                    <i
                      style={{
                        width: `${incidents.length ? (count / incidents.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <b>{count}</b>
                </div>
              );
            })}
          </div>
        </section>
        <section className="quick-panel">
          <span className="eyebrow">INVESTIGATION WORKSPACE</span>
          <h2>
            เชื่อมจุดข้อมูล
            <br />
            สู่ภาพรวมของเหตุการณ์
          </h2>
          <p>
            วิเคราะห์พื้นที่ ตรวจสอบหลักฐาน
            <br />
            และเรียงลำดับ Timeline ในที่เดียว
          </p>
          <button
            className="button primary"
            onClick={() => onNavigate("investigation")}
          >
            เปิดแฟ้มสืบสวน
            <ArrowUpRight size={16} />
          </button>
          <RouteArt />
        </section>
      </div>
    </>
  );
}
function RouteArt() {
  return (
    <svg className="route-art" viewBox="0 0 180 120" fill="none">
      <path
        d="M10 100L60 80L90 100L125 40L170 20"
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeDasharray="4 5"
      />
      {[
        [10, 100],
        [60, 80],
        [90, 100],
        [125, 40],
        [170, 20],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="9" fill="#163048" />
          <circle cx={cx} cy={cy} r="3" fill="#5ad5ff" />
        </g>
      ))}
    </svg>
  );
}
