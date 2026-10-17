# REPORT M1 — 🧮 car-physics · 2026-10-17

> ## สรุป
> 1. **เสร็จ:** `createCar(model)` ตามสัญญา M1 ใช้ฟิสิกส์จริงแทนรถ stub แล้ว (`src/game/modules.ts` โหลด `src/car/index.ts` ให้เอง) · `pnpm typecheck` + `pnpm build` ผ่าน
> 2. **ไฟล์:** `src/car/config.ts` (TUNING ทุกค่า) · `physics.ts` (แกนฟิสิกส์ ไม่พึ่ง three.js) · `physics-collide.ts` · `camera.ts` · `index.ts` · `physics-cables.ts` (สายไฟ/โคม พร้อมใช้ M3 ยังไม่ต่อเข้าเกม)
> 3. **พิสูจน์:** `node scripts/test-car-physics.mjs` รัน step จริงของเกมแบบ headless ใน Node → **40/40 ผ่าน** เทียบเกณฑ์ PHYSICS §9 (0–100, launch, ท็อปสปีด, เบรก, skidpad R56, ดริฟต์, กระโดด, ชน, คู, เขตลาน, hydroplaning, สายไฟ)
> 4. ตัวเลขหลัก: 0–100 ปกติ **2.33 วิ** · boost 1.15 · launch+boost **0.63** (0–60 mph 0.59, 4.63 g, ล้อหน้าไม่ลอย) · ท็อป 240 / 320 · เบรก 100→0 19.6 ม. · grip R56 101 กม./ชม. · ดริฟต์ R56 113 (ฝน 104) · กระโดด 3.49 ม. ลอย 1.59 วิ แตะพื้น 3.3 ม./วิ
> 5. **ทำตามที่ conductor ตัดสิน:** launch 4.64 g ของจริง (ฟรีครั้งแรกหลัง reset ครั้งต่อไปใช้ 28 หน่วย) · ดริฟต์ยางหลัง ×0.85 · ยางเปียก ×0.85 (ตอนนี้ `rain = 0` รอฝน M3) · ลมจากรถต่อสายไฟ ×8
> 6. **เพิ่มจาก PHYSICS (เจอตอนเทสต์):** stability control กันรถหมุนเองตอนสลับเลี้ยวเร็ว (FEEL-08 เดิมหมุน 128°) + traction control ตอนเลี้ยว — ดริฟต์ยังเข้าได้ด้วยการแตะเบรกตามเดิม
> 7. ใช้เวลา ~2 µs ต่อ step บนเครื่องนี้ (มือถือกลางประมาณ 12 µs × 2 step/เฟรม — ไม่กระทบ fps)
> 8. **ยังไม่ได้เปิดดูในเบราว์เซอร์** (Chrome ใช้ได้ทีละ pane) — ให้ QA/game-ui ลองขับจริง: ทิศเลี้ยว ความรู้สึกดริฟต์ กล้อง
> 9. **ต้องให้ pane อื่นทำ** (ห้ามแก้ไฟล์คนอื่น) — ดูหัวข้อ 3: game-ui ต่อ hook ใหม่ + แก้ข้อความ "ทางลัด" ตรงคูมนัส · world ใส่ความสูง/ชนิดให้ barrier

## 1. สิ่งที่ทำตามบรีฟ

