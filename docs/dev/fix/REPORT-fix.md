# REPORT — 🐞 fix

## สรุป
| # | บั๊ก | สาเหตุจริง | แก้ | test | สถานะ |
|---|---|---|---|---|---|
| 1 | นับถอยหลังพากย์ "Three, Three" | engine สั่ง `countdown3` ซ้ำ 2 ครั้ง (ไฟล์เสียงถูกต้องทุกไฟล์) | `src/game/engine.ts` +1 บรรทัด | `tests/qa/voice.spec.ts` | ✅ แก้แล้ว · test จับบั๊กได้ทั้ง Chromium + WebKit |
| 2 | นับถอยหลังยืดเมื่อเฟรมตก (ถึง 2.4 วิ/คำ) | countdown นับด้วย physics step ซึ่งตัดที่ 30 step/เฟรม และ dt ตัดที่ 250 ms | `src/game/engine.ts` · `src/audio/index.ts` | `tests/qa/voice.spec.ts` FIX-02 (CPU 6×) | ✅ แก้แล้ว |
| 3 | หัวพ่นลงพื้นมี 4 ในภาพจริง โมเดลมี 2 | — | `src/car/model.ts` (+ `nozzles()` ใน `model-preview.ts`) | `fix.spec` FIX-03 | ✅ |
| 4 | HUD ความเร็ว/เกจอ่านยากบนควันขาว | ตัวอักษรขาวบนพื้นโปร่ง | `src/style.css` (`.hud-bottom`, `.speedrow`, `.tank`) | `fix.spec` FIX-04 | ✅ |
| 5 | เปลี่ยนชื่อเกมเป็น "โคราชโรสเตอร์" | — | `index.html` `<title>` · `src/ui/screens.ts` หัวเมนู | `tests/qa/fix.spec.ts` FIX-05 | ✅ |
| 6 | MOB-03 ลากนิ้วออกแล้วปุ่มค้าง | touch capture ไปติด `<path>` ของไอคอน | `src/style.css` (`.tbtn > *` pointer-events none) | `mobile.spec` MOB-03 (เปลี่ยน sleep → รอสถานะ) | ✅ input ผ่าน · ⚠️ ดูข้อ ERR-08 ด้านล่าง |
| 7 | DEP-03 asset มี hash ไม่ cache ยาว | ไม่มี header rule | `vercel.json` | `fix.spec` FIX-07 (+ `deploy.spec` บน preview) | ✅ local · ⏳ ยืนยันบน preview |
| 8 | กล้องหลุดเมื่อ fps ต่ำ | จำกัดระยะ 1.5 ม. "ต่อเฟรม" | `src/car/camera.ts` · `src/car/config.ts` | `physics.spec` FEEL-10b gate 60/30/20/15 fps | ✅ |
| 9 | `qa.teleport(…, speedKmh)` ไม่ใส่ความเร็ว | รถจริงไม่มี `car.qa.setSpeed` | `src/car/index.ts` · `src/car/physics.ts` | `fix.spec` FIX-09 | ✅ |
| FEEL-05 | เกณฑ์ใหม่ + ล้อที่วาดจมถนนตอนยุบ | ล้อติดตายกับตัวรถ ไม่ขยับตามโช้ค | `src/car/index.ts` · hook `qa.wheelClearanceM()` | `physics.spec` FEEL-05 · TEST-PLAN | ✅ |
| 10 | แข่ง 1 รอบ | — | `src/net/score.ts` (laps 1) · race/engine/audio/types (BGM 25 % สุดท้าย) · hud/results · GAMEPLAY.md · api.spec | `fix.spec` FIX-10, FIX-10/11 | ✅ |
| 11 | ข้ามด่านเข้าโบนัสสไตล์ + ghost ผูก track version | — | score.ts · ghost-format v2 · `src/net/track-version.ts` (+ script) · `api/run/finish.ts` · `api/ghost/top.ts` | `fix.spec` FIX-10/11, FIX-11 | ✅ |

typecheck ✅ · build ✅ · ไม่ได้ commit (ตามบรีฟ)

---

## บั๊ก #1 — เสียงพากย์ "Three, Three"

