# REPORT M1 — 🛣️ world: สนาม A จากข้อมูลจริง

1. **เสร็จครบตามบรีฟ** · `pnpm typecheck && pnpm build` ผ่าน · ทดสอบในเกมจริง (engine ของ game-ui โหลด `src/track` ตัวจริง, autopilot วิ่งผ่าน checkpoint ได้ ไม่มี console error)
2. `scripts/build-track.mjs` (รันซ้ำได้ `node scripts/build-track.mjs`, 0.5 วิ) → `public/data/track-A.json` **115 KB / 31 KB gzip** + `track-A.debug.json` 5 KB gzip (โหลดเฉพาะหน้า debug)
3. **สนามหลังแก้ยาว 3,307 ม.** (OSM เดิม 3,361 · PHYSICS คาด ~3,311) · เลี้ยวขวา 93° ที่แยก 224 หัวราชดำเนิน **เปิดทั้งแยก** (ขาไปตะวันตก + ช่องเกาะกลาง + ขาไปตะวันออก) + กรวยนีออน apex 5 อัน (ไม่ใช่ collider) · ไม่มีช่วงวิ่งสวนวันเวย์
4. **แนวถนนเทียบ OSM:** เบี่ยงสูงสุด **3.07 ม.** · p95 0 ม. (ยกเว้นช่วงที่ตั้งใจแก้ s 476–569 ซึ่งต่างจากเส้น OSM เดิมสูงสุด 16.7 ม. เพราะ OSM routing ผิด)
5. **ข้ามคูมนัส = ท่าโชว์ ไม่ใช่ทางลัด** (PHYSICS §2.3) · `altGroup = null` · ไม่มี checkpoint ระหว่าง s 1,035–1,198 ทั้งสองไลน์จึงผ่าน checkpoint ครบ · ราวริมคูทุกเส้น + แบริเออร์ปากพลแสนตะวันตก `h = 1.0 ม.` · ที่เหลือ `h = Infinity`
6. **Barrier มี `h` + `kind` + `style` แล้ว** (ตามที่ car-physics ขอ): kind = `wall|barrier|building|monument` (ขอบลานย่าโม/ประตู = `monument` ชนนุ่ม) · style = `rail|neon|building|invisible` · 1,036 เส้น (neon 41 ปากทาง, ราวคู 21, หน้าตึก 239, ขอบลาน 13)
7. **งบ:** ทั้งสนามมองจากบน (ทุก chunk เปิด) **47 draw calls / 51,617 สามเหลี่ยม** · มุมขับจริง 9–32 draws / ≤ 37k tris · ในเกมพร้อมรถ 24 draws / 18.6k tris → ต่ำกว่างบ 150 / 500k มาก
8. หน้า debug **`?qa=1&view=top`** เขียนแล้วที่ `src/scene/top-view.ts` แต่ **game-ui ต้องต่อใน `src/main.ts`** (ข้อ A ด้านล่าง) · มี deep link `&cx=&cz=&zoom=`
9. **เส้นชัยย้าย** ไปขอบเหนือเขตลานย่าโม +3 ม. (เดิม research track_m 0 = หน้าอนุสาวรีย์ อยู่ในเขตห้าม boost) · startGrid ห่างเส้นชัย 10 ม. นอกเขต · research track_m 0 = s 3,269.5 · ตารางแปลง `researchMap` อยู่ใน JSON
10. ต้องให้ pane อื่นทำ: **game-ui** ต่อหน้า top view + เติม field barrier ใน `src/types.ts` · **QA** ใช้ช่วงยกเว้น REAL-02 · รายละเอียดหัวข้อ 4
11. ยังไม่ทำ (M2/M3): ป้ายชื่อถนน, เสาไฟ/สายไฟ/โคม (เว้นช่องโคม x 480–505 ไว้ให้), polygon แอ่งน้ำ, ภาพภายนอก Terminal 21 ยังไม่มี ref

---

## 1. ไฟล์ที่ทำ (ของ world ทั้งหมด)

