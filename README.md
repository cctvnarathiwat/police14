# NARA CCTV Command Center — สภ.เมืองนราธิวาส

เว็บแอปภาษาไทยสำหรับทะเบียนกล้อง เหตุการณ์ งานบำรุงรักษา รถแจ้งเตือน การวิเคราะห์พื้นที่ และแฟ้มสืบสวน ตาม Blueprint ที่ผู้ใช้แชร์

## เริ่มใช้งาน

ต้องมี Node.js 22.12+ หรือ Node.js 24 LTS

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

เปิด URL ที่ Vite แสดง (ปกติ `http://127.0.0.1:5173`)

### ทดลองโดยไม่ใช้ฐานข้อมูลจริง

ตั้ง `VITE_DEMO_MODE=true` ใน `.env` แล้วเริ่ม dev server ใหม่ ข้อมูลสาธิต 36 กล้องและรายการตัวอย่างจะสร้างในเบราว์เซอร์ ข้อมูลทั้งหมดเป็นข้อมูลจำลอง ไม่ใช่ทะเบียนกล้องจริง ใช้ LocalStorage เก็บรายการและ IndexedDB เก็บไฟล์แนบ โหมดนี้ไม่ส่งข้อมูลไป Supabase และไม่มีการยืนยันตัวตน จึงใช้ทดสอบเท่านั้น

### ใช้งานกับ Supabase

โปรเจกต์เป้าหมาย: `ruzhxkgqpszzhalcgkgi`

1. บัญชีผู้ติดตั้งต้องมีสิทธิ์เข้าถึงโปรเจกต์นี้ ตรวจสอบว่าไม่มีตาราง `cc_*` หรือ bucket `cc-evidence` ที่ใช้อยู่ก่อนติดตั้ง
2. รัน `supabase/migrations/20260923054738_command_center.sql` ใน SQL Editor ของโปรเจกต์ **หนึ่งครั้ง** ไฟล์ครอบด้วย transaction `BEGIN; … COMMIT;` อยู่แล้ว หรือใช้ Supabase CLI migration workflow หลังตรวจ `--help` ของรุ่นที่ติดตั้ง หากติดตั้งผ่าน SQL Editor แล้ว ต้องบันทึก migration history ก่อนใช้ `db push` ในอนาคตเพื่อไม่ให้รันซ้ำ
3. ใน Authentication → Users สร้างบัญชีผู้ดูแลด้วย email/password ที่หน่วยงานเป็นผู้กำหนด บันทึก User UUID
4. รัน SQL สำหรับสมาชิกเริ่มต้นด้วยสิทธิ์ผู้ดูแลฐานข้อมูล แทนค่า UUID และชื่อจริงก่อนรัน:

```sql
-- ใช้ UUID ของบัญชีที่สร้างใน Supabase Auth แทน ADMIN_AUTH_USER_UUID
with organization as (
  insert into public.cc_organizations(name)
  values ('สภ.เมืองนราธิวาส') returning id
)
insert into public.cc_profiles(id, org_id, display_name, role)
select 'ADMIN_AUTH_USER_UUID'::uuid, id, 'ผู้ดูแลศูนย์ CCTV', 'administrator'
from organization;
```

5. คัดลอก **Publishable key** จาก Project Settings → API Keys ไปใส่ `.env`:

```dotenv
VITE_SUPABASE_URL=https://ruzhxkgqpszzhalcgkgi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_DEMO_MODE=false
```

6. เริ่มเซิร์ฟเวอร์ใหม่ เข้าสู่ระบบด้วยบัญชีที่สร้าง แล้วเพิ่มข้อมูลจริง แอปไม่สร้างข้อมูลสาธิตในฐานข้อมูลจริง ไม่เปิด public signup และบัญชี Auth ที่ไม่มี membership จะเข้าถึงข้อมูลไม่ได้
7. ทดสอบ login, สร้าง/แก้ไขกล้องและเหตุการณ์, แนบหลักฐาน, เปิดไฟล์, แยกหน่วยงาน และสิทธิ์ Viewer ในโปรเจกต์จริงก่อนใช้ปฏิบัติงาน

ห้ามใส่ `service_role`, Secret key หรือรหัสผ่านกล้องใน frontend ตัว Publishable key ถูกออกแบบให้ใช้ใน browser ได้ โดยสิทธิ์ข้อมูลบังคับที่ RLS

## สิ่งที่ทำงานได้

