import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Plus,
  Save,
  FileUp,
  Search,
  ArrowUpRight,
  Archive,
  Check,
  Camera,
  MapPin,
} from "lucide-react";
import {
  canWrite,
  dateTime,
  definitions,
  s,
  statusLabels,
  validateData,
  type Data,
  type Kind,
  type RecordRow,
} from "./domain";
import { useStore, demo } from "./context";
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {statusLabels[status] ?? status}
    </span>
  );
}
export function Empty({
  children = "ยังไม่มีรายการ เริ่มต้นด้วยการเพิ่มข้อมูล",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Camera size={28} />
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">CCTV COMMAND CENTER</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="ปิดหน้าต่าง"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export interface EditorProps {
  kind: Kind;
  record?: RecordRow;
  parent?: string;
  initial?: Partial<Data>;
  onClose: () => void;
  onSaved?: (r: RecordRow) => void;
}
export function Editor({
  kind,
  record,
  parent,
  initial,
  onClose,
  onSaved,
}: EditorProps) {
  const { rows, save, upload } = useStore();
  const def = definitions[kind];
  const [data, setData] = useState<Data>(() =>
    record
      ? { ...record.data }
      : {
          title: "",
          code: `${def.prefix}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
          status: def.statuses[0],
          occurred_at: new Date().toISOString(),
          ...initial,
        },
  );
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (key: string, value: string | number) =>
    setData((d) => ({ ...d, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    setBusy(true);
    setError("");
    try {
      const payload = { ...data };
      for (const f of def.fields) {
        if (f.type === "datetime-local")
          payload[f.key] = String(formData.get(f.key) ?? "");
      }
      for (const f of def.fields) {
        if (f.type === "datetime-local" && payload[f.key])
          payload[f.key] = new Date(String(payload[f.key])).toISOString();
      }
      validateData(kind, payload);
      if (kind === "evidence" && !record && !file)
        throw new Error("กรุณาเลือกไฟล์หลักฐาน");
      if (file) {
        if (!parent) throw new Error("ต้องเลือกแฟ้มหรืองานก่อนอัปโหลด");
        const uploaded = await upload(file, parent);
        payload.file_path = uploaded.path;
        payload.sha256 = uploaded.sha256;
        payload.file_name = file.name;
        payload.mime_type = file.type;
        payload.file_size = file.size;
      }
      const saved = await save(kind, payload, record, parent);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : String((e as { message?: string }).message ?? e),
      );
    } finally {
      setBusy(false);
    }
  }
  function localValue(v: string) {
    if (!v) return "";
    const d = new Date(v);
    if (!Number.isFinite(+d)) return v;
    return new Date(+d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  return (
    <Modal
      title={`${record ? "แก้ไข" : "เพิ่ม"}${def.name}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            รหัสอ้างอิง
            <input
              required
              maxLength={100}
              value={String(data.code ?? "")}
              onChange={(e) => set("code", e.target.value)}
            />
          </label>
          <label>
            สถานะ
            <select
              value={String(data.status)}
              onChange={(e) => set("status", e.target.value)}
            >
              {def.statuses.map((v) => (
                <option key={v} value={v}>
                  {statusLabels[v]}
                </option>
              ))}
            </select>
          </label>
          {def.fields.map((f) => (
            <label key={f.key} className={f.type === "textarea" ? "wide" : ""}>
              {f.label}
              {f.required ? " *" : ""}
              {f.type === "select" ? (
                <select
                  required={f.required}
                  value={String(data[f.key] ?? "")}
                  onChange={(e) => {
                    set(f.key, e.target.value);
                    if (f.ref === "camera") {
                      const c = rows.find((r) => r.id === e.target.value);
                      if (c)
                        setData((d) => ({
                          ...d,
                          [f.key]: c.id,
                          lat: c.data.lat,
                          lng: c.data.lng,
                        }));
                    }
                  }}
                >
                  <option value="">เลือก…</option>
                  {f.ref
                    ? rows
                        .filter((r) => r.kind === f.ref)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {s(r, "code")} · {s(r, "title")}
                          </option>
                        ))
                    : f.options?.map((v) => (
                        <option key={v} value={v}>
                          {statusLabels[v] ?? v}
                        </option>
                      ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  required={f.required}
                  maxLength={10000}
                  value={String(data[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  name={f.key}
                  defaultValue={
                    f.type === "datetime-local"
                      ? localValue(String(data[f.key] ?? ""))
                      : undefined
                  }
                  type={f.type ?? "text"}
                  required={f.required}
                  step={f.type === "number" ? "any" : undefined}
                  min={f.min}
                  max={f.max}
                  maxLength={1000}
                  value={
                    f.type === "datetime-local"
                      ? undefined
                      : String(data[f.key] ?? "")
                  }
                  onChange={(e) =>
                    set(
                      f.key,
                      f.type === "number" && e.target.value !== ""
                        ? Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
              )}
            </label>
          ))}
          {kind === "evidence" && !record && (
            <label className="upload wide">
              <FileUp />
              ไฟล์หลักฐาน · สูงสุด 50 MB
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <small>
                {demo
                  ? "ไฟล์สาธิตเก็บในเบราว์เซอร์เครื่องนี้"
                  : "อัปโหลดไปยังพื้นที่ส่วนตัวของหน่วยงาน"}{" "}
                · บันทึกค่า SHA-256
              </small>
            </label>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button className="button primary" disabled={busy}>
            <Save size={16} />
            {busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function RecordTable({
  rows,
  onOpen,
}: {
  rows: RecordRow[];
  onOpen: (r: RecordRow) => void;
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>รหัส / รายการ</th>
            <th>พื้นที่ / ผู้รับผิดชอบ</th>
            <th>สถานะ</th>
            <th>อัปเดตล่าสุด</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <button className="record-link" onClick={() => onOpen(r)}>
                  <span className="mono">{s(r, "code")}</span>
                  <strong>{s(r, "title")}</strong>
                </button>
              </td>
              <td>
                {s(r, "area") || s(r, "assignee") || s(r, "plate") || "—"}
              </td>
              <td>
                <Badge status={s(r, "status")} />
              </td>
              <td className="muted">{dateTime(r.updated_at)}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`เปิด ${s(r, "code")}`}
                  onClick={() => onOpen(r)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
export function RecordList({
  kind,
  onOpen,
  onNew,
}: {
  kind: Kind;
  onOpen: (r: RecordRow) => void;
  onNew: () => void;
}) {
  const { rows, profile } = useStore();
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0);
  const all = rows.filter((r) => r.kind === kind),
    items = all
      .filter(
        (r) =>
          (!status || s(r, "status") === status) &&
          Object.values(r.data)
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase()),
      )
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <>
      <div className="toolbar">
        <div className="input-icon">
          <Search size={17} />
          <input
            aria-label="ค้นหารายการ"
            placeholder="ค้นหารหัส ชื่อ พื้นที่…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          aria-label="กรองสถานะ"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">ทุกสถานะ</option>
          {definitions[kind].statuses.map((v) => (
            <option key={v} value={v}>
              {statusLabels[v]}
            </option>
          ))}
        </select>
        <span className="muted">{items.length} รายการ</span>
        {canWrite(profile!.role, kind) && (
          <button className="button primary push" onClick={onNew}>
            <Plus size={16} />
            เพิ่ม{definitions[kind].name}
          </button>
        )}
      </div>
      <div className="panel">
        <RecordTable
          rows={items.slice(page * 15, page * 15 + 15)}
          onOpen={onOpen}
        />
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </button>
          <span>
            {Math.min(page + 1, Math.max(1, Math.ceil(items.length / 15)))} /{" "}
            {Math.max(1, Math.ceil(items.length / 15))}
          </span>
          <button
            disabled={(page + 1) * 15 >= items.length}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป
          </button>
        </div>
      </div>
    </>
  );
}
export function Details({
  record: r,
  onClose,
  onEdit,
  onAnalyze,
  onOpen,
  onAdd,
}: {
  record: RecordRow;
  onClose: () => void;
  onEdit: () => void;
  onAnalyze: (r: RecordRow) => void;
  onOpen: (r: RecordRow) => void;
  onAdd: (kind: Kind, parent: string) => void;
}) {
  const { rows, archive, profile } = useStore();
  const [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const children = rows.filter(
    (c) =>
      c.parent_id === r.id ||
      c.data.camera_id === r.id ||
      c.data.incident_id === r.id,
  );
  return (
    <Modal title={s(r, "title")} onClose={onClose}>
      <div className="detail-body">
        <div className="toolbar">
          <span className="mono">{s(r, "code")}</span>
          <Badge status={s(r, "status")} />
        </div>
        <dl>
          {definitions[r.kind].fields.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>
                {f.ref
                  ? (rows.find((x) => x.id === r.data[f.key])?.data.title ??
                    "—")
                  : String(r.data[f.key] ?? "—")}
              </dd>
            </div>
          ))}
        </dl>
        {r.kind === "evidence" && (
          <p className="hash">SHA-256: {s(r, "sha256")}</p>
        )}
        {(r.kind === "job" || r.kind === "incident" || r.kind === "case") &&
          canWrite(profile!.role, "evidence") && (
            <button className="button" onClick={() => onAdd("evidence", r.id)}>
              <FileUp size={16} />
              แนบหลักฐาน / ภาพก่อน–หลัง
            </button>
          )}
        {r.kind === "vehicle" && canWrite(profile!.role, "sighting") && (
          <button className="button" onClick={() => onAdd("sighting", r.id)}>
            <Plus size={16} />
            บันทึกการพบรถ
          </button>
        )}
        {children.length > 0 && (
          <>
            <h3>ประวัติและข้อมูลที่เกี่ยวข้อง</h3>
            <RecordTable rows={children} onOpen={onOpen} />
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <footer>
        {canWrite(profile!.role, r.kind) && (
          <>
            <button
              className="button danger"
              onClick={async () => {
                if (!confirm) {
                  setConfirm(true);
                  return;
                }
                try {
                  await archive(r);
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              <Archive size={15} />
              {confirm ? "ยืนยันเก็บเข้าคลัง" : "เก็บเข้าคลัง"}
            </button>
            <button className="button" onClick={onEdit}>
              แก้ไขข้อมูล
            </button>
          </>
        )}
        {r.data.lat !== undefined && (
          <button className="button primary" onClick={() => onAnalyze(r)}>
            <MapPin size={15} />
            วิเคราะห์พื้นที่นี้
          </button>
        )}
        <button className="button" onClick={onClose}>
          <Check size={15} />
          ปิด
        </button>
      </footer>
    </Modal>
  );
}