### สาเหตุ (root cause)
`src/game/engine.ts`
- `beginCountdown()` โชว์ "3" แล้วสั่ง `E.audio.play('countdown3')` ทันที แต่ **ไม่ได้ตั้ง `countdownShown = '3'`** (ค่ายังเป็น `''`)
- physics step แรกใน `stepOnce()` คำนวณ `step = ceil(3.19 / 0.8) = 4` → `shown = '3'` ≠ `''` → สั่ง `countdown3` **อีกรอบ**
- ใน `say()` (`src/audio/index.ts`) เสียงพากย์ priority เท่ากัน (5) ไม่ตัดกัน แต่ **ต่อคิว** หลังคำแรกจบ → ได้ยิน "Three" ซ้ำห่าง ~0.5 วิ แล้ว "Two" ถูกดันช้าไปด้วย

ไทม์ไลน์จริงที่วัดได้ (WebKit, build ก่อนแก้): `three +0 · three +0.495 · two +0.495 · one +0.621 · go +0.800`
หลังแก้: `three +0 · two +0.813 · one +0.803 · go +0.800`

บั๊กเกิด **ทุกครั้งที่เริ่มนับถอยหลัง** (ทั้งรอบแรกและกดเล่นใหม่) — `countdownShown` ถูกรีเซ็ตเป็น `''` ตอน "ไป!" เสมอ

### ตัดเหตุอื่นที่บรีฟสงสัยออก
- **ไฟล์เสียงชื่อสลับ / build-audio ทับชื่อผิด** — ไม่ใช่: ถอดเสียงทุกไฟล์ใน `public/assets/audio/voice/` ด้วย faster-whisper (medium, ในเครื่อง) ได้ตรงทุกคำทั้ง `.ogg` และ `.m4a`:
  three→"Three" · two→"Two" · one→"One" · go→"Go!" · final-lap→"Final lap!" · new-record→"New Lap Record" · finish→"Finish." · boost→"Boost!" · nice-drift→"Nice drift!" · great-jump→"Great jump!"
  md5 ไม่ซ้ำกันทุกไฟล์ (three/one/go mp3 ต้นฉบับขนาดเท่ากัน 12,582 B แต่เนื้อไม่เหมือนกัน) · manifest `vo-X` → `voice/vo-X` → `voice/mint/charlie/X.mp3` ตรงทุกตัว
- **mapping ใน audio** — `play()` แมป countdown3/2/1/go → vo-three/two/one/go ถูกต้อง
- **เสียงอื่นในชุด** (ตรวจจากโค้ด — แต่ละตัวยิงจากจุดเดียว ไม่มีทางซ้ำ):
  final-lap = `race.ts` ตอนเข้ารอบสุดท้าย 1 ครั้ง · finish / new-record = `finishRace()` เลือกอย่างใดอย่างหนึ่ง · boost = ครั้งแรกของเกมเท่านั้น (`boostSaid` รีเซ็ตที่ countdown3 — หลังแก้ยังยิง 1 ครั้งตามเดิม) · nice-drift / great-jump = `sayCooled` เว้น 8 วิ

### แก้ไฟล์ไหน
`src/game/engine.ts` — `beginCountdown()` เพิ่ม 1 บรรทัดหลัง `play('countdown3')`:
```ts
countdownShown = '3'; // already announced — stepOnce() must not fire countdown3 again ("Three, Three")
```
ผลข้างเคียงที่ดี: กรณีกด "เล่นใหม่" ระหว่างนับถอยหลัง (`countdownShown` ค้างเป็น '2'/'1') ก็ไม่ซ้ำแล้วเช่นกัน
⚠️ engine.ts มีงานของ pane 🌃 visuals ค้างอยู่ใน working tree ด้วย — แก้ของ fix มีแค่บรรทัดนี้บรรทัดเดียว (ใน `beginCountdown`) conductor add ได้โดยไม่ชน

### Test
`tests/qa/voice.spec.ts` (Playwright, ทั้ง chromium-landscape + webkit-landscape)
- **FIX-01 countdown voice** — ดักทุก `AudioBufferSourceNode.start()` ที่เล่นบัฟเฟอร์เสียงพากย์ (ติดป้าย id จาก URL ตอน fetch → decode) กดปุ่ม "เริ่มแข่ง" จริงเพื่อปลดล็อกเสียง รอจนเข้า racing แล้วตรวจว่าเสียงพากย์ = `[vo-three, vo-two, vo-one, vo-go]` เป๊ะ และแต่ละคำห่างกัน ≥ 0.68 วิ
- **FIX-01 voice set** — manifest ครบ 10 คำ และแต่ละ id ชี้ไฟล์ของตัวเอง

