import { CENTER, type RecordRow, type Kind, type Data } from "./domain";
export const DEMO_ORG = "00000000-0000-4000-8000-000000000001";
export function makeDemo(): RecordRow[] {
  const rows: RecordRow[] = [];
  const now = new Date();
  const add = (kind: Kind, data: Data, parent_id: string | null = null) => {
    const r: RecordRow = {
      id: crypto.randomUUID(),
      org_id: DEMO_ORG,
      kind,
      parent_id,
      data,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      created_by: null,
      archived: false,
    };
    rows.push(r);
    return r;
  };
  const locations = [
    "แยกหอนาฬิกา",
    "ถนนพิชิตบำรุง",
    "ตลาดสดเทศบาล",
    "ถนนสุริยะประดิษฐ์",
    "สะพานบางนรา",
    "ถนนภูผาภักดี",
    "ชุมชนบางนาค",
    "ถนนจำรูญนรา",
    "หน้าสวนสาธารณะ",
    "ถนนประชาภิรมย์",
    "ชุมชนกำปงตาโก๊ะ",
    "ถนนสุริยะ",
  ];
  for (let i = 0; i < 36; i++)
    add("camera", {
      title:
        locations[i % locations.length] + ` · จุด ${Math.floor(i / 12) + 1}`,
      code: `CAM-${String(i + 1).padStart(3, "0")}`,
      status:
        i % 11 === 0 ? "offline" : i % 13 === 0 ? "maintenance" : "online",
      lat: CENTER[0] + Math.sin(i * 2.399) * (0.002 + i * 0.00042),
      lng: CENTER[1] + Math.cos(i * 2.399) * (0.002 + i * 0.00042),
      area: i % 3 === 0 ? "บางนาค" : i % 3 === 1 ? "บางนรา" : "เทศบาลเมือง",
      agency: "สภ.เมืองนราธิวาส",
      type: i % 4 === 0 ? "PTZ" : "Fixed",
      bearing: (i * 37) % 360,
      fov: 80,
      range: 150,
      last_seen: new Date(now.getTime() - i * 600000).toISOString(),
      notes: "ข้อมูลจำลองสำหรับทดสอบ ไม่ใช่ตำแหน่งกล้องจริง",
    });
  const cameras = rows.slice();
  for (let i = 0; i < 9; i++) {
    const c = cameras[i * 3];
    add("incident", {
      title: [
        "อุบัติเหตุบริเวณแยก",
        "ตรวจสอบทรัพย์สินสูญหาย",
        "ตรวจสอบเหตุในพื้นที่",
      ][i % 3],
      code: `EVT-${String(i + 1).padStart(3, "0")}`,
      status: i % 3 === 0 ? "open" : i % 3 === 1 ? "investigating" : "closed",
      category: ["อุบัติเหตุ", "ลักทรัพย์", "อื่น ๆ"][i % 3],
      lat: c.data.lat,
      lng: c.data.lng,
      area: c.data.area,
      camera_id: c.id,
      occurred_at: new Date(now.getTime() - i * 7200000).toISOString(),
      notes: "เหตุการณ์สมมติ",
    });
  }
  for (let i = 0; i < 4; i++)
    add("job", {
      title: [
        "กิ่งไม้บดบังมุมกล้อง",
        "ตรวจสอบระบบเครือข่าย",
        "ปรับมุมกล้อง",
        "ทำความสะอาดเลนส์",
      ][i],
      code: `JOB-00${i + 1}`,
      status: ["open", "in_progress", "review", "completed"][i],
      camera_id: cameras[i * 4].id,
      category: i === 0 ? "ภูมิทัศน์" : "ซ่อมอุปกรณ์",
      priority: i === 0 ? "high" : "normal",
      assignee: "ทีมบำรุงรักษา",
      due_date: new Date(now.getTime() + (i - 1) * 86400000)
        .toISOString()
        .slice(0, 10),
    });
  const v = add("vehicle", {
    title: "รถตัวอย่างสำหรับทดสอบ",
    code: "VEH-001",
    plate: "DEMO-001",
    province: "นราธิวาส",
    brand: "รถตัวอย่าง",
    color: "เทา",
    reason: "รายการสมมติ",
    priority: "normal",
    status: "active",
  });
  add(
    "sighting",
    {
      title: "บันทึกตัวอย่าง",
      code: "OBS-001",
      status: "unverified",
      lat: cameras[2].data.lat,
      lng: cameras[2].data.lng,
      camera_id: cameras[2].id,
      occurred_at: now.toISOString(),
    },
    v.id,
  );
  const c = add("case", {
    title: "ตรวจสอบเหตุบริเวณตลาดเทศบาล",
    code: "INV-2026-001",
    status: "investigating",
    area: "บางนาค",
    assignee: "เจ้าหน้าที่สาธิต",
    occurred_at: now.toISOString(),
    incident_id: rows.find((r) => r.kind === "incident")!.id,
    notes: "แฟ้มตัวอย่าง • ไม่มีข้อมูลบุคคลจริง",
  });
  add("case", {
    title: "ตรวจสอบเหตุบริเวณถนนพิชิตบำรุง",
    code: "INV-2026-002",
    status: "waiting",
    area: "บางนรา",
    assignee: "เจ้าหน้าที่สาธิต",
    occurred_at: now.toISOString(),
  });
  [2, 5, 8].forEach((j, i) =>
    add(
      "timeline",
      {
        title: cameras[j].data.title,
        code: `TL-00${i + 1}`,
        status: i === 2 ? "unverified" : "confirmed",
        camera_id: cameras[j].id,
        lat: cameras[j].data.lat,
        lng: cameras[j].data.lng,
        occurred_at: new Date(
          now.getTime() - (40 - i * 14) * 60000,
        ).toISOString(),
        observation: "ข้อมูลตัวอย่างสำหรับแสดงลำดับเหตุการณ์",
      },
      c.id,
    ),
  );
  return rows;
}
