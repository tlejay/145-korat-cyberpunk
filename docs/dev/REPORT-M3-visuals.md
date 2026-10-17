# REPORT M3 — 🌃 visuals: cyberpunk pass + integrator ของ M3

## รอบ 3 (art + checkpoint + กล้องเมนู) — conductor สั่งหลัง art-manifest มา

- **art ต่อครบ** (`src/scene/art.ts` อ่าน `art-manifest.json` ตอน build):
  - **ฟ้า**: equirect `sky-…-lo` (1024×512, ไม่มี mip ≈ 2 MB GPU — ใช้ lo ทุก quality) · ภาพต้นฉบับสว่างแดงเหมือนพลบค่ำ → หรี่เหลือ ×0.42 + ผสมหมอก 18% ให้เป็นกลางคืนเมฆสะท้อนไฟเมือง
  - **หน้าต่าง 4 แบบ** วาดทับ cell ชั้นบนของตึกแถว (แถว SHOP คอลัมน์ A–D) ใน atlas หน้าตึกเดิม → **GPU เพิ่ม 0 MB** · albedo สว่าง ×2.2 (ภาพเป็นภาพกลางคืนเข้มอยู่แล้ว) · emissive = ภาพ 12% + ส่วนกระจกที่มีไฟเต็ม · แบบที่ใช้มากสุด (A/B) ได้หน้าต่างมีไฟ ส่วนแบบม่านปิดไปอยู่ D
  - **กรอบนีออน 6 แบบ** วาดใต้ตัวอักษรไทยของป้ายหน้าร้าน + blade (high = ไฟล์เต็ม, low/mid = -lo) · สีตัวอักษร + แสงสะท้อนบนถนนตรงกับสีหลอดของกรอบ · GPU เพิ่ม 0 MB
  - **บิลบอร์ดโฆษณา 5 ภาพ** ใส่ใน atlas บิลบอร์ดเดิมพร้อมข้อความไทย — แต่ตอนนี้สปอนเซอร์ใช้ทั้ง 4 ช่อง ภาพโฆษณาจึงเป็นตัวสำรองเท่านั้น · **พื้นหลังสปอนเซอร์** (`sponsor-bg-*`) pane sponsors ใช้เองแล้ว
  - **ปก**: แสดงตอนโหลด (มือถือ 1280, desktop 1920) → เมื่อปุ่ม "เริ่มแข่ง" พร้อม ค่อย ๆ จางหายใน 1.2 วิ เหลือฉาก 3D ลานย่าโมสด (conductor ตัดสินใจตาม M1–M3: ปก = หน้าโหลด, ฉากจริง = เมนู) — `refs/m3/menu-loading-cover.jpg` → `menu-ready.jpg`
  - **og:image** + og/twitter meta + description ใน `index.html` → `https://madebytle.com/koratrocketcar/assets/img/og-cover-1200x630.jpg`
  - GPU ของ art รวม ≈ **2 MB** (ฟ้าใบเดียว) แทนที่จะเป็น 11–20 MB ตามตารางใน manifest
- **เครดิต**: เพิ่ม "สนับสนุนโดย สมาคมดิจิทัลนครราชสีมา · MADEBYTLE" + "ภาพประกอบบางส่วน… สร้างด้วย ChatGPT (OpenAI)"
- **checkpoint ต่อแล้ว** ตาม REPORT-checkpoint §4: `approach` → toast · `cue` → ไฟปุ่มกระโดด (now = เขียว, early/late/slow = เหลือง — ชนะ hint ของคูมนัส) · `clear` → combo + สั่น (เสียง "Great jump!" มาจากระบบเสียงตอนลงพื้นเมื่อลอย > 1 วิ) · `smash` → combo + เสียงชน · `hit` → สั่น + เสียงชน (กันซ้ำ 250 ms) · `blown` → combo · reset ตอนเริ่มแข่ง · ทุก event ส่ง `emit('roadblock')` ให้ QA · **แต้ม "ข้ามด่าน +300" ตอนนี้เป็นแค่ข้อความ** — นับเข้าตารางอันดับต้องเพิ่ม field ใน `RunResult` + `api/` (conductor/backend ตัดสิน REPORT-checkpoint §5)
- **กล้องเมนู → จุดสตาร์ทแบบนุ่ม**: กล้องเลื่อนจากวงโคจรรอบย่าโมไปหลังรถใน 1.6 วิ (smoothstep ทั้งตำแหน่ง ทิศ fov) ไม่ตัดฉับ (`refs/m3/menu-to-start-blend.jpg`) · ปิดใน QA mode · **แก้บั๊กเดิม**: มุมกล้องเมนูหมุนเพิ่มเรื่อย ๆ จนวนไปทะลุกำแพงประตูชุมพลหลัง ~2 นาที → เปลี่ยนเป็นแกว่งไป-กลับฝั่งตะวันตก · เล็งสูงขึ้นให้ย่าโมอยู่ใต้ปุ่มเมนู ไม่ถูกปุ่มบัง
- **typecheck**: ไฟล์ของ visuals ผ่าน · ตอนส่งมี error 1 จุดใน `src/car/index.ts` (`wheelBottoms`) ซึ่ง pane อื่นกำลังแก้อยู่ — ไม่ใช่ของ visuals