ผลรัน (build แยกใน scratchpad, เสิร์ฟพอร์ต 4191/4192 — ไม่แตะ server 4180 ของ QA):
- build **ก่อนแก้**: ❌ fail ทั้ง 2 เบราว์เซอร์ — `Received: ["vo-three", "vo-three", "vo-two", "vo-one", "vo-go"]`
- build **หลังแก้**: ✅ 3 passed, 1 skipped (static check รันแค่ Chromium)

รัน: `pnpm exec playwright test tests/qa/voice.spec.ts`

### ข้อสังเกต (ไม่ใช่บั๊กนี้ — ให้ conductor พิจารณา)
- บน Chromium + SwiftShader (เฟรมช้า) ช่วงห่างแต่ละคำยืดเป็น 1.0–2.4 วิ เพราะ countdown เดินตาม physics step ซึ่งตัดที่ 30 step/เฟรม — เครื่องที่ fps ตกหนักตอนเริ่มเกม (compile shader) จะนับช้ากว่านาฬิกาจริง · WebKit ได้ 0.80 ± 0.02 วิ ตรงจังหวะ · test จึงเช็คแค่ขั้นต่ำ ไม่เช็คเพดาน
- เส้นทาง `skipCountdown` (QA `?skip=1`) ไม่รีเซ็ต `boostSaid` — กระทบแค่โหมด QA ไม่กระทบผู้เล่น

---

## บั๊ก #2 — นับถอยหลังต้องเดินตามนาฬิกาจริง

### สาเหตุ
- countdown ลด `E.countdownS` ทีละ `STEP` (1/120 วิ) ใน `stepOnce()` แต่ `advance()` จำกัด 30 step/เฟรม (= 0.25 วิ) และ `frame()` ตัด dt ที่ 250 ms → เฟรมช้ากว่า 4 fps หรือเฟรมกระตุกตอน compile shader = นาฬิกาเกมช้ากว่านาฬิกาจริง ทั้ง HUD และเสียงพากย์ (เพราะเสียงสั่งตามตัวเลขที่ HUD เปลี่ยน)
- โมดูลเสียงมี `countdown(stepSec)` ที่ตั้งเวลา 3-2-1-GO ไว้บนนาฬิกาเสียงอยู่แล้ว + `now()` (ออกแบบไว้ให้ HUD ตามนาฬิกาเสียง) แต่ engine ไม่ได้ใช้

### แก้
`src/game/engine.ts` (เฉพาะส่วน countdown — ไม่แตะงาน visuals)
- `beginCountdown()` เรียก `audio.countdown(0.8)` → เสียงพากย์ + บี๊บถูกตั้งเวลาตรงตัวอย่างเสียง (sample-exact) ทุกเครื่อง · ไม่เรียก `play('countdown3')` ซ้ำเมื่อตั้งเวลาแล้ว
- ฟังก์ชันใหม่ `tickCountdown(dt)` รันหนึ่งครั้งต่อเฟรมใน `advance()`: อ่านนาฬิกาเดียวกัน → ตัวเลข HUD, ไฟสตาร์ท 5 ดวงของ 🏁 sponsors (`sponsor-start-lights` → `userData.startLights.countdown()` / `go()`), และ "ไป!" + `race.go()`
- นาฬิกา: นาฬิกาเสียง (`audio.now() − beat0`) เป็นหลัก · สำรอง = ผลรวม frame dt (ไม่มีเสียง / ยังไม่ปลดล็อก / QA fixedStep — ยัง deterministic) · ถ้า audio context ค้าง ใช้ frame dt − 0.3 วิ ต่อแทน ไม่ค้างตลอดไป
- จับเวลาแข่งตรง "ไป!": ถ้า GO เกิดกลางเฟรม จำลองช่วงเวลาที่เลย GO มา (`over` ≤ 0.25 วิ) เป็นการแข่งในเฟรมนั้นเลย
- `stepOnce()` ช่วง countdown เหลือแค่ physics รถ (ถือเบรก/ชาร์จ launch) ตาม `E.countdownS` ที่อัปเดตจากนาฬิกา
- pause ระหว่างนับ: context เสียง suspend + `advance` ไม่เดิน → นาฬิกาหยุดทั้งคู่ ต่อได้ตรง
- **warm-up shader:** `await renderer.compileAsync(scene, camera)` ก่อนปุ่ม "เริ่มแข่ง" พร้อม (compile วัสดุทุกชิ้นรวมที่กล้องเมนูไม่เห็น) · ล้มเหลว = ข้าม ไม่บล็อกเกม
- พ่วงแก้บั๊กเล็กที่เจอระหว่างทาง: กด "เริ่มใหม่" จากเมนูพักเกม → audio context ยัง suspend ค้าง (เกมเงียบทั้งรอบ) → `beginCountdown()` เรียก `audio.resume()`

