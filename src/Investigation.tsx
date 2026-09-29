import { orderedTimeline, evidenceForPoint } from "./investigationData";
import { displayCode } from "./domain";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Play,
  Pause,
  ChevronRight,
  FileUp,
  Camera,
  Download,
  MapPin,
  Clock,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Badge, Empty, Modal } from "./components";
import MapView from "./MapView";
import { useStore, demo } from "./context";
import {
  canWrite,
  dateTime,
  definitions,
  download,
  hasPosition,
  meters,
  position,
  s,
  statusLabels,
  type Data,
  type Kind,
  type Point,
  type RecordRow,
} from "./domain";
export default function Investigation({
  onEdit,
  onOpen,
  onAnalyze,
  onEvidence,
  initialCase,
}: {
  onEdit: (
    kind: Kind,
    parent?: string,
    initial?: Partial<Data>,
    record?: RecordRow,
  ) => void;
  onOpen: (r: RecordRow) => void;
  onAnalyze: (p: Point, end?: Point) => void;
  onEvidence: (r: RecordRow) => void;
  initialCase?: string;
}) {
  const { rows, save, profile } = useStore();
  const cases = rows.filter((r) => r.kind === "case");
  const [caseId, setCaseId] = useState(initialCase || cases[0]?.id || ""),
    [board, setBoard] = useState(false),
    [selected, setSelected] = useState(""),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [drawing, setDrawing] = useState(false),
    [draftRoute, setDraftRoute] = useState<Point[]>([]),
    [routeName, setRouteName] = useState(""),
    [savedRouteId, setSavedRouteId] = useState(""),
    [savingRoute, setSavingRoute] = useState(false),
    [notice, setNotice] = useState(""),
    [cameraQuery, setCameraQuery] = useState(""),
    [error, setError] = useState("");
  const current = cases.find((c) => c.id === caseId);
  const timeline = orderedTimeline(rows, caseId);
  const evidence = rows.filter(
      (r) => r.kind === "evidence" && r.parent_id === caseId,
    ),
    cameras = rows.filter(
      (r) =>
        r.kind === "camera" && timeline.some((t) => t.data.camera_id === r.id),
    );
  const chosen = timeline.find((r) => r.id === selected),
    write = canWrite(profile!.role, "timeline");
  const routePoints = timeline.filter(hasPosition);
  const savedRoutes = rows.filter(
    (r) => r.kind === "route" && r.parent_id === caseId,
  );
  const savedRoute = savedRoutes.find((r) => r.id === savedRouteId);
  const visibleDrawnRoute = draftRoute.length
    ? draftRoute
    : (savedRoute?.data.points as Point[] | undefined);
  const chosenCamera = rows.find(
    (r) => r.kind === "camera" && r.id === chosen?.data.camera_id,
  );
  const pointEvidence = (t: RecordRow) => evidenceForPoint(evidence, t);
  useEffect(() => {
    setSelected("");
    setPlaying(false);
    setCameraQuery("");
    setDrawing(false);
    setDraftRoute([]);
    setSavedRouteId("");
    setRouteName("");
    setNotice("");
    setError("");
  }, [caseId]);
  async function storeRoute() {
    if (!current || !write || draftRoute.length < 2 || savingRoute) return;
    setSavingRoute(true);
    setError("");
    try {
      const result = await save(
        "route",
        {
          title: routeName.trim() || "เส้นทางก่อเหตุที่วาด",
          code: `RTE-${crypto.randomUUID().slice(0, 8)}`,
          status: "draft",
          points: draftRoute,
          corridor: 100,
          notes: "เส้นทางที่ผู้ใช้วาดเพื่อประกอบการสืบสวน",
        },
        undefined,
        current.id,
      );
      setSavedRouteId(result.id);
      setDraftRoute([]);
      setDrawing(false);
      setNotice("บันทึกเส้นทางในแฟ้มแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingRoute(false);
    }
  }
  useEffect(() => {
    if (!playing || !timeline.length) return;
    const interval = setInterval(() => {
      setSelected((prev) => {
        const next = timeline.findIndex((r) => r.id === prev) + 1;
        if (next >= timeline.length) {
          setPlaying(false);
          return prev;
        }
        return timeline[next].id;
      });
    }, 2000 / speed);
    return () => clearInterval(interval);
  }, [playing, speed, timeline.map((r) => r.id).join(",")]);
  async function move(r: RecordRow, status: string) {
    try {
      await save("case", { ...r.data, status }, r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <>
      <h2>Timeline + CCTV Route Investigation</h2>
      <p className="muted">
        ลำดับเหตุการณ์ตามเวลา → กล้องแต่ละจุด → จุดสิ้นสุด พร้อมหลักฐานในแฟ้ม
      </p>
      <div className="toolbar">
        <div className="segmented">
          <button
            className={!board ? "active" : ""}
            onClick={() => setBoard(false)}
          >
            พื้นที่สืบสวน
          </button>
          <button
            className={board ? "active" : ""}
            onClick={() => setBoard(true)}
          >
            กระดาน Case
          </button>
        </div>
        <select
          aria-label="เลือกแฟ้มสืบสวน"
          disabled={draftRoute.length > 0 || savingRoute}
          value={caseId}
          onChange={(e) => {
            setCaseId(e.target.value);
            setSelected("");
            setPlaying(false);
          }}
        >
          <option value="">เลือกแฟ้ม</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {displayCode(c)} · {s(c, "title")}
            </option>
          ))}
        </select>
        {write && (
          <button
            className="button primary push"
            onClick={() => onEdit("case")}
          >
            <Plus size={16} />
            เปิดแฟ้มใหม่
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {board ? (
        <div className="kanban">
          {definitions.case.statuses.map((status) => (
            <section
              key={status}
              onDragOver={(e) => {
                if (write) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const c = cases.find(
                  (c) => c.id === e.dataTransfer.getData("text/plain"),
                );
                if (c && write) void move(c, status);
              }}
            >
              <h3>
                {statusLabels[status]}
                <span>
                  {cases.filter((c) => s(c, "status") === status).length}
                </span>
              </h3>
              {cases
                .filter((c) => s(c, "status") === status)
                .map((c) => (
                  <article
                    key={c.id}
                    draggable={write}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", c.id)
                    }
                  >
                    <button
                      className="record-link"
                      disabled={draftRoute.length > 0 || savingRoute}
                      onClick={() => {
                        setCaseId(c.id);
                        setBoard(false);
                      }}
                    >
                      <span className="mono">{displayCode(c)}</span>
                      <strong>{s(c, "title")}</strong>
                    </button>
                    <p>
                      {s(c, "assignee")} · {s(c, "area")}
                    </p>
                    <small>
                      {
                        rows.filter(
                          (r) => r.parent_id === c.id && r.kind === "timeline",
                        ).length
                      }{" "}
                      จุด Timeline
                    </small>
                    {write && (
                      <select
                        aria-label={`เปลี่ยนสถานะ ${displayCode(c)}`}
                        value={status}
                        onChange={(e) => void move(c, e.target.value)}
                      >
                        {definitions.case.statuses.map((v) => (
                          <option key={v} value={v}>
                            {statusLabels[v]}
                          </option>
                        ))}
                      </select>
                    )}
                  </article>
                ))}
            </section>
          ))}
        </div>
      ) : !current ? (
        <Empty>เลือกหรือสร้างแฟ้มสืบสวนเพื่อเริ่มทำงาน</Empty>
      ) : (
        <>
          <div className="case-banner">
            <div>
              <span className="mono">{displayCode(current)}</span>
              <h2>{s(current, "title")}</h2>
              <span className="muted">
                {s(current, "area")} · ผู้รับผิดชอบ {s(current, "assignee")}
              </span>
            </div>
            <Badge status={s(current, "status")} />
            <div className="case-numbers">
              <span>
                <b>{timeline.length}</b>จุด Timeline
              </span>
              <span>
                <b>{cameras.length}</b>กล้อง
              </span>
              <span>
                <b>{evidence.length}</b>หลักฐาน
              </span>
            </div>
            <button className="button" onClick={() => onOpen(current)}>
              ข้อมูลแฟ้ม
            </button>
          </div>
          <div className="investigation-grid">
            <section className="panel">
              <div className="panel-heading">
                <h3>
                  <MapPin size={17} />
                  CCTV Route Investigation
                </h3>
                <span className="muted">เส้นเชื่อมตามลำดับเวลาที่บันทึก</span>
              </div>
              <div className="toolbar" style={{ padding: 12 }}>
                {write && (
                  <>
                    <button
                      className={`button ${drawing ? "primary" : ""}`}
                      disabled={savingRoute}
                      onClick={() => {
                        setDrawing(!drawing);
                        setPlaying(false);
                      }}
                    >
                      {" "}
                      {drawing ? "หยุดวาด" : "วาดเส้นทางก่อเหตุ"}
                    </button>
                    <button
                      className="button"
                      disabled={!draftRoute.length || savingRoute}
                      onClick={() => setDraftRoute((p) => p.slice(0, -1))}
                    >
                      ย้อนจุดล่าสุด
                    </button>
                    <button
                      className="button"
                      disabled={!draftRoute.length || savingRoute}
                      onClick={() => setDraftRoute([])}
                    >
                      ล้างเส้นร่าง
                    </button>
                    <input
                      aria-label="ชื่อเส้นทางก่อเหตุ"
                      placeholder="ชื่อเส้นทาง"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                    />
                    <button
                      className="button primary"
                      disabled={draftRoute.length < 2 || savingRoute}
                      onClick={() => void storeRoute()}
                    >
                      {savingRoute ? "กำลังบันทึก…" : "บันทึกเส้นทาง"}
                    </button>
                  </>
                )}
                <select
                  aria-label="เส้นทางในแฟ้ม"
                  value={savedRouteId}
                  onChange={(e) => {
                    setSavedRouteId(e.target.value);
                    setDraftRoute([]);
                    setDrawing(false);
                  }}
                  disabled={draftRoute.length > 0 || savingRoute}
                >
                  <option value="">ไม่แสดงเส้นทางที่บันทึก</option>
                  {savedRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {s(r, "title")}
                    </option>
                  ))}
                </select>
              </div>
              <p className="muted" style={{ padding: "0 12px" }}>
                สีฟ้า: เชื่อมจุดตามเวลา · สีส้ม: เส้นทางที่วาดประกอบการสืบสวน
                {drawing
                  ? ` · คลิกบนแผนที่เพื่อเพิ่มจุด (${draftRoute.length} จุด)`
                  : ""}
              </p>
              <MapView
                cameras={cameras}
                onClick={
                  drawing && write && !savingRoute
                    ? (point) => setDraftRoute((points) => [...points, point])
                    : undefined
                }
                drawnRoute={visibleDrawnRoute}
                onSelect={(c) =>
                  setSelected(
                    timeline.find((t) => t.data.camera_id === c.id)?.id ?? "",
                  )
                }
                selected={
                  chosen ? String(chosen.data.camera_id ?? "") : undefined
                }
                focus={
                  chosen && hasPosition(chosen) ? position(chosen) : undefined
                }
                route={routePoints.map(position)}
                routeLabels={routePoints.map(
                  (t) =>
                    `${timeline.indexOf(t) + 1}${t.id === timeline[timeline.length - 1]?.id ? " · จุดสิ้นสุด" : ""}`,
                )}
                onRouteSelect={(i) => {
                  setSelected(routePoints[i].id);
                  setPlaying(false);
                }}
              />
              {chosen && (
                <section className="route-point-detail" aria-live="polite">
                  <h3>
                    จุด {timeline.indexOf(chosen) + 1}
                    {chosen.id === timeline[timeline.length - 1]?.id
                      ? " · จุดสิ้นสุด"
                      : ""}{" "}
                    — {s(chosen, "title")}
                  </h3>
                  <p>
                    {dateTime(s(chosen, "occurred_at"))} ·{" "}
                    {chosenCamera
                      ? `${displayCode(chosenCamera) || "ไม่ระบุ UID"} · ${s(chosenCamera, "title")}`
                      : "จุดที่ไม่ผูกกล้อง"}
                  </p>
                  <div className="toolbar">
                    {chosenCamera && (
                      <button
                        className="button"
                        onClick={() => onOpen(chosenCamera)}
                      >
                        รายละเอียดกล้อง
                      </button>
                    )}
                    {write && (
                      <button
                        className="button"
                        onClick={() =>
                          onEdit("evidence", caseId, {
                            camera_id: chosen.data.camera_id,
                            timeline_id: chosen.id,
                            occurred_at: chosen.data.occurred_at,
                          })
                        }
                      >
                        แนบหลักฐานจุดนี้
                      </button>
                    )}
                    {pointEvidence(chosen).map((e) => (
                      <button
                        className="button"
                        key={e.id}
                        onClick={() => onEvidence(e)}
                      >
                        เปิดหลักฐาน: {s(e, "title")}
                      </button>
                    ))}
                  </div>
                  {!pointEvidence(chosen).length && (
                    <p className="muted">
                      ยังไม่มีหลักฐานของจุดหรือกล้องนี้ในแฟ้ม
                    </p>
                  )}
                </section>
              )}
              <div className="playback">
                <button
                  className="button primary"
                  disabled={!timeline.length || drawing || savingRoute}
                  onClick={() => {
                    if (
                      !playing &&
                      timeline[timeline.length - 1]?.id === selected
                    )
                      setSelected("");
                    setPlaying(!playing);
                  }}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                  {playing ? "หยุด" : "Playback"}
                </button>
                <select
                  aria-label="ความเร็ว Playback"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  {[0.5, 1, 2, 4].map((v) => (
                    <option key={v} value={v}>
                      {v}×
                    </option>
                  ))}
                </select>
                <span className="muted">แสดงลำดับจุด • ไม่ใช่วิดีโอสด</span>
              </div>
            </section>
            <section className="panel timeline-panel">
              <div className="panel-heading">
                <h3>
                  <Clock size={17} />
                  Timeline การสืบสวน
                </h3>
                {write && (
                  <button
                    className="icon-button"
                    aria-label="เพิ่มจุด Timeline"
                    onClick={() => onEdit("timeline", caseId)}
                  >
                    <Plus size={17} />
                  </button>
                )}
              </div>
              {write && (
                <div style={{ padding: 12 }}>
                  <input
                    aria-label="ค้นหากล้องเพื่อเพิ่ม Timeline"
                    placeholder="ค้นหาชื่อกล้องหรือ UID เพื่อเพิ่มจุด"
                    value={cameraQuery}
                    onChange={(e) => setCameraQuery(e.target.value)}
                  />
                  {cameraQuery.trim() && (
                    <div className="route-camera-results">
                      {rows
                        .filter(
                          (r) =>
                            r.kind === "camera" &&
                            `${displayCode(r)} ${s(r, "title")}`
                              .toLowerCase()
                              .includes(cameraQuery.trim().toLowerCase()),
                        )
                        .slice(0, 20)
                        .map((c) => (
                          <button
                            className="button"
                            key={c.id}
                            onClick={() =>
                              onEdit("timeline", caseId, {
                                title: s(c, "title"),
                                camera_id: c.id,
                                lat: c.data.lat,
                                lng: c.data.lng,
                              })
                            }
                          >
                            เพิ่มจุด: {displayCode(c) || "ไม่ระบุ UID"} ·{" "}
                            {s(c, "title")}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
              <div
                className="timeline-list"
                onDragOver={(e) => {
                  if (write) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const ev = evidence.find(
                    (r) => r.id === e.dataTransfer.getData("text/plain"),
                  );
                  if (ev && write) {
                    const c = rows.find((r) => r.id === ev.data.camera_id);
                    onEdit("timeline", caseId, {
                      title: s(ev, "title"),
                      camera_id: ev.data.camera_id,
                      occurred_at: ev.data.occurred_at,
                      lat: c?.data.lat,
                      lng: c?.data.lng,
                      notes: `หลักฐานอ้างอิง ${s(ev, "code")}`,
                    });
                  }
                }}
              >
                {timeline.length ? (
                  timeline.map((t, i) => {
                    const previous = timeline[i - 1],
                      gap = previous
                        ? (Date.parse(s(t, "occurred_at")) -
                            Date.parse(s(previous, "occurred_at"))) /
                          60000
                        : 0;
                    return (
                      <div key={t.id}>
                        {gap > 10 && (
                          <button
                            className="gap"
                            onClick={() =>
                              onAnalyze(position(previous), position(t))
                            }
                          >
                            ช่วงห่าง {Math.round(gap)} นาที ·
                            ค้นหากล้องเพิ่มเติม
                            <ChevronRight size={14} />
                          </button>
                        )}
                        <article
                          className={`timeline-item ${selected === t.id ? "selected" : ""}`}
                        >
                          <button
                            className="timeline-select"
                            onClick={() => {
                              setSelected(t.id);
                              setPlaying(false);
                            }}
                          >
                            <span
                              className={`timeline-bullet ${s(t, "status")}`}
                            >
                              <CheckCircle2 size={13} />
                            </span>
                            <small>{dateTime(s(t, "occurred_at"))}</small>
                            <h4>
                              จุด {i + 1}
                              {i === timeline.length - 1
                                ? " · จุดสิ้นสุด"
                                : ""}{" "}
                              — {s(t, "title")}
                            </h4>
                            <p>{s(t, "observation")}</p>
                            <Badge status={s(t, "status")} />
                            {previous && (
                              <small>
                                {Math.round(gap)} นาที · ระยะเส้นตรง{" "}
                                {Math.round(
                                  meters(position(previous), position(t)),
                                )}{" "}
                                ม.
                              </small>
                            )}
                          </button>
                          <div className="timeline-actions">
                            <button
                              onClick={() => {
                                setSelected(t.id);
                                setPlaying(false);
                              }}
                            >
                              หลักฐาน ({pointEvidence(t).length})
                            </button>
                            <button onClick={() => onOpen(t)}>
                              รายละเอียด
                            </button>
                            {write && (
                              <button
                                onClick={() =>
                                  onEdit("timeline", caseId, undefined, t)
                                }
                              >
                                แก้ไข
                              </button>
                            )}
                            <button onClick={() => onAnalyze(position(t))}>
                              กล้องใกล้เคียง
                            </button>
                          </div>
                        </article>
                      </div>
                    );
                  })
                ) : (
                  <Empty>
                    เพิ่มกล้องหรือจุดตรวจสอบลง Timeline
                    <br />
                    ลากหลักฐานมาที่นี่ได้
                  </Empty>
                )}
              </div>
            </section>
          </div>
          <section className="panel evidence-tray">
            <div className="panel-heading">
              <h3>
                <FileText size={17} />
                หลักฐานในแฟ้ม <span className="counter">{evidence.length}</span>
              </h3>
              {write && (
                <button
                  className="button"
                  onClick={() => onEdit("evidence", caseId)}
                >
                  <FileUp size={15} />
                  แนบหลักฐาน
                </button>
              )}
            </div>
            <div className="evidence-cards">
              {evidence.length ? (
                evidence.map((e) => (
                  <button
                    draggable={write}
                    onDragStart={(ev) =>
                      ev.dataTransfer.setData("text/plain", e.id)
                    }
                    key={e.id}
                    className="evidence-card"
                    onClick={() => onEvidence(e)}
                  >
                    <div>
                      <Camera size={24} />
                      <span>{s(e, "category")}</span>
                    </div>
                    <strong>{s(e, "title")}</strong>
                    <small>{s(e, "file_name")}</small>
                  </button>
                ))
              ) : (
                <p className="muted">
                  ยังไม่มีไฟล์แนบ • รองรับภาพ วิดีโอ และ PDF
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
export function EvidenceViewer({
  record: r,
  onClose,
  onAdd,
}: {
  record: RecordRow;
  onClose: () => void;
  onAdd: (data: Partial<Data>, parent: string) => void;
}) {
  const { fileUrl, log, rows, upload, save, profile } = useStore();
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [speed, setSpeed] = useState(1),
    [elapsed, setElapsed] = useState(0);
  const video = useRef<HTMLVideoElement>(null),
    image = s(r, "mime_type").startsWith("image/"),
    isVideo = s(r, "mime_type").startsWith("video/");
  useEffect(() => {
    let active = true,
      local = "";
    async function load() {
      try {
        await log("VIEW_EVIDENCE", r.id);
        const u = await fileUrl(s(r, "file_path"));
        local = u;
        if (active) setUrl(u);
      } catch (e) {
        if (active) setError(String((e as Error).message));
      }
    }
    void load();
    return () => {
      active = false;
      if (local.startsWith("blob:")) URL.revokeObjectURL(local);
    };
  }, [r.id]);
  const captureTime = () =>
    new Date(Date.parse(s(r, "occurred_at")) + elapsed * 1000).toISOString();
  async function snapshot() {
    if (!video.current || !r.parent_id) return;
    setBusy(true);
    try {
      const v = video.current,
        canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext("2d")!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("สร้างภาพไม่ได้"))),
          "image/png",
        ),
      );
      const file = new File(
        [blob],
        `snapshot-${Math.floor(v.currentTime)}.png`,
        { type: "image/png" },
      );
      const result = await upload(file, r.parent_id);
      await save(
        "evidence",
        {
          title: `Snapshot · ${s(r, "title")} @ ${Math.floor(v.currentTime)}s`,
          code: `EVD-${crypto.randomUUID().slice(0, 8)}`,
          status: "unverified",
          occurred_at: captureTime(),
          category: "ภาพ",
          camera_id: r.data.camera_id,
          timeline_id: r.data.timeline_id,
          file_path: result.path,
          sha256: result.sha256,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          notes: `ต้นฉบับ ${displayCode(r)} เวลาในคลิป ${v.currentTime.toFixed(2)} วินาที`,
        },
        undefined,
        r.parent_id,
      );
      setError("บันทึก Snapshot แล้ว");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={s(r, "title")} onClose={onClose}>
      <div className="detail-body">
        {url ? (
          image ? (
            <img className="evidence-image" src={url} alt={s(r, "title")} />
          ) : isVideo ? (
            <video
              className="evidence-video"
              ref={video}
              src={url}
              crossOrigin="anonymous"
              controls
              onTimeUpdate={() => setElapsed(video.current?.currentTime ?? 0)}
            />
          ) : (
            <p>ไฟล์ PDF พร้อมดาวน์โหลด</p>
          )
        ) : (
          <p>กำลังโหลดหลักฐาน…</p>
        )}
        {isVideo && (
          <div className="toolbar">
            <label>
              ความเร็ว
              <select
                value={speed}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSpeed(v);
                  if (video.current) video.current.playbackRate = v;
                }}
              >
                {[0.25, 0.5, 1, 2, 4].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </label>
            <span>{elapsed.toFixed(1)} วินาที</span>
            {profile!.role !== "viewer" && (
              <button
                className="button"
                disabled={busy || !url}
                onClick={() => void snapshot()}
              >
                <Camera size={16} />
                Capture Snapshot
              </button>
            )}
          </div>
        )}
        <p className="hash">SHA-256 · {s(r, "sha256")}</p>
        <p className="muted">
          {s(r, "file_name")} · {dateTime(s(r, "occurred_at"))}
        </p>
        {error && <p role="status">{error}</p>}
      </div>
      <footer>
        <button
          className="button"
          disabled={!url}
          onClick={async () => {
            try {
              await log("DOWNLOAD_EVIDENCE", r.id);
              const response = await fetch(url);
              if (!response.ok)
                throw new Error("ลิงก์หมดอายุ กรุณาปิดแล้วเปิดหลักฐานใหม่");
              download(await response.blob(), s(r, "file_name"));
            } catch (e) {
              setError(String((e as Error).message));
            }
          }}
        >
          <Download size={16} />
          ดาวน์โหลด
        </button>
        {r.parent_id &&
          rows.find((c) => c.id === r.parent_id)?.kind === "case" &&
          profile!.role !== "viewer" && (
            <button
              className="button primary"
              onClick={() => {
                const c = rows.find((c) => c.id === r.data.camera_id);
                onAdd(
                  {
                    title: s(r, "title"),
                    occurred_at: captureTime(),
                    camera_id: r.data.camera_id,
                    lat: c?.data.lat,
                    lng: c?.data.lng,
                    notes: `อ้างอิง ${displayCode(r)} ${isVideo ? `เวลาในคลิป ${elapsed}s` : ""}`,
                  },
                  r.parent_id!,
                );
              }}
            >
              <Plus size={16} />
              เพิ่ม Timeline
            </button>
          )}
      </footer>
    </Modal>
  );
}