| ข้อบรีฟ | สถานะ | อยู่ที่ |
|---|---|---|
| 120 Hz substep (เกมเรียก `step(1/120)`) | ✅ | engine ของ game-ui |
| bicycle + Pacejka ย่อ + friction ellipse + ถ่ายน้ำหนัก (สูตร ไม่ใช่สปริง) | ✅ | `physics.ts` แกนราบ |
| raycast suspension 4 ล้อ (สปริง 2 Hz, โช้คคืนตัวหนืดกว่า 2 เท่า, bump stop) → y / pitch / roll / ล้อแตะพื้น | ✅ | `vertical()` · ออกตัว 4.6 g ก้นยุบ ~3° |
| พัดลมดูดพื้น (ปกติ 0.27 → เต็ม 0.75 × น้ำหนัก, spool 0.5 วิ) | ✅ | เต็มเมื่อ เบรก / ดริฟต์ / เตรียมออกตัว / เร่งหนักต่ำกว่า 100 · ต่ำกว่า 160 กม./ชม. |
| launch control | ✅ | กด BOOST ค้างตอนจอด (หรือเบรก+เร่งค้าง) ≥ 0.3 วิ → ปล่อย = 4.64 g 0.6 วิ · ตรงกับ protocol นับถอยหลังของ race.ts |
| boost | ✅ | +1.5 g, 20/วิ, ต้องมี ≥ 10, พ่นขั้นต่ำ 0.25 วิ, กลางอากาศครึ่งแรง |
| กระโดด + ลอยค้าง + landing burn | ✅ | vy 9.2, g 12, ลอยค้าง g 2.5 ≤ 1.2 วิ, ชะลอเหลือ −3 ม./วิ ตอน 1.5 ม.สุดท้าย · ลงเบี้ยว/ลงพัง/ลงหันหัว = ดริฟต์ |
| ถังลมใบเดียว (0..100) | ✅ | เติมเอง 3/วิ หลัง 1.5 วิ · ดริฟต์ 10/วิ · `addGas()` สำหรับโบนัสของเกม |
| ชนแบริเออร์ไม่ติด | ✅ | 3 วงกลมตามตัวรถ · ดันออก + กฎเฉียด/ชนตรง GAMEPLAY §2.5 · ไม่เร็วขึ้นหลังชน · ขอบลาน (`kind: 'monument'`) เด้งนุ่ม |
| `surfaceAt` / water → splash | ✅ | `telemetry.events.splash` + `state.onSurface = 'water'` (race.ts respawn เอง) |
| ห้ามกระโดด/boost ใน `zones.noBoostNoJump` + ห้ามกระโดดถ้าจุดตกอยู่ในเขต + ลอยเข้าเขต = ตกเร็ว | ✅ | |
| hydroplaning | ✅ | ทำงานเมื่อ track มี `puddleAt(x,z)` (ยังไม่มี — M3) |
| หมุนล้อ / เลี้ยวล้อหน้า / พัดลม / ปีก (airbrake ตอนเบรกแรง) / ตัวถังเอียง | ✅ | `index.ts` |
| กล้อง GAMEPLAY §3 + FOV ตาม g + สั่น + ไม่ทะลุตึก | ✅ | `camera.ts` — spring ω 8/4, ยืดตามความเร็ว/boost/g, ดริฟต์ผสมทิศความเร็ว 35%, กระโดดก้ม 6°, raycast ผนังแล้วดึงเข้าทันที คืน 0.4 วิ, ขยับ ≤ 1.5 ม./เฟรม, สั่นตามเหตุการณ์ (ไม่สั่นตอนชนขอบลาน) |
| test headless | ✅ | `node scripts/test-car-physics.mjs` (ไม่ต้องลง package · ใช้ Node type stripping + resolve hook `.js`→`.ts`) |
| สายไฟ/โคม (M3) | ✅ โมดูลพร้อม | `physics-cables.ts` — catenary + Verlet แบบ Jacobi, LOD 120 ม., สูงสุด 1,200 จุด, เทสต์ความเสถียรแล้ว |

## 2. ผลเทสต์ (40/40)

ตัวเลขเต็มดูได้จากการรัน `node scripts/test-car-physics.mjs` · ข้อที่ใกล้ขอบเกณฑ์: grip R56 101 (เป้า 107, −6%) · ดริฟต์ R56 113 (เป้า 122, −7%) · เฉียดกำแพง 20° เหลือ 0.77 (เกณฑ์ 0.75–0.95) — ทั้งหมดยังอยู่ในช่วง PHYSICS §9 · ค่าต่ำกว่าเป้าเล็กน้อยเพราะยางในเกมมี stability/traction control ที่ sim ไม่มี

## 3. ขอให้ pane อื่นทำ