`src/audio/index.ts`
- `cancelCountdown()` ใหม่ + `countdown()` เรียกก่อนตั้งเวลาชุดใหม่ → เริ่มใหม่/กลับเมนูกลางนับ จะไม่มี "one, go" ค้างคิวดังตามมา · `toMenu()` เรียก `cancelCountdown()` + ดับไฟสตาร์ท

### Test — `tests/qa/voice.spec.ts`
- FIX-01 (เดิม) ตอนนี้เช็คช่วงห่างเสียง 0.8 ± 0.1 วิ ได้ทั้ง Chromium และ WebKit แล้ว (เดิมต้องตัดเพดานออกเพราะบั๊กนี้)
- **FIX-02** (Chromium, CDP `Emulation.setCPUThrottlingRate` 6× + SwiftShader ≈ 1.4–2.5 fps):
  - เสียง 3-2-1-GO ห่าง 0.8 ± 0.1 วิ บนนาฬิกาเสียง และนาฬิกาเสียงเทียบนาฬิกาจริง drift < 0.05 วิ (วัดได้ 0.005)
  - HUD แต่ละตัวเลขขึ้นเฟรมแรกหลังจังหวะของมัน — ไม่ก่อนเวลา และช้าไม่เกิน 1 เฟรม + 0.1 วิ · ถ้าเฟรมยาวกว่าจังหวะ ตัวเลขอาจข้ามได้ (เช่น 3 → 2 → ไป!) แต่ "ไป!" ต้องขึ้นเสมอ
- ผล: build **ก่อนแก้ #2** ❌ (เสียงห่าง 3.25 / 1.40 / 1.45 วิ) · **หลังแก้** ✅ 4 passed 2 skipped (เสียง 0.800/0.800/0.800)

### ข้อจำกัด
- HUD/ไฟสตาร์ทอัปเดตได้แค่ตอนวาดเฟรม — เครื่องที่ 2 fps จะเห็นตัวเลขช้าได้ถึง 1 เฟรม (เสียงยังตรงเสมอ) ที่ 30 fps ขึ้นไปคลาดเคลื่อน ≤ 33 ms
- ไม่มีเสียง (ปิดเสียงระบบ iOS ไม่ปลดล็อก / module เสียงล้ม) → ใช้ frame dt ซึ่งตัดที่ 250 ms/เฟรม — ตรงเวลาจริงเมื่อ ≥ 4 fps

---

## #5 — ชื่อเกม "โคราชโรสเตอร์"
- ชื่อเก่าในส่วนที่ผู้เล่นเห็นมีแค่ 2 จุด: `<title>` (index.html) และหัวเมนู `<h1>` (`src/ui/screens.ts`) → แก้แล้ว · ไม่มี OG/meta แชร์ หน้าโหลด หน้าเครดิต หรือ error ที่อ้างชื่อเกม · ไม่มีข้อความอังกฤษของชื่อเกม (ไม่ได้เพิ่ม "Korat Roadster")
- ไม่แตะชื่อโปรเจค/repo/URL `/koratrocketcar/`/Vercel · comment ในโค้ดคำว่า "cyberpunk" (ชื่อสไตล์) คงไว้
- ข้อสังเกต: ฝั่ง art มี `public/assets/img/og-cover-1200x630.jpg` แล้ว แต่ index.html ยังไม่มี `og:title`/`og:image` (deploy.spec บันทึกค่านี้) — ถ้าจะใส่ ให้ใช้ชื่อใหม่
- test FIX-05: title + h1 = ชื่อใหม่ · ไม่มีชื่อเก่าในไฟล์ `src/` `public/` `index.html`