---

## รอบ 2 (integrator, conductor สั่งหลังตรวจภาพผ่าน)

- **กล้องหน้าเมนู** (`introCamera` ใน engine.ts): รัศมี 70 → 34 ม. สูง 8 → 5.5 ม. กวาด ±26° รอบด้านตะวันตก มองย่าโม — ไม่มุดตึกแล้ว ย่าโมอยู่กลางภาพตลอด (`refs/m3/menu-cam-{0,1}.jpg`)
- **สวิตช์ "ลดแสงกะพริบ"** ในหน้าตั้งค่า (`settings.reduceFlicker`, `data-qa=set-reduce-flicker`) → `applyFlicker()` ใน engine (เปิดเองด้วยถ้าเครื่องตั้ง "ลดการเคลื่อนไหว") · แก้ `src/ui/settings.ts` + `src/ui/screens.ts` 1 แถว
- **QA hook ฝน**: `physics().weather` อ่านค่าจริงจาก `tuning.rain` → ตอนนี้ได้ `{ rain: 1, muMul: 0.85 }` (แก้ `src/qa/hooks.ts` 1 บรรทัด)
- **sponsors ต่อแล้ว**: `buildSponsors(track)` เข้าฉาก (ซุ้มสตาร์ท MADEBYTLE + ป้ายเลียบแบริเออร์ 3 draw calls) · บิลบอร์ดบนหลังคาแสดงสปอนเซอร์จาก `getSponsorTexture('billboard', i)` · **ไฟสตาร์ท 5 ดวง** ขับจาก engine ผ่าน `visuals.startLights(phase, countdownS, stepS)` (แดงทีละดวงตอนนับ → เขียวตอน "ไป!" → ดับ · ออกเมนู = ดับ) — ภาพ `refs/m3/sponsors-*.jpg`
- **engine.ts** แก้เป็นจุดเล็ก ๆ ไม่แตะโค้ดนับถอยหลังของ pane fix: `applyFlicker()`, `introCamera()`, 1 บรรทัด `startLights` ใน `render()`
- **art**: ยังไม่มี `docs/dev/m3/art-manifest.json` ตอนส่ง → ต่อไว้อัตโนมัติแล้ว (rebuild ก็ขึ้น) · **checkpoint**: ยังไม่มี `src/checkpoint/index.ts` → ต่อไว้อัตโนมัติแล้วตามสัญญา §3

---