- Dashboard สรุปสถานะจริงจากรายการที่โหลดได้ แผนที่และความเคลื่อนไหวล่าสุด
- ทะเบียนกล้อง: เพิ่ม/แก้ไข/เก็บเข้าคลัง, ตาราง/การ์ด/แผนที่, ค้นหา, กรองสถานะ พื้นที่ หน่วยงาน ประเภท และ Offline/last seen เกิน 24 ชั่วโมง
- เหตุการณ์พร้อมพิกัด เวลา ประเภท กล้องอ้างอิงและไฟล์แนบ
- งานซ่อมและภูมิทัศน์: ผู้รับผิดชอบ กำหนดเสร็จ ความสำคัญ สถานะ และภาพก่อน–หลัง
- รถแจ้งเตือนและประวัติการพบรถพร้อมกล้อง เวลา พิกัด
- วิเคราะห์รัศมี 200/500/1,000/2,000 เมตรและกำหนดเอง, วงรัศมีซ้อน, วาด Polygon, แสดง FOV และกรองกล้องตามมุมมอง
- วาดแนวเส้นทางและค้นหากล้องใน Corridor, เรียงตามลำดับบนเส้น, บันทึก/โหลด/เปรียบเทียบจำนวนกล้องของเส้นทางสมมติหลายเส้น
- Heat Map แบบวงความเข้มซ้อน เลือกเหตุการณ์ การพบรถ งานซ่อม หรือกล้อง Offline พร้อมช่วงวัน/วันที่กำหนดเอง/ช่วงชั่วโมง/ประเภทข้อมูล
- แฟ้มสืบสวน Kanban (ลากเปลี่ยนสถานะหรือใช้ dropdown), Timeline เรียงเวลา, จุดไม่ผูกกล้อง, สถานะยืนยัน/รอตรวจสอบ, Playback ตามลำดับจุด และค้นหากล้องระหว่างสองจุดที่มีช่วงเวลาห่าง
- เลือกกล้องจากแผนที่เข้าสู่ Timeline, ลากหลักฐานเข้าสู่ Timeline แล้วกรอกข้อสังเกต
- หลักฐานส่วนตัว: JPG/PNG/WebP/MP4/WebM/PDF สูงสุด 50 MB, SHA-256, เปิดด้วย signed URL อายุ 5 นาที, ดาวน์โหลด, วิดีโอปรับความเร็วและ Capture Snapshot
- ส่งออก CSV (ป้องกันสูตร), Excel `.xlsx`, พิมพ์/บันทึก PDF ผ่านเบราว์เซอร์ และรายงานแฟ้มพร้อมแผนที่/Timeline เมื่อเลือกแฟ้ม
- ค้นหาทั้งระบบ, แจ้งเตือนกล้อง Offline/งานใกล้กำหนด, ผู้ใช้ 4 ระดับ, ประวัติการเปลี่ยนแปลง, layout มือถือและโหมดซ่อน sidebar

## ขอบเขตการใช้งานและงานเชื่อมต่อที่ยังต้องทำ

- ยังไม่มี live RTSP/HLS gateway, ระบบ ping/ONVIF หรือการตรวจสุขภาพกล้องอัตโนมัติ สถานะกล้องมาจากเจ้าหน้าที่บันทึก วิดีโอใช้ไฟล์แนบ
- การแจ้งเตือนคำนวณจากข้อมูลที่โหลด เมื่อกดรีเฟรชจะได้ข้อมูลใหม่ ยังไม่มี background monitoring, push notification หรือ Realtime subscription
- Heat Map แสดงการซ้อนความเข้มเชิงภาพ ไม่ใช่แบบจำลองพยากรณ์หรือ KDE เชิงสถิติ
- เส้นทางเป็นเส้นที่ผู้ใช้วาด ไม่ใช่ระบบหาเส้นทางถนนอัตโนมัติ FOV เป็นข้อมูลอ้างอิง ไม่มีการประเมินสิ่งกีดขวาง
- สมาชิกในหน่วยงานเดียวกันอ่านรายการทั้งหมดของหน่วยงานได้ ยังไม่แบ่งสิทธิ์รายแฟ้ม/พื้นที่ย่อย Supervisor และ Operator มีสิทธิ์เขียนงานเท่ากัน ยังไม่มี workflow อนุมัติรายงานแยกต่างหาก
- Timeline เรียงตามเวลาหลักฐาน แก้เวลาเพื่อเปลี่ยนลำดับได้; drag/drop ใช้เพิ่มหลักฐานและเปลี่ยนสถานะ Case ไม่เปลี่ยนเวลาโดยลากจุด Timeline
- การเก็บเข้าคลังเป็น soft archive รายการที่ยังมีข้อมูลอ้างอิงจะเก็บเข้าคลังไม่ได้ ให้เปลี่ยนสถานะปิดแทน ผู้ดูแลฐานข้อมูลสามารถกู้รายการ archived ได้
- Audit ของการเปลี่ยนข้อมูลบังคับด้วย trigger; log การเปิด/ดาวน์โหลด/ส่งออกบันทึกผ่าน UI/RPC ไม่ใช่ network access log ที่ครอบคลุมผู้ใช้เรียก Storage API เองทั้งหมด
- ไฟล์ต้นฉบับไม่มีสิทธิ์เขียนทับหรือลบจาก browser หาก upload สำเร็จแต่บันทึกรายการล้มเหลวอาจเหลือไฟล์ orphan ให้ผู้ดูแลตรวจเทียบ `file_path` ก่อน cleanup
- หน้า UI โหลดข้อมูลที่ผู้ใช้เข้าถึงได้แบบแบ่งหน้า API แล้ววิเคราะห์ใน browser เหมาะกับทะเบียนระดับหน่วยงาน หากข้อมูลโตมากควรย้าย spatial query ไป PostGIS และเพิ่ม server-side pagination
- แผนที่ใช้ OpenStreetMap standard tiles และฟอนต์ Google Fonts ต้องมีอินเทอร์เน็ต ควรจัดหา tile service ตามปริมาณการใช้งานจริงและนโยบายหน่วยงาน