## #6 — MOB-03 ปุ่มค้าง
- สาเหตุ (ตาม QA): บนจอสัมผัส browser จับ pointer capture ไว้ที่ element ที่นิ้วโดน = `<svg>/<path>` ของไอคอน โค้ดปล่อย capture เฉพาะตัวปุ่ม → `pointerleave` ไม่เกิด
- ลองแก้ด้วย JS (ปล่อยจาก `e.target`) ก่อน → ทำให้กดครั้งแรกไม่ติดใน Chromium · ถอยกลับ แล้วใช้ทางที่สองที่ QA เสนอ: `src/style.css` `.tbtn > *, .tbtn svg * { pointer-events: none; }` → ตัวปุ่มเป็นเป้าเสมอ โค้ดเดิมที่ปล่อย capture ทำงานได้ · `touch.ts` ไม่ได้แก้
- test: `mobile.spec` MOB-03 เปลี่ยน `waitForTimeout` ตายตัวเป็น "รอจนสถานะ input ตรง ≤ 5 วิ" (เกณฑ์เหมือนเดิมทุกข้อ) — เพราะเฟรม SwiftShader + ภาพ M3 ช้า 0.5–1.3 วิ อ่าน 200 ms แล้วได้ค่าเก่า
  - build ไม่มี CSS นี้: ❌ `throttle must release when the finger slides off` · build ที่แก้: ✅ ทุกข้อ input
- ⚠️ **ERR-08 / DEP-02 ล้มใน build ปัจจุบัน (ไม่เกี่ยวกับ fix):** เกมขอไฟล์ `/koratrocketcar/[object%20Object]` → 404 ทุกครั้งที่เปิด (CDP initiator `other`, ไม่มีในไฟล์ build — เกิดตอนรัน) · มาจากงาน M3 ที่ยังค้างใน working tree (`src/scene/*` ของ 🌃 visuals กำลังแก้) — ส่ง conductor ประสาน visuals · ทุก spec ที่เรียก `expectClean` จะล้มจนกว่าจะแก้

## #7 — DEP-03 cache header
- `vercel.json` เพิ่ม rule แรก: `/(koratrocketcar/)?assets/:file([^/]+-[A-Za-z0-9_-]{8}\\.(?:js|css|woff2?))` → `public, max-age=31536000, immutable`
- ตรวจด้วย path-to-regexp 6.3.0 (ตัวที่ Vercel ใช้จับ `source` — เพิ่มเป็น devDependency): ตรง 28/28 ไฟล์ hash ใน `dist/assets` · **ไม่** ตรง `assets/audio/*`, `assets/img/*`, `assets/sponsors/*`, `index.html` (index ยัง max-age=0 ตามเดิม)
- รูปแบบ prefix `/(koratrocketcar/)?` เหมือน rule `data/` เดิมที่ QA ยืนยันบน preview แล้ว — ⏳ ให้ QA รัน `deploy.spec` DEP-03 บน preview ใหม่เพื่อยืนยันของจริง

## #8 — กล้องหลุดเมื่อ fps ต่ำ
- สาเหตุ: `camera.ts` จำกัดการเคลื่อนที่กล้อง `camMaxStep` 1.5 ม. **ต่อเฟรม** → 60 fps = 90 ม./วิ แต่ 20 fps = 30 ม./วิ (108 กม./ชม.) รถวิ่งเร็วกว่านั้น กล้องเลยหลุดไปเรื่อย ๆ
- แก้: เพดาน = `max(camMaxStep × 60 × dt, 1.2 × ระยะที่รถวิ่งในเฟรมนั้น)` — ที่ 60 fps เท่าเดิมทุกประการ (FEEL-10 "≤ 2 ม./เฟรม" ไม่เปลี่ยน) · เพิ่ม `camSnapM: 40` — กล้องห่างเป้าเกิน 40 ม. (เฟรมยาวมาก/teleport) → snap
- test FEEL-10b: เดิมเกตแค่ 60/30 fps (20 fps แค่บันทึก) → ตอนนี้เกต 60/30/20/15 fps ห่างรถ ≤ 20 ม. — ✅ ผ่าน

