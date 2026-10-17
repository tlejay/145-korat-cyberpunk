# REPORT M1 — 🚗 car-model

## รอบ 2 (แก้ตาม REVIEW-car-model-1, 2026-10-17)

- ✅ **ไฟท้าย**: แถบแดงล้วนหนา 5 ซม. เต็มความกว้าง 1.88 ม. ชิดใต้ขอบฝาท้าย โค้งอ้อมมุม · ใช้แดงล้วน (ไม่มี G/B) จึงไม่เพี้ยนเป็นส้มหลัง tone mapping · แยก mesh จากไฟหน้าแล้ว (`tailLights[0]`, `headLights`) · ค่าตั้งต้น `TAIL_GLOW = 1.6` เบรก/boost ให้คูณขึ้น
- ✅ **แผงท้ายล่างสีดำเทา**: จากใต้แถบไฟลงถึง diffuser ทรงสอบตามตัวถัง · เหลือแถบขาวบาง ๆ เหนือไฟตามของจริง
- ✅ **ปีก**: กว้าง ~1.96 ม. (เกือบเท่าตัวรถ) · ยกสูงขึ้น 12 ซม. · กลางแบน + ปลายสองข้างเชิดขึ้น 15° · endplate · สีเงิน-บรอนซ์ + เรืองแสงจาง ๆ ให้มองเห็นในฉากมืด · มุมปกติ `WING_CRUISE`, airbrake `WING_AIRBRAKE`
- ✅ **ยางหลัง**: กว้างขึ้นเป็น 0.38 ม. (ด้านภาพ) · ดอกยางเทาเข้ม + แก้มยางสีเทา แยกจากฉากมืดได้
- ✅ **หัวพ่นข้างล้อหลัง 2 หัว พ่นลงพื้น** ใส่แล้ว · `nozzles` = rear 4 หัว ตามด้วย side-down 2 หัว · `userData.kind` = `'rear'` | `'side-down'` · มี `rearNozzles` / `sideNozzles` แยกให้ด้วย · ทิศพ่น = +z ของ anchor (ด้านข้างชี้ลงพื้น)
- ✅ **diffuser** ยื่นลงต่ำถึง 9 ซม. จากพื้น · หัวพ่นแถวบน พัดลมแถวล่าง
- ✅ ชื่อรถ `CAR_NAME = 'ราชสีห์ R1'` export จาก `model.ts` · ป้ายทะเบียนคงเดิม
- งบใหม่: **2,759 triangles · 7 draw calls** (≤ 8 ตามที่ conductor ขยายให้)
- 📸 แคป compare ใหม่ทับไฟล์เดิมแล้ว (`refs/car/compare-*.png` · `compare-chase-cam.png` วางคู่ภาพข่าวด้วย)
- ⚠️ `pnpm typecheck` **ไม่ผ่านในตอนนี้** เพราะ `src/qa/hooks.ts` (ไฟล์ของ game-ui) ยังไม่ตรงกับ type ใหม่ของ pane อื่น (`PhysicsCarDebug`, `setWeather/setTank/armLaunch`) — ไฟล์ `src/car/model*.ts` ไม่มี error · `vite build` ผ่าน
- ยังต่างจากของจริง: ปีกยังเป็นแผ่นเหลี่ยม ไม่มีโค้งกลาง · ยางหลังมองจากหลังตรง ๆ ยังเห็นแค่ดอกยางเทาเข้ม (ของจริงมีไฟสตูดิโอส่อง)

## รอบ 1

**สรุป (2026-10-17)**
- ✅ `buildCarModel()` อยู่ที่ `src/car/model.ts` ตรงตามสัญญา + เพิ่ม `wing` และ `CAR_DIMS` · สร้างจาก geometry ในโค้ดทั้งหมด ไม่โหลดไฟล์
- ✅ งบ: **2,505 triangles · 6 draw calls** (body, wing, lights, plate, wheels-instanced, fans-instanced) — ต่ำกว่างบ 15k/6 มาก
- ✅ ด้านท้าย: ไฟท้ายแดงเต็มความกว้าง + เส้นที่สองจาง (emissive ×2.5 ให้ bloom จับ) · ปีกทองแดงบนขาคอห่าน · diffuser 4 ช่อง พัดลม 4 ตัว (หมุนได้) · หัวพ่นทอง 4 หัว (anchor สำหรับ VFX) · ล้อ 6 ก้านบาง + จานลม · กระจกทอง · ตัวถัง Ano White
- ✅ ป้ายทะเบียนไทย "ไซเบอร์ 1 / นครราชสีมา" วาดด้วย canvas + Noto Sans Thai (`src/car/model-plate.ts`) — ไม่มีโลโก้/คำว่า Tesla บนรถ
- ✅ หน้า preview: `src/car/model-preview.ts` → `mountCarPreview(canvas)` (ลากหมุน, ล้อ/พัดลมหมุน, bloom, `window.__carPreview.setView/stats`)
- ⚠️ **game-ui ต้องต่อสาย** ใน `src/main.ts` (ไฟล์ไม่ใช่ของ car-model): ถ้า `?qa=1&view=car` → `import('./car/model-preview.js').then(m => m.mountCarPreview(canvas))` แทนการสร้างเกม
- 📸 ภาพเทียบ (gitignored): `refs/car/compare-rear34.png`, `compare-rear.png`, `compare-side.png`, `compare-chase-cam.png`
- 🏷️ ชื่อรถให้ Tle เลือก — ดูหัวข้อด้านล่าง
- `pnpm typecheck && pnpm build` ผ่าน · ไม่ได้เพิ่ม dependency · ไม่ได้ commit