1. **ครบ 6 ข้อตามบรีฟ** · `pnpm typecheck && pnpm build` ผ่าน · ไม่ได้ commit / deploy · ไม่ได้เพิ่ม dependency
2. **Bloom + tone mapping + vignette** เขียนเอง (ไม่ใช้ EffectComposer เพราะเบากว่า): high = bloom จาก ½ จอ 8 pass · mid = จาก ¼ จอ 6 pass · **low = ไม่มี post เลย** (ACES ใน material แทน หน้าตาใกล้กัน)
3. **ฝน** = เส้นฝน GPU 1 draw call (high 9,000 · mid 4,500 · low 2,200) เอียงตามลม และยืดตามความเร็วกล้อง · **ฟิสิกส์ตั้ง `rain = 1` ตลอดเกม** (ยาง ×0.85 ทุก quality — ฟิสิกส์ไม่ขึ้นกับกราฟิก)
4. **ถนนเปียก** = แพตช์ shader ของ material ผิวถนนเดิม: ถนนเข้มขึ้น สะท้อนท้องฟ้าที่มุมต่ำ และ **แสงไฟยืดเป็นแถบยาวบนถนน** จากไฟ 3/6/8 ดวงที่ใกล้กล้องที่สุด (low/mid/high) จากแหล่งแสง 402 จุด (ไฟโซเดียม ไฟจราจร นีออน บิลบอร์ด ร้านทอง ย่าโม)
5. **แอ่งน้ำ 6 แอ่ง** (ก่อนโค้ง + ทางตรงยาว ห่างจุดกระโดด/เส้นสตาร์ท ≥ 70 ม.) เหมือนกระจก มีวงน้ำกระเพื่อม · **ต่อเข้าฟิสิกส์แล้ว** ผ่าน `track.puddleAt` (ทดสอบแล้ว: รถในแอ่ง → `contact.surface = 'puddle'` ของ car-physics → hydroplane > 100 กม./ชม. เป็นของ physics)
6. **ป้ายนีออน 5 draw calls**: ป้ายหน้าร้าน 62 · ป้าย blade 114 · โคมจีน 85 · บิลบอร์ด 4 · แสงหลังป้ายร้านทอง 32 — ชื่อร้านสมมุติภาษาไทย (ผัดหมี่โคราช ข้าวมันไก่ หมูยอโคราช ซ่อมมือถือ ฯลฯ) วาดด้วย canvas + Noto Sans Thai
7. **ห้ามนีออนในที่ศักดิ์สิทธิ์**: ตัดป้ายในรัศมี 75 ม. จากอนุสาวรีย์ และรอบประตู/วัด/ซุ้มพระบรมฉายาลักษณ์/ศาลากลาง (+18 ม.) → ตัดออก 40 ชิ้น (รวมบิลบอร์ด 1 จาก 5 ใกล้ประตูมุมเมือง) · **ย่าโมยังสว่างที่สุดในลาน** (ภาพ `after-high-yamo.jpg`)
8. **คูเมืองสะท้อนไฟ**: ทุก quality ไฟสะท้อนในน้ำจะตามกล้อง (2 ดวงตายตัว ย่าโม+ประตู, 4 ดวงคือไฟใกล้น้ำที่ใกล้กล้องสุด) · high เพิ่มภาพสะท้อนจริงความละเอียด ¼ จอ เฉพาะของที่เรืองแสง (ใช้ช่อง `uReflect` ของ landmarks-3d)
9. **งบ (มุมขับจริง, M1 Pro headless GPU จริง, รวม fx pane แล้ว):** high สูงสุด **92 draw calls / 182k สามเหลี่ยม** · mid ≤ 51 / 82k · low ≤ 36 / 75k → ต่ำกว่างบ 150 / 500k · CPU ของ visuals 0.1–0.4 ms/เฟรม · ไม่มี allocate ต่อเฟรม
10. **กะพริบ (VIS-04)**: ป้าย 93% นิ่งหรือหายใจช้า (0.4 Hz ±16%) · 7% "หลอดเสีย" หรี่นุ่ม ๆ ≤ 2 ครั้ง/วิ ไม่ดับ-ติดแรง · ปิดได้ทั้งหมด (`neon.setReduceFlicker`) และปิดเองถ้าเครื่องตั้ง "ลดการเคลื่อนไหว"
11. **ภาพเทียบก่อน/หลัง 5 มุม** `refs/m3/compare-*.jpg` (M2 | M3 high | M3 low) + `after-{high,mid,low}-*.jpg` (gitignored)
12. **Integrator**: ต่อ visuals + fx + checkpoint + sponsors เข้าเกมแล้ว (fx ทำงานจริง · checkpoint/sponsors จะติดเองเมื่อไฟล์ `index.ts` ของ pane นั้นมา) — วิธีต่อ/สัญญาอยู่ §3
13. **ภาพจาก art**: ต่อไว้แล้วผ่าน `docs/dev/m3/art-manifest.json` (ฟ้า/ปก/บิลบอร์ด) แต่ **ตอนส่งงานยังไม่มี manifest** → ยังใช้สีล้วน/procedural · ไฟล์ webp 6 ไฟล์ใน `public/assets/img/` มาแล้ว จะถูกใช้อัตโนมัติเมื่อ manifest มา (rebuild)
14. **ต้องตัดสินใจ/ส่งต่อ**: §6