## #9 — `qa.teleport(x, z, yaw, speedKmh)`
- `src/car/index.ts` เพิ่ม `car.qa.setSpeed(kmh)` (hook เดิมเรียกอยู่แล้วแต่รถจริงไม่มี) · `src/car/physics.ts` เพิ่ม `setPlanarVelocity()` ตั้งความเร็ว + body-frame u/w ไปพร้อมกัน ไม่ให้เกิด g กระชาก step ถัดไป
- test FIX-09: teleport 100 → `speedKmh` 100 ทันที · 6 step ต่อมายัง > 90 · g < 2 · และรัน PHY-04 แบบ TEST-PLAN (teleport ลงไลน์กระโดด 55° ที่ 100/110/120 กม./ชม. แล้วกระโดดที่ตลิ่ง) ได้จริง — ผลแต่ละความเร็วบันทึกใน `tests/qa/.metrics/FIX-09.*.json` ให้ QA ตัดสิน PHY-04
- ⚠️ test เดิม `physics.spec` PHY-04/PHY-05 (สคริปต์วิ่งจาก `place(820)`) ล้มใน build ปัจจุบัน: รถไม่ไปถึงคู — น่าจะเพราะ commit `a17e0ef` ย้ายเส้นสตาร์ท ทำให้ระยะ s บน centerline เลื่อน (s=820 ไม่ใช่จุดเดิมแล้ว) · ไม่ใช่ผลจาก fix — ให้ QA ปรับเลข s

## FEEL-05 — เกณฑ์ใหม่ (conductor 20:52)
- `docs/qa/TEST-PLAN.md` แก้ข้อ FEEL-05 แล้ว · `physics.spec` FEEL-05: `pos.y ≥ −0.15` + "ล้อไม่ต่ำกว่าผิวถนน"
- ระหว่างวัดเจอของจริง: **ล้อที่วาดติดตายกับตัวรถ** — ตัวรถยุบ 12 ซม. ตอนลงพื้น = ล้อจมถนน 12 ซม. (ฟิสิกส์ถือว่าล้อแตะถนน แต่ภาพไม่ตาม)
- แก้ `src/car/index.ts` `sync()`: ล้อแต่ละข้างขยับขึ้นลงตามการยุบของสปริง (`comp − sag`, ยืดลงสุด 8 ซม. ตอนลอย) → ล้อแตะถนนตอนยุบ
- hook ใหม่ `qa.wheelClearanceM()` (types + hooks + `car.qa.wheelBottoms()`) = ก้นยางที่วาดต่ำสุด − ความสูงถนน · test: ≥ −0.03 ม. (เผื่อยาง low-poly)
- ผล: ✅ FEEL-05 ผ่านทุกข้อ

## #3 — หัวพ่นลงพื้น 4 หัว
- ภาพ `refs/car/rear-upright-and-inverted-*.jpg` (ล่าง — ตอนพ่น): **ลำไอพุ่งลงพื้น 4 ลำ อยู่ที่มุมท้าย 2 ลำต่อข้าง** — ลำนอกออกจากกระป๋องทองบนขายึดข้างล้อหลัง (ที่โมเดลมีอยู่แล้ว) อีกลำอยู่ถัดเข้ามาด้านใน ~65 px ≈ 0.19 ม. (ท้ายรถกว้าง ~670 px ≈ 2 ม.) ซ่อนอยู่ใต้ขอบตัวถัง · **ไม่มีคู่หน้า** (ภาพ flight/side ไม่เห็นหัวพ่นหน้า)
- `src/car/model.ts`: `SIDE_NOZZLES` 4 ตัว (ซ้าย→ขวา: นอก, ใน, ใน, นอก) · หัวในที่ x ±0.51 สูง 0.24 ม. เยื้องไปหน้าเล็กน้อย + กระป๋องทองสั้นใต้ตัวถัง (รวมใน mesh เดิม draw call ไม่เพิ่ม) · ชื่อ `nozzle-side-down-{l, l-in, r-in, r}` type `side-down` → fx หยิบไปเองอัตโนมัติ (`src/fx/index.ts` หา `nozzle-*` ทุกตัว)
- `model-preview.ts` (`?qa=1&view=car`) เพิ่ม `__carPreview.nozzles()` ให้ QA ตรวจ
- test FIX-03: rear 4 + side-down 4 · ข้างละ 2 · ชี้ลงพื้น · อยู่ใต้ตัวรถช่วงท้าย · สมมาตร · ห่างคู่ 0.12–0.3 ม. ✅

