import { z } from "zod";
import {
  point,
  lineString,
  polygon,
  distance,
  nearestPointOnLine,
  booleanPointInPolygon,
  destination,
} from "@turf/turf";

export const CAMERA_TYPES = [
  "กอ.รมน.",
  "มหาดไทย",
  "WI-FI",
  "4G",
  "ยุทธวิธี",
  "อื่นๆ",
];
export type Kind =
  | "camera"
  | "incident"
  | "job"
  | "vehicle"
  | "sighting"
  | "case"
  | "timeline"
  | "evidence"
  | "route";
export type Role = "administrator" | "supervisor" | "operator" | "viewer";
export type Point = [number, number]; // latitude, longitude
export type Data = {
  title: string;
  [key: string]: string | number | boolean | Point[] | undefined;
};
export interface RecordRow {
  id: string;
  org_id: string;
  kind: Kind;
  parent_id: string | null;
  data: Data;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived: boolean;
}
export interface Profile {
  id: string;
  org_id: string;
  display_name: string;
  role: Role;
  active: boolean;
}
export interface Audit {
  id: string;
  record_id: string | null;
  action: string;
  actor_id: string | null;
  created_at: string;
  details: Record<string, unknown>;
}
export interface Field {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "datetime-local" | "date" | "select";
  required?: boolean;
  options?: string[];
  ref?: Kind;
  min?: number;
  max?: number;
}
export interface Definition {
  name: string;
  plural: string;
  prefix: string;
  fields: Field[];
  statuses: string[];
}
const title: Field = {
  key: "title",
  label: "ชื่อ / รายละเอียดหลัก",
  required: true,
};
const coords: Field[] = [
  {
    key: "lat",
    label: "ละติจูด",
    type: "number",
    min: -90,
    max: 90,
    required: true,
  },
  {
    key: "lng",
    label: "ลองจิจูด",
    type: "number",
    min: -180,
    max: 180,
    required: true,
  },
];
const time: Field = {
  key: "occurred_at",
  label: "วันและเวลา",
  type: "datetime-local",
  required: true,
};
const note: Field = { key: "notes", label: "หมายเหตุ", type: "textarea" };
const camera: Field = {
  key: "camera_id",
  label: "กล้องที่เกี่ยวข้อง",
  type: "select",
  ref: "camera",
};
const area: Field = { key: "area", label: "พื้นที่ / ชุมชน", required: true };
export const definitions: Record<Kind, Definition> = {
  camera: {
    name: "กล้อง",
    plural: "ทะเบียนกล้อง CCTV",
    prefix: "CAM",
    statuses: ["online", "offline", "maintenance"],
    fields: [
      title,
      area,
      ...coords,
      {
        key: "type",
        label: "ประเภทกล้อง",
        type: "select",
        options: CAMERA_TYPES,
      },
      { key: "agency", label: "หน่วยงานเจ้าของ" },
      { key: "ip", label: "IP / ข้อมูลเชื่อมต่อ (ไม่ใส่รหัสผ่าน)" },
      {
        key: "bearing",
        label: "ทิศทาง 0–359°",
        type: "number",
        min: 0,
        max: 359,
      },
      { key: "fov", label: "มุมมอง 1–360°", type: "number", min: 1, max: 360 },
      {
        key: "range",
        label: "ระยะมองเห็นอ้างอิง (เมตร)",
        type: "number",
        min: 1,
        max: 10000,
      },
      { key: "last_seen", label: "ตรวจสอบล่าสุด", type: "datetime-local" },
      note,
    ],
  },
  incident: {
    name: "เหตุการณ์",
    plural: "บันทึกเหตุการณ์",
    prefix: "EVT",
    statuses: ["open", "investigating", "in_progress", "closed"],
    fields: [
      title,
      {
        key: "category",
        label: "ประเภทเหตุ",
        type: "select",
        options: [
          "อุบัติเหตุ",
          "ลักทรัพย์",
          "ทะเลาะวิวาท",
          "รถแจ้งเตือน",
          "อื่น ๆ",
        ],
      },
      time,
      area,
      ...coords,
      camera,
      note,
    ],
  },
  job: {
    name: "งานบำรุงรักษา",
    plural: "ซ่อมบำรุงและภูมิทัศน์",
    prefix: "JOB",
    statuses: ["open", "assigned", "in_progress", "review", "completed"],
    fields: [
      title,
      { ...camera, required: true },
      {
        key: "category",
        label: "ประเภทงาน",
        type: "select",
        options: ["ภูมิทัศน์", "ซ่อมอุปกรณ์", "ระบบเครือข่าย"],
      },
      {
        key: "priority",
        label: "ความสำคัญ",
        type: "select",
        options: ["normal", "high", "critical"],
      },
      { key: "assignee", label: "ผู้รับผิดชอบ", required: true },
      { key: "due_date", label: "กำหนดเสร็จ", type: "date", required: true },
      note,
    ],
  },
  vehicle: {
    name: "รถแจ้งเตือน",
    plural: "รถแจ้งเตือน",
    prefix: "VEH",
    statuses: ["active", "closed"],
    fields: [
      title,
      { key: "plate", label: "ทะเบียนรถ", required: true },
      { key: "province", label: "จังหวัด", required: true },
      { key: "brand", label: "ยี่ห้อ / รุ่น" },
      { key: "color", label: "สี" },
      {
        key: "priority",
        label: "ระดับแจ้งเตือน",
        type: "select",
        options: ["normal", "high", "critical"],
      },
      { key: "reason", label: "เหตุผลการแจ้งเตือน", required: true },
      note,
    ],
  },
  sighting: {
    name: "การพบรถ",
    plural: "ประวัติการพบรถ",
    prefix: "OBS",
    statuses: ["unverified", "confirmed"],
    fields: [title, time, ...coords, camera, note],
  },
  case: {
    name: "แฟ้มสืบสวน",
    plural: "แฟ้มสืบสวน CCTV",
    prefix: "INV",
    statuses: ["open", "investigating", "waiting", "review", "closed"],
    fields: [
      title,
      {
        key: "incident_id",
        label: "เหตุการณ์อ้างอิง",
        type: "select",
        ref: "incident",
      },
      area,
      { key: "assignee", label: "ผู้รับผิดชอบ", required: true },
      time,
      note,
    ],
  },
  timeline: {
    name: "จุด Timeline",
    plural: "Timeline การสืบสวน",
    prefix: "TL",
    statuses: ["unverified", "confirmed"],
    fields: [
      title,
      time,
      camera,
      ...coords,
      {
        key: "observation",
        label: "ข้อสังเกต / ที่มาของการยืนยัน",
        type: "textarea",
        required: true,
      },
      note,
    ],
  },
  evidence: {
    name: "หลักฐาน",
    plural: "คลังหลักฐาน",
    prefix: "EVD",
    statuses: ["unverified", "confirmed"],
    fields: [
      title,
      time,
      camera,
      {
        key: "category",
        label: "ประเภทหลักฐาน",
        type: "select",
        options: ["ภาพ", "วิดีโอ", "เอกสาร", "ก่อนดำเนินการ", "หลังดำเนินการ"],
      },
      note,
    ],
  },
  route: {
    name: "เส้นทางสมมติ",
    plural: "เส้นทางที่บันทึก",
    prefix: "RTE",
    statuses: ["draft", "review"],
    fields: [
      title,
      {
        key: "corridor",
        label: "ระยะจากแนวเส้น (เมตร)",
        type: "number",
        min: 1,
        max: 10000,
      },
      note,
    ],
  },
};
export const statusLabels: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  maintenance: "ซ่อมบำรุง",
  open: "รับแจ้ง / เปิดใหม่",
  investigating: "กำลังตรวจสอบ",
  in_progress: "กำลังดำเนินการ",
  closed: "ปิดแล้ว",
  assigned: "มอบหมายแล้ว",
  review: "รอตรวจสอบ",
  completed: "เสร็จสิ้น",
  active: "กำลังแจ้งเตือน",
  waiting: "รอข้อมูล",
  unverified: "รอตรวจสอบ",
  confirmed: "ยืนยันจากหลักฐาน",
  draft: "แบบร่าง",
  normal: "ปกติ",
  high: "สูง",
  critical: "เร่งด่วน",
};
export const s = (r: RecordRow, key: string) => String(r.data[key] ?? "");
export const n = (r: RecordRow, key: string) => Number(r.data[key] ?? 0);
export const position = (r: RecordRow): Point => [n(r, "lat"), n(r, "lng")];
export const hasPosition = (r: RecordRow) =>
  r.data.lat !== undefined &&
  r.data.lng !== undefined &&
  Number.isFinite(n(r, "lat")) &&
  Number.isFinite(n(r, "lng"));