---

## 1. ไฟล์

| ไฟล์ | ทำอะไร |
|---|---|
| `src/scene/visuals.ts` (ใหม่) | entry เดียว `createVisuals({renderer, scene, camera, track, car})` → `render(dt)` / `setSize()` / `stats()` · ประกอบทุกอย่าง + quality hook + sponsors + art |
| `src/scene/post.ts` (ใหม่) | HDR target → bright pass → dual-filter bloom → ACES + sRGB + vignette · fallback 8-bit ถ้าเครื่องไม่รองรับ float target · MSAA high ×4 (มือถือ ×2) / mid ×2 |
| `src/scene/rain.ts` (ใหม่) | ฝน GPU |
| `src/scene/wet.ts` (ใหม่) | แพตช์ถนนเปียก · ตัวเลือกไฟ (ไม่ allocate) · แอ่งน้ำ + `puddleAt` |
| `src/scene/reflect.ts` (ใหม่) | ไฟในคูเมืองตามกล้อง + planar reflection (high) · layer 3 = ของเรืองแสง |
| `src/scene/art.ts` (ใหม่) | อ่าน art-manifest ตอน build (schema ยืดหยุ่น จับคำ sky/cover/billboard/window/neon) |
| `src/scene/night.ts` | หมอกฝนม่วงอมน้ำเงิน · ปิดดาว (ฟ้ามีเมฆฝน) · `setPanorama()` สำหรับภาพฟ้าจาก art · ใส่ tonemapping/colorspace ให้ฟ้าตรงกันทุก quality |
| `src/neon/{index,atlas,geo,texts}.ts` (ใหม่) | ป้ายนีออน/blade/โคม/บิลบอร์ด/แสงร้านทอง · atlas ตัวอักษรไทย · ตัวกรองที่ศักดิ์สิทธิ์ |
| `src/game/engine.ts` | **(integrator)** สร้าง visuals หลังโหลดรถ (try/catch → ถ้าพังใช้ render ธรรมดา) · `render()` เรียก `visuals.render(dt)` · resize → `setSize()` · โหลด fx/checkpoint · `wireCheckpoint()` · `applyMenuCover()` หลังสร้างเมนู · `checkpoint.reset()` ตอนเริ่มแข่ง |
| `src/game/modules.ts` | **(integrator)** `loadFxModule()` / `loadCheckpointModule()` แบบเดียวกับ audio (ไม่มีไฟล์ = null · `?stub=fx,checkpoint` ปิดได้ · error ไม่บล็อกเกม) |

## 2. งบละเอียด (draw calls / สามเหลี่ยม · 1280×600 · รวม HUD-less scene + fx pane + bloom passes)

| มุม | M2 (ก่อน) high | M3 high | M3 mid | M3 low |
|---|---|---|---|---|
| ลาน/ประตู (มองย่าโม) | 49 / 74k | 85 / 147k | 47 / 80k | 33 / 70k |
| ราชดำเนิน | 37 / 53k | 67 / 117k | 49 / 81k | 33 / 67k |
| 224 | 31 / 54k | 57 / 118k | 42 / 78k | 29 / 58k |
| คันดินมนัส | 36 / 69k | 66 / 136k | 42 / 75k | 34 / 75k |
| มนัส (สายไฟหนาสุด) | 44 / 66k | 76 / 135k | 45 / 81k | 27 / 61k |
| วัชรสฤษดิ์ | 29 / 27k | 56 / 88k | 42 / 56k | 31 / 50k |
| คูเมืองหน้าประตู (สะท้อน) | — | 92 / — | 51 | 36 |