| ไฟล์ | ทำอะไร |
|---|---|
| `scripts/build-track.mjs` | OSM + Street View + landmarks → JSON (centerline แก้แยก, ความกว้าง, raster ผิว, ผนังชน, ตึก, checkpoint, โซน) |
| `public/data/track-A.json` | ข้อมูลสนามที่เกมโหลด (พิกัด ×10 = เดซิเมตร) |
| `public/data/track-A.debug.json` | OSM ดิบสำหรับ overlay ในหน้า top view เท่านั้น |
| `src/track/index.ts` | `loadTrack('A', scene)` + `getTrackExtras()` + `fetchTrackData()` |
| `src/track/data.ts` | decode JSON, `surfaceAt/heightAt` แบบ grid O(1) |
| `src/track/meshes.ts` · `builder.ts` · `materials.ts` | mesh ถนน/ขอบทาง/เส้นจราจร/ผนัง/นีออน/น้ำ/พื้น/ตึก merge ต่อ chunk |
| `src/track/landmarks.ts` | อนุสาวรีย์ ลาน ประตูชุมพล Terminal 21 |
| `src/scene/night.ts` | ฟ้ากลางคืน (gradient + city glow + ดาว) หมอก แสงจันทร์/hemisphere · tier low/mid/high |
| `src/scene/top-view.ts` · `scene.ts` | หน้า QA มองบน · `scene.ts` เหลือเป็น barrel (main.ts ไม่ได้ใช้แล้ว) |

ไม่ได้เพิ่ม dependency · ไม่ได้แตะไฟล์ pane อื่น

## 2. ข้อมูลและการตัดสินใจ

**Centerline** — จุดจาก `research/osm/track-A.geojson` ตัดช่วง OSM index 15–25 (เลี้ยวซ้ายสวนวันเวย์ + secondary_link) ออก แทนด้วยมุมเดียวที่จุดตัดแนวราชดำเนินกับแนว 224 ขาไปตะวันออก แล้ว fillet ทุกมุม > 12° (มุมแยก 224 R 15 ม. ตามแนวกลางถนน · มุมอื่น R 11 ม.) · resample ทุก 2.5 ม. (1,323 จุด)

**โค้งที่ได้** (s จากเส้นชัยใหม่): 505 ขวา 93° (แยก 224) · 1,115 ขวา 92° (มนัส) · 2,017 ขวา 92° (สรรพสิทธิ์) · 2,332 ซ้าย 91° (วัชรสฤษดิ์) · 2,457 ขวา 96° (กำแหงสงคราม) · 2,750 ขวา 89° (ราชดำเนิน) — อยู่ใน `corners` ของ JSON ให้ HUD ใช้

**ชื่อถนน** (`roadNames`): ราชดำเนิน 0–510 · ราชสีมา-โชคชัย 510–1,112 (เปลี่ยนจาก OSM "มิตรภาพ"/"นครราชสีมา - หินโคน" ตาม Street View) · มนัส · สรรพสิทธิ์ · วัชรสฤษดิ์ · กำแหงสงคราม · ราชดำเนิน

**ความกว้าง** — Street View 39 จุดที่อยู่บนสนาม (≤ 14 ม. และทิศตรง) interpolate ตามระยะ · ทางเท้า 2.5 ม. (มนัส/สรรพสิทธิ์/วัชรสฤษดิ์/กำแหงสงคราม 1.8 ม., ฝั่งคูราชดำเนิน 3 ม.) · ทาง 224 = ขาไปตะวันออก + เกาะกลาง (curb) + ขาไปตะวันตก 10.5 ม. (จากเส้น OSM ขาไปตะวันตก) + ทางเท้าริมคู 1.5 ม.

**ผิว (`surfaceAt`)** — raster 0.5 ม. 1,422×2,201 ช่อง (RLE) · `road` = ผิวถนน + แยก · `curb` = ทางเท้า/เกาะกลาง/หญ้าตลิ่ง · `water` = คูเมืองทุก polygon · `blocked` = ที่เหลือ · `heightAt` = 0 ทุกที่ ยกเว้นน้ำ = −1.2 (ผิวน้ำ)

