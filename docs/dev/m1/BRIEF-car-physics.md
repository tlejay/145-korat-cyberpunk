# BRIEF M1 — 🧮 car-physics (pane physics ทำต่อ)
อ่าน `docs/dev/M1-CONTRACTS.md` (เจ้าของไฟล์ + interface — `src/types.ts` มีแล้วจาก game-ui) · ห้าม commit/push/deploy · จบด้วย typecheck+build ผ่าน + `docs/dev/REPORT-M1-car-physics.md`

**conductor ตัดสินแล้ว (19:11 ตามที่แนะนำ — Tle มอบสิทธิ์ M1–M3):** (1) ออกตัว **4.64 g ของจริง** ตอนออกจากจุดจอด (2) ข้ามคูมนัส = **ท่าโชว์ + แต้มสไตล์ "ข้ามคูเมือง"** ไม่ใช่ทางลัด (3) **เปิดทั้งแยก 224** ใช้กรวยนีออนเป็น apex · ค่าดริฟต์ยางหลัง ×0.85 · ยางเปียก ×0.85 · ลมจากรถต่อสายไฟ ×8

1. `src/car/physics*.ts` + `config.ts` (`TUNING` รวมค่า GAMEPLAY §7 + PHYSICS §1.6) + `camera.ts` + `index.ts` → `createCar(model)` ตามสัญญา: 120 Hz substep, bicycle + Pacejka ย่อ, raycast suspension 4 ล้อ, weight transfer, พัดลมดูดพื้น, launch control, boost, กระโดด + ลอยค้าง + landing burn, ถังลมใบเดียว, ชนแบริเออร์ไม่ติด (ใช้ `track.barriers`), `surfaceAt` (water → splash event), ห้ามกระโดด/boost ใน `zones.noBoostNoJump`, hydroplaning, หมุนล้อ/พัดลมของ model
2. กล้องตาม GAMEPLAY §4 (FOV ตามค่า g, สั่น, ไม่ทะลุตึก)
3. ให้ผลตรงกับ `scripts/physics-sim.mjs` ในเกณฑ์ PHYSICS §9 — เขียน test เล็ก ๆ ที่รัน step จริงของ `src/car` แบบ headless (Node) แล้วเทียบตัวเลข 0–100, เบรก, R56 skidpad
4. ค่า hook ใหม่ตาม PHYSICS §8 — ส่งให้ game-ui ผ่าน `car.state` (อย่าแก้ src/qa เอง เขียนใน REPORT ว่าต้องเพิ่มอะไร)
5. สายไฟ/โคม (Verlet) **ยังไม่ต้องทำใน M1** — เก็บไว้ M3 (เขียนเป็นโมดูลแยกที่พร้อมใช้ได้ถ้ามีเวลา: `src/car/physics-cables.ts`)