## #4 — HUD อ่านยากบนควันขาว
- `src/style.css` เฉพาะ HUD: `.hud-bottom` เพลตแก้วเข้ม `rgba(7,6,15,0.65)` มุมมน · `.speedrow` เงาตัวอักษรหนาขึ้น · `.tank` พื้นหลังเกจจากขาวโปร่ง 12% → ดำ 50% + ขอบบาง
- test FIX-04: กรณีแย่สุด (เพลตทับควันขาวล้วน) ความต่างสีตัวเลขความเร็ว = **5.75** (เกณฑ์ WCAG AA ≥ 4.5) · ที่ 55% ได้ 3.98 จึงปรับเป็น 65%

## #10 — แข่งรอบเดียว
- **ต้นทาง:** `TRACK_RULES.A.laps: 2 → 1` (`src/net/score.ts`) — engine (`E.laps`), ตั๋วส่งคะแนน และ server (`BAD_LAPS`, splits = checkpoints × laps, ขีดจำกัดสไตล์ต่อรอบ, `minLapMs` ต่อรอบ) อ่านค่านี้ร่วมกันหมด จึงเปลี่ยนตามทั้งระบบ · คะแนน par = `parLapMs × laps` (78 วิ)
- **ghost:** เดิมเก็บรอบที่ดีที่สุด → ตอนนี้ = ทั้งการแข่ง (ทั้งของตัวเองและอันดับ 1 ออนไลน์) ไม่ต้องแก้โค้ด
- **เสียง/เพลง:** "Final lap!" ไม่ถูกเรียกแล้ว (event `finalLap` เกิดเฉพาะ laps > 1 — โหมด QA) ไฟล์ยังอยู่ · event ใหม่ `finalStretch` (`race.ts`) ที่ 75 % ของรอบสุดท้าย → `audio.play('finalStretch')` = `switchToFinal()` สลับ BGM เร็วบนจังหวะห้องถัดไป ไม่มีเสียงพากย์
- **HUD:** ซ่อนตัวนับรอบเมื่อ 1 รอบ (laps > 1 ยังแสดง "รอบ 1/2") · **หน้าสรุป:** ไม่แสดงรายการเวลาแต่ละรอบ · "สถิติใหม่ของคุณ" · "วิ่งไม่ชนเลย" แทน "รอบไม่ชน n" · เพิ่มบรรทัด "ข้ามด่าน n"
- **DB (ตรวจแบบอ่านอย่างเดียว ไม่ได้ลบอะไร):** ตาราง `scores` = 0 แถว, `ghosts` = 0 แถว (preview/prod ใช้ DB เดียวกัน) → ไม่มีแต้ม 2 รอบค้าง · schema ไม่มีฟิลด์จำนวนรอบ (อยู่ใน `result` jsonb) ไม่ต้อง migrate
- `docs/dev/GAMEPLAY.md`: จำนวนรอบ, flow, ตาราง TRACK_RULES, ตัวอย่างคำนวณแต้มใหม่ (1 รอบ 70 วิ = 132,363), หัวข้อข้ามด่าน
- test ที่ผูก 2 รอบ: `api.spec` (เกม `&net=1`) เปลี่ยน `laps=2 → 1` — ไม่งั้นไม่มีตั๋ว `run/start` · test อื่นที่ใส่ `laps=2` ตั้งใจเป็นโหมด QA ใช้ได้ตามเดิม (UI-02 ยังเห็น "รอบ 1/2")
- test FIX-10 (ในเกม): ไม่ใส่ `laps=` → จบหลัง 1 รอบ · HUD ไม่มีตัวนับ · หน้าสรุปไม่มีรายการรอบ · BGM เป็น `race` ถึง 70 % แล้วสลับ `race-final` ที่ **75.1 %** ของรอบ ✅

