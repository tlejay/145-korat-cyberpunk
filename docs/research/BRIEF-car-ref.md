# BRIEF — 🔍 car-ref: เทียบโมเดลราชสีห์ R1 กับรูปทางการบน tesla.com (Tle ถามผ่าน Mint 22:20)
อ่าน `CLAUDE.md` + `research/car/REPORT.md` + `blueprint.md` + `docs/dev/REPORT-M1-car-model.md` ก่อน · **ใช้ Chrome** (skill `kiki-chrome` → profile **DOSX** Tle เลือกไว้แล้ว ไม่ต้องถาม · ใช้ทีละ pane) · ห้าม commit/deploy · ปิด tab ที่เปิดเองก่อนจบ

1. เปิด https://www.tesla.com/roadster/reserve#payment ใน Chrome (เดิม fetch ได้ 403) · ดูรูปแบนเนอร์ด้านบนทุกรูป (ถ้ามีหน้า tesla.com/roadster หลักก็ดูด้วย) · แคปเก็บ `refs/car/official-*.png` (gitignored — **ใช้อ้างอิงเท่านั้น ห้ามเข้าเกม ห้าม commit**) · ห้ามกดจอง/กรอกฟอร์ม/ล็อกอิน
2. เทียบกับโมเดลในเกม (`src/car/model.ts` — ดูภาพ `refs/car/compare-*.png` หรือเรนเดอร์ `?qa=1&view=car` บนพอร์ตอื่น ไม่ใช่ 5199): สัดส่วน ยาว/กว้าง/สูง/ฐานล้อ · ทรงหลังคา/กระจก · ไฟท้าย/ไฟหน้า · ปีก · ล้อ · สี — มุมข้าง/หลัง/3/4 หลัง/หน้า
3. **ยังไม่แก้ `src/car/model.ts`** (QA กำลังตัดสินก่อน production) — เขียน `docs/research/REPORT-car-ref.md`: สรุป ≤ 10 บรรทัดบนสุด (ตรง/ต่างตรงไหน เรียงตามความสำคัญเมื่อมองจากกล้องหลังรถ) + ตัวเลขที่ควรปรับ (ค่าเดิม → ค่าใหม่ + ที่มา) · conductor จะส่งให้แก้หลังขึ้น production
