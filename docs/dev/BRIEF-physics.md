# BRIEF — Physics: ระบบฟิสิกส์ + 4 จุดโชว์ (คำนวณจากของจริง)

อ่าน `CLAUDE.md` + `research/car/REPORT.md` + `research/car/specs.json` + `research/car/blueprint.md` + `research/osm/REPORT.md` + `research/landmarks/REPORT.md` + `research/streetview/REPORT.md` + `docs/qa/TEST-PLAN.md` (FEEL/PERF) ก่อน · ถ้า `docs/dev/GAMEPLAY.md` มีแล้วให้อ่านด้วย (pane gameplay ออกแบบ "ความรู้สึก/ปุ่ม/กล้อง" — pane นี้เป็นเจ้าของ **โมเดลฟิสิกส์และตัวเลข**) · ห้าม commit

## หลัก
ฟิสิกส์ต้อง **คำนวณจากสเปกรถจริง (รุ่น Rocket) + ขนาดถนน/คูเมืองจริง** แล้วค่อยปรับเพื่อความสนุก — ทุกค่าที่ปรับต้องเขียนว่า "จริง = X · ในเกม = Y · เพราะ …" · ต้องรันบนมือถือกลาง ๆ ได้ (เขียนเอง ไม่ใช้ physics engine หนัก เว้นแต่พิสูจน์ได้ว่าคุ้ม)

## งาน → `docs/dev/PHYSICS.md` + `scripts/physics-sim.mjs`
1. **แกนกลาง**: fixed timestep (กี่ Hz, substep), แรงที่กระทำต่อรถ (แรงขับ มอเตอร์ 2 ตัวล้อหลัง, drag, rolling resistance, แรงกดจากพัดลม, ยางแบบ slip-based ง่าย ๆ เช่น Pacejka ย่อ/brush), weight transfer หน้า-หลัง/ซ้าย-ขวา, ช่วงล่างแบบ raycast spring-damper 4 ล้อ, การชนแบริเออร์ (restitution/friction ไม่ติด)
2. **โชว์ 1 — กระโดดข้ามคูเมือง** (Tle เลือก): หา **จุดบนสนาม A ที่คูกว้าง 23–40 ม.** ที่ข้ามแล้วเป็นทางลัดได้ (ห่างลานย่าโม ≥ ตามกฎ CLAUDE.md) · คำนวณ cold-gas thruster: แรงขับ/หัว, impulse, ใช้แก๊สเท่าไร (เกจถังลม) → ความสูง/ระยะ/เวลาลอยที่ความเร็วเข้าต่าง ๆ · ตีลังกากลางอากาศ (angular momentum, ควบคุมด้วยหัวพ่น) · ลงพื้น: ช่วงล่างยุบ, ถ้าลงผิดมุมเกิดอะไร · ตกน้ำ = respawn
3. **โชว์ 2 — ออกตัว 4.6g**: 0–60 mph < 0.59 วิ → a ≈ 45 m/s² · พิสูจน์ด้วยตัวเลขว่ายาง μ≈1.1 ทำได้แค่ ~1.1g → **แรงกดจากพัดลมดูด + หัวพ่นท้าย** ต้องเพิ่มเท่าไร · launch control (กดค้าง = พัดลมหมุน → ปล่อย) · ข้อมูลที่ HUD ควรโชว์ (เกจ g สด) · เอฟเฟกต์กล้อง (FOV, สั่น) อิงค่า g
4. **โชว์ 3 — ดริฟต์โค้งกลับ 148°** หัวถนนราชดำเนิน: รัศมีโค้งจริงจาก OSM/Street View · ความเร็วเข้าโค้งสูงสุดแบบ grip vs แบบดริฟต์ · slip angle, countersteer assist สำหรับจอสัมผัส · ดริฟต์เติมเกจถังลม (ถ้า gameplay ใช้)
5. **โชว์ 4 — ฝน + สายไฟ/โคม/ป้ายแกว่ง**: μ ถนนเปียก vs แห้ง, แอ่งน้ำ (hydroplaning ง่าย ๆ), ละอองน้ำจากล้อ · สายไฟพันกันแบบ catenary + spring (Verlet) แกว่งจากลมที่รถวิ่งผ่าน/หัวพ่น · โคมจีน ป้ายแขวน (pendulum) — ตำแหน่งตามของจริงใน `research/streetview/segments.json` · งบ: จำนวนเส้น/จุดสูงสุดบนมือถือ, LOD (ไกล = ไม่ simulate)
6. **พิสูจน์ตัวเลข**: `scripts/physics-sim.mjs` (Node ไม่ต้องลง package) จำลองแบบ headless: 0–100, กระโดดข้ามคูที่จุดที่เลือก, เข้าโค้ง 148° — พิมพ์ตารางผล ให้ QA ใช้เป็นเกณฑ์ได้ · ใส่ผลลง PHYSICS.md
7. **QA hooks**: ค่าใน `window.__game` ที่ต้องเปิดเพิ่ม (g, slip, gas, airborne, contact) ตาม `docs/qa/TEST-HOOKS.md`
8. สรุป ≤ 15 บรรทัดบนสุด + "ต้องตัดสินใจ" ≤ 3 ข้อ แล้วจบ turn