**ผนังชน** — ขอบของพื้นที่ขับได้ใน raster (marching squares + Douglas-Peucker 0.45 ม.) จึงปิดสนามรอบทิศโดยอัตโนมัติ · จุดที่ถนน OSM จริงตัดผ่านขอบ = แบริเออร์นีออน (41 ปากทาง — รายงาน Street View ระบุ 24 จุดหลัก ส่วนเกินคือซอย residential ที่ OSM มี) · ทางรถเข้าโรงเรียน (service) ใช้ราวธรรมดาตามรายงาน

**ตึก** — OSM ในรัศมี 95 ม. 165 หลัง (ทิ้ง 10 หลังที่ทับผิวถนน — REAL-07) + สร้างจาก Street View 22 หลัง (ช่วง OSM ไม่มีตึก: เลียบคูเหนือ + มนัส) + รั้ว/กำแพงโรงเรียน 12 ช่วง · ความสูง: landmark 4 · Street View ฝั่งเดียวกันในระยะ 70 ม. 74 · ค่าเริ่ม 2–4 ชั้น 87 · ตึกที่ล้ำทางเท้าถูกตัดทางเท้าออก (ผนังชนเลื่อนไปหน้าตึก)

**ข้ามคูมนัส** — `moatJump.takeoff` (495, −577.4) · `landing` (529.5, −528) = ไลน์ 55° ของ PHYSICS §2.2 · `widthM` 28.2 · ราวคูช่วง x 480–520 เป็นไฟสีอำพัน (บอกจุด) · ฝั่งลง = ถนนพลแสน + หญ้าตลิ่ง x 470–528 ต่อกับมนัส (พื้นที่วิ่งออกหลังลง) · ปากพลแสนตะวันตก x 470 = แบริเออร์นีออน h 1.0 · มีแยกมนัสเปิด (ขาไปตะวันตกต่อถึงมนัส) · extras: `moatJumpLines.takeoff/landing/landingPoly`

**เขตลานย่าโม** — `zones.noBoostNoJump` = convex hull ของลาน OSM `way/31257513` และประตู `way/549315243` ขยาย 15 ม. · ขอบลาน/ประตูเป็นราวหินขาวเตี้ย + ไฟเท้าอุ่น (ไม่ใช่นีออน) · ผนังชน kind `monument`

**แลนด์มาร์ก** — อนุสาวรีย์: ฐานไพที footprint OSM (26×26) + บันได + แท่น ~3 ม. + รูปหล่อสำริด 1.85 ม. **หันตะวันตก** ดาบมือขวาปลายจรดพื้น มือซ้ายเท้าสะเอว + พวงมาลัยไฟอุ่นรอบแท่น + ไฟ key warm (ปิดใน low ใช้ emissive แทน) · ประตูชุมพล 43×11 ม. ช่องประตู 3 ม. กำแพง 6 ม. ใบเสมา หอรบไม้สีแดงเลือดหมู หลังคาจั่ว 2 ชั้นถึง 13 ม. · Terminal 21 ตึก 34 ม. + หอ 110 ม. + โรงแรม ไม่มีหมอก ถูก re-project ให้อยู่ในระยะ far plane ทุกเฟรม (ไม่โดนตัด)

**Quality** — อ่าน `getQuality()/onQuality()` ของ game-ui · หมอก low 60–260 / mid 90–420 / high 120–650 ม. · `track.update()` ซ่อน chunk (12 ท่อนตามความยาวสนาม) ที่เกินระยะมอง · `setupNight()` ลบไฟสำรองชื่อ `engine-fallback-light` ของ engine และแทน `scene.fog` ด้วยของตัวเอง (engine ยังปรับ `fog.far` ได้ตามเดิม)

## 3. งบ (วัดด้วย Chromium headless + SwiftShader, `renderer.info`)