## สถาปัตยกรรม

React + TypeScript + Vite, Leaflet/react-leaflet, Turf.js, Supabase JS (Auth/Postgres/Storage), Zod, Lucide และ write-excel-file

- `src/domain.ts`: แบบข้อมูล, metadata ของฟอร์ม, validation, spatial calculations
- `src/store.tsx`: Supabase persistence และ demo adapter แยกจากกัน
- `src/Analysis.tsx`, `src/MapView.tsx`: เครื่องมือแผนที่
- `src/Investigation.tsx`: แฟ้ม Timeline และหลักฐาน/วิดีโอ
- `src/components.tsx`: ฟอร์ม รายการ และ modal ที่ใช้ร่วมกัน
- `supabase/migrations/`: schema, constraints, RLS, private helpers, audit และ Storage policies
- `tests/`: การทดสอบ spatial logic และ PostgreSQL security ด้วย PGlite

ตาราง `cc_records` ใช้ชนิดรายการ (`kind`) และ JSONB payload เพื่อรองรับฟอร์มหลายโมดูล มี FK สำหรับ parent, ตรวจสอบ parent/reference ข้ามหน่วยงาน, unique code ต่อประเภท/หน่วยงาน และ optimistic concurrency ด้วย `updated_at` ในการแก้ไข

| Role          | อ่านข้อมูลหน่วยงาน | จัดการกล้อง | จัดการงาน/แฟ้ม/หลักฐาน | ส่งออกรายงาน | จัดการสมาชิก |
| ------------- | ------------------ | ----------- | ---------------------- | ------------ | ------------ |
| Administrator | ✓                  | ✓           | ✓                      | ✓            | ✓            |
| Supervisor    | ✓                  | —           | ✓                      | ✓            | —            |
| Operator      | ✓                  | —           | ✓                      | ✓            | —            |
| Viewer        | ✓                  | —           | —                      | —            | —            |

RLS อ่าน membership จากตารางที่ client แก้ไม่ได้ ไม่ใช้ `user_metadata` เพื่ออนุญาตสิทธิ์ ฟังก์ชันที่ต้องใช้ `SECURITY DEFINER` อยู่ใน `cc_private` มี `search_path=''` ตรวจ `auth.uid()` และจำกัด EXECUTE

## ตรวจสอบและ build

```powershell
npm test
npm run test:db
npm run build
npm audit
```

PGlite tests จำลอง Supabase Auth/Storage schema เพื่อทดสอบ SQL จริงใน PostgreSQL WASM แต่ไม่แทนการทดสอบ Supabase Auth/Storage HTTP service หรือ Security Advisors ของโปรเจกต์จริง

`npm run build` สร้าง `dist/` สำหรับ static hosting ต้องตั้ง environment ก่อน build ค่าของ Vite ถูกฝังตอน build หากเปลี่ยนโปรเจกต์/โหมดต้อง build ใหม่ ห้ามนำ build ที่เปิด DEMO MODE ไปใช้งานจริง

## ที่มาของข้อกำหนด

- https://chatgpt.com/share/6ab360f5-2624-83ec-a463-0ad6fb2107a7
- GitHub เป้าหมาย: https://github.com/cctvnarathiwat/police14
- Supabase Auth: https://supabase.com/docs/guides/auth/passwords
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Private storage: https://supabase.com/docs/guides/storage/buckets/fundamentals
