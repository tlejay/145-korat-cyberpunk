# BRIEF — 🔰 wayfinding: ป้ายเตือนทางเลี้ยวข้างทาง (Tle สั่ง 21:14)
Tle: "ข้างทางต้องมีป้ายว่ากำลังจะต้องเลี้ยวขวา เลี้ยวซ้าย คนเล่นใหม่จะได้รู้"
อ่าน `CLAUDE.md` + `docs/dev/M1-CONTRACTS.md` + `docs/dev/REPORT-M1-world.md` + `docs/dev/REPORT-M2-streetscape.md` + `docs/dev/GAMEPLAY.md` (HUD/ลูกศร) + `docs/dev/PHYSICS.md` (ความเร็วเข้าโค้ง) · ห้าม commit/push/deploy · ปิด dev server ของตัวเองก่อนจบ (ห้ามพอร์ต 5199) · typecheck+build ผ่าน + `docs/dev/wayfinding/REPORT-wayfinding.md`

**เจ้าของไฟล์:** `src/wayfinding/**` (ใหม่) — export `buildWayfinding(track): THREE.Group` + `getUpcomingTurn(trackM): { dir: 'left'|'right', distM: number, severity: 1|2|3 } | null` ให้ 🌃 visuals (integrator) ต่อเข้าเกม/HUD · ⚠️ pane 🚧 checkpoint กำลังย้ายเส้นชัย/สร้าง track ใหม่ → **คำนวณโค้งจาก centerline ตอนโหลด** ไม่ hardcode ระยะ

1. หาโค้งทุกโค้งของสนาม A จาก centerline (มุมเลี้ยว, รัศมี, ทิศ) — รวมแยก 224 เลี้ยวขวา ~93°, โค้งถนนมนัส, สรรพสิทธิ์-วัชรสฤษดิ์-กำแหงสงคราม ฯลฯ · ระดับความแรง 1–3 จากความเร็วเข้าโค้งที่ปลอดภัย (PHYSICS)
2. **ป้ายข้างทาง** ก่อนถึงโค้ง: แผงลูกศรบั้ง (chevron) แบบป้ายเตือนทางโค้งของไทย (เหลือง-ดำ) **ในสไตล์ไฟ LED/นีออน** ให้เห็นชัดกลางคืนฝนตก · วางด้านนอกโค้งตรงจุดเลี้ยว + ป้ายเตือนล่วงหน้า ~150 ม. และ ~70 ม. (ลูกศรโค้ง + ข้อความไทยสั้น "เลี้ยวขวา" / "เลี้ยวซ้าย" / "โค้งอันตราย" ด้วย canvas + Noto Sans Thai) · จำนวนบั้งตามความแรง · ลูกศรวิ่งได้แต่กะพริบ ≤ 3 ครั้ง/วิ
3. **HUD ประกอบ** (ให้ visuals ต่อ): ลูกศรเลี้ยวมุมบนกลางจอ + ระยะ (ม.) เมื่อเหลือ ≤ 200 ม. ใช้ Heroicons/SVG ไม่ใช่ emoji · เสียงติ๊กเตือนเบา ๆ (optional ผ่าน audio event `uiTap` หรือเสนอ event ใหม่)
4. ห้ามวางป้ายในเขตลานย่าโม/บนประตู/วัด/ซุ้มพระบรมฉายาลักษณ์ · ไม่บังป้ายสปอนเซอร์และด่านตรวจ · มี collider ชนเบา (หรือไม่มี collider ถ้าอยู่หลังแบริเออร์)
5. งบ ≤ 4 draw calls (instancing) · ภาพ 4 มุมก่อนถึงโค้งสำคัญ `refs/m3/wayfinding-*.png`