## #11 — ข้ามด่าน + ghost ผูก track version
**แต้มข้ามด่าน**
- `RunResult.checkpointClears` (นับจาก event `clear` ของ `src/checkpoint` ใน `wireCheckpoint`) · `SCORE.checkpointClear = 300` รวมใน `styleRaw` → อยู่ใต้เพดาน 20 % เดิม · **ไม่มีคอลัมน์ใหม่** (เก็บใน `result` jsonb)
- `parseRun`: ฟิลด์นี้ไม่บังคับ (build เก่าไม่ส่ง = 0) · `validateRun`: ≤ จำนวนด่าน (2) × รอบ และ ≤ จำนวนกระโดด ไม่งั้น `BAD_STYLE`
- **server พิสูจน์จาก ghost** (`api/run/finish.ts`): `ghostCheckpointClears()` นับด่านที่ ghost มีจุด `airborne` ≥ 2 จุดภายใน 14 ม. จากพิกัดด่าน (`SITES` ของ `src/checkpoint/sim.ts` — ไฟล์เดียวกับเกม) → ใช้ `min(ที่ client ส่ง, ที่ ghost พิสูจน์ได้)` · ไม่ส่ง ghost (iOS เก่าบีบอัดไม่ได้) = ไม่ได้แต้มข้ามด่าน แต่สไตล์อื่นยังได้ตามเดิม
**ghost ผูก track version**
- `scripts/track-version.mjs` → `src/net/track-version.ts` = sha256(track-A.json) 32 บิตแรก (ตอนนี้ `35e744af`) · รันอัตโนมัติก่อน `pnpm build` (เขียนไฟล์เฉพาะเมื่อค่าเปลี่ยน)
- ghost format **v2** (`'G2'`, header 14 ไบต์ +u32 track version) · v1 (`'G1'`) ถูกปฏิเสธทั้งหมด — ทุกตัวอัดบนสนามก่อนย้ายเส้นสตาร์ทอยู่แล้ว
- ไม่เล่น ghost ที่เวอร์ชันไม่ตรง: client `decodeGhost()` (ทั้งของตัวเองใน localStorage และอันดับ 1 ออนไลน์) คืน null · server `checkGhost` ตอบ `BAD_GHOST` ถ้าส่ง ghost เวอร์ชันอื่น · `/api/ghost/top` ดู top 20 แล้วส่งตัวแรกที่เวอร์ชันตรง (เดิม `limit 1`)
- test FIX-11: ค่า `TRACK_VERSION` ที่ commit = hash ไฟล์ track ปัจจุบัน (จับกรณีสร้างสนามใหม่แล้วไม่ build) · pack/unpack เก็บเวอร์ชัน · เวอร์ชันอื่น/G1 ไม่ผ่าน · ghost วิ่งบนพื้นผ่านด่าน = 0 · ลอยผ่าน = 1 · ลอยที่อื่น (คู) = 0 ✅
- ⚠️ ข้อควรรู้: ทุกครั้งที่ world pane สร้าง `track-A.json` ใหม่ (แม้แก้เล็กน้อย) ghost เก่าทั้งหมดจะไม่ถูกเล่น — ตั้งใจตามบรีฟ

---

## สถานะ test รวม (build ปัจจุบัน, Chromium + WebKit, เสิร์ฟจาก scratchpad)
- ✅ `fix.spec` ทั้งหมด (FIX-03/04/05/07/09/10/11) · `voice.spec` FIX-01/02 · `mobile.spec` MOB-03 (input) · `physics.spec` FEEL-05, FEEL-10b · `ui.spec` 9/10
- ❌ ที่ยังล้ม **ไม่ได้เกิดจาก fix** — ให้ QA/conductor ดู:
  - `ui.spec` AUD-01/02/05: กดกระโดดหลังออกตัว 4 วิ — ตอนนี้รถอยู่ z≈30 ม. ข้างอนุสาวรีย์ = **เขตลานห้ามกระโดด** (ปุ่ม `locked`) เพราะ commit `a17e0ef` ย้ายเส้นสตาร์ทไปใต้ลานย่าโม → ให้ QA กระโดดหลังพ้นเขต (step ≥ 420) หรือก่อนเข้า (≤ 180)
  - `physics.spec` PHY-04/PHY-05 (สคริปต์จาก `place(820)`): ระยะ s เลื่อนตามเส้นสตาร์ทใหม่ รถไปไม่ถึงคู (ดูหัวข้อ #9)
  - ERR-08 `[object Object]` 404 ที่เห็นตอนรัน MOB-03 รอบแรก ไม่เกิดแล้วในรอบล่าสุด (น่าจะแก้ฝั่ง visuals ไปแล้ว) — ให้ QA ยืนยันตอนรันเต็มชุด
- ⏳ ยังไม่ได้รัน: ชุดเต็ม 86 test, `deploy.spec` (DEP-03 บน preview จริง), `api.spec` บน preview (track `test`)