- M3 visuals เพิ่ม: นีออน 5 · ฝน 1 · แอ่งน้ำ 1 · bloom 6–8 · reflection (high) ≈ 15–25 · ส่วนที่เหลือเป็นของ fx pane (สายไฟ อนุภาค)
- texture เพิ่ม: atlas ป้าย 1024² + บิลบอร์ด 1024² ≈ 11 MB GPU (รวม mip) · render target: mid มือถือ (DPR 1.75) ≈ 25 MB · high desktop DPR 2 + MSAA ×4 ≈ 120 MB (มือถือจำกัด ×2)
- headless ใช้ GPU จริง (ANGLE Metal, M1 Pro) — fps 58–60 ทุกมุม แต่ fps มือถือจริงต้องวัดตาม PERF-01

## 3. วิธีต่อ (สำหรับ pane อื่น)

- **fx** (`src/fx`, ต่อแล้ว ทำงานจริง): `createFx(scene, track, car)` ถูกสร้างใน `loadWorld` หลัง visuals · `update(dt, camera)` ทุกเฟรมใน `render()` · ป้าย blade/โคมเป็น InstancedMesh ชื่อ `neon-blades` / `neon-lanterns` · **origin ของ instance = จุดบานพับ** (โคม: ปลายเชือกบน, blade: ขอบบนของป้าย, ฝั่งผนังอยู่ local −x) ตรงกับที่ fx ค้นหา · มี helper `getNeon().swing.set(kind, i, rx, rz)` + `commit()` ถ้าอยากใช้
- **sponsors** (`src/sponsors`, ยังไม่มี `index.ts` ตอนส่งงาน): visuals โหลด `src/sponsors/index.ts` แบบ eager glob — ต้อง export
  - `buildSponsors(track): THREE.Object3D` → visuals `scene.add()` ให้ (ก่อนติด layer สะท้อน — ป้ายเรืองแสงจะสะท้อนในคูเมืองบน high)
  - `getSponsorTexture('billboard', i)` (i = 0..4) → visuals **คัดลอกภาพ (`texture.image`) ลง atlas บิลบอร์ดเดิม** (คงไว้ 1 draw call) แบบไม่มีกรอบ/ข้อความของเรา · เช็ค `texture.version` ทุก 1 วิ ถ้าเปลี่ยน (ฟอนต์/โลโก้โหลดเสร็จ) คัดลอกใหม่ · **ช่องละ 512×205 (2.5 : 1)** ออกแบบตามสัดส่วนนี้จะไม่ยืด
  - หมายเหตุ: billboard anchor ใช้ได้จริง **4 ใน 5** (1 อันอยู่ใกล้ประตูมุมเมือง ถูกกรองที่ศักดิ์สิทธิ์ออก)
- **checkpoint** (`src/checkpoint`, ยังไม่มีไฟล์): `createCheckpoint(scene, track, car)` · `update(dt)` เรียกทุกเฟรมเฉพาะตอน countdown/racing · `reset?()` ตอนเริ่มแข่งทุกครั้ง · **สัญญา events** (`CustomEvent` บน `events`, detail ไม่บังคับทุกช่อง):
  - `'hint'` `{ text }` → HUD toast (เช่น "ด่านข้างหน้า! กระโดดข้าม")
  - `'clear'` `{ text }` → HUD combo + สั่น (กระโดดข้ามสะอาด)
  - `'crash'` `{ text, impulse }` → HUD combo + เสียง `crash` + สั่นตามแรง
  - ทุกตัวใส่ `{ audio: AudioEvent }` เพื่อเล่นเสียงเฉพาะได้ · ทุก event ถูก `emit('roadblock', { type, ...detail })` ให้ QA ด้วย
  - **แต้ม**: กระโดดข้ามด่านนับแต้มผ่าน jump/cleanLanding เดิมอยู่แล้ว · ถ้าต้องการแต้มสไตล์ "ข้ามด่าน" แยกในตารางอันดับ ต้องเพิ่ม field ใน `RunResult` + ตรวจฝั่ง `api/` + `src/net/score.ts` (นอกขอบเขต visuals — conductor ตัดสิน)