**🎮 game-ui**
- **hook ใหม่ (PHYSICS §8):** อ่านจาก `(car as PhysicsCar).telemetry` → `car()` ของ `window.__game`: `g{long,lat,total,peak}` · `slip{betaDeg,frontDeg,rearDeg,rearSliding}` · `tank{units,lastUse,lastUseUnits}` · `airborne/airtimeMs/apexM` · `contact{wheels,compressionM,surface}` · `fans{level,spool}` · `thrustN{rear,lift}` · `launch{armed,active}` · `hydroplaning` · `attitudeDeg` · `stepMs` · `lastLand{vyMs,attitudeDeg,landingBurn,quality}` · นับเหตุการณ์ใน `telemetry.events` (launch/jump/land/splash/hardLanding/driftStart/driftEnd/boost — เป็นตัวนับ ให้เทียบค่าก่อนหน้าแล้วยิง `on(...)`)
- `qa.setTank(n)` → `car.physics.gas = n` · `qa.armLaunch()` = ส่ง input boost ค้าง 0.3 วิตอนจอด · `qa.setWeather({rain})` → `car.setRain(rain)` · `physics().tuning` → `car.tuning` (แผง `?tune=1` แก้ค่าใน object นี้ได้สด — physics อ่านทุก step)
- ตั้งค่า "ลดการสั่นกล้อง" → `car.setShakeScale(0.3)`
- **ข้อความที่คูมนัสต้องแก้:** engine.ts ขึ้น "ทางลัด: กระโดดข้ามคู" และ hint `speedKmh >= 80` — ตามที่ตัดสินแล้วเป็น **ท่าโชว์ ไม่ใช่ทางลัด** และไลน์ลงสวยคือ **90–115 กม./ชม. + กดค้างลอย** · race.ts ให้ "ข้ามคู +500" ถูกแล้ว แต่ `stats.shortcuts` ควรเปลี่ยนชื่อเป็นแต้มสไตล์ (ไม่ควรถูกนับเป็นทางลัดฝั่ง server)
- `launch` ฟรีทุกครั้งหลัง `car.reset()` (รวมหลัง respawn) — ถ้าไม่อยากให้ฟรีหลัง respawn ให้ตั้ง `car.physics.freeLaunch = false` หลังเรียก reset ตอน respawn
- เวลาต่ำสุดกันโกงเปลี่ยนเป็น 54.4 วิ/รอบ (PHYSICS §6) ถ้ายังไม่แก้ใน `src/net/score.ts`

**🛣️ world**
- `track.barriers` ยังไม่มีความสูง/ชนิด ตอนนี้ physics เดา: ทุกเส้น**สูงไม่จำกัด** ยกเว้นเส้นที่อยู่ห่างแนว `moatJump.takeoff → landing` ไม่เกิน 14 ม. ให้สูง 1.0 ม. (กระโดดข้ามได้) · **ขอให้ใส่ field เพิ่มใน barrier:** `h?: number` (ราวริมคู/แบริเออร์ปากพลแสนตะวันตก = 1.0) และ `kind?: 'building'|'wall'|'monument'|'barrier'` (ขอบลานย่าโม = `monument` → ชนนุ่ม ไม่สั่น ไม่มีประกายไฟ) — physics อ่านสองค่านี้อยู่แล้วถ้ามี
- M3: `puddleAt(x, z): boolean` สำหรับแอ่งน้ำ

## 4. ข้อสังเกต / ความเสี่ยง

- ดริฟต์เป็น PD แบบ arcade (GAMEPLAY) จำกัดแรงข้างไม่เกินยางจริงที่พัดลมเต็ม (~2.04 g) — มุมสไลด์ 30–40° ได้สวย · เทสต์ด้วย "คนขับจำลอง" ที่คุมเส้นได้ดีแค่ช่วงความเร็วใกล้ขีดจำกัด คนเล่นจริงต้องลองดู
- stability control ทำให้รถ "ดื้อ" ไม่ออกท้ายถ้าไม่แตะเบรก — ตั้งใจ (FEEL-08) · ถ้า Tle อยากให้ท้ายหลุดง่ายขึ้น ลด `escKp` หรือเพิ่ม `escBetaDeg` ใน `config.ts`
- แรงกดล้อของยางคิดจากสูตร ไม่ได้มาจากสปริง ตามที่ออกแบบไว้ (สปริงใช้แค่ความสูง มุมเอียง และการแตะพื้น)
- พื้นต่างระดับ (คันดิน/ตลิ่ง) ใช้ `heightAt` ต่อล้อ — ทดสอบเฉพาะพื้นเรียบกับตกน้ำ ยังไม่ได้ทดสอบกับทางลาดจริงของ world
- VFX (ไอพ่น 4 ลำ, น้ำกระจาย, ประกายไฟ) ไม่อยู่ในงานนี้ — state พร้อมให้ M3 ใช้ (`telemetry.boosting`, `thrustN`, `events`)
- ไฟท้ายสว่างตอนเบรกยังไม่ได้ทำ เพราะ mesh ไฟท้ายกับไฟหน้าใช้ material เดียวกัน (ต้องให้ car-model แยกก่อน)