| มุม | draw calls | สามเหลี่ยม |
|---|---|---|
| ทั้งสนามมองจากบน (ทุก chunk) | 47 | 51,617 |
| จุดออกตัว มองเหนือ | 21 | 19,293 |
| หน้าอนุสาวรีย์ มองลาน+ประตู (หนักสุด) | 32 | 37,183 |
| แยก 224 | 10 | 8,385 |
| ถนนมนัส (หุบตึก) | 22 | 28,266 |
| ในเกมจริง + รถ + HUD (autopilot) | 24 | 18,591 |

geometry 39 mesh ของสนาม · texture 2 ใบ (facade atlas 256² + lit windows 256²) · fps ที่ได้ใน headless ไม่ใช่ตัวเลขจริง (software GL) — ต้องวัดบนมือถือ (PERF-01)

## 4. ขอให้ pane อื่นทำ

**A. game-ui**
- `src/main.ts`: เพิ่ม `else if (view === 'top') void import('./scene/top-view.js').then((m) => m.startTopView(canvas, ui));` (แบบเดียวกับ view=car/audio)
- `src/types.ts`: เติม field ใน barrier → `barriers: { a: Vec2; b: Vec2; h?: number; kind?: 'wall' | 'barrier' | 'building' | 'monument'; style?: 'rail' | 'neon' | 'building' | 'invisible' }[]` (ตอนนี้ค่ามีอยู่ใน object แล้ว แค่ type ยังไม่ประกาศ)
- QA hooks `world()`: ใช้ `getTrackExtras()` จาก `src/track/index.ts` ได้เลย — `monument`, `toLatLng/fromLatLng`, `roadNames` (s0/s1/name/osm), `corners`
- ข้อความ "ทางลัด: กระโดดข้ามคู" → เปลี่ยนเป็นท่าโชว์ตาม PHYSICS §2.3 · ลูกศรเลี้ยวใช้ `corners` ได้
- เส้นชัยใหม่อยู่เหนือเขตลาน (ข้อ 9 สรุป) · ระยะรอบแรกสั้นกว่ารอบอื่น 10 ม. (กริดอยู่หลังเส้นชัย 10 ม. ตาม convention stub เดิม)

**B. car-physics** — `barrier.h` (ม.) = `Infinity` หรือ `1.0` · `barrier.kind` ตามที่ขอ · เกาะกลาง 224 = `curb` (ไม่มีผนัง) · ตกน้ำ: `surfaceAt = 'water'` + `heightAt = −1.2`

**C. QA**
- REAL-02: เทียบได้ทุกจุด ยกเว้น s 476–569 (แยก 224 ที่ตั้งใจแก้) · ความยาว −1.6% จาก `length_m` (เกณฑ์ 3%) · ดูภาพรวมที่ `?qa=1&view=top` (เขียว = เกม, แดง = OSM เดิม)
- REAL-04: โค้งแรกเปลี่ยนจาก "ซ้าย 53° + ขวา 148°" เป็น "ขวา 93°" (ตาม Street View/PHYSICS)
- track_m ใน research ทั้งหมด → s ในเกม ใช้ `researchMap` ใน JSON (ทุก 50 ม.)

## 5. ข้อจำกัด / ยังไม่ยืนยัน

- ความกว้าง/ความสูงตึกมาจากการกะด้วยตาใน Street View (±2 ม. / ±1 ชั้น) · ตึกนอกช่วงที่ Street View จด = 2–4 ชั้นแบบสุ่มคงที่
- OSM มีตึกริมสนามน้อย ตึกบางช่วงจึงห่าง/โล่ง (เช่น ฝั่งโรงเรียนเลียบคูเหนือ ใช้รั้ว + ตึกสังเคราะห์ 22 หลัง)
- แลนด์มาร์กเป็นทรงหยาบสัดส่วนจริง (M2 ปั้นละเอียด) · Terminal 21 ไม่มีภาพภายนอกอ้างอิง
- ไม่มีเสาไฟ สายไฟ โคม ป้าย ชื่อถนนบนจอ แอ่งน้ำ (M3 ตาม PHYSICS §5.5)
