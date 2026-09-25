import { useEffect, useState } from "react";
import {
  Shield,
  LayoutDashboard,
  Map,
  Camera,
  TriangleAlert,
  Wrench,
  Car,
  Flame,
  Crosshair,
  Route,
  FolderSearch,
  FileText,
  Users,
  Settings,
  Search,
  Bell,
  RefreshCw,
  Maximize2,
  Menu,
  LogOut,
  Activity,
  Plus,
  ChevronRight,
} from "lucide-react";
import { Provider } from "./store";
import { useStore, supabase, demo } from "./context";
import {
  dateTime,
  definitions,
  position,
  s,
  type Kind,
  type RecordRow,
  type Point,
  type Data,
} from "./domain";
import {
  Details,
  Editor,
  Empty,
  Modal,
  RecordList,
  type EditorProps,
} from "./components";
import Dashboard from "./Dashboard";
import Analysis from "./Analysis";
import Investigation, { EvidenceViewer } from "./Investigation";
import Reports from "./Reports";
import UsersPage from "./Users";
import CameraHealth from "./CameraHealth";
const nav = [
  { id: "dashboard", label: "ภาพรวมศูนย์", icon: LayoutDashboard },
  { id: "map", label: "แผนที่ปฏิบัติการ", icon: Map },
  { id: "camera", label: "ทะเบียนกล้อง CCTV", icon: Camera },
  { id: "incident", label: "บันทึกเหตุการณ์", icon: TriangleAlert },
  { id: "job", label: "ซ่อมบำรุง / ภูมิทัศน์", icon: Wrench },
  { id: "vehicle", label: "รถแจ้งเตือน", icon: Car },
  { id: "heat", label: "Heat Map", icon: Flame },
  { id: "area", label: "วิเคราะห์พื้นที่", icon: Crosshair },
  { id: "route", label: "วิเคราะห์เส้นทาง", icon: Route },
  { id: "investigation", label: "แฟ้มสืบสวน / Timeline", icon: FolderSearch },
  { id: "evidence", label: "คลังหลักฐาน", icon: FileText },
  { id: "reports", label: "ศูนย์รายงาน", icon: FileText },
  { id: "users", label: "ผู้ใช้งานและสิทธิ์", icon: Users },
  { id: "audit", label: "ประวัติการทำงาน", icon: Activity },
  { id: "settings", label: "ตั้งค่าระบบ", icon: Settings },
];
function WorkspaceIdentity() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="workspace-identity">
      <strong>ระบบบริหารข้อมูลกล้องวงจรปิด CCTV</strong>
      <p>
        สภ.เมืองนราธิวาส ·{" "}
        {now.toLocaleDateString("th-TH", {
          timeZone: "Asia/Bangkok",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
        <time dateTime={now.toISOString()}>
          เวลา{" "}
          {now.toLocaleTimeString("th-TH", {
            timeZone: "Asia/Bangkok",
            hour12: false,
          })}{" "}
          น.
        </time>
      </p>
    </div>
  );
}
function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-icon">
          <Camera size={30} />
        </div>
        <span className="eyebrow">NARATHIWAT · POLICE 14</span>
        <h1>CCTV POLICE14 DATACENTER</h1>
        <p>ระบบข้อมูลกล้องวงจรปิด สภ.เมืองนราธิวาส</p>
        {!supabase ? (
          <div className="setup-note">
            <h3>รอเชื่อมต่อ Supabase</h3>
            <p>
              กำหนด VITE_SUPABASE_URL และ VITE_SUPABASE_PUBLISHABLE_KEY ในไฟล์
              .env ตาม README ก่อนเข้าสู่ระบบ
            </p>
            <small>
              การสาธิตในเครื่อง: ตั้ง VITE_DEMO_MODE=true แล้วเริ่มแอปใหม่
            </small>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const { error: e } = await supabase!.auth.signInWithPassword({
                  email,
                  password,
                });
                if (e) throw e;
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              อีเมลเจ้าหน้าที่
              <input
                type="email"
                autoComplete="username"
                required
                placeholder="อีเมลเจ้าหน้าที่"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              รหัสผ่าน
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="button primary" disabled={busy}>
              {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              <ChevronRight size={16} />
            </button>
            <small>ใช้บัญชีที่ผู้ดูแลกำหนดสิทธิ์ให้เท่านั้น</small>
          </form>
        )}
        <details className="login-support">
          <summary>ลืมบัญชีผู้ใช้งาน หรือรหัสผ่าน</summary>
          <p>
            ติดต่อผู้ดูแลระบบของหน่วยงานเพื่อยืนยันบัญชีและขอตั้งรหัสผ่านใหม่
            ใช้อีเมลที่ได้รับสิทธิ์ในการเข้าสู่ระบบ
          </p>
        </details>
      </div>
      <div className="photo-credit">
        ภาพ Lake Ingalls โดย Sergei Akulich ·{" "}
        <a
          href="https://commons.wikimedia.org/wiki/File:Mountains_reflected_in_a_lake_(Unsplash).jpg"
          target="_blank"
          rel="noreferrer"
        >
          CC0 / Wikimedia Commons
        </a>
      </div>
    </div>
  );
}
function Workspace() {
  const store = useStore();
  const { rows, profile, loading, error, audit, refresh } = store;
  const [page, setPage] = useState("dashboard"),
    [menu, setMenu] = useState(false),
    [full, setFull] = useState(false),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState<RecordRow | null>(null),
    [editor, setEditor] = useState<Omit<EditorProps, "onClose"> | null>(null),
    [evidence, setEvidence] = useState<RecordRow | null>(null),
    [center, setCenter] = useState<Point>(),
    [routePoints, setRoutePoints] = useState<Point[]>(),
    [notifications, setNotifications] = useState(false),
    [toast, setToast] = useState(""),
    [initialCase, setInitialCase] = useState("");
  const navigate = (p: string) => {
    setPage(p);
    setMenu(false);
    setQuery("");
  };
  const edit = (
    kind: Kind,
    parent?: string,
    initial?: Partial<Data>,
    record?: RecordRow,
  ) => {
    setDetail(null);
    setEvidence(null);
    setEditor({
      kind,
      parent,
      initial,
      record,
      onSaved: () => {
        setToast("บันทึกข้อมูลเรียบร้อย");
        setTimeout(() => setToast(""), 3500);
      },
    });
  };
  const open = (r: RecordRow) => {
    setQuery("");
    setNotifications(false);
    if (r.kind === "evidence") {
      setDetail(null);
      setEvidence(r);
    } else if (r.kind === "case") {
      setInitialCase(r.id);
      navigate("investigation");
      setDetail(r);
    } else setDetail(r);
  };
  const analyze = (p: Point, end?: Point) => {
    setCenter(p);
    setRoutePoints(end ? [p, end] : undefined);
    setDetail(null);
    navigate(end ? "route" : "area");
  };
  const addTimeline = (r: RecordRow, parent: string) =>
    edit("timeline", parent, {
      title: s(r, "title"),
      camera_id: r.kind === "camera" ? r.id : undefined,
      lat: r.data.lat,
      lng: r.data.lng,
    });
  if (loading)
    return (
      <div className="loading">
        <Shield />
        <p>กำลังเปิดศูนย์ปฏิบัติการ…</p>
      </div>
    );
  if (!profile) {
    if (error && store.session)
      return (
        <div className="login-page">
          <div className="login-card">
            <h2>ยังเข้าใช้งานไม่ได้</h2>
            <p className="error">{error}</p>
            <button className="button" onClick={() => void refresh()}>
              ลองใหม่
            </button>
            <button
              className="button"
              onClick={() => void supabase?.auth.signOut()}
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      );
    return <Login />;
  }
  const title = nav.find((n) => n.id === page)?.label ?? "ศูนย์ CCTV";
  const alerts = rows.filter(
    (r) =>
      (r.kind === "camera" && s(r, "status") === "offline") ||
      (r.kind === "job" &&
        s(r, "status") !== "completed" &&
        Date.parse(s(r, "due_date")) < Date.now() + 86400000),
  );
  const searchResults = query
    ? rows
        .filter((r) =>
          Object.values(r.data)
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .slice(0, 8)
    : [];
  return (
    <div
      className={`app ${full ? "fullscreen" : ""} ${menu ? "menu-open" : ""}`}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <Shield size={24} />
          </span>
          <div>
            <strong>
              NARA<span> CCTV</span>
            </strong>
            <small>COMMAND CENTER</small>
          </div>
        </div>
        <div className="station">
          <i className="dot" />
          สภ.เมืองนราธิวาส<span>POLICE 14</span>
        </div>
        <nav>
          {nav.map((item, i) => (
            <div key={item.id}>
              {[0, 6, 11].includes(i) && (
                <div className="nav-section">
                  {i === 0
                    ? "ศูนย์ปฏิบัติการ"
                    : i === 6
                      ? "วิเคราะห์และสืบสวน"
                      : "จัดการระบบ"}
                </div>
              )}
              <button
                title={item.label}
                aria-label={item.label}
                aria-current={page === item.id ? "page" : undefined}
                className={page === item.id ? "active" : ""}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.id === "incident" && (
                  <b>
                    {
                      rows.filter(
                        (r) =>
                          r.kind === "incident" && s(r, "status") === "open",
                      ).length
                    }
                  </b>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Shield size={16} />
          <span>
            ศูนย์ CCTV นราธิวาส<small>Command Center · v1.0</small>
          </span>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="ปิดเมนู"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="เปิดเมนู"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={19} />
          </button>
          <WorkspaceIdentity />
          <div className="global-search">
            <Search size={16} />
            <input
              aria-label="ค้นหาทั้งระบบ"
              placeholder="ค้นหากล้อง เหตุการณ์ แฟ้ม…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>⌕</kbd>
            {query && (
              <div className="search-results">
                {searchResults.length ? (
                  searchResults.map((r) => (
                    <button key={r.id} onClick={() => open(r)}>
                      <small>
                        {s(r, "code")} · {definitions[r.kind].name}
                      </small>
                      <strong>{s(r, "title")}</strong>
                    </button>
                  ))
                ) : (
                  <p>ไม่พบข้อมูล</p>
                )}
              </div>
            )}
          </div>
          <button
            className="icon-button"
            aria-label="รีเฟรชข้อมูล"
            onClick={() => void refresh()}
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="เต็มหน้าจอ"
            onClick={() => setFull(!full)}
          >
            <Maximize2 size={17} />
          </button>
          <button
            className="icon-button notification-button"
            aria-label="การแจ้งเตือน"
            onClick={() => setNotifications(true)}
          >
            <Bell size={19} />
            {alerts.length > 0 && <i />}
          </button>
          <div className="profile-avatar">
            {profile.display_name.slice(0, 1)}
          </div>
          <div className="profile-label">
            <strong>{profile.display_name}</strong>
            <small>{profile.role}</small>
          </div>
          {!demo && (
            <button
              className="icon-button"
              aria-label="ออกจากระบบ"
              onClick={async () => {
                const { error: e } = await supabase!.auth.signOut();
                if (e) setToast(e.message);
              }}
            >
              <LogOut size={17} />
            </button>
          )}
        </header>
        {demo && (
          <div className="demo-banner">
            <span>DEMO MODE</span> ข้อมูลและตำแหน่งทั้งหมดเป็นตัวอย่าง •
            บันทึกในเบราว์เซอร์นี้ • ยังไม่เชื่อมฐานข้อมูลจริง
          </div>
        )}
        {error && (
          <p role="alert" className="error load-error">
            โหลดข้อมูลไม่สำเร็จ: {error}{" "}
            <button onClick={() => void refresh()}>ลองใหม่</button>
          </p>
        )}
        <main>
          {page !== "dashboard" && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">NARATHIWAT COMMAND CENTER</span>
                <h1>{title}</h1>
              </div>
              <span className="muted">
                {new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}
              </span>
            </div>
          )}
          {page === "dashboard" && (
            <Dashboard onOpen={open} onNavigate={navigate} />
          )}
          {["map", "area", "route", "heat"].includes(page) && (
            <Analysis
              key={`${page}-${center?.join()}`}
              mode={page as "map" | "area" | "route" | "heat"}
              initial={center}
              initialRoute={page === "route" ? routePoints : undefined}
              onOpen={open}
              onTimeline={addTimeline}
              onSaveRoute={(data) => edit("route", undefined, data)}
            />
          )}
          {page === "camera" && (
            <CameraHealth onOpen={open} onNew={() => edit("camera")} />
          )}
          {["incident", "job", "vehicle", "evidence"].includes(page) && (
            <RecordList
              key={page}
              kind={page as Kind}
              onOpen={open}
              onNew={() =>
                page === "evidence"
                  ? navigate("investigation")
                  : edit(page as Kind)
              }
            />
          )}
          {page === "investigation" && (
            <Investigation
              key={initialCase}
              initialCase={initialCase}
              onEdit={edit}
              onOpen={open}
              onAnalyze={analyze}
              onEvidence={(r) => setEvidence(r)}
            />
          )}
          {page === "reports" && <Reports onOpen={open} />}
          {page === "users" && <UsersPage />}
          {page === "audit" && (
            <section className="panel">
              <div className="panel-heading">
                <h3>ประวัติการทำงานล่าสุด</h3>
                <button className="button" onClick={() => void refresh()}>
                  รีเฟรช
                </button>
              </div>
              {audit.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>เวลา</th>
                        <th>การทำงาน</th>
                        <th>รายการ</th>
                        <th>ผู้ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((a) => (
                        <tr key={a.id}>
                          <td>{dateTime(a.created_at)}</td>
                          <td>{a.action}</td>
                          <td className="mono">
                            {rows.find((r) => r.id === a.record_id)?.data
                              .code ??
                              a.record_id ??
                              "รายงาน"}
                          </td>
                          <td>
                            {a.actor_id === profile.id
                              ? profile.display_name
                              : a.actor_id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>ยังไม่มีประวัติการทำงาน</Empty>
              )}
            </section>
          )}
          {page === "settings" && (
            <section className="panel settings-panel">
              <h2>การเชื่อมต่อระบบ</h2>
              <dl>
                <div>
                  <dt>หน่วยงาน</dt>
                  <dd>สภ.เมืองนราธิวาส</dd>
                </div>
                <div>
                  <dt>โหมดการทำงาน</dt>
                  <dd>
                    {demo
                      ? "สาธิต — ข้อมูลในเบราว์เซอร์"
                      : "Supabase — ข้อมูลจริงตามสิทธิ์"}
                  </dd>
                </div>
                <div>
                  <dt>Supabase Project</dt>
                  <dd>ruzhxkgqpszzhalcgkgi</dd>
                </div>
                <div>
                  <dt>เขตเวลาแสดงผล</dt>
                  <dd>Asia/Bangkok (UTC+7)</dd>
                </div>
                <div>
                  <dt>วิดีโอ</dt>
                  <dd>
                    รองรับไฟล์ MP4 / WebM ที่แนบในแฟ้ม • ยังไม่มี Video gateway
                    สำหรับ RTSP สด
                  </dd>
                </div>
                <div>
                  <dt>สถานะกล้อง</dt>
                  <dd>
                    อ้างอิงสถานะที่เจ้าหน้าที่บันทึก
                    ยังไม่เชื่อมระบบตรวจสุขภาพอัตโนมัติ
                  </dd>
                </div>
              </dl>
              <p className="muted">
                การเชื่อมต่อและบัญชีเริ่มต้นตั้งค่าผ่านไฟล์ environment และ
                Supabase Dashboard ตามคู่มือ README
              </p>
            </section>
          )}
          <div className="page-footer">
            <span>
              <Shield size={12} /> CCTV COMMAND CENTER · สภ.เมืองนราธิวาส
            </span>
            <span>
              {demo ? "DEMONSTRATION DATA" : "AUTHORIZED PERSONNEL ONLY"}
            </span>
          </div>
        </main>
      </div>
      {detail && (
        <Details
          record={rows.find((r) => r.id === detail.id) ?? detail}
          onClose={() => setDetail(null)}
          onEdit={() =>
            edit(detail.kind, detail.parent_id ?? undefined, undefined, detail)
          }
          onAnalyze={(r) => analyze(position(r))}
          onOpen={open}
          onAdd={(kind, parent) => edit(kind, parent)}
        />
      )}
      {editor && (
        <Editor
          key={editor.record?.id ?? editor.kind}
          {...editor}
          onClose={() => setEditor(null)}
        />
      )}
      {evidence && (
        <EvidenceViewer
          record={evidence}
          onClose={() => setEvidence(null)}
          onAdd={(data, parent) => edit("timeline", parent, data)}
        />
      )}
      {notifications && (
        <Modal title="ศูนย์แจ้งเตือน" onClose={() => setNotifications(false)}>
          <div className="detail-body">
            <p className="muted">รายการที่ต้องตรวจสอบจากสถานะปัจจุบัน</p>
            {alerts.length ? (
              alerts.map((r) => (
                <button
                  className="alert-row"
                  key={r.id}
                  onClick={() => open(r)}
                >
                  <TriangleAlert size={19} />
                  <div>
                    <strong>
                      {s(r, "code")} · {s(r, "title")}
                    </strong>
                    <small>
                      {r.kind === "camera"
                        ? "กล้องออฟไลน์"
                        : "งานใกล้ครบกำหนด / เกินกำหนด"}
                    </small>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <Empty>ไม่มีรายการที่ต้องตรวจสอบ</Empty>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <Provider>
      <Workspace />
    </Provider>
  );
}
