# BRIEF M1 — 🚗 car-model: โมเดลรถ low-poly จากภาพข่าว
อ่าน CLAUDE.md + docs/dev/M1-CONTRACTS.md (สัญญากลาง — ห้ามแก้ไฟล์นอกโฟลเดอร์ที่เป็นเจ้าของ) + docs/dev/GAMEPLAY.md ก่อน · ห้าม commit/push/deploy · จบด้วย pnpm typecheck && pnpm build ผ่าน + REPORT ตามสัญญา
อ่านเพิ่ม: research/car/REPORT.md + blueprint.md + specs.json · ภาพอ้างอิงใน refs/car/ (เปิดดูด้วย Read ได้ — **ห้ามใช้ภาพเป็น texture ห้ามก๊อปเข้า public/**)

1. `src/car/model.ts` → `buildCarModel()` ตามสัญญา: สร้างด้วย geometry ของ three.js ในโค้ด (ไม่โหลดไฟล์ glTF) สัดส่วนตาม blueprint (ยาว ~4.45 ฐานล้อ ~2.825 กว้าง ~2.0 สูง ~1.25 ม.) ทรงลิ่ม
2. **ด้านท้ายสำคัญที่สุด** (กล้องมองท้ายตลอดเกม): แถบไฟท้ายแดงเต็มความกว้าง (emissive), ปีกหลังใหญ่บนขาคอห่าน, diffuser มีพัดลม 4 ตัว (export `fans` ให้หมุน) + หัวพ่น 4 หัว (export `nozzles` ให้ VFX), ล้อ 6 ก้านบาง (export `wheels`), กระจกทอง, สี Ano White
3. **ห้ามโลโก้ Tesla / ห้ามคำว่า Tesla บนรถ** · ป้ายทะเบียนท้ายแบบไทยสไตล์โคราช (เรนเดอร์ตัวอักษรไทยด้วย canvas + Noto Sans Thai เช่น "ไซเบอร์ 1 นครราชสีมา" — ห้ามให้ imagegen เขียน)
4. งบ: ≤ 15k triangles, ≤ 6 draw calls (merge วัสดุเดียวกัน) · LOD ไม่จำเป็น
5. หน้า preview `?qa=1&view=car` หมุนดูรถ + ภาพ screenshot มุมหลัง 3/4 เทียบภาพข่าว (เก็บที่ refs/car/compare-*.png) — ใน REPORT เขียนว่าส่วนไหนเหมือน/ต่าง
6. ชื่อรถในเกม: เสนอ 3 ชื่อไทย/อังกฤษผสมที่ไม่ใช้คำว่า Tesla/Roadster ใส่ใน REPORT ให้ Tle เลือก