- **puddles**: `track.puddleAt(x, z)` (ฟิสิกส์อ่านอยู่แล้ว) · `track.puddles` = รายการ `{x, z, a, b, ang, s}` ให้ fx ทำน้ำกระจาย
- **QA**: `?qa=1` มี `window.__visuals` (`stats()`, `debugCamera = { pos, look }` สำหรับถ่ายภาพมุมคงที่, `neon.setReduceFlicker(true)`, `setRain(false)`) · `renderer.info.autoReset = false` แล้ว reset ต้นเฟรม → `stats().drawCalls/triangles` รวมทุก pass ของเฟรม

## 4. ภาพ (`refs/m3/`, gitignored)

- `compare-{plaza,ratchadamnoen,224,manat-cables,watcharasarit}.jpg` — ซ้าย M2, กลาง M3 high, ขวา M3 low
- `after-{high,mid,low}-moat.jpg` — คูเมืองหน้าประตูชุมพล (high มีภาพสะท้อนไฟจริง) · `after-*-yamo.jpg` — ลานย่าโมไม่มีนีออน อนุสาวรีย์สว่างสุด

## 5. ทดสอบ

- typecheck + build ผ่าน · ไม่มี console error ในภาพทุกชุด
- `tests/qa/errors.spec.ts` ผ่านทั้งหมด (รวม ERR-05 WebGL context lost กับ post-processing) · `static.spec.ts` ผ่าน **ยกเว้น LIC-01 / LIC-02/03** — เพราะไฟล์ใหม่ของ art (`public/assets/img/*.webp`) และ sponsors (`public/assets/sponsors/*.png`) ยังไม่มี manifest/license และเทสต์ M1 ยังเขียนว่า "ไม่มีภาพ raster" → QA ต้องอัปเดตเทสต์ + pane เหล่านั้นใส่ manifest (ไม่ใช่ไฟล์ของ visuals)
- แอ่งน้ำ: วางรถในแอ่ง → telemetry `contact.surface = 'puddle'` ✔

## 6. ขอให้ pane อื่นทำ / ต้องตัดสินใจ

- **game-ui:** (1) `qa/hooks.ts` `physics().weather.rain` ยังคืนค่า 0 จาก `physDefault` ทั้งที่ฟิสิกส์ฝนเปิดอยู่ (`tuning.rain = 1`) — ควรอ่านจาก `tuning.rain` (2) เพิ่มสวิตช์ "ลดแสงกะพริบ" ในหน้าตั้งค่า → เรียก `getVisuals()?.neon?.setReduceFlicker(on)` (VIS-04 🟡) (3) กล้องหน้าเมนู (`introCamera` รัศมี 70 ม. ฝั่งตะวันตก) **มุดเข้าตึกแถวราชดำเนิน มองไม่เห็นย่าโม** — แนะนำมุม `pos (−30, 6, 25) → look (0, 5, 0)` ตามภาพ `after-high-yamo.jpg` (4) เครดิต: เพิ่ม "ภาพประกอบบางส่วนสร้างด้วย ChatGPT (OpenAI)" เมื่อใช้ภาพ art
- **art:** เขียน `docs/dev/m3/art-manifest.json` ให้มี path `public/assets/...` + คำบอกหน้าที่ (sky / cover / billboard / window / neon) แล้ว rebuild → ฟ้าพาโนรามา ปกเมนู พื้นหลังบิลบอร์ดจะขึ้นเอง · **ภาพฟ้าควรเป็นแถบพาโนรามาแนวนอนวนรอบได้** (ขอบซ้ายต่อขวา, ล่าง = ขอบฟ้า, บน ≈ 50°) · texture หน้าต่างกับกรอบนีออนยังไม่ได้ใช้ (ตึกใช้ atlas procedural ของ M2 ซึ่ง UV ผูกกับเรขาคณิต — สลับได้ใน M4 ถ้าคุ้ม)
- **conductor:** เมื่อมีบิลบอร์ดสปอนเซอร์ ภาพพื้นหลังบิลบอร์ดจาก art จะไม่ถูกแสดง (สปอนเซอร์ชนะ) ยกเว้นช่องที่สปอนเซอร์ไม่ส่ง texture มา — ถ้าอยากให้ภาพ art ไปอยู่ที่อื่น (เช่น ป้ายบนผนังตึก) เป็นงาน M4