## สัญญาที่ pane อื่นต้องรู้ (car-physics / VFX)

| สิ่ง | รายละเอียด |
|---|---|
| แกน | origin = พื้นถนน กึ่งกลางระหว่างเพลาหน้า-หลัง · **หน้ารถ = −z** · ขึ้น = +y · ขวา = +x → ใช้ `Pose` ได้ตรง ๆ (`root.rotation.y = −heading`) |
| ขนาด | `CAR_DIMS`: ยาว 4.40 · กว้าง 2.00 · สูง 1.27 · ฐานล้อ 2.82 · เพลาหน้า z −1.41 / หลัง +1.41 · half-track 0.85/0.83 · รัศมีล้อ 0.345/0.365 · ความกว้างยางหลัง (ด้านภาพ) 0.38 |
| ล้อ | `wheels.fl/fr/rl/rr` เป็น Object3D proxy (`rotation.order = 'YXZ'`) → `rotation.y` = เลี้ยว, `rotation.x` = หมุนล้อ (ติดลบ = เดินหน้า), `position.y` = ช่วงล่างยุบ/ยืด · InstancedMesh ตามเองทุกเฟรมไม่มีหน่วง |
| พัดลม | `fans[0..3]` (ซ้าย→ขวา) หมุนด้วย `rotation.z` |
| หัวพ่น | (รอบ 2) `nozzles[0..3]` = rear พ่นไปหลัง · `nozzles[4..5]` = side-down พ่นลงพื้น · ทิศพ่น = +z ของ anchor · ใช้ `getWorldPosition()` / `getWorldDirection()` วาง particle |
| ไฟ | (รอบ 2) `tailLights[0]` = ไฟท้ายแดงอย่างเดียว · `headLights` แยก · เบรก/boost: `material.color.setScalar(TAIL_GLOW * 2)` · ปกติ `TAIL_GLOW` |
| ปีก | `wing` pivot ที่ขอบหน้าปีก · `rotation.x` = `WING_CRUISE` (−0.28) · airbrake `WING_AIRBRAKE` (−1.4) |

## เทียบภาพข่าว — เหมือน / ต่าง

**เหมือน:** สัดส่วนตาม blueprint (ทรงลิ่ม จมูกต่ำ หลังคาสูงสุดค่อนไปหลัง) · ไฟท้ายเส้นบางเต็มความกว้างอยู่ใต้ปีก · ปีกใหญ่ปลายพับลงบนขาคอห่านสองขา · diffuser กล่องดำ 4 ช่องมีพัดลม + หัวพ่นทอง 4 หัวเรียงเหนือพัดลม · ป้ายทะเบียนกลางท้ายเหนือ diffuser · ท้ายสอบเข้าด้านล่าง (ไหล่กว้างที่ไฟท้าย) · ล้อ 6 ก้านบางบนจานเทา · กระจกโทนทอง/ชา

**ต่าง (ตั้งใจ — low-poly):** ผิวเป็นเหลี่ยม flat shading ไม่มีโค้งมนแบบรถจริง · ไม่มีเส้นตัดประตู/มือจับ/กระจกมองข้าง · ปีกไม่มีโค้งกลางแผ่น · กระจกไม่สะท้อนแบบโลหะ (ยังไม่มี env map — ใส่ได้ตอน M3 cyberpunk pass) · ป้ายเป็นป้ายไทยแทน "RDSTR" · มองตรงจากหลังยังเห็นยางหลังข้าง diffuser ไม่ชัดเท่าภาพจริง (ยางดำกลืนกับฉากมืด) · ยังไม่มีหัวพ่นใต้ท้องด้านข้าง 2 หัวของรุ่น Rocket (ในภาพ upright เห็นพ่นลงข้างล้อหลัง — ถ้าอยากให้ VFX กระโดดใช้ บอกได้ เพิ่ม anchor ได้ทันที)

**สีในภาพ preview** ดูม่วง/ฟ้าเพราะไฟ rim นีออนของหน้า preview — ตัวรถจริงเป็นขาว

## ชื่อรถ — เสนอ 3 ชื่อ (ไม่มีคำว่า Tesla / Roadster)

1. **ราชสีห์ R1 (Rajasi R1)** — มาจาก "นครราชสีมา" เมืองราชสีห์ · R1 ตรงกับป้าย "ไซเบอร์ 1" ⭐ แนะนำ
2. **โคราชโวลต์ (Korat Volt)** — รถไฟฟ้า + โคราช อ่านง่าย จำง่าย
3. **ลำตะคอง GT (Lamtakhong GT)** — ชื่อแม่น้ำสายหลักของโคราช ให้ฟีลรถแกรนด์ทัวเรอร์

(เลี่ยงชื่อย่าโม/สุรนารี เพราะเป็นที่เคารพ ไม่ควรเอามาเป็นชื่อรถแข่ง)

## ไฟล์ที่สร้าง
`src/car/model.ts` · `src/car/model-plate.ts` · `src/car/model-preview.ts` · `docs/dev/REPORT-M1-car-model.md` · `refs/car/compare-*.png` (gitignored)
