import { useState } from "react";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { useStore, demo } from "./context";
import {
  definitions,
  download,
  csvCell,
  s,
  dateTime,
  hasPosition,
  position,
  meters,
  type Kind,
  type RecordRow,
} from "./domain";
import MapView from "./MapView";
import { RecordTable } from "./components";
export default function Reports({
  onOpen,
}: {
  onOpen: (r: RecordRow) => void;
}) {
  const { rows, log, profile } = useStore();
  const [kind, setKind] = useState<Kind>("camera"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [caseId, setCaseId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const items = rows.filter(
    (r) =>
      r.kind === kind &&
      (!caseId || r.id === caseId || r.parent_id === caseId) &&
      (!from ||
        Date.parse(s(r, "occurred_at") || r.created_at) >=
          Date.parse(`${from}T00:00:00+07:00`)) &&
      (!to ||
        Date.parse(s(r, "occurred_at") || r.created_at) <=
          Date.parse(`${to}T23:59:59.999+07:00`)),
  );
  const columns = [
    "code",
    "title",
    "status",
    ...definitions[kind].fields.map((f) => f.key).filter((k) => k !== "title"),
  ];
  const reportTimeline = rows
    .filter((r) => r.kind === "timeline" && r.parent_id === caseId)
    .sort((a, b) => s(a, "occurred_at").localeCompare(s(b, "occurred_at")));
  const reportCameras = rows.filter(
    (r) =>
      r.kind === "camera" &&
      reportTimeline.some((t) => t.data.camera_id === r.id),
  );
  const path = reportTimeline.filter(hasPosition).map(position);
  async function output(format: "csv" | "xlsx" | "print") {
    setBusy(true);
    setError("");
    try {
      if (from && to && from > to)
        throw new Error("วันเริ่มต้องไม่เกินวันสิ้นสุด");
      if (profile!.role === "viewer")
        throw new Error("สิทธิ์ Viewer ไม่สามารถส่งออกรายงาน");
      await log(`EXPORT_${format.toUpperCase()}`, caseId || undefined);
      const data = [columns, ...items.map((r) => columns.map((c) => s(r, c)))];
      if (format === "print") {
        window.print();
      } else if (format === "csv") {
        download(
          new Blob(
            [
              "\uFEFF" +
                data.map((row) => row.map(csvCell).join(",")).join("\r\n"),
            ],
            { type: "text/csv;charset=utf-8" },
          ),
          `police14-${kind}.csv`,
        );
      } else {
        const { default: writeXlsxFile } =
          await import("write-excel-file/browser");
        await writeXlsxFile(
          data.map((row, i) =>
            row.map((value) => ({
              value,
              type: String,
              fontWeight: i === 0 ? ("bold" as const) : undefined,
            })),
          ),
          { columns: columns.map(() => ({ width: 24 })) },
        ).toFile(`police14-${kind}.xlsx`);
      }
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar no-print">
        <label>
          ประเภทรายงาน
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setCaseId("");
            }}
          >
            {Object.entries(definitions).map(([k, d]) => (
              <option key={k} value={k}>
                {d.plural}
              </option>
            ))}
          </select>
        </label>
        <label>
          ตั้งแต่
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          ถึง
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          กรองแฟ้ม
          <select
            disabled={!["case", "timeline", "evidence"].includes(kind)}
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {rows
              .filter((r) => r.kind === "case")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {s(r, "code")}
                </option>
              ))}
          </select>
        </label>
      </div>
      <section className="panel report">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">NARATHIWAT CCTV COMMAND CENTER</span>
            <h2>{definitions[kind].plural}</h2>
            <p className="muted">
              สภ.เมืองนราธิวาส · {items.length} รายการ ·{" "}
              {demo ? "ข้อมูลสาธิต" : "ข้อมูลตามสิทธิ์ผู้ใช้งาน"}
            </p>
          </div>
          <div className="toolbar no-print">
            {profile!.role !== "viewer" && (
              <>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void output("csv")}
                >
                  <Download size={15} />
                  CSV
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void output("xlsx")}
                >
                  <FileSpreadsheet size={15} />
                  Excel
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void output("print")}
                >
                  <Printer size={15} />
                  พิมพ์ / PDF
                </button>
              </>
            )}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <RecordTable rows={items} onOpen={onOpen} />
        {caseId && ["case", "timeline"].includes(kind) && (
          <div className="case-report">
            <h3>
              สรุปการสืบสวน · {rows.find((r) => r.id === caseId)?.data.title}
            </h3>
            <p>
              {reportTimeline.length} จุด · {reportCameras.length} กล้อง ·
              ระยะตามเส้นเชื่อม{" "}
              {(
                path
                  .slice(1)
                  .reduce((sum, p, i) => sum + meters(path[i], p), 0) / 1000
              ).toFixed(2)}{" "}
              กม.
            </p>
            <MapView cameras={reportCameras} route={path} />
            <ol>
              {reportTimeline.map((t) => (
                <li key={t.id}>
                  <b>
                    {dateTime(s(t, "occurred_at"))} · {s(t, "title")}
                  </b>
                  <p>
                    {s(t, "observation")} ·{" "}
                    {s(t, "status") === "confirmed"
                      ? "ยืนยันจากหลักฐาน"
                      : "รอตรวจสอบ"}
                  </p>
                </li>
              ))}
            </ol>
            <p className="footnote">
              เส้นเชื่อมแสดงลำดับข้อมูลที่บันทึก
              ไม่ใช่ข้อยืนยันเส้นทางเดินทางจริง
            </p>
          </div>
        )}
        <div className="print-details">
          {items.map((r) => (
            <article key={r.id}>
              <h3>
                {s(r, "code")} · {s(r, "title")}
              </h3>
              {definitions[kind].fields.map((f) => (
                <p key={f.key}>
                  <b>{f.label}: </b>
                  {s(r, f.key)}
                </p>
              ))}
            </article>
          ))}
        </div>
        <p className="footnote">
          จัดทำโดย {profile!.display_name} · วันที่{" "}
          {new Date().toLocaleDateString("th-TH")} ·
          ช่วงวันที่อ้างอิงเวลาเหตุการณ์ หากไม่มีใช้วันที่สร้าง
        </p>
      </section>
    </>
  );
}
