# ผลการตรวจสอบ — 23 กันยายน 2026

## ผ่านในเครื่อง

- TypeScript และ production build (ทั้งค่าเริ่มต้นไม่เปิด demo และ build สาธิต)
- Unit tests 7 ข้อ: ระยะ geodesic, corridor, ลำดับกล้องตามแนวเส้น, polygon, พิกัด/status, Timeline required fields, role permissions และ CSV formula escaping
- PostgreSQL/PGlite integration: migration ทั้งไฟล์, อ่านข้ามหน่วยงานไม่ได้, anonymous ไม่มีสิทธิ์, Viewer เขียนไม่ได้, Operator แก้กล้องไม่ได้, เปลี่ยน org/role โดยตรงไม่ได้, สมาชิกต่างหน่วยงานย้ายไม่ได้, revoke membership มีผล, private file storage, ป้องกันเขียนทับ/ลบไฟล์, audit ไม่ให้แก้หรือลบ, ตรวจชนิด parent, route coordinates และ immutable evidence hash
- `npm audit`: 0 vulnerabilities ทั้ง dependency ของแอปและ development dependencies ณ เวลาทดสอบ

## ทดสอบผ่านเบราว์เซอร์

- Dashboard แสดงข้อมูลสาธิตพร้อมป้าย DEMO และแผนที่ OpenStreetMap โหลดได้
- เพิ่มเหตุการณ์พร้อมพิกัดและเวลา ค้นหารายการ และยังอยู่หลัง reload
- Radius 200 เมตรได้ 0 กล้อง / 500 เมตรได้ 6 กล้อง / 1 กม. ได้ 17 กล้องตาม fixture
- เลือกกล้องจาก Area Analysis แล้วส่งเข้าแฟ้ม INV-2026-001 ได้ มี Timeline เพิ่มและสถานะเริ่มต้นรอตรวจสอบ
- แนบ PNG ไปยัง IndexedDB ในโหมดสาธิต เปิดกลับได้หลัง reload; SHA-256 ที่หน้าแอปแสดงตรงกับ hash จากไฟล์ต้นทาง
- กดส่งออก Excel ได้ไฟล์ `.xlsx` จริง ตรวจ ZIP/XML ภายในพบ 37 แถว (header + 36 กล้อง) และ shared strings มีรหัส CAM-001 และข้อความภาษาไทย
- ตรวจ Dashboard และ Area Analysis ใน iframe ขนาด 390px (content viewport 375px หลังหัก scrollbar) ไม่มี horizontal overflow และเมนูมือถือเปิด/เลือกหน้าได้
- ทำ production preview ที่ `http://127.0.0.1:5173` เพื่อทดลองในเครื่อง

## ## ตรวจระบบจริงและธีมใหม่ 25 กันยายน 2569

- Supabase migration ติดตั้งผ่าน SQL Editor แล้ว: RLS เปิดทั้ง 4 ตาราง, 8 policies, private evidence bucket และ anonymous ไม่มีสิทธิ์อ่านข้อมูล/เรียก RPC
- ทดสอบ HTTP: anonymous records ตอบ 401 permission denied และ Auth settings ตอบ 200
- Security Advisor: 0 errors, 1 warning เรื่อง Leaked Password Protection Disabled
- GitHub Pages production deployment ผ่านแล้ว และตั้ง repository variables สำหรับ publishable key / URL แล้ว
- ธีมสว่างตามภาพอ้างอิง: glass login, sidebar, pastel summary, striped tables, detail modal และเครื่องมือแผนที่ รองรับมือถือ 390px
- ตรวจหน้า login ด้วยการเชื่อม Supabase จริง และ Dashboard/แผนที่/รายละเอียดในโหมด demo; ไม่คัดลอกข้อมูลบุคคลหรือข้อมูลปฏิบัติการจากภาพตัวอย่าง
- Build และ unit tests ทั้ง 7 ข้อผ่านหลังปรับ UI

## ขอบเขตที่ยังไม่ได้ตรวจ

- ยังไม่ทดสอบ login ด้วยรหัสผ่านของผู้ใช้ หรือการอัปโหลดหลักฐานบน production
- ยังไม่ทดสอบ stream gateway, วิดีโอจากเครื่องบันทึกจริง หรือ workload หลายผู้ใช้
- PDF ใช้หน้าพิมพ์ของ browser ยังไม่ได้ตรวจไฟล์ PDF ส่งออกทุกขนาดกระดาษ
