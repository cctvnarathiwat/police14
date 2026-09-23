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
    [error, setError] = useState("");
  const current = cases.find((c) => c.id === caseId);
  const timeline = rows
    .filter((r) => r.kind === "timeline" && r.parent_id === caseId)
    .sort((a, b) => s(a, "occurred_at").localeCompare(s(b, "occurred_at")));
  const evidence = rows.filter(
      (r) => r.kind === "evidence" && r.parent_id === caseId,
    ),
    cameras = rows.filter(
      (r) =>
        r.kind === "camera" && timeline.some((t) => t.data.camera_id === r.id),
    );
  const chosen = timeline.find((r) => r.id === selected),
    write = canWrite(profile!.role, "timeline");
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
              {s(c, "code")} · {s(c, "title")}
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
                      onClick={() => {
                        setCaseId(c.id);
                        setBoard(false);
                      }}
                    >
                      <span className="mono">{s(c, "code")}</span>
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
                        aria-label={`เปลี่ยนสถานะ ${s(c, "code")}`}
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
              <span className="mono">{s(current, "code")}</span>
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
                  Investigation Map
                </h3>
                <span className="muted">เส้นเชื่อมตามลำดับเวลาที่บันทึก</span>
              </div>
              <MapView
                cameras={cameras}
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
                route={timeline.filter(hasPosition).map(position)}
              />
              <div className="playback">
                <button
                  className="button primary"
                  disabled={!timeline.length}
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
                            onClick={() => setSelected(t.id)}
                          >
                            <span
                              className={`timeline-bullet ${s(t, "status")}`}
                            >
                              <CheckCircle2 size={13} />
                            </span>
                            <small>{dateTime(s(t, "occurred_at"))}</small>
                            <h4>{s(t, "title")}</h4>
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
          file_path: result.path,
          sha256: result.sha256,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          notes: `ต้นฉบับ ${s(r, "code")} เวลาในคลิป ${v.currentTime.toFixed(2)} วินาที`,
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
                    notes: `อ้างอิง ${s(r, "code")} ${isVideo ? `เวลาในคลิป ${elapsed}s` : ""}`,
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
