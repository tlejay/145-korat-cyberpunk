อัปเดตล่าสุด: 2026-10-18 00:25 · 🟢 ขึ้น production แล้ว https://korat-cyberpunk.vercel.app/koratrocketcar/ · (เดิม 2026-10-17 · `tlejay/145-korat-cyberpunk` · 🟡 ระยะสำรวจ (ยังไม่มีโค้ดเกม)

## 0. รอบล่าสุด — 2026-10-17 ตั้งโปรเจค + ส่ง research pane

**ตัดสินใจแล้ว**
- ข้อมูลจริง = OSM (เรขาคณิต) + Street View/Wikimedia (ภาพอ้างอิง) — ไม่ใช้ Google 3D Tiles, ไม่เอาภาพ Google เข้าเกม
- ภาษาไทยอย่างเดียว · มือถือเป็นหลัก (แนวนอน ปุ่มสัมผัส)
- Stack: Vite + TypeScript + three.js · deploy Vercel CLI

**กำลังทำ** — research 3 tab ในเวิร์กสเปซนี้ (บรีฟ `docs/research/`)
- [x] OSM: ถนน/ตึก/คูเมือง + เสนอสนาม 3 แบบ → `research/osm/`
- [x] Landmarks: อนุสาวรีย์ ประตูชุมพล ฯลฯ + ภาพ CC → `research/landmarks/`
- [x] Car: Tesla Roadster รุ่นใหม่ — ข่าว สเปก ฟีเจอร์กระโดด/ออกตัว รูปทรงด้านท้าย → `research/car/`
- [x] Backend: scaffold + Vercel + Neon + leaderboard API → `docs/dev/REPORT-leaderboard.md`
- [x] Physics: โมเดล + 4 จุดโชว์ (ข้ามคูเมือง, ออกตัว 4.6g, ดริฟต์ 148°, ฝน+สายไฟ) → `docs/dev/PHYSICS.md`
- [x] Content (ร่าง 1): ร่างโพสต์ Facebook long form → `docs/content/facebook-post.md`
- [x] Gameplay: การควบคุม กล้อง ฟิสิกส์ สูตรแต้ม → `docs/dev/GAMEPLAY.md`
- [x] Audio: BGM + SFX license ใช้ได้ + แนวทางใช้บนมือถือ → `research/audio/`
- [x] Street View รอบ 1 (8 ถนนรอบลาน)
- [x] Street View รอบ 2: สนาม A ทั้งวง → `research/streetview/REPORT-track-A.md`

- [x] QA: TEST-PLAN + TEST-HOOKS + RELEASE-GATE → `docs/qa/` (QA เป็นด่านก่อน production ทุกครั้ง)

- [x] เสียงพากย์: Charlie (Mint/ElevenLabs ไม่เชิงพาณิชย์) · สำรอง Kenney CC0

- [x] **M1 เสร็จ** v0.2.0-build002 · preview https://korat-cyberpunk-8nliiddxu-dosx.vercel.app/koratrocketcar/ · QA กำลังตรวจ
- [x] M2 landmarks-3d
- [x] M2 streetscape · **M2 เสร็จ** 20:08
- [ ] M3: art + visuals + fx (เริ่ม 20:11)
- [ ] M3 backlog: รูปหล่อย่าโมยังผอมคล้ายหุ่น — เพิ่มรายละเอียดชุดไทย/ทรงผม (ห้ามล้อเลียน) · Terminal 21 ทรงกลาง ๆ (ไม่มีภาพนอก)

**แผนคืนนี้ (Tle อนุญาต 21:02 ก่อนนอน)**
1. รอ art (แก้ภาพ) · visuals (ต่อ art/sponsors/checkpoint) · fix (คิว #2–#9) · sponsors · checkpoint (ย้ายสตาร์ท + ด่าน) ให้จบ
2. 🧪 QA รอบ M3 บน preview → แก้จน 🔴 ที่ทดสอบอัตโนมัติได้ผ่านหมด
3. `vercel deploy --prod` เกม → เช็ค `korat-cyberpunk.vercel.app/koratrocketcar/` 200
4. pane madebytle: rewrite `/koratrocketcar/*` → เกม → deploy → เช็ค `madebytle.com/koratrocketcar/` 200 + หน้าเดิมของ madebytle ไม่พัง
5. ✍️ content อัปเดตโพสต์ Facebook ฉบับเต็ม
4.1 🚗 car-fix หลัง production: แก้โมเดลตาม `docs/research/REPORT-car-ref.md` (ปีกเตี้ยลง + Hidden Aero กางที่ >80 กม./ชม., กระจกหลังคางหมู, แผงท้ายขาว, ตัวรถเตี้ยลง 9%, ไฟท้ายบางลง) → QA ด่วนเฉพาะรถ → deploy ซ้ำ (ก่อน clips อัด)
5.1 🎬 clips: โหมดเดโม่ผ่าน URL บน production (Mint อัดเอง) + `promo/` (เพลง/SFX/โลโก้/ภาพนิ่ง/FACTS) commit ลง repo → comment ใน tlejay/mint#476
6. 📘 README (`/kiki-gh-readme`, Tle สั่ง 21:05) หลัง deploy: ภาพจากเกมฉบับจบ + GIF + ลิงก์ madebytle.com/koratrocketcar → **เปิด repo เป็น public** (Tle อนุญาตแล้ว · ตรวจประวัติ git 21:06 สะอาด: ไม่มี secret/อีเมล/IP/ภาพ Google/ภาพข่าว) · ไม่ใส่ open-source license (สงวนสิทธิ์โค้ด · asset ตาม CREDITS) จนกว่า Tle เลือก
7. สรุปให้ Tle ตอนเช้า

**แผนถัดไป (milestone)**
1. M0 รวมผลสำรวจ → Tle เลือกสนาม (A/B/C)
2. M1 Vertical slice: ถนนจาก OSM + รถขับได้ + ปุ่มมือถือ + deploy Vercel ครั้งแรก
3. M2 ลานย่าโม + ประตูชุมพล + คูเมือง (โมเดลแลนด์มาร์ก) + ตึกริมทางจาก footprint
4. M3 Cyberpunk pass: กลางคืน ฝน นีออน bloom ป้ายไฟไทย (texture จาก `/kiki-gpt`)
5. M4 เกมเพลย์: จับเวลารอบ ghost เพื่อนแข่ง AI หน้าเมนู/หน้าเครดิต · ปรับ fps มือถือ

**ตัดสินใจแล้ว** — สนาม A วงคูเมือง 3.36 กม. · URL madebytle.com/koratrocketcar