export const CENTER: Point = [6.4264, 101.8231];
export const toGeo = ([lat, lng]: Point): [number, number] => [lng, lat];
export const meters = (a: Point, b: Point) =>
  distance(point(toGeo(a)), point(toGeo(b)), { units: "meters" });
export function routeDistance(p: Point, route: Point[]) {
  if (route.length < 2) return { distance: Infinity, along: 0 };
  const nearest = nearestPointOnLine(
    lineString(route.map(toGeo)),
    point(toGeo(p)),
    { units: "meters" },
  );
  return {
    distance: nearest.properties.dist ?? Infinity,
    along: nearest.properties.location ?? 0,
  };
}
export function inside(p: Point, vertices: Point[]) {
  return (
    vertices.length >= 3 &&
    booleanPointInPolygon(
      point(toGeo(p)),
      polygon([[...vertices.map(toGeo), toGeo(vertices[0])]]),
    )
  );
}
export function coverage(r: RecordRow): Point[] {
  const p = position(r),
    bearing = n(r, "bearing"),
    fov = n(r, "fov") || 90,
    range = n(r, "range") || 120;
  return [
    p,
    ...Array.from({ length: 25 }, (_, i) => {
      const d = destination(
        point(toGeo(p)),
        range,
        bearing - fov / 2 + (fov * i) / 24,
        { units: "meters" },
      ).geometry.coordinates;
      return [d[1], d[0]] as Point;
    }),
    p,
  ];
}
export function canWrite(role: Role, kind: Kind) {
  return role !== "viewer" && (kind !== "camera" || role === "administrator");
}
export function validateData(kind: Kind, data: Data) {
  z.object({
    title: z.string().trim().min(1).max(300),
    code: z.string().min(1).max(100),
    status: z.enum(definitions[kind].statuses as [string, ...string[]]),
  })
    .passthrough()
    .parse(data);
  for (const f of definitions[kind].fields) {
    const v = data[f.key];
    if (f.required && (v === undefined || v === ""))
      throw new Error(`กรุณาระบุ ${f.label}`);
    if (v === undefined || v === "") continue;
    if (
      f.type === "number" &&
      (!Number.isFinite(Number(v)) ||
        Number(v) < (f.min ?? -Infinity) ||
        Number(v) > (f.max ?? Infinity))
    )
      throw new Error(`${f.label} อยู่นอกช่วงที่กำหนด`);
    if (
      (f.type === "date" || f.type === "datetime-local") &&
      !Number.isFinite(Date.parse(String(v)))
    )
      throw new Error(`วันที่ ${f.label} ไม่ถูกต้อง`);
    if (f.options && !f.options.includes(String(v)))
      throw new Error(`${f.label} ไม่ถูกต้อง`);
  }
  if (
    kind === "timeline" &&
    data.status === "confirmed" &&
    !String(data.observation ?? "").trim()
  )
    throw new Error("ระบุที่มาของการยืนยัน");
  return data;
}
export const dateTime = (date: string) =>
  date
    ? new Date(date).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      })
    : "—";
export function csvCell(value: unknown) {
  let t = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replaceAll('"', '""') + '"';
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
