# BRIEF — QA รอบ M3 = ด่านก่อน production (build v0.2.0-build002)
อ่าน `CLAUDE.md` + `docs/qa/TEST-PLAN.md` + `TEST-HOOKS.md` + `RELEASE-GATE.md` + `docs/qa/reports/2026-10-17-build002.md` (รอบก่อน) + REPORT ทุกตัวใน `docs/dev/` (M3, sponsors, checkpoint, wayfinding, fix) · ห้าม commit/deploy · **ห้ามแก้โค้ดเกม** ยกเว้นไฟล์ test · ปิด server ของตัวเองก่อนจบ (ห้ามพอร์ต 5199) · ลบโฟลเดอร์ผลวัดด้วย rm ตรง ๆ (ไม่ห่อ sh -c)
Tle อนุญาตให้ขึ้น production คืนนี้ถ้า QA ผ่าน → รายงานนี้คือคำตัดสิน **GO / NO-GO**

- preview: https://korat-cyberpunk-nanirpyvt-dosx.vercel.app/koratrocketcar/ (เข้าแบบเดิมด้วย OIDC token) · ในเครื่อง `pnpm build` + preview พอร์ตอื่น
1. **ปรับ test ที่ผูกกับของเดิม**: เส้นสตาร์ทย้ายไปใต้ลานย่าโม (AUD-01 กระโดดในเขตลาน, PHY-04/05 ระยะเริ่ม) · แข่ง **รอบเดียว** แล้ว · ชื่อเกม "โคราชโรสเตอร์"
2. รัน `pnpm qa` ครบทุกตัว + `pnpm qa:preview` บน preview (Chromium + WebKit)
3. เพิ่ม test สำหรับของใหม่ M3: VIS-04 กะพริบ ≤ 3/วิ (นีออน ป้ายสปอนเซอร์ ไฟด่าน ป้ายเลี้ยว), ไม่มีนีออน/สปอนเซอร์/ป้ายในเขตลานย่าโม-ประตู-วัด, ด่านตรวจ (กระโดดข้าม/ชนแล้วไม่ติด), ป้ายเลี้ยว HUD ขึ้นก่อนทุกโค้ง, งบ draw calls/tris ทุก quality tier, GPU texture ≤ 32 MB (low/mid), LIC: ทุกไฟล์ใน public/ อยู่ใน CREDITS/manifest ไม่มีภาพ Google/ภาพข่าว, DEP-03 cache header บน preview จริง, leaderboard รอบเดียว + ghost (track test แล้วลบ)
4. **ขับ autopilot ครบรอบหลายครั้ง** (quality low/mid/high) — ไม่ติดป้าย/ด่าน/แบริเออร์, ไม่หลุดโลก, ไม่มี console error
5. ข้อที่ต้องมือถือจริง → อัปเดต `docs/qa/M4-CHECKLIST-real-device.md` (ไม่นับว่าตก)
6. รายงาน `docs/qa/reports/2026-10-17-v0.2.0-build002.md` บนสุด: **GO หรือ NO-GO** + 🔴 ที่ตก (ทำซ้ำได้ + สาเหตุที่สงสัย + ไฟล์) · 🟡 สำคัญ
