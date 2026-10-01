import { displayCode } from "./domain";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Plus,
  Save,
  FileUp,
  Search,
  ArrowUpRight,
  Archive,
  Pencil,
  Trash2,
  Check,
  Camera,
  MapPin,
} from "lucide-react";
import {
  canWrite,
  cameraSiteKey,
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
      aria-label={title}
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
    [busy, setBusy] = useState(false),
    [cameraSearch, setCameraSearch] = useState(""),
    [cameraSearchInput, setCameraSearchInput] = useState("");
  const set = (key: string, value: string | number) =>
    setData((d) => ({ ...d, [key]: value }));
  const matchingCameras = rows
    .filter((r) => {
      if (r.kind !== "camera" || r.archived) return false;
      const query = cameraSearch.trim().toLowerCase();
      return (
        !query ||
        `${displayCode(r)} ${s(r, "title")}`.toLowerCase().includes(query)
      );
    })
    .slice(0, 20);
  function chooseCamera(cameraId: string) {
    if (!cameraId) {
      setData((d) => ({ ...d, camera_id: "" }));
      setCameraSearch("");
      setCameraSearchInput("");
      return;
    }
    const camera = rows.find((r) => r.id === cameraId);
    if (!camera) return;
    setData((d) => ({
      ...d,
      camera_id: camera.id,
      lat: camera.data.lat,
      lng: camera.data.lng,
    }));
    const label = `${displayCode(camera) || "ไม่ระบุ UID"} · ${s(camera, "title")}`;
    setCameraSearch(label);
    setCameraSearchInput(label);
  }
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
          <label
            style={
              record && !displayCode(record) ? { display: "none" } : undefined
            }
          >
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
              {f.ref === "camera" ? (
                <>
                  <div className="camera-search-control">
                    <input
                      aria-label="ค้นหากล้องที่เกี่ยวข้อง"
                      placeholder="ค้นหา UID หรือชื่อจุดติดตั้ง"
                      value={cameraSearchInput}
                      onChange={(e) => setCameraSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setCameraSearch(cameraSearchInput);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setCameraSearch(cameraSearchInput)}
                    >
                      <Search size={16} /> ค้นหากล้อง
                    </button>
                  </div>
                  {cameraSearch.trim() && (
                    <div
                      className="camera-picker-results"
                      role="listbox"
                      aria-label="ผลการค้นหากล้อง"
                    >
                      {matchingCameras.length ? (
                        matchingCameras.map((camera) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={data.camera_id === camera.id}
                            key={camera.id}
                            onClick={() => chooseCamera(camera.id)}
                          >
                            <strong>
                              {displayCode(camera) || "ไม่ระบุ UID"}
                            </strong>
                            <span>{s(camera, "title")}</span>
                          </button>
                        ))
                      ) : (
                        <p className="muted">ไม่พบกล้องที่ตรงกับคำค้นหา</p>
                      )}
                    </div>
                  )}
                  <select
                    required={f.required}
                    value={String(data[f.key] ?? "")}
                    onChange={(e) => chooseCamera(e.target.value)}
                  >
                    <option value="">เลือกจากรายการทั้งหมด…</option>
                    {rows
                      .filter((r) => r.kind === "camera" && !r.archived)
                      .map((camera) => (
                        <option key={camera.id} value={camera.id}>
                          {displayCode(camera)} · {s(camera, "title")}
                        </option>
                      ))}
                  </select>
                </>
              ) : f.type === "select" ? (
                <select
                  required={f.required}
                  value={String(data[f.key] ?? "")}
                  onChange={(e) => {
                    set(f.key, e.target.value);
                  }}
                >
                  <option value="">เลือก…</option>
                  {f.options?.map((v) => (
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
  onEdit,
  onArchive,
}: {
  rows: RecordRow[];
  onOpen: (r: RecordRow) => void;
  onEdit?: (r: RecordRow) => void;
  onArchive?: (r: RecordRow) => Promise<void>;
}) {
  const { profile } = useStore();
  const [confirmArchive, setConfirmArchive] = useState(""),
    [archiveError, setArchiveError] = useState("");
  return rows.length ? (
    <>
      {archiveError && (
        <p className="error" role="alert">
          {archiveError}
        </p>
      )}
      <div className="table-scroll">
        <table className="record-table">
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
                    {displayCode(r) && (
                      <span className="mono">{displayCode(r)}</span>
                    )}
                    <strong className="record-title">{s(r, "title")}</strong>
                  </button>
                </td>
                <td className="record-area">
                  {s(r, "area") || s(r, "assignee") || s(r, "plate") || "—"}
                </td>
                <td>
                  <Badge status={s(r, "status")} />
                </td>
                <td className="muted">{dateTime(r.updated_at)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`เปิด ${displayCode(r) || s(r, "title")}`}
                    onClick={() => onOpen(r)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                  {onEdit && onArchive && canWrite(profile!.role, r.kind) && (
                    <span className="record-actions">
                      <button
                        className="icon-button"
                        aria-label={`แก้ไข ${displayCode(r) || s(r, "title")}`}
                        onClick={() => onEdit(r)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button danger-icon"
                        aria-label={
                          confirmArchive === r.id
                            ? `ยืนยันลบ ${displayCode(r) || s(r, "title")}`
                            : `ลบ ${displayCode(r) || s(r, "title")}`
                        }
                        onClick={async () => {
                          if (confirmArchive !== r.id) {
                            setConfirmArchive(r.id);
                            return;
                          }
                          try {
                            await onArchive(r);
                            setConfirmArchive("");
                            setArchiveError("");
                          } catch (e) {
                            setArchiveError(
                              e instanceof Error ? e.message : String(e),
                            );
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  ) : (
    <Empty />
  );
}
export function RecordList({
  kind,
  onOpen,
  onNew,
  onEdit,
}: {
  kind: Kind;
  onOpen: (r: RecordRow) => void;
  onNew: () => void;
  onEdit: (r: RecordRow) => void;
}) {
  const { rows, profile, archive } = useStore();
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
      {kind === "incident" && canWrite(profile!.role, kind) && (
        <IncidentImporter />
      )}
      {kind === "vehicle" && canWrite(profile!.role, kind) && (
        <VehicleImporter />
      )}
      <div className="panel">
        <RecordTable
          rows={items.slice(page * 15, page * 15 + 15)}
          onOpen={onOpen}
          onEdit={onEdit}
          onArchive={archive}
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

function IncidentImporter() {
  const { rows, save } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  async function importFile(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const sheet = await readSheet(file);
      const [headers, ...sourceRows] = sheet;
      const columns = headers.map((value) => String(value ?? "").trim());
      const column = (name: string) => columns.indexOf(name);
      const required = [
        "policestation",
        "latitude",
        "longitude",
        "category",
        "description",
        "address",
        "date_start",
      ];
      if (required.some((name) => column(name) < 0)) {
        throw new Error("ไม่พบคอลัมน์มาตรฐานของไฟล์บันทึกเหตุการณ์");
      }
      const cell = (row: unknown[], name: string) =>
        String(row[column(name)] ?? "").trim();
      const compact = (value: string, limit = 90) => {
        const normalized = value.replace(/\s+/g, " ").trim();
        return normalized.length > limit
          ? `${normalized.slice(0, limit - 1).trimEnd()}…`
          : normalized;
      };
      const targetRows = sourceRows
        .map((row, index) => ({ row, sourceRow: index + 2 }))
        .filter(({ row }) =>
          cell(row, "policestation")
            .replace(/^สภ\./, "")
            .trim()
            .includes("เมืองนราธิวาส"),
        );
      if (!targetRows.length) {
        throw new Error("ไม่พบข้อมูลของ สภ.เมืองนราธิวาส ในไฟล์นี้");
      }
      const existing = new Map(
        rows
          .filter(
            (record) =>
              record.kind === "incident" &&
              typeof record.data.source_ref === "string",
          )
          .map((record) => [String(record.data.source_ref), record]),
      );
      let imported = 0,
        updated = 0,
        invalid = 0;
      for (const { row, sourceRow } of targetRows) {
        const sourceRef = `nara-events-xlsx:${sourceRow}`;
        const current = existing.get(sourceRef);
        const lat = Number(cell(row, "latitude"));
        const lng = Number(cell(row, "longitude"));
        const description = cell(row, "description");
        const address = cell(row, "address");
        const dateValue = row[column("date_start")];
        const occurredAt =
          dateValue instanceof Date
            ? `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, "0")}-${String(dateValue.getDate()).padStart(2, "0")}T00:00`
            : cell(row, "date_start").replace(" ", "T").slice(0, 16);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180 ||
          !address ||
          !description ||
          !Number.isFinite(Date.parse(occurredAt))
        ) {
          invalid++;
          continue;
        }
        const sourceCategory = cell(row, "category");
        const title = `${sourceCategory || "เหตุการณ์"} · ${compact(address)}`;
        await save(
          "incident",
          {
            code: current
              ? String(current.data.code)
              : `EVT-NARA-XLSX-${sourceRow}`,
            title,
            category: [
              "อุบัติเหตุ",
              "ลักทรัพย์",
              "ทะเลาะวิวาท",
              "รถแจ้งเตือน",
            ].includes(sourceCategory)
              ? sourceCategory
              : "อื่น ๆ",
            source_category: sourceCategory,
            occurred_at: occurredAt,
            area: compact(address),
            lat,
            lng,
            notes: description,
            source_ref: sourceRef,
            source_station: cell(row, "policestation"),
            source_address: address,
            status: "open",
          },
          current,
        );
        if (current) updated++;
        else imported++;
      }
      setMessage(
        `นำเข้า ${imported} รายการ · ปรับรายการเดิม ${updated} · ข้อมูลไม่ครบ ${invalid}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="import-panel">
      <div>
        <strong>นำเข้าบันทึกเหตุการณ์ Excel</strong>
        <p className="muted">
          อ่านเฉพาะ สภ.เมืองนราธิวาส เก็บหมวดเหตุเดิม พิกัด รายละเอียด
          และวันเกิดเหตุ โดยไม่สร้างรายการซ้ำจากไฟล์เดิม
        </p>
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
        }}
      />
      <button
        className="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={16} /> {busy ? "กำลังนำเข้า…" : "เลือกไฟล์ Excel"}
      </button>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function VehicleImporter() {
  const { rows, save } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  async function importFile(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const sheet = await readSheet(file);
      const [, ...sourceRows] = sheet;
      if (!sourceRows.length || sourceRows.some((row) => row.length < 21)) {
        throw new Error("ไม่พบคอลัมน์มาตรฐานของไฟล์รถหายและรถได้คืน");
      }
      const text = (row: unknown[], index: number) =>
        String(row[index] ?? "").trim();
      const compact = (value: string, limit = 110) => {
        const normalized = value.replace(/\s+/g, " ").trim();
        return normalized.length > limit
          ? `${normalized.slice(0, limit - 1).trimEnd()}…`
          : normalized;
      };
      const sourceDate = (value: unknown) => {
        if (value instanceof Date)
          return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
        return String(value ?? "")
          .trim()
          .slice(0, 10);
      };
      const targetRows = sourceRows
        .map((row, index) => ({ row, sourceRow: index + 2 }))
        .filter(({ row }) =>
          text(row, 14).replace(/^สภ\./, "").includes("เมืองนราธิวาส"),
        );
      if (!targetRows.length) {
        throw new Error("ไม่พบข้อมูลของ สภ.เมืองนราธิวาส ในไฟล์นี้");
      }
      const existing = new Map(
        rows
          .filter(
            (record) =>
              record.kind === "vehicle" &&
              typeof record.data.source_ref === "string",
          )
          .map((record) => [String(record.data.source_ref), record]),
      );
      let imported = 0,
        updated = 0,
        invalid = 0;
      for (let start = 0; start < targetRows.length; start += 8) {
        const batch = targetRows.slice(start, start + 8);
        const result = await Promise.all(
          batch.map(async ({ row, sourceRow }) => {
            const sourceRef = `nara-vehicle-xlsx:${sourceRow}`;
            const current = existing.get(sourceRef);
            const plate = text(row, 5);
            const brand = [text(row, 6), text(row, 7), text(row, 8)]
              .filter(Boolean)
              .join(" ");
            const reason = text(row, 16) || "แจ้งเตือนรถจากไฟล์ต้นฉบับ";
            if (!plate) return "invalid";
            const returnedAt = sourceDate(row[13]);
            const returnedNote = returnedAt || "ไม่ระบุวันที่คืนในไฟล์ต้นฉบับ";
            const lat = Number(text(row, 19));
            const lng = Number(text(row, 20));
            const location = text(row, 18);
            await save(
              "vehicle",
              {
                code: current
                  ? String(current.data.code)
                  : `VEH-NARA-XLSX-${sourceRow}`,
                title: compact(
                  `${plate} · ${brand || text(row, 6) || "รถแจ้งเตือน"}`,
                ),
                plate,
                province: "นราธิวาส",
                brand: compact(brand),
                color: text(row, 9),
                priority: "normal",
                reason,
                notes: [text(row, 25), `สถานะจากไฟล์: รถหายแล้วได้คืน (${returnedNote})`]
                  .filter(Boolean)
                  .join(" · "),
                status: "closed",
                source_ref: sourceRef,
                source_station: text(row, 14),
                source_status: text(row, 2),
                source_category: text(row, 16),
                source_reported_at: sourceDate(row[12]),
                source_returned_at: returnedAt,
                vehicle_type: text(row, 6),
                vehicle_model: text(row, 7),
                vehicle_year: text(row, 8),
                engine_no: text(row, 10),
                chassis_no: text(row, 11),
                source_location: location,
                lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : "",
                lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : "",
              },
              current,
            );
            return current ? "updated" : "imported";
          }),
        );
        for (const item of result) {
          if (item === "imported") imported++;
          else if (item === "updated") updated++;
          else invalid++;
        }
      }
      setMessage(
        `นำเข้า ${imported} รายการ · ปรับรายการเดิม ${updated} · ข้อมูลไม่ครบ ${invalid}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="import-panel">
      <div>
        <strong>นำเข้าทะเบียนรถหายและรถได้คืน Excel</strong>
        <p className="muted">
          อ่านเฉพาะ สภ.เมืองนราธิวาส ข้อมูลทุกแถวในไฟล์นี้เป็นรถหายแล้วได้คืน
          จึงบันทึกเป็นปิดแล้ว แม้ต้นฉบับจะไม่ระบุวันที่คืน และไม่สร้างรายการซ้ำจากไฟล์เดิม
        </p>
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
        }}
      />
      <button
        className="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={16} /> {busy ? "กำลังนำเข้า…" : "เลือกไฟล์ Excel"}
      </button>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
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
  const siteCameras =
    r.kind === "camera"
      ? rows.filter(
          (c) =>
            c.kind === "camera" &&
            !c.archived &&
            cameraSiteKey(c) === cameraSiteKey(r),
        )
      : [];
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
          {displayCode(r) && <span className="mono">{displayCode(r)}</span>}
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
                  : r.data[f.key] == null || r.data[f.key] === ""
                    ? "—"
                    : f.type === "datetime-local"
                      ? dateTime(String(r.data[f.key]))
                      : f.type === "date"
                        ? new Date(String(r.data[f.key])).toLocaleDateString(
                            "th-TH",
                          )
                        : ["lat", "lng"].includes(f.key)
                          ? Number(r.data[f.key]).toFixed(6)
                          : String(r.data[f.key])}
              </dd>
            </div>
          ))}
        </dl>
        {siteCameras.length > 1 && (
          <section className="site-camera-list">
            <h3>กล้องทั้งหมด ณ พิกัดเดียวกัน ({siteCameras.length} ตัว)</h3>
            {siteCameras.map((camera, index) => (
              <article key={camera.id}>
                <strong>
                  {index + 1}. {s(camera, "title")}
                </strong>
                <div>UID: {displayCode(camera) || "ไม่ระบุ"}</div>

                <div>
                  {s(camera, "type")} · <Badge status={s(camera, "status")} />
                </div>
                <button
                  className="button"
                  disabled={camera.id === r.id}
                  onClick={() => onOpen(camera)}
                >
                  {camera.id === r.id
                    ? "กำลังแสดงกล้องนี้"
                    : "รายละเอียดกล้องนี้"}
                </button>
              </article>
            ))}
          </section>
        )}
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
            <div className="table-scroll">
              <RecordTable rows={children} onOpen={onOpen} />
            </div>
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
              {confirm ? "ยืนยันลบ (กู้คืนได้)" : "ลบ (เก็บเข้าคลัง)"}
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
