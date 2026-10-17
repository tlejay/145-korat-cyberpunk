อัปเดตล่าสุด: 2026-10-17 · `tlejay/145-korat-cyberpunk` · 🟡 ระยะสำรวจ (ยังไม่มีโค้ดเกม)

## 0. รอบล่าสุด — 2026-10-17 ตั้งโปรเจค + ส่ง research pane

**ตัดสินใจแล้ว**
- ข้อมูลจริง = OSM (เรขาคณิต) + Street View/Wikimedia (ภาพอ้างอิง) — ไม่ใช้ Google 3D Tiles, ไม่เอาภาพ Google เข้าเกม
- ภาษาไทยอย่างเดียว · มือถือเป็นหลัก (แนวนอน ปุ่มสัมผัส)
- Stack: Vite + TypeScript + three.js · deploy Vercel CLI

**กำลังทำ** — research 3 tab ในเวิร์กสเปซนี้ (บรีฟ `docs/research/`)
- [x] OSM: ถนน/ตึก/คูเมือง + เสนอสนาม 3 แบบ → `research/osm/`
- [ ] Landmarks: อนุสาวรีย์ ประตูชุมพล ฯลฯ + ภาพ CC → `research/landmarks/`
- [ ] Car: Tesla Roadster รุ่นใหม่ — ข่าว สเปก ฟีเจอร์กระโดด/ออกตัว รูปทรงด้านท้าย → `research/car/`
- [ ] Audio: BGM + SFX license ใช้ได้ + แนวทางใช้บนมือถือ → `research/audio/`
- [ ] Street View: เดินสำรวจถนนทีละช่วง → `research/streetview/`

- [ ] QA: TEST-PLAN + TEST-HOOKS + RELEASE-GATE → `docs/qa/` (QA เป็นด่านก่อน production ทุกครั้ง)

**แผนถัดไป (milestone)**
1. M0 รวมผลสำรวจ → Tle เลือกสนาม (A/B/C)
2. M1 Vertical slice: ถนนจาก OSM + รถขับได้ + ปุ่มมือถือ + deploy Vercel ครั้งแรก
3. M2 ลานย่าโม + ประตูชุมพล + คูเมือง (โมเดลแลนด์มาร์ก) + ตึกริมทางจาก footprint
4. M3 Cyberpunk pass: กลางคืน ฝน นีออน bloom ป้ายไฟไทย (texture จาก `/kiki-gpt`)
5. M4 เกมเพลย์: จับเวลารอบ ghost เพื่อนแข่ง AI หน้าเมนู/หน้าเครดิต · ปรับ fps มือถือ

**ต้องตัดสินใจ** — เลือกสนามหลังได้ผล OSM
