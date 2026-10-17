# BRIEF — QA รอบ M1 (build v0.2.0-build002)
อ่าน `CLAUDE.md` + `docs/qa/TEST-PLAN.md` + `TEST-HOOKS.md` + `RELEASE-GATE.md` + REPORT-M1-*.md ทั้งหมดใน `docs/dev/` + `docs/dev/PHYSICS.md` §9 · ห้าม commit · **ห้ามแก้โค้ดเกม** (QA หาบั๊ก ไม่ใช่แก้)

- preview: https://korat-cyberpunk-8nliiddxu-dosx.vercel.app/koratrocketcar/ (มี Vercel deployment protection — ใช้ skill `vercel:access-protected-vercel-deployment` หาทางเข้าแบบอัตโนมัติ ห้ามปิด protection ของโปรเจค) · ถ้าเข้าไม่ได้ ใช้ `pnpm build && pnpm preview` ทดสอบในเครื่องแทน และทดสอบ API บน preview ด้วย `&net=1` + track `test` (ลบแต้มทดสอบทิ้งเสมอ)
- ใช้ Playwright (Chromium + WebKit, 844×390 แนวนอน, touch) — **ไม่ใช้ Chrome ของ Tle**
1. รัน test case ทุกข้อใน TEST-PLAN ที่ทดสอบได้ใน M1 (ข้ามข้อของ M2/M3 เช่น นีออน/ฝน — ระบุว่า "ยังไม่ถึง") · ใส่ PHY-01..08 ผ่าน hook · ความสมจริง REAL (ยกเว้นช่วงแยก s 476–569 ที่ตั้งใจแก้) · LIC: ไม่มีภาพจาก Google/ภาพข่าวใน `public/` และ dist
2. เขียนสคริปต์ที่รันซ้ำได้ `tests/qa/*.spec.ts` + คำสั่ง `pnpm qa` (เพิ่ม devDependency Playwright ได้)
3. ข้อที่ต้องใช้มือถือจริง (fps, ความรู้สึกปุ่ม): ทำ checklist สั้นให้ Tle ทำตอน M4 แยกไว้ — ไม่นับว่าไม่ผ่าน
4. รายงาน `docs/qa/reports/2026-10-17-build002.md` ตามแบบฟอร์ม RELEASE-GATE: สรุป ≤ 15 บรรทัดบนสุด · ตาราง 🔴 ที่ไม่ผ่าน (ขั้นตอนทำซ้ำ + ภาพหน้าจอเก็บใน `docs/qa/reports/img/`) · 🟡 · ข้อเสนอเรียงตามความสำคัญ
